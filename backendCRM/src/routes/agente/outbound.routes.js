import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { formatLocalDateTime } from "../../utils/dateTime.js";
import pool from "../../services/db.js";

const outMaquitaUploadsDir =
    process.env.ENTREGA_DOCUMENTOS_PATH ||
    path.join(process.cwd(), "entrega_documentos");
const outMaquitaDocumentStatusOptions = new Set(["Completos", "Incompletos"]);

fs.mkdirSync(outMaquitaUploadsDir, { recursive: true });

function normalizeOutMaquitaDocumentStatus(value) {
    const raw = String(value || "").trim();
    const upper = raw.toUpperCase();

    if (upper === "COMPLETO" || upper === "COMPLETOS") {
        return "Completos";
    }
    if (upper === "INCOMPLETO" || upper === "INCOMPLETOS") {
        return "Incompletos";
    }

    return raw;
}

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
        linkManagementToRecording,
    },
) {
    router.get(
        "/out-maquita-external-leads",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const flow = String(req.query?.flow || "")
                    .trim()
                    .toLowerCase();
                const mode = String(req.query?.mode || "gestion")
                    .trim()
                    .toLowerCase();
                const search = String(req.query?.search || "").trim();
                const limit = Math.min(
                    Math.max(Number(req.query?.limit || 300), 1),
                    1000,
                );

                if (!["mail", "rrss"].includes(flow)) {
                    return res.status(400).json({
                        error: "flow debe ser 'mail' o 'rrss'",
                    });
                }

                if (!["gestion", "regestion"].includes(mode)) {
                    return res.status(400).json({
                        error: "mode debe ser 'gestion' o 'regestion'",
                    });
                }

                const where = [
                    "LOWER(el.source_provider) = 'maquita'",
                    "LOWER(el.source_channel) = ?",
                ];
                const params = [flow];

                if (mode === "gestion") {
                    where.push("el.workflow_status IN ('listo_para_promocion', 'promovido')");
                } else if (flow === "mail") {
                    where.push(
                        "LOWER(TRIM(COALESCE(el.external_status, ''))) IN ('volver a llamar', 'grabadora.', 'cuelga llamada.', 'seguimiento.')",
                    );
                } else {
                    where.push(
                        "LOWER(TRIM(COALESCE(el.external_status, ''))) IN ('no contesta', 'volver a llamar', 'seguimiento')",
                    );
                }

                if (search) {
                    where.push(
                        "(el.identification LIKE ? OR el.full_name LIKE ? OR el.celular LIKE ?)",
                    );
                    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
                }

                const [rows] = await pool.query(
                    `
                    SELECT
                        el.id,
                        el.source_channel,
                        el.identification,
                        el.full_name,
                        el.celular,
                        el.external_status,
                        el.external_substatus,
                        el.observacion_externo,
                        el.workflow_status,
                        el.workflow_substatus,
                        el.monto_solicitado,
                        el.proceso_a_realizar,
                        el.monto_aplica,
                        el.observacion_cooperativa,
                        el.fecha_contacto_raw,
                        el.estatus,
                        el.agencia,
                        el.asesor_operativo,
                        el.autoriza_buro,
                        el.city,
                        el.destino_credito,
                        el.ingreso_neto_recibir,
                        el.tipo_relacion_laboral,
                        el.actividad_economica,
                        el.tipo_vivienda,
                        el.mantiene_hijos,
                        el.otros_ingresos,
                        el.producto,
                        el.asesor_externo,
                        el.usuario_maquita,
                        el.seguimiento_kimobill,
                        el.payload_json,
                        el.updated_at
                    FROM external_leads el
                    WHERE ${where.join(" AND ")}
                    ORDER BY el.updated_at DESC, el.id DESC
                    LIMIT ?
                    `,
                    [...params, limit],
                );

                return res.json({
                    success: true,
                    data: rows,
                });
            } catch (err) {
                console.error("Error en /agente/out-maquita-external-leads:", err);
                return res.status(500).json({
                    error: "Error obteniendo leads externos de Out Maquita",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

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
                        sourceChannel: String(
                            row?.ImportId || "",
                        ).toUpperCase().includes("REDES")
                            ? "rrss"
                            : String(row?.ImportId || "")
                                    .toUpperCase()
                                    .includes("MAIL")
                              ? "mail"
                              : "",
                        documentStatus: normalizeOutMaquitaDocumentStatus(
                            row?.CAMPO4,
                        ),
                        motivoInteraccion: String(row?.ResultLevel1 || "").trim(),
                        submotivoInteraccion: String(row?.ResultLevel2 || "").trim(),
                        observaciones: String(row?.Observaciones || "").trim(),
                        creditStatus: String(
                            row?.CAMPO6 ||
                                row?.ClienteCampo6 ||
                                additionalPayload?.estadoCredito ||
                                "",
                        ).trim(),
                        documentComment: String(
                            row?.CAMPO5 ||
                                row?.ClienteCampo5 ||
                                additionalPayload?.documentosComentario ||
                                "",
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

    router.get(
        "/out-maquita-documentos-seguimiento",
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

                const rows = await agenteDAO.listOutMaquitaDocumentTrackingRows(
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
                        sourceChannel: String(
                            row?.ImportId || "",
                        ).toUpperCase().includes("REDES")
                            ? "rrss"
                            : String(row?.ImportId || "")
                                    .toUpperCase()
                                    .includes("MAIL")
                              ? "mail"
                              : "",
                        documentStatus: normalizeOutMaquitaDocumentStatus(
                            row?.CAMPO4,
                        ),
                        motivoInteraccion: String(row?.ResultLevel1 || "").trim(),
                        submotivoInteraccion: String(row?.ResultLevel2 || "").trim(),
                        observaciones: String(row?.Observaciones || "").trim(),
                        documentComment: String(
                            row?.CAMPO5 ||
                                row?.ClienteCampo5 ||
                                additionalPayload?.documentosComentario ||
                                "",
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
                console.error(
                    "Error en /agente/out-maquita-documentos-seguimiento:",
                    err,
                );
                return res.status(500).json({
                    error: "Error listando seguimiento de documentos Out Maquita",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.post(
        "/guardar-out-maquita-documentos-seguimiento",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const agenteActor = getAgentActor(req);
                const campaignId = String(
                    req.body?.campaignId || req.body?.campaign_id || "",
                ).trim();
                const identification = String(
                    req.body?.identification || req.body?.identificacion || "",
                ).trim();
                const motivoInteraccion = String(
                    req.body?.motivoInteraccion || "",
                ).trim();
                const submotivoInteraccion = String(
                    req.body?.submotivoInteraccion || "",
                ).trim();
                const observaciones = String(
                    req.body?.observaciones || "",
                ).trim();

                if (
                    !campaignId ||
                    !identification ||
                    !motivoInteraccion ||
                    !submotivoInteraccion
                ) {
                    return res.status(400).json({
                        error: "campaignId, identification, motivoInteraccion y submotivoInteraccion son requeridos",
                    });
                }

                if (!isOutMaquitaCampaign(campaignId)) {
                    return res.status(400).json({
                        error: "campaignId invalido para Out Maquita",
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

                const payloadJson = JSON.stringify({
                    ...existingDynamicPayload,
                    motivoInteraccion,
                    submotivoInteraccion,
                    observaciones,
                });

                await agenteDAO.updateOutboundClienteFollowupByContactId({
                    contactId,
                    agent: agenteActor,
                    resultLevel1: motivoInteraccion,
                    resultLevel2: submotivoInteraccion,
                    payloadJson,
                });

                await agenteDAO.updateOutboundGestionFinalFollowupByContactId({
                    contactId,
                    agent: agenteActor,
                    resultLevel1: motivoInteraccion,
                    resultLevel2: submotivoInteraccion,
                    observaciones,
                });

                return res.json({
                    success: true,
                    data: {
                        contactId,
                        identification,
                        motivoInteraccion,
                        submotivoInteraccion,
                        observaciones,
                    },
                    message: "Seguimiento documental guardado",
                });
            } catch (err) {
                console.error(
                    "Error en /agente/guardar-out-maquita-documentos-seguimiento:",
                    err,
                );
                return res.status(500).json({
                    error: "Error guardando seguimiento documental de Out Maquita",
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
                    documentComment,
                    payloadJson: JSON.stringify({
                        ...existingDynamicPayload,
                        documentosComentario: documentComment,
                    }),
                });
                await agenteDAO.updateOutboundGestionFinalDocumentMetadataByContactId(
                    {
                        contactId,
                        documentStatus,
                        documentComment,
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

                if (isOutMaquitaCampaign(campaignId)) {
                    const montoAceptado = String(
                        formData?.montoAceptado ||
                            formData?.["Monto aceptado"] ||
                            formData?.["Monto Aceptado"] ||
                            "",
                    ).trim();

                    // Reservamos posicion fija para mantener trazabilidad en reportes.
                    preguntas[18] = "Monto aceptado";
                    respuestas[18] = montoAceptado;
                }

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

                const outMaquitaSheetSync = null;

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

}

export default registerOutboundRoutes;
