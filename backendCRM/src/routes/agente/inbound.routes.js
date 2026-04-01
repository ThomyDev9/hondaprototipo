// Rutas para gestion inbound (nuevo endpoint, aislado de outbound)
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

const inboundImagesBasePath =
    process.env.INBOUND_IMAGES_PATH ||
    path.join(process.cwd(), "storage", "inbound-images");

function sanitizePathSegment(value) {
    return (
        String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\\s_-]/g, "")
            .trim()
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 80) || "sin-cliente"
    );
}

function buildTimestampParts(date = new Date()) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const compact = `${year}${month}${day}-${String(date.getHours()).padStart(
        2,
        "0",
    )}${String(date.getMinutes()).padStart(2, "0")}${String(
        date.getSeconds(),
    ).padStart(2, "0")}`;

    return { year, month, day, compact };
}

const inboundImageUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const clientFolder = sanitizePathSegment(
                req.body?.nombreClienteRef || "sin-cliente",
            );
            const { year, month, day } = buildTimestampParts();
            const destination = path.join(
                inboundImagesBasePath,
                clientFolder,
                year,
                month,
                day,
            );
            fs.mkdirSync(destination, { recursive: true });
            cb(null, destination);
        },
        filename: (req, file, cb) => {
            const actor = sanitizePathSegment(
                req.user?.username || req.user?.email || req.user?.id || "asesor",
            ).toLowerCase();
            const { compact } = buildTimestampParts();
            const ext = path.extname(String(file.originalname || "")).toLowerCase();
            const sequence = String(
                (Number(req.__inboundImageSeq || 0) || 0) + 1,
            ).padStart(2, "0");
            req.__inboundImageSeq = Number(sequence);
            cb(null, `in-${actor}-${compact}-${sequence}${ext || ".png"}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = new Set([
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
        ]);
        if (allowedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
            cb(null, true);
            return;
        }
        cb(new Error("Solo se permiten imágenes PNG, JPG, JPEG o WEBP"));
    },
    limits: {
        fileSize: 3 * 1024 * 1024,
        files: 10,
    },
});

function normalizeLookupKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .trim();
}

function getFirstFormValueByKeys(source = {}, candidateKeys = []) {
    const entries = Object.entries(source || {});

    for (const candidateKey of candidateKeys) {
        const directValue = source?.[candidateKey];
        if (
            directValue !== undefined &&
            directValue !== null &&
            String(directValue).trim() !== ""
        ) {
            return String(directValue).trim();
        }
    }

    const normalizedCandidates = candidateKeys.map(normalizeLookupKey);

    for (const [key, value] of entries) {
        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ""
        ) {
            continue;
        }

        if (normalizedCandidates.includes(normalizeLookupKey(key))) {
            return String(value).trim();
        }
    }

    return "";
}

function buildQuestionAnswerPayload(sections = []) {
    const preguntas = Array.from({ length: 30 }, () => "");
    const respuestas = Array.from({ length: 30 }, () => "");

    const normalizedEntries = [];

    for (const section of sections) {
        const fields = Array.isArray(section?.fields) ? section.fields : [];
        const payload =
            section?.payload && typeof section.payload === "object"
                ? section.payload
                : {};

        for (const field of fields) {
            const key = String(
                field?.name || field?.key || field?.field_key || "",
            ).trim();
            const label = String(field?.label || key).trim();
            if (!key || !label) continue;

            const rawValue = payload?.[key];
            const value =
                rawValue === undefined || rawValue === null
                    ? ""
                    : String(rawValue).trim();

            normalizedEntries.push({ label, value });
        }
    }

    normalizedEntries.slice(0, 30).forEach((entry, index) => {
        preguntas[index] = entry.label;
        respuestas[index] = entry.value;
    });

    return { preguntas, respuestas };
}

export function registerInboundRoutes(
    router,
    {
        agenteDAO,
        agenteMiddlewares,
        encuestaSchema,
        getAgentActor,
        saveDynamicResponseIfTemplateActive,
        linkManagementToRecording,
    },
) {
    router.get(
        "/buscar-cliente-inbound",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const identification = String(
                    req.query?.identification || req.query?.identificacion || "",
                ).trim();
                const campaignId = String(req.query?.campaignId || "").trim();

                if (!identification) {
                    return res.status(400).json({
                        error: "identification es requerido",
                    });
                }

                const clientByCampaign = campaignId
                    ? await agenteDAO.getInboundClientByIdentificationAndCampaign(
                          identification,
                          campaignId,
                      )
                    : null;
                const client =
                    clientByCampaign ||
                    (await agenteDAO.getInboundClientByIdentification(
                        identification,
                    ));

                if (!client) {
                    return res.status(404).json({
                        error: "Cliente inbound no encontrado",
                    });
                }

                return res.json({
                    success: true,
                    data: {
                        id: client.id,
                        contactId: client.contact_id,
                        campaignId: client.campaign_id,
                        menuItemId: client.menu_item_id,
                        identification: client.identification || "",
                        tipoIdentificacion: client.tipo_identificacion || "",
                        fullName: client.full_name || "",
                        city: client.city || "",
                        email: client.email || "",
                        celular: client.celular || "",
                        convencional: client.convencional || "",
                        ticketId: client.ticket_id || "",
                        tipoCliente: client.tipo_cliente || "",
                        relacion: client.relacion || "",
                        tipoCanal: client.tipo_canal || "",
                        nombreClienteRef: client.nombre_cliente_ref || "",
                    },
                });
            } catch (err) {
                console.error("Error en /agente/buscar-cliente-inbound:", err);
                return res.status(500).json({
                    error: "Error buscando cliente inbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.post(
        "/upload-inbound-images",
        ...agenteMiddlewares,
        inboundImageUpload.array("images", 10),
        async (req, res) => {
            try {
                const files = Array.isArray(req.files) ? req.files : [];
                const interactionId = String(req.body?.interactionId || "").trim();
                const contactId = String(req.body?.contactId || "").trim();
                const clienteInboundId = Number(req.body?.clienteInboundId || 0);
                const gestionInboundId = Number(req.body?.gestionInboundId || 0) || null;
                const campaignId = String(req.body?.campaignId || "").trim();
                const categoryId = String(req.body?.categoryId || "").trim();
                const menuItemId = String(req.body?.menuItemId || "").trim();
                const nombreClienteRef = String(
                    req.body?.nombreClienteRef || "",
                ).trim();
                const agenteActor = getAgentActor(req);

                if (!interactionId || !contactId || !clienteInboundId) {
                    return res.status(400).json({
                        error: "interactionId, contactId y clienteInboundId son requeridos",
                    });
                }

                if (files.length === 0) {
                    return res.status(400).json({
                        error: "No se recibieron imágenes",
                    });
                }

                const savedImages = [];
                for (const [index, file] of files.entries()) {
                    const relativePath = path
                        .relative(inboundImagesBasePath, file.path)
                        .replace(/\\/g, "/");
                    const autoLabel = String(file.filename || "")
                        .replace(/\.[^.]+$/, "")
                        .trim();

                    await agenteDAO.insertInboundGestionImagen([
                        gestionInboundId,
                        interactionId,
                        contactId,
                        clienteInboundId,
                        campaignId,
                        categoryId,
                        menuItemId,
                        nombreClienteRef,
                        agenteActor,
                        autoLabel,
                        String(file.originalname || "").trim(),
                        String(file.filename || "").trim(),
                        relativePath,
                        String(file.mimetype || "").trim(),
                        Number(file.size || 0),
                    ]);

                    savedImages.push({
                        originalFilename: file.originalname,
                        storedFilename: file.filename,
                        relativePath,
                        url: `/inbound-images/${relativePath}`,
                        label: autoLabel,
                        size: Number(file.size || 0),
                    });
                }

                return res.json({
                    success: true,
                    count: savedImages.length,
                    files: savedImages,
                });
            } catch (err) {
                console.error("Error en /agente/upload-inbound-images:", err);
                return res.status(500).json({
                    error: "Error subiendo imágenes inbound",
                    detail: err?.message || "",
                });
            }
        },
    );

    router.post(
        "/guardar-gestion-inbound",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const agenteActor = getAgentActor(req);
                const campaignId = String(
                    req.body?.campaignId || req.body?.campaign_id || "",
                ).trim();
                const categoryId = String(req.body?.categoryId || "").trim();
                const menuItemId = String(req.body?.menuItemId || "").trim();
                const formData =
                    req.body?.formData && typeof req.body.formData === "object"
                        ? req.body.formData
                        : {};
                const fieldsMeta = Array.isArray(req.body?.fieldsMeta)
                    ? req.body.fieldsMeta
                    : [];
                const surveyPayload =
                    req.body?.surveyPayload && typeof req.body.surveyPayload === "object"
                        ? req.body.surveyPayload
                        : {};
                const interactionDetails = Array.isArray(
                    req.body?.interactionDetails,
                )
                    ? req.body.interactionDetails
                    : [];
                const surveyFieldsMeta = Array.isArray(req.body?.surveyFieldsMeta)
                    ? req.body.surveyFieldsMeta
                    : [];

                const identification = getFirstFormValueByKeys(formData, [
                    "identificacion",
                    "Identificacion",
                    "Identificación",
                    "identification",
                    "numeroCedula",
                    "NumeroCedula",
                    "numeroDeCedula",
                    "cedula",
                    "IDENTIFICACION",
                ]);

                if (!campaignId || !identification) {
                    return res.status(400).json({
                        error: "campaignId e identificacion son requeridos",
                    });
                }

                const now = new Date();
                const tmstmp = now;
                const startedManagement = now;
                const interactionId = `INB-${Date.now()}-${Math.floor(
                    Math.random() * 100000,
                )}`;
                const payloadJson = null;
                const fieldsMetaJson = null;

                const normalizedInteractionDetails = interactionDetails
                    .map((detail, index) => ({
                        orden: Number(detail?.orden || index + 1),
                        categorizacion: String(
                            detail?.categorizacion || "",
                        ).trim(),
                        motivo: String(detail?.motivo || "").trim(),
                        submotivo: String(detail?.submotivo || "").trim(),
                        observaciones: String(
                            detail?.observaciones || "",
                        ).trim(),
                    }))
                    .filter(
                        (detail) =>
                            detail.categorizacion ||
                            detail.motivo ||
                            detail.submotivo ||
                            detail.observaciones,
                    );
                const fallbackInteractionDetail = {
                    orden: 1,
                    categorizacion: String(formData?.categorizacion || "").trim(),
                    motivo: String(formData?.motivoInteraccion || "").trim(),
                    submotivo: String(
                        formData?.submotivoInteraccion || "",
                    ).trim(),
                    observaciones: String(
                        formData?.observaciones ||
                            formData?.["Observaciones de la interacción"] ||
                            formData?.["Observaciones de la interaccion"] ||
                            "",
                    ).trim(),
                };
                const effectiveInteractionDetails =
                    normalizedInteractionDetails.length > 0
                        ? normalizedInteractionDetails
                        : [fallbackInteractionDetail];

                const latestInteractionDetail =
                    effectiveInteractionDetails[
                        effectiveInteractionDetails.length - 1
                    ] || {};

                const level1ToUse = String(
                    latestInteractionDetail.motivo || "",
                ).trim();
                const level2ToUse = String(
                    latestInteractionDetail.submotivo || "",
                ).trim();
                const observaciones = String(
                    latestInteractionDetail.observaciones || "",
                ).trim();
                const fechaAgendamiento = String(
                    formData?.FechaAgenda || formData?.fechaAgenda || "",
                ).trim();
                const fullName = getFirstFormValueByKeys(formData, [
                    "apellidosNombres",
                    "ApellidosNombres",
                    "apellidosNombre",
                    "nombreCompleto",
                    "nombresApellidos",
                    "NOMBRE_CLIENTE",
                    "NombreCliente",
                ]);
                const celular = getFirstFormValueByKeys(formData, [
                    "celular",
                    "Celular",
                    "telefono",
                    "telefonoCelular",
                    "movil",
                    "CAMPO3",
                ]);
                const city = getFirstFormValueByKeys(formData, [
                    "ciudad",
                    "Ciudad",
                    "CAMPO1",
                ]);
                const email = getFirstFormValueByKeys(formData, [
                    "correoCliente",
                    "correo",
                    "email",
                    "Correo del cliente",
                    "CAMPO2",
                ]);
                const convencional = getFirstFormValueByKeys(formData, [
                    "convencional",
                    "telefonoConvencional",
                    "Convencional",
                    "CAMPO4",
                ]);
                const ticketId = getFirstFormValueByKeys(formData, [
                    "ticketId",
                    "idLlamada",
                    "Id llamada/Nro. Ticket",
                    "CAMPO5",
                ]);
                const tipoCliente = String(
                    formData?.tipoCliente || formData?.__inbound_tipo_cliente || "",
                ).trim();
                const tipoIdentificacion = String(
                    formData?.tipoIdentificacion ||
                        formData?.__inbound_tipo_identificacion ||
                        "",
                ).trim();
                const tipoCanal = String(
                    formData?.tipoCanal || formData?.__inbound_tipo_canal || "",
                ).trim();
                const relacion = String(
                    formData?.relacion || formData?.__inbound_relacion || "",
                ).trim();
                const nombreClienteRef = String(
                    formData?.nombreCliente ||
                        formData?.__inbound_nombre_cliente ||
                        "",
                ).trim();
                const categorizacion = String(
                    latestInteractionDetail.categorizacion ||
                        formData?.categorizacion ||
                        "",
                ).trim();

                const existingClientByCampaign =
                    await agenteDAO.getInboundClientByIdentificationAndCampaign(
                        identification,
                        campaignId,
                    );
                const existingClient =
                    existingClientByCampaign ||
                    (await agenteDAO.getInboundClientByIdentification(
                        identification,
                    ));
                const contactId =
                    String(existingClient?.contact_id || "").trim() ||
                    `INBCL-${globalThis.crypto?.randomUUID?.() || Date.now()}`;

                const clientParams = [
                    contactId,
                    campaignId,
                    categoryId,
                    menuItemId,
                    identification,
                    tipoIdentificacion,
                    fullName,
                    city,
                    email,
                    celular,
                    convencional,
                    ticketId,
                    tipoCliente,
                    relacion,
                    tipoCanal,
                    nombreClienteRef,
                    categorizacion,
                    level1ToUse,
                    level2ToUse,
                    observaciones,
                    payloadJson,
                    agenteActor,
                ];

                let clienteInboundId = Number(existingClient?.id || 0);
                if (!clienteInboundId) {
                    const [insertResult] = await agenteDAO.insertInboundClient(
                        clientParams,
                    );
                    clienteInboundId = Number(insertResult?.insertId || 0);
                } else {
                    await agenteDAO.updateInboundClientById([
                        ...clientParams,
                        clienteInboundId,
                    ]);
                }

                const nextIntentos =
                    (await agenteDAO.countInboundGestionesByContactId(contactId)) + 1;
                const { preguntas, respuestas } = buildQuestionAnswerPayload([
                    { fields: surveyFieldsMeta, payload: surveyPayload },
                ]);

                let gestionInboundId = 0;
                for (const [index, detail] of effectiveInteractionDetails.entries()) {
                    const actionOrder = Number(detail?.orden || index + 1) || index + 1;
                    const detailLevel1 = String(detail?.motivo || "").trim();
                    const detailLevel2 = String(detail?.submotivo || "").trim();
                    const detailObservaciones = String(
                        detail?.observaciones || "",
                    ).trim();
                    const detailCategorizacion = String(
                        detail?.categorizacion || "",
                    ).trim();

                    let detailManagementResultCode = "";
                    if (campaignId && detailLevel1 && detailLevel2) {
                        const codeRow =
                            await agenteDAO.getManagementCodeByLevelsWithoutLevel3(
                                campaignId,
                                detailLevel1,
                                detailLevel2,
                            );
                        detailManagementResultCode = String(
                            codeRow?.code || "",
                        ).trim();
                    }

                    const shouldAttachSurvey = index === 0;
                    const gestionParams = [
                        contactId,
                        clienteInboundId,
                        campaignId,
                        categoryId,
                        menuItemId,
                        interactionId,
                        actionOrder,
                        agenteActor,
                        detailManagementResultCode ||
                            detailLevel2 ||
                            detailLevel1 ||
                            "sin_gestion",
                        detailLevel1,
                        detailLevel2,
                        detailCategorizacion,
                        detailObservaciones,
                        fechaAgendamiento,
                        identification,
                        fullName,
                        celular,
                        tipoCliente,
                        tipoIdentificacion,
                        tipoCanal,
                        relacion,
                        nombreClienteRef,
                        city,
                        email,
                        convencional,
                        ticketId,
                        payloadJson,
                        fieldsMetaJson,
                        ...(shouldAttachSurvey
                            ? preguntas
                            : Array.from({ length: 30 }, () => "")),
                        ...(shouldAttachSurvey
                            ? respuestas
                            : Array.from({ length: 30 }, () => "")),
                        startedManagement,
                        tmstmp,
                        nextIntentos,
                    ];

                    const [gestionInsertResult] =
                        await agenteDAO.insertInboundGestionFinal(gestionParams);

                    if (!gestionInboundId) {
                        gestionInboundId = Number(
                            gestionInsertResult?.insertId || 0,
                        );
                    }
                }

                let form2SaveResult = {
                    saved: false,
                    reason: "empty_form_data",
                };
                let form3SaveResult = {
                    saved: false,
                    reason: "empty_survey_payload",
                };

                if (Object.keys(formData || {}).length > 0) {
                    form2SaveResult = await saveDynamicResponseIfTemplateActive({
                        campaignId,
                        categoryId,
                        menuItemId,
                        formType: "F2",
                        contactId,
                        agentUser: agenteActor,
                        payload: {
                            ...formData,
                            __fieldsMeta: fieldsMeta,
                        },
                    });
                }

                if (Object.keys(surveyPayload || {}).length > 0) {
                    form3SaveResult = await saveDynamicResponseIfTemplateActive({
                        campaignId,
                        categoryId,
                        menuItemId,
                        formType: "F3",
                        contactId,
                        agentUser: agenteActor,
                        payload: {
                            ...surveyPayload,
                            __fieldsMeta: surveyFieldsMeta,
                        },
                    });
                }

                let linkedRecording = null;
                try {
                    linkedRecording = await linkManagementToRecording({
                        schemaName: encuestaSchema,
                        contactId,
                        gestionRowId: contactId,
                        interactionId,
                        campaignId,
                        agent: agenteActor,
                        contactAddress: celular,
                        managementTimestamp: tmstmp,
                    });
                } catch (linkErr) {
                    console.warn(
                        "[agente/guardar-gestion-inbound] no se pudo enlazar grabacion",
                        linkErr?.message || linkErr,
                    );
                }

                return res.json({
                    success: true,
                    contactId,
                    clienteInboundId,
                    gestionInboundId,
                    interactionId,
                    recordingLinked: Boolean(linkedRecording?.recording_path),
                    formResponses: {
                        form2: form2SaveResult,
                        form3: form3SaveResult,
                    },
                });
            } catch (err) {
                console.error("Error en /agente/guardar-gestion-inbound:", err);
                return res.status(500).json({
                    error: "Error guardando gestion inbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );
}
