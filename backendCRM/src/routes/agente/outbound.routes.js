import { formatLocalDateTime } from "../../utils/dateTime.js";

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
                const estadoFinalToUse =
                    level2ToUse || level1ToUse || "sin_gestion";
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
                const campos = buildOutboundCampos(formData);
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

                const payloadJson = JSON.stringify(formData || {});
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
