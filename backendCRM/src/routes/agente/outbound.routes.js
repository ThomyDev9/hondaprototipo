import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { formatLocalDateTime } from "../../utils/dateTime.js";

const outMaquitaUploadsDir =
    process.env.ENTREGA_DOCUMENTOS_PATH ||
    path.join(process.cwd(), "entrega_documentos");
const outMaquitaDocumentStatusOptions = new Set(["Completos", "Incompletos"]);

fs.mkdirSync(outMaquitaUploadsDir, { recursive: true });

function sanitizeFileSegment(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .trim();
}

function buildOutMaquitaDocumentFileName(identification = "") {
    const safeIdentification = sanitizeFileSegment(identification);
    return `${safeIdentification}_out_maquita_documentos.pdf`;
}

function resolveOutMaquitaDocumentFileName(identification = "") {
    const safeIdentification = sanitizeFileSegment(identification);
    if (!safeIdentification) return null;

    const preferredFile = buildOutMaquitaDocumentFileName(safeIdentification);
    const preferredPath = path.join(outMaquitaUploadsDir, preferredFile);

    if (fs.existsSync(preferredPath)) {
        return preferredFile;
    }

    const files = fs.readdirSync(outMaquitaUploadsDir);
    return (
        files.find((fileName) => {
            const normalized = String(fileName || "").toLowerCase();
            return (
                normalized.endsWith(".pdf") &&
                normalized.startsWith(safeIdentification.toLowerCase())
            );
        }) || null
    );
}

const outMaquitaDocumentUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, cb) => {
        const mimeType = String(file?.mimetype || "").toLowerCase();
        const ext = path.extname(String(file?.originalname || "")).toLowerCase();

        if (mimeType === "application/pdf" || ext === ".pdf") {
            cb(null, true);
            return;
        }

        cb(new Error("Solo se permite subir archivos PDF"));
    },
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
    },
});

