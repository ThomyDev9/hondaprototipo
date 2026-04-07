import { formatLocalDateTime } from "../../utils/dateTime.js";

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

export function registerRedesRoutes(
    router,
    {
        agenteDAO,
        agenteMiddlewares,
        getAgentActor,
        saveDynamicResponseIfTemplateActive,
    },
) {
    router.get(
        "/buscar-cliente-redes",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const identification = String(
                    req.query?.identification || "",
                ).trim();
                const campaignId = String(req.query?.campaignId || "").trim();

                if (!identification) {
                    return res.status(400).json({
                        error: "identification es requerido",
                    });
                }

                const client =
                    (campaignId
                        ? await agenteDAO.getRedesClientByIdentificationAndCampaign(
                              identification,
                              campaignId,
                          )
                        : null) ||
                    (await agenteDAO.getRedesClientByIdentification(
                        identification,
                    ));

                if (!client) {
                    return res.status(404).json({
                        error: "Cliente de redes no encontrado",
                    });
                }

                return res.json({
                    success: true,
                    data: {
                        id: client.id,
                        contactId: String(client.contact_id || "").trim(),
                        campaignId: String(client.campaign_id || "").trim(),
                        identification: String(client.identification || "").trim(),
                        fullName: String(client.full_name || "").trim(),
                        celular: String(client.celular || "").trim(),
                        tipoCliente: String(client.tipo_cliente || "").trim(),
                        tipoRedSocial: String(client.tipo_red_social || "").trim(),
                        estadoConversacion: String(
                            client.estado_conversacion || "",
                        ).trim(),
                        fechaGestion: String(client.fecha_gestion || "").trim(),
                        nombreClienteRef: String(
                            client.nombre_cliente_ref || "",
                        ).trim(),
                        cantidadMensajes: String(
                            client.cantidad_mensajes || "",
                        ).trim(),
                    },
                });
            } catch (err) {
                console.error("Error en /agente/buscar-cliente-redes:", err);
                return res.status(500).json({
                    error: "Error buscando cliente de redes",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );

    router.post(
        "/guardar-gestion-redes",
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
                    req.body?.surveyPayload &&
                    typeof req.body.surveyPayload === "object"
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
                const interactionId = `RED-${Date.now()}-${Math.floor(
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
                const cantidadMensajes = getFirstFormValueByKeys(formData, [
                    "cantidadMensajes",
                    "cantidad_mensajes",
                    "CantidadMensajes",
                    "cantidad de mensajes",
                    "Cantidad de mensajes",
                    "CAMPO2",
                ]);
                const tipoCliente = String(
                    formData?.tipoCliente ||
                        formData?.__redes_tipo_cliente ||
                        "Asesor",
                ).trim();
                const tipoRedSocial = String(
                    formData?.tipoRedSocial ||
                        formData?.__redes_tipo_red_social ||
                        "",
                ).trim();
                const tipoIdentificacion = String(
                    formData?.tipoIdentificacion || "",
                ).trim();
                const nombreClienteRef = String(
                    formData?.nombreCliente ||
                        formData?.__redes_nombre_cliente ||
                        "",
                ).trim();
                const fechaGestion = String(
                    formData?.fechaGestion ||
                        formData?.__redes_fecha_gestion ||
                        "",
                ).trim();
                const estadoConversacion = String(
                    formData?.estadoConversacion ||
                        formData?.__redes_estado_conversacion ||
                        "",
                ).trim();
                const categorizacion = String(
                    latestInteractionDetail.categorizacion ||
                        formData?.categorizacion ||
                        "",
                ).trim();

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
                    cantidadMensajes,
                    celular,
                    tipoCliente,
                    tipoRedSocial,
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
                    clienteRedesId = Number(insertClientResult?.insertId || 0);
                } else {
                    await agenteDAO.updateRedesClientById([
                        ...clientParams,
                        clienteRedesId,
                    ]);
                }

                let detailManagementResultCode = "";
                if (level1ToUse && level2ToUse) {
                    const codeRow =
                        await agenteDAO.getRedesManagementCodeByLevelsWithoutLevel3(
                            level1ToUse,
                            level2ToUse,
                        );
                    detailManagementResultCode = String(
                        codeRow?.code || "",
                    ).trim();
                }

                const totalGestionesPrevias =
                    await agenteDAO.countRedesGestionesByContactId(contactId);
                const nextIntentos = Number(totalGestionesPrevias || 0) + 1;
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
                    tipoRedSocial,
                    tipoIdentificacion,
                    nombreClienteRef,
                    estadoConversacion,
                    fechaGestion,
                    cantidadMensajes,
                    payloadJson,
                    fieldsMetaJson,
                    startedManagement,
                    tmstmp,
                    nextIntentos,
                ];

                const [insertGestionResult] =
                    await agenteDAO.insertRedesGestionFinal(gestionParams);
                const gestionRedesId = Number(
                    insertGestionResult?.insertId || 0,
                );

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
            } catch (err) {
                console.error("Error en /agente/guardar-gestion-redes:", err);
                return res.status(500).json({
                    error: "Error guardando gestion redes",
                    detail: err?.sqlMessage || err?.message || "",
                });
            }
        },
    );
}

export default registerRedesRoutes;
