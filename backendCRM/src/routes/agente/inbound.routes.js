// Rutas para gestion inbound (nuevo endpoint, aislado de outbound)
import express from "express";

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
                const interactionId = `INB-${Date.now()}`;
                const payloadJson = JSON.stringify(formData || {});
                const fieldsMetaJson = JSON.stringify(fieldsMeta || []);

                const level1ToUse = String(
                    formData?.motivoInteraccion || "",
                ).trim();
                const level2ToUse = String(
                    formData?.submotivoInteraccion || "",
                ).trim();
                const observaciones = String(
                    formData?.observaciones ||
                        formData?.["Observaciones de la interacción"] ||
                        formData?.["Observaciones de la interaccion"] ||
                        formData?.CAMPO6 ||
                        "",
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
                    formData?.categorizacion ||
                        formData?.__inbound_categorizacion ||
                        "",
                ).trim();

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
                    `INB-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
                const nextIntentos =
                    Math.max(Number(existingClient?.intentos || 0), 0) + 1;

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

                const gestionFinalRow =
                    await agenteDAO.getInboundGestionFinalByContactId(contactId);
                const gestionParams = [
                    contactId,
                    clienteInboundId,
                    campaignId,
                    categoryId,
                    menuItemId,
                    interactionId,
                    agenteActor,
                    managementResultCode || level2ToUse || level1ToUse || "sin_gestion",
                    level1ToUse,
                    level2ToUse,
                    categorizacion,
                    observaciones,
                    fechaAgendamiento,
                    identification,
                    fullName,
                    celular,
                    tipoCliente,
                    tipoIdentificacion,
                    tipoCanal,
                    relacion,
                    nombreClienteRef,
                    payloadJson,
                    fieldsMetaJson,
                    startedManagement,
                    tmstmp,
                    nextIntentos,
                ];

                if (!gestionFinalRow) {
                    await agenteDAO.insertInboundGestionFinal(gestionParams);
                } else {
                    await agenteDAO.insertInboundGestionHistoricaFromFinal(
                        contactId,
                    );
                    await agenteDAO.updateInboundGestionFinalByContactId([
                        ...gestionParams.slice(1),
                        contactId,
                    ]);
                }

                await saveDynamicResponseIfTemplateActive({
                    campaignId,
                    categoryId,
                    menuItemId,
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



