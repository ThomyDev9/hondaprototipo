// Rutas para gestión inbound (nuevo endpoint, no afecta outbound)
import express from "express";

export function registerInboundRoutes(
    router,
    {
        agenteDAO,
        agenteMiddlewares,
        encuestaSchema,
        getAgentActor,
        buildOutboundCampos,
        buildOutboundQuestionPayload,
        saveDynamicResponseIfTemplateActive,
        linkManagementToRecording,
    },
) {
    router.post(
        "/guardar-gestion-inbound",
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
                const existingClient =
                    await agenteDAO.getClienteByIdentificationAndCampaign(
                        identification,
                        campaignLike,
                    );
                const contactId =
                    String(existingClient?.ContactId || "").trim() ||
                    `INB-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
                const now = new Date();
                const startedManagement = now;
                const tmstmp = now;
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
                const interactionId = `INB-${Date.now()}`;
                const importId = String(formData?.Origen || "INBOUND").trim();
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
                        "[agente/guardar-gestion-inbound] no se pudo enlazar grabacion",
                        linkErr?.message || linkErr,
                    );
                }

                return res.json({
                    success: true,
                    contactId,
                    recordingLinked: Boolean(linkedRecording?.recording_path),
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
