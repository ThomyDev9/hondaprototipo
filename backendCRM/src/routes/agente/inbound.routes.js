// Rutas para gestion inbound (nuevo endpoint, aislado de outbound)
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { callCenterPool } from "../../services/db.multi.js";
import { formatLocalDateTime } from "../../utils/dateTime.js";
import {
    appendInboundEmailToSent,
    findInboundAdvisorSignature,
    getInboundEmailLimits,
    getInboundMailFromAddress,
    sendInboundEmail,
} from "../../services/inboundMail.service.js";

const inboundImagesBasePath =
    process.env.INBOUND_IMAGES_PATH ||
    path.join(process.cwd(), "storage", "inbound-images");
const inboundFilesBasePath =
    process.env.INBOUND_FILES_PATH ||
    path.join(process.cwd(), "storage", "inbound-archivos");

function isInboundImageMimeType(mimeType = "") {
    return new Set([
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    ]).has(String(mimeType || "").toLowerCase());
}

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
            const basePath = isInboundImageMimeType(file?.mimetype)
                ? inboundImagesBasePath
                : inboundFilesBasePath;
            const destination = path.join(
                basePath,
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
            cb(null, `in-${actor}-${compact}-${sequence}${ext || ".bin"}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = new Set([
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
        ]);
        if (allowedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
            cb(null, true);
            return;
        }
        cb(
            new Error(
                "Solo se permiten archivos PNG, JPG, JPEG, WEBP, PDF, Word, Excel o TXT",
            ),
        );
    },
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10,
    },
});

const inboundEmailLimits = getInboundEmailLimits();
const inboundEmailAllowedMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "text/plain",
]);

const inboundEmailUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, cb) => {
        const mimeType = String(file.mimetype || "").toLowerCase();
        if (inboundEmailAllowedMimeTypes.has(mimeType)) {
            cb(null, true);
            return;
        }

        cb(
            new Error(
                "Adjunto no permitido. Usa PDF, Word, Excel, TXT o imagen",
            ),
        );
    },
    limits: {
        fileSize: inboundEmailLimits.maxFileSizeBytes,
        files: inboundEmailLimits.maxFiles,
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

function normalizeFlowText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function isRedesFormFlow({
    campaignId = "",
    menuItemId = "",
    categoryId = "",
}) {
    const normalizedCampaignId = normalizeFlowText(campaignId);
    const normalizedMenuItemId = normalizeFlowText(menuItemId);
    const normalizedCategoryId = normalizeFlowText(categoryId);

    return (
        normalizedCampaignId === "gestion redes" ||
        normalizedMenuItemId === "gestion redes" ||
        normalizedCategoryId === "gestion redes"
    );
}

function resolveInboundTicketValue(callRow = {}) {
    const phone = String(callRow?.phone || "").trim();
    const callEntryId = String(callRow?.id_call_entry || "").trim();

    if (phone && callEntryId) {
        return `${callEntryId}_${phone}`;
    }

    return callEntryId;
}

async function findInboundCurrentCallByAgent(agentNumber = "") {
    const normalizedAgentNumber = String(agentNumber || "").trim();
    if (!normalizedAgentNumber) {
        return null;
    }

    const [rows] = await callCenterPool.query(
        `
        SELECT
            a.name,
            a.number,
            cce.id_agent,
            cce.id_call_entry,
            ce.callerid,
            SUBSTRING_INDEX(ce.callerid, '_', -1) AS phone,
            cr.recordingfile
            ,
            qce.queue
        FROM current_call_entry AS cce
        LEFT JOIN agent AS a
          ON a.id = cce.id_agent
        LEFT JOIN call_entry AS ce
          ON ce.id = cce.id_call_entry
        LEFT JOIN call_recording AS cr
          ON cr.id_call_incoming = cce.id_call_entry
        LEFT JOIN queue_call_entry AS qce
          ON qce.id = cce.id_queue_call_entry
        WHERE TRIM(COALESCE(a.number, '')) = TRIM(?)
        ORDER BY cce.id_call_entry DESC
        LIMIT 1
        `,
        [normalizedAgentNumber],
    );

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
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

function buildInboundEmailAttachments(files = []) {
    return files.map((file) => ({
        filename: String(file.originalname || "adjunto").trim(),
        content: file.buffer,
        contentType: String(file.mimetype || "").trim(),
    }));
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
        linkManagementToKnownRecording,
    },
) {
    router.get(
        "/inbound-historico-clientes",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const campaignId = String(req.query?.campaignId || "").trim();

                const rows =
                    await agenteDAO.listInboundHistoricoClientOptions(
                        campaignId,
                    );

                return res.json({
                    success: true,
                    data: rows.map((row) => ({
                        value: String(row?.value || "").trim(),
                        label: String(row?.value || "").trim(),
                    })),
                });
            } catch (err) {
                console.error(
                    "Error en /agente/inbound-historico-clientes:",
                    err,
                );
                return res.status(500).json({
                    error: "Error obteniendo clientes del historico inbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.get(
        "/inbound-historico",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const campaignId = String(req.query?.campaignId || "").trim();
                const advisor = String(req.query?.advisor || "").trim();
                const clientName = String(req.query?.clientName || "").trim();
                const searchText = String(req.query?.searchText || "").trim();
                const startDate = String(req.query?.startDate || "").trim();
                const endDate = String(req.query?.endDate || "").trim();

                const rows = await agenteDAO.listInboundHistoricoRows({
                    campaignId,
                    advisor,
                    clientName,
                    searchText,
                    startDate,
                    endDate,
                });

                return res.json({
                    success: true,
                    data: rows,
                });
            } catch (err) {
                console.error("Error en /agente/inbound-historico:", err);
                return res.status(500).json({
                    error: "Error obteniendo historico inbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

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

    router.get(
        "/inbound-current-call",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const agentNumber = String(
                    req.query?.agentNumber ||
                        req.query?.agent_extension ||
                        req.query?.extension ||
                        "",
                ).trim();

                if (!agentNumber) {
                    return res.status(400).json({
                        error: "agentNumber es requerido para buscar la llamada inbound activa",
                    });
                }

                const currentCall = await findInboundCurrentCallByAgent(
                    agentNumber,
                );

                if (!currentCall) {
                    return res.status(404).json({
                        error: "No se encontro una llamada inbound activa para el agente",
                    });
                }

                return res.json({
                    success: true,
                    data: {
                        agentName: String(currentCall.name || "").trim(),
                        agentNumber: String(currentCall.number || "").trim(),
                        idAgent: Number(currentCall.id_agent || 0),
                        idCallEntry: String(
                            currentCall.id_call_entry || "",
                        ).trim(),
                        ticketId: resolveInboundTicketValue(currentCall),
                        callerId: String(currentCall.callerid || "").trim(),
                        phone: String(currentCall.phone || "").trim(),
                        queue: String(currentCall.queue || "").trim(),
                        recordingfile: String(
                            currentCall.recordingfile || "",
                        ).trim(),
                    },
                });
            } catch (err) {
                console.error("Error en /agente/inbound-current-call:", err);
                return res.status(500).json({
                    error: "Error obteniendo la llamada inbound activa",
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
                        error: "No se recibieron archivos",
                    });
                }

                const savedImages = [];
                for (const [index, file] of files.entries()) {
                    const isImageFile = isInboundImageMimeType(file?.mimetype);
                    const basePath = isImageFile
                        ? inboundImagesBasePath
                        : inboundFilesBasePath;
                    const baseUrl = isImageFile
                        ? "/inbound-images"
                        : "/inbound-archivos";
                    const relativePath = path
                        .relative(basePath, file.path)
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
                        url: `${baseUrl}/${relativePath}`,
                        label: autoLabel,
                        size: Number(file.size || 0),
                        type: isImageFile ? "image" : "file",
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
                    error: "Error subiendo archivos inbound",
                    detail: err?.message || "",
                });
            }
        },
    );

    router.post(
        "/send-inbound-email",
        ...agenteMiddlewares,
        (req, res, next) => {
            inboundEmailUpload.array("attachments", inboundEmailLimits.maxFiles)(
                req,
                res,
                (error) => {
                    if (!error) {
                        next();
                        return;
                    }

                    if (error instanceof multer.MulterError) {
                        return res.status(400).json({
                            error:
                                error.code === "LIMIT_FILE_SIZE"
                                    ? `Cada adjunto puede pesar maximo ${Math.round(
                                          inboundEmailLimits.maxFileSizeBytes /
                                              (1024 * 1024),
                                      )} MB`
                                    : "No se pudieron procesar los adjuntos",
                        });
                    }

                    return res.status(400).json({
                        error: error.message || "Adjunto invalido",
                    });
                },
            );
        },
        async (req, res) => {
            try {
                const to = String(req.body?.to || "").trim();
                const subject = String(req.body?.subject || "").trim();
                const header = String(req.body?.header || "").trim();
                const body = String(req.body?.body || "").trim();
                const footer = String(req.body?.footer || "").trim();
                const files = Array.isArray(req.files) ? req.files : [];
                const signatureAttachment =
                    await findInboundAdvisorSignature(req.user);
                const advisorUsername = String(
                    req.user?.username || "",
                ).trim();

                if (!to || !subject || !body) {
                    return res.status(400).json({
                        error: "to, subject y body son requeridos",
                    });
                }

                if (!signatureAttachment) {
                    return res.status(400).json({
                        error: advisorUsername
                            ? `No se encontro la firma del asesor ${advisorUsername}. Debe existir un archivo con ese mismo username en firmas_asesores.`
                            : "No se encontro la firma del asesor. Debe existir un archivo con el mismo username en firmas_asesores.",
                    });
                }

                const totalSize = files.reduce(
                    (sum, file) => sum + Number(file?.size || 0),
                    0,
                );

                if (totalSize > inboundEmailLimits.maxTotalSizeBytes) {
                    return res.status(400).json({
                        error: `El peso total de adjuntos no puede superar ${Math.round(
                            inboundEmailLimits.maxTotalSizeBytes /
                                (1024 * 1024),
                        )} MB`,
                    });
                }

                const sendResult = await sendInboundEmail({
                    to,
                    subject,
                    header,
                    body,
                    footer,
                    attachments: buildInboundEmailAttachments(files),
                    signatureAttachment,
                });

                let sentMailbox = "";
                let savedToSent = false;
                let saveToSentError = "";

                try {
                    const appendResult = await appendInboundEmailToSent({
                        to,
                        subject,
                        header,
                        body,
                        footer,
                        attachments: buildInboundEmailAttachments(files),
                        signatureAttachment,
                        date: new Date(),
                        messageId: String(sendResult?.messageId || "").trim(),
                    });
                    savedToSent = Boolean(appendResult?.success);
                    sentMailbox = String(appendResult?.mailbox || "").trim();
                } catch (appendError) {
                    saveToSentError = String(
                        appendError?.message || "",
                    ).trim();
                    console.warn(
                        "No se pudo guardar copia del correo en Sent:",
                        appendError,
                    );
                }

                return res.json({
                    success: true,
                    from: getInboundMailFromAddress(),
                    to,
                    messageId: String(sendResult?.messageId || "").trim(),
                    attachmentsSent: files.length,
                    signatureApplied: Boolean(signatureAttachment),
                    savedToSent,
                    sentMailbox,
                    saveToSentError,
                });
            } catch (err) {
                console.error("Error en /agente/send-inbound-email:", err);
                return res.status(500).json({
                    error: "No se pudo enviar el correo inbound",
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
                const tmstmp = formatLocalDateTime(now);
                const startedManagement = formatLocalDateTime(now);
                const interactionId = `INB-${Date.now()}-${Math.floor(
                    Math.random() * 100000,
                )}`;
                const payloadJson = null;
                const fieldsMetaJson = null;
                const isRedesFlow = isRedesFormFlow({
                    campaignId,
                    menuItemId,
                    categoryId,
                    formData,
                });

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
                const inboundRecordingfile = getFirstFormValueByKeys(formData, [
                    "__inbound_current_call_recordingfile",
                    "recordingfile",
                ]);
                const tipoCliente = String(
                    formData?.tipoCliente ||
                        formData?.__inbound_tipo_cliente ||
                        "",
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
                const fechaGestion = String(
                    formData?.fechaGestion || "",
                ).trim();
                const estadoConversacion = String(
                    formData?.estadoConversacion || "",
                ).trim();
                const categorizacion = String(
                    latestInteractionDetail.categorizacion ||
                        formData?.categorizacion ||
                        "",
                ).trim();

                if (isRedesFlow) {
                    const existingClientByCampaign =
                        await agenteDAO.getRedesClientByIdentificationAndCampaign(
                            identification,
                            campaignId,
                        );
                    const existingClient =
                        existingClientByCampaign ||
                        (await agenteDAO.getRedesClientByIdentification(
                            identification,
                        ));
                    const contactId =
                        String(existingClient?.contact_id || "").trim() ||
                        `REDCL-${globalThis.crypto?.randomUUID?.() || Date.now()}`;

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
                        estadoConversacion,
                        fechaGestion,
                        nombreClienteRef,
                        categorizacion,
                        level1ToUse,
                        level2ToUse,
                        observaciones,
                        payloadJson,
                        agenteActor,
                    ];

                    let clienteRedesId = Number(existingClient?.id || 0);
                    if (!clienteRedesId) {
                        const [insertClientResult] =
                            await agenteDAO.insertRedesClient(clientParams);
                        clienteRedesId = Number(
                            insertClientResult?.insertId || 0,
                        );
                    } else {
                        await agenteDAO.updateRedesClientById([
                            ...clientParams,
                            clienteRedesId,
                        ]);
                    }

                    let detailManagementResultCode = "";
                    if (campaignId && level1ToUse && level2ToUse) {
                        const codeRow =
                            await agenteDAO.getManagementCodeByLevelsWithoutLevel3(
                                campaignId,
                                level1ToUse,
                                level2ToUse,
                            );
                        detailManagementResultCode = String(
                            codeRow?.code || "",
                        ).trim();
                    }

                    const existingGestion =
                        await agenteDAO.getRedesGestionByContactId(contactId);
                    const nextIntentos =
                        Number(existingGestion?.intentos || 0) + 1;
                    const { preguntas, respuestas } = buildQuestionAnswerPayload([
                        { fields: surveyFieldsMeta, payload: surveyPayload },
                    ]);

                    const gestionParams = [
                        contactId,
                        clienteRedesId,
                        campaignId,
                        categoryId,
                        menuItemId,
                        interactionId,
                        1,
                        agenteActor,
                        detailManagementResultCode ||
                            level2ToUse ||
                            level1ToUse ||
                            "sin_gestion",
                        level1ToUse,
                        level2ToUse,
                        categorizacion,
                        level1ToUse,
                        level2ToUse,
                        observaciones,
                        identification,
                        fullName,
                        celular,
                        tipoCliente,
                        tipoIdentificacion,
                        nombreClienteRef,
                        estadoConversacion,
                        fechaGestion,
                        city,
                        email,
                        convencional,
                        ticketId,
                        payloadJson,
                        fieldsMetaJson,
                        ...preguntas,
                        ...respuestas,
                        startedManagement,
                        tmstmp,
                        nextIntentos,
                    ];

                    let gestionRedesId = Number(existingGestion?.id || 0);

                    if (!gestionRedesId) {
                        const [insertGestionResult] =
                            await agenteDAO.insertRedesGestionFinal(
                                gestionParams,
                            );
                        gestionRedesId = Number(
                            insertGestionResult?.insertId || 0,
                        );
                    } else {
                        await agenteDAO.insertRedesGestionHistoricaFromFinal(
                            contactId,
                        );
                        await agenteDAO.updateRedesGestionFinalByContactId([
                            clienteRedesId,
                            campaignId,
                            categoryId,
                            menuItemId,
                            interactionId,
                            agenteActor,
                            detailManagementResultCode ||
                                level2ToUse ||
                                level1ToUse ||
                                "sin_gestion",
                            level1ToUse,
                            level2ToUse,
                            categorizacion,
                            level1ToUse,
                            level2ToUse,
                            observaciones,
                            identification,
                            fullName,
                            celular,
                            tipoCliente,
                            tipoIdentificacion,
                            nombreClienteRef,
                            estadoConversacion,
                            fechaGestion,
                            city,
                            email,
                            convencional,
                            ticketId,
                            payloadJson,
                            fieldsMetaJson,
                            ...preguntas,
                            ...respuestas,
                            startedManagement,
                            tmstmp,
                            nextIntentos,
                            contactId,
                        ]);
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
                        form2SaveResult =
                            await saveDynamicResponseIfTemplateActive({
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
                        form3SaveResult =
                            await saveDynamicResponseIfTemplateActive({
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

                    return res.json({
                        success: true,
                        flowType: "redes",
                        contactId,
                        clienteRedesId,
                        gestionRedesId,
                        interactionId,
                        formResponses: {
                            form2: form2SaveResult,
                            form3: form3SaveResult,
                        },
                    });
                }

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
                    if (inboundRecordingfile) {
                        linkedRecording = await linkManagementToKnownRecording({
                            schemaName: encuestaSchema,
                            contactId,
                            gestionRowId: contactId,
                            interactionId,
                            campaignId,
                            agent: agenteActor,
                            contactAddress: celular,
                            managementTimestamp: tmstmp,
                            recordingfile: inboundRecordingfile,
                        });
                    } else {
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
                    }
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