export function registerOutboundRoutes(
    router,
    {
        agenteDAO,
        agenteMiddlewares,
        encuestaSchema,
        getAgentActor,
        buildOutboundCampos,
        buildOutboundQuestionPayload,
        saveDynamicResponseIfTemplateActive,
        isOutMaquitaCampaign,
        syncOutMaquitaSheet,
        appendOutMaquitaRrssDriveData,
        linkManagementToRecording,
    },
) {
    router.get(
        "/out-maquita-documentos",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const campaignId = String(req.query?.campaignId || "").trim();

                if (!campaignId) {
                    return res.status(400).json({
                        error: "campaignId es requerido",
                    });
                }

                if (!isOutMaquitaCampaign(campaignId)) {
                    return res.status(400).json({
                        error: "campaignId invalido para Out Maquita",
                    });
                }

                const rows = await agenteDAO.listOutMaquitaDocumentRows(
                    `${campaignId}%`,
                );
                const latestByIdentification = new Map();

                for (const row of rows) {
                    const identification = String(
                        row?.IDENTIFICACION || "",
                    ).trim();

                    if (!identification || latestByIdentification.has(identification)) {
                        continue;
                    }

                    const fileName = resolveOutMaquitaDocumentFileName(
                        identification,
                    );
                    let additionalPayload = {};

                    try {
                        additionalPayload = row?.ClienteCamposAdicionalesJson
                            ? JSON.parse(row.ClienteCamposAdicionalesJson)
                            : {};
                    } catch {
                        additionalPayload = {};
                    }

                    latestByIdentification.set(identification, {
                        contactId: String(row?.ContactId || "").trim(),
                        campaignId: String(row?.CampaignId || "").trim(),
                        identification,
                        fullName: String(
                            row?.NOMBRE_CLIENTE || row?.ContactName || "",
                        ).trim(),
                        celular: String(row?.ContactAddress || "").trim(),
                        entregaDocumentos: String(row?.CAMPO2 || "").trim(),
                        agenciaAsistir: String(row?.CAMPO3 || "").trim(),
                        documentStatus: String(row?.CAMPO4 || "").trim(),
                        motivoInteraccion: String(row?.ResultLevel1 || "").trim(),
                        submotivoInteraccion: String(row?.ResultLevel2 || "").trim(),
                        observaciones: String(row?.Observaciones || "").trim(),
                        documentComment: String(
                            additionalPayload?.documentosComentario || "",
                        ).trim(),
                        updatedAt: row?.TmStmp || null,
                        pdfFileName: fileName,
                        pdfUrl: fileName
                            ? `/entrega_documentos/${fileName}`
                            : null,
                    });
                }

                return res.json({
                    success: true,
                    data: Array.from(latestByIdentification.values()),
                });
            } catch (err) {
                console.error("Error en /agente/out-maquita-documentos:", err);
                return res.status(500).json({
                    error: "Error listando documentos de Out Maquita",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.post(
        "/guardar-out-maquita-documentos",
        ...agenteMiddlewares,
        (req, res, next) => {
            outMaquitaDocumentUpload.single("document")(req, res, (error) => {
                if (!error) {
                    next();
                    return;
                }

                if (error instanceof multer.MulterError) {
                    return res.status(400).json({
                        error: "No se pudo cargar el PDF",
                        detail: error.message,
                    });
                }

                return res.status(400).json({
                    error: "Archivo invalido",
                    detail: error?.message || "Solo se permite PDF",
                });
            });
        },
        async (req, res) => {
            try {
                const campaignId = String(
                    req.body?.campaignId || req.body?.campaign_id || "",
                ).trim();
                const identification = String(
                    req.body?.identification || req.body?.identificacion || "",
                ).trim();
                const documentStatus = String(
                    req.body?.documentStatus || req.body?.estadoDocumentos || "",
                ).trim();
                const documentComment = String(
                    req.body?.documentComment || req.body?.comentarioDocumentos || "",
                ).trim();

                if (!campaignId || !identification || !documentStatus) {
                    return res.status(400).json({
                        error: "campaignId, identification y documentStatus son requeridos",
                    });
                }

                if (!isOutMaquitaCampaign(campaignId)) {
                    return res.status(400).json({
                        error: "campaignId invalido para Out Maquita",
                    });
                }

                if (!outMaquitaDocumentStatusOptions.has(documentStatus)) {
                    return res.status(400).json({
                        error: "Estado documental invalido",
                    });
                }

                const existingClient =
                    await agenteDAO.getClienteByIdentificationAndCampaign(
                        identification,
                        `${campaignId}%`,
                    );

                if (!existingClient) {
                    return res.status(404).json({
                        error: "No se encontro el registro de Out Maquita",
                    });
                }

                const contactId = String(
                    existingClient?.ContactId || "",
                ).trim();

                if (!contactId) {
                    return res.status(400).json({
                        error: "El registro no tiene ContactId valido",
                    });
                }

                let existingDynamicPayload = {};
                try {
                    existingDynamicPayload = existingClient?.CamposAdicionalesJson
                        ? JSON.parse(existingClient.CamposAdicionalesJson)
                        : {};
                } catch {
                    existingDynamicPayload = {};
                }

                const currentDocumentStatus = String(
                    existingClient?.CAMPO4 || "",
                ).trim();

                if (
                    currentDocumentStatus === "Completos" &&
                    documentStatus === "Incompletos"
                ) {
                    return res.status(400).json({
                        error: "El registro ya fue marcado como Completos y no puede volver a Incompletos",
                    });
                }

                let fileName = resolveOutMaquitaDocumentFileName(identification);

                if (req.file?.buffer) {
                    fileName = buildOutMaquitaDocumentFileName(identification);
                    fs.writeFileSync(
                        path.join(outMaquitaUploadsDir, fileName),
                        req.file.buffer,
                    );
                }

                await agenteDAO.updateOutboundClienteDocumentMetadataByContactId({
                    contactId,
                    documentStatus,
                    payloadJson: JSON.stringify({
                        ...existingDynamicPayload,
                        documentosComentario: documentComment,
                    }),
                });
                await agenteDAO.updateOutboundGestionFinalDocumentMetadataByContactId(
                    {
                        contactId,
                        documentStatus,
                    },
                );

                return res.json({
                    success: true,
                    data: {
                        contactId,
                        identification,
                        documentStatus,
                        documentComment,
                        pdfFileName: fileName,
                        pdfUrl: fileName
                            ? `/entrega_documentos/${fileName}`
                            : null,
                    },
                    message: "Documentos de Out Maquita guardados",
                });
            } catch (err) {
                console.error(
                    "Error en /agente/guardar-out-maquita-documentos:",
                    err,
                );
                return res.status(500).json({
                    error: "Error guardando documentos de Out Maquita",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.get(
        "/buscar-gestion-outbound",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const campaignId = String(req.query?.campaignId || "").trim();
                const identification = String(
                    req.query?.identification || req.query?.identificacion || "",
                ).trim();

                if (!campaignId || !identification) {
                    return res.status(400).json({
                        error: "campaignId e identification son requeridos",
                    });
                }

                const campaignLike = `${campaignId}%`;
                const row = await agenteDAO.getClienteByIdentificationAndCampaign(
                    identification,
                    campaignLike,
                );
                if (!row) {
                    return res
                        .status(404)
                        .json({ error: "Gestion no encontrada" });
                }

                let dynamicPayload = {};
                try {
                    dynamicPayload = row.CamposAdicionalesJson
                        ? JSON.parse(row.CamposAdicionalesJson)
                        : {};
                } catch {
                    dynamicPayload = {};
                }

                return res.json({
                    success: true,
                    data: {
                        ...dynamicPayload,
                        identificacion:
                            dynamicPayload.identificacion ||
                            dynamicPayload.Identificacion ||
                            row.IDENTIFICACION ||
                            "",
                        apellidosNombres:
                            dynamicPayload.apellidosNombres ||
                            dynamicPayload.NombreCliente ||
                            row.NOMBRE_CLIENTE ||
                            row.ContactName ||
                            "",
                        celular:
                            dynamicPayload.celular ||
                            dynamicPayload.Celular ||
                            row.ContactAddress ||
                            "",
                        tipoCampana:
                            dynamicPayload.tipoCampana ||
                            dynamicPayload.TipoCampania ||
                            row.CAMPO1 ||
                            "",
                        motivoInteraccion:
                            dynamicPayload.motivoInteraccion ||
                            dynamicPayload.MotivoLlamada ||
                            row.ResultLevel1 ||
                            "",
                        submotivoInteraccion:
                            dynamicPayload.submotivoInteraccion ||
                            dynamicPayload.SubmotivoLlamada ||
                            row.ResultLevel2 ||
                            "",
                        observaciones:
                            dynamicPayload.observaciones ||
                            dynamicPayload.Observaciones ||
                            row.Observaciones ||
                            "",
                    },
                });
            } catch (err) {
                console.error("Error en /agente/buscar-gestion-outbound:", err);
                return res.status(500).json({
                    error: "Error buscando gestion outbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.get(
        "/buscar-cliente-outbound",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const campaignId = String(req.query?.campaignId || "").trim();
                const identification = String(
                    req.query?.identification || req.query?.identificacion || "",
                ).trim();

                if (!identification) {
                    return res.status(400).json({
                        error: "identification es requerido",
                    });
                }

                const campaignLike = campaignId ? `${campaignId}%` : "";
                const rowByCampaign = campaignId
                    ? await agenteDAO.getClienteByIdentificationAndCampaign(
                          identification,
                          campaignLike,
                      )
                    : null;
                const rowByIdOrIdentification =
                    await agenteDAO.getOutboundClientBaseByIdOrIdentification(
                        identification,
                    );
                const rowByIdentification =
                    await agenteDAO.getClienteByIdentification(identification);
                const resolvedRow =
                    rowByCampaign || rowByIdOrIdentification || rowByIdentification;

                if (!resolvedRow) {
                    return res.status(404).json({
                        error: "Cliente outbound no encontrado",
                    });
                }

                let dynamicPayload = {};
                try {
                    dynamicPayload = resolvedRow.CamposAdicionalesJson
                        ? JSON.parse(resolvedRow.CamposAdicionalesJson)
                        : {};
                } catch {
                    dynamicPayload = {};
                }

                return res.json({
                    success: true,
                    data: {
                        identificacion:
                            dynamicPayload.identificacion ||
                            dynamicPayload.Identificacion ||
                            resolvedRow.IDENTIFICACION ||
                            "",
                        apellidosNombres:
                            dynamicPayload.apellidosNombres ||
                            dynamicPayload.NombreCliente ||
                            resolvedRow.NOMBRE_CLIENTE ||
                            resolvedRow.ContactName ||
                            "",
                        celular:
                            dynamicPayload.celular ||
                            dynamicPayload.Celular ||
                            resolvedRow.ContactAddress ||
                            "",
                    },
                });
            } catch (err) {
                console.error("Error en /agente/buscar-cliente-outbound:", err);
                return res.status(500).json({
                    error: "Error buscando cliente outbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.post(
        "/guardar-gestion-outbound",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const agenteActor = getAgentActor(req);
                const campaignId = String(
                    req.body?.campaignId || req.body?.campaign_id || "",
                ).trim();
                const formData =
                    req.body?.formData && typeof req.body.formData === "object"
                        ? req.body.formData
                        : {};
                const fieldsMeta = Array.isArray(req.body?.fieldsMeta)
                    ? req.body.fieldsMeta
                    : [];
                const identification = String(
                    formData?.identificacion ||
                        formData?.Identificacion ||
                        formData?.identification ||
                        formData?.["Identificación"] ||
                        formData?.["IdentificaciÃ³n"] ||
                        formData?.["Número de Cedula"] ||
                        formData?.["Numero de Cedula"] ||
                        "",
                ).trim();

                if (!campaignId || !identification) {
                    return res.status(400).json({
                        error: "campaignId e identificacion son requeridos",
                    });
                }

                const campaignLike = `${campaignId}%`;
                const existingClientByCampaign =
                    await agenteDAO.getClienteByIdentificationAndCampaign(
                        identification,
                        campaignLike,
                    );
                const existingClientBase =
                    await agenteDAO.getOutboundClientBaseByIdOrIdentification(
                        identification,
                    );
                const existingClient =
                    existingClientByCampaign ||
                    existingClientBase ||
                    (await agenteDAO.getClienteByIdentification(
                        identification,
                    ));
                let existingDynamicPayload = {};
                try {
                    existingDynamicPayload = existingClient?.CamposAdicionalesJson
                        ? JSON.parse(existingClient.CamposAdicionalesJson)
                        : {};
                } catch {
                    existingDynamicPayload = {};
                }
                const contactId =
                    String(
                        existingClient?.ContactId ||
                            existingClient?.contact_id ||
                            "",
                    ).trim() ||
                    `OUT-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
                const now = new Date();
                const startedManagement = formatLocalDateTime(now);
                const tmstmp = formatLocalDateTime(now);
                const level1ToUse = String(
                    formData?.motivoInteraccion || "",
                ).trim();
                const level2ToUse = String(
                    formData?.submotivoInteraccion || "",
                ).trim();

                if (!level1ToUse || !level2ToUse) {
                    return res.status(400).json({
                        error: "motivoInteraccion y submotivoInteraccion son obligatorios",
                    });
                }

                const estadoFinalToUse = level2ToUse || level1ToUse;
                const contactName = String(
                    formData?.apellidosNombres || formData?.NombreCliente || "",
                ).trim();
                const contactAddress = String(formData?.celular || "").trim();
                const interactionId = `OUT-${Date.now()}`;
                const importId = String(
                    formData?.Origen ||
                        (isOutMaquitaCampaign(campaignId)
                            ? formData?.outboundFlow === "rrss"
                                ? "OUTBOUND REDES"
                                : "OUTBOUND MAIL"
                            : "OUTBOUND"),
                ).trim();
                const observaciones = String(
                    formData?.observaciones || "",
                ).trim();
                const fechaAgendamiento = String(
                    formData?.FechaAgenda || "",
                ).trim();
                const campos = buildOutboundCampos(formData, campaignId);
                const questionEntries = fieldsMeta.map((field) => ({
                    label: field?.label || field?.name || "",
                    value: formData?.[field?.name] ?? "",
                }));
                const { preguntas, respuestas } =
                    buildOutboundQuestionPayload(questionEntries);

                let managementResultCode = "";
                if (campaignId && level1ToUse && level2ToUse) {
                    const codeRow =
                        await agenteDAO.getManagementCodeByLevelsWithoutLevel3(
                            campaignId,
                            level1ToUse,
                            level2ToUse,
                        );
                    managementResultCode = String(codeRow?.code || "").trim();
                }

                const payloadJson = JSON.stringify({
                    ...existingDynamicPayload,
                    ...(formData || {}),
                });
                const nextIntentos =
                    Math.max(Number(existingClient?.Intentos || 0), 0) + 1;

                if (!existingClient) {
                    await agenteDAO.insertOutboundCliente([
                        "CCK",
                        campaignId,
                        contactId,
                        contactName,
                        contactAddress,
                        interactionId,
                        importId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        "",
                        managementResultCode || estadoFinalToUse,
                        "",
                        tmstmp,
                        nextIntentos,
                        identification,
                        campaignId,
                        campaignId,
                        identification,
                        contactName,
                        ...campos,
                        payloadJson,
                        agenteActor,
                        "Gestionado",
                    ]);
                } else {
                    await agenteDAO.updateOutboundCliente([
                        contactId,
                        contactName,
                        contactAddress,
                        interactionId,
                        importId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        managementResultCode || estadoFinalToUse,
                        tmstmp,
                        contactName,
                        ...campos,
                        payloadJson,
                        agenteActor,
                        contactId,
                        identification,
                        campaignLike,
                    ]);
                }

                const gestionFinalRows =
                    await agenteDAO.getGestionFinalByContactId(contactId);

                if (gestionFinalRows.length === 0) {
                    await agenteDAO.insertGestionFinalFromCliente([
                        contactId,
                        contactAddress,
                        interactionId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        "",
                        managementResultCode || estadoFinalToUse,
                        startedManagement,
                        tmstmp,
                        nextIntentos,
                        fechaAgendamiento,
                        contactAddress,
                        observaciones,
                        identification,
                        ...preguntas,
                        ...respuestas,
                        contactId,
                        contactId,
                    ]);
                } else {
                    await agenteDAO.updateGestionFinalByContactId([
                        contactAddress,
                        interactionId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        "",
                        managementResultCode || estadoFinalToUse,
                        startedManagement,
                        tmstmp,
                        nextIntentos,
                        fechaAgendamiento,
                        contactAddress,
                        observaciones,
                        ...preguntas,
                        ...respuestas,
                        contactId,
                    ]);

                    await agenteDAO.updateOutboundGestionFinalMetadata([
                        contactName,
                        campaignId,
                        importId,
                        identification,
                        contactName,
                        ...campos,
                        contactId,
                    ]);

                    await agenteDAO.insertGestionHistoricaFromGestionFinal(
                        contactId,
                    );
                }

                await saveDynamicResponseIfTemplateActive({
                    campaignId,
                    formType: "F3",
                    contactId,
                    agentUser: agenteActor,
                    payload: formData,
                });

                let linkedRecording = null;
                try {
                    linkedRecording = await linkManagementToRecording({
                        schemaName: encuestaSchema,
                        contactId,
                        gestionRowId: contactId,
                        interactionId,
                        campaignId,
                        agent: agenteActor,
                        contactAddress,
                        managementTimestamp: tmstmp,
                    });
                } catch (linkErr) {
                    console.warn(
                        "[agente/guardar-gestion-outbound] no se pudo enlazar grabacion",
                        linkErr?.message || linkErr,
                    );
                }

                let outMaquitaSheetSync = null;
                if (isOutMaquitaCampaign(campaignId)) {
                    try {
                        outMaquitaSheetSync = await syncOutMaquitaSheet(
                            formData,
                            agenteActor,
                        );
                    } catch (sheetError) {
                        const outMaquitaFlow =
                            String(
                                formData?.outboundFlow || formData?.flow || "",
                            )
                                .trim()
                                .toLowerCase() === "rrss"
                                ? "rrss"
                                : "mail";
                        const syncTarget =
                            outMaquitaFlow === "rrss"
                                ? "estado RRSS en Google Sheets"
                                : "gestion Mail en Google Sheets";

                        console.error(
                            "Error sincronizando Out Maquita con Google Sheets:",
                            sheetError,
                        );
                        return res.status(500).json({
                            error: `Gestion guardada en BD pero fallo la sincronizacion de ${syncTarget}`,
                            detail:
                                sheetError?.message ||
                                "No se pudo actualizar Google Sheets",
                            syncTarget,
                        });
                    }
                }

                return res.json({
                    success: true,
                    contactId,
                    outMaquitaSheetSync,
                    recordingLinked: Boolean(linkedRecording?.recording_path),
                    recordingfile: linkedRecording?.recording_path || null,
                    message: "Gestion outbound guardada",
                });
            } catch (err) {
                console.error(
                    "Error en /agente/guardar-gestion-outbound:",
                    err,
                );
                return res.status(500).json({
                    error: "Error guardando gestion outbound",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.post(
        "/guardar-out-maquita-rrss-drive",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const agenteActor = getAgentActor(req);
                const campaignId = String(
                    req.body?.campaignId || req.body?.campaign_id || "",
                ).trim();
                const formData =
                    req.body?.formData && typeof req.body.formData === "object"
                        ? req.body.formData
                        : {};

                if (!isOutMaquitaCampaign(campaignId)) {
                    return res.status(400).json({
                        error: "campaignId invalido para Out Maquita RRSS",
                    });
                }

                const driveSync = await appendOutMaquitaRrssDriveData(
                    formData,
                    agenteActor,
                );

                return res.json({
                    success: true,
                    driveSync,
                    message: "Datos RRSS enviados al Drive",
                });
            } catch (err) {
                console.error(
                    "Error en /agente/guardar-out-maquita-rrss-drive:",
                    err,
                );
                return res.status(500).json({
                    error: "Error enviando datos RRSS al Drive",
                    detail: err?.message || "",
                });
            }
        },
    );
}

export default registerOutboundRoutes;
