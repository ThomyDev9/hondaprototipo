import { useCallback } from "react";
import {
    guardarGestion,
    guardarGestionInbound,
    uploadInboundImages,
} from "../../../services/dashboard.service";

const INBOUND_SPECIAL_FIELDS_META = [
    { name: "__inbound_tipo_cliente", label: "Tipo cliente" },
    { name: "__inbound_tipo_identificacion", label: "Tipo de identificación" },
    { name: "__inbound_tipo_canal", label: "Tipo de canal" },
    { name: "__inbound_relacion", label: "Relacion" },
    { name: "__inbound_nombre_cliente", label: "Nombre Cliente" },
];

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

export default function useAgentGestionSubmit({
    manualFlowActivo,
    dynamicFormConfig,
    dynamicFormAnswers,
    observacion,
    campaignIdSeleccionada,
    categoryIdSeleccionada,
    menuItemIdSeleccionado,
    handle403,
    onChangeAgentPage,
    setRegistro,
    setError,
    registro,
    level1Seleccionado,
    level2Seleccionado,
    interactionIdActual,
    telefonoSeleccionado,
    surveyAnswers,
    surveyFieldsToRender,
    dynamicFormDetail,
    estadoAgente,
    fetchSiguienteRegistro,
    inboundChildOptions,
    inboundInteractionDetails,
    inboundImageDrafts,
}) {
    return useCallback(
        async (event) => {
            event?.preventDefault?.();

            if (manualFlowActivo) {
                try {
                    setError("");

                    const dynamicRows = Array.isArray(dynamicFormConfig?.rows)
                        ? dynamicFormConfig.rows.flat()
                        : [];
                    const fieldsMeta = [
                        ...INBOUND_SPECIAL_FIELDS_META,
                        ...dynamicRows.map((field) => ({
                            name: field?.key || "",
                            label: field?.label || field?.key || "",
                        })),
                    ].filter((field) => field.name);

                    const selectedInboundOption = (inboundChildOptions || []).find(
                        (item) =>
                            String(item?.value || "") ===
                            String(
                                dynamicFormAnswers?.__inbound_nombre_cliente || "",
                            ),
                    );

                    const normalizedInteractionDetails = (
                        inboundInteractionDetails || []
                    )
                        .map((detail, index) => ({
                            orden: index + 1,
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

                    const latestInteractionDetail =
                        normalizedInteractionDetails[
                            normalizedInteractionDetails.length - 1
                        ] || {};

                    const inboundFormData = {
                        ...dynamicFormAnswers,
                        tipoCliente:
                            dynamicFormAnswers?.__inbound_tipo_cliente || "",
                        tipoIdentificacion:
                            dynamicFormAnswers?.__inbound_tipo_identificacion ||
                            "",
                        tipoCanal:
                            dynamicFormAnswers?.__inbound_tipo_canal || "",
                        relacion: dynamicFormAnswers?.__inbound_relacion || "",
                        nombreCliente:
                            String(selectedInboundOption?.campaignId || "").trim() ||
                            dynamicFormAnswers?.__inbound_nombre_cliente ||
                            "",
                        nombreClienteMenuItemId:
                            String(selectedInboundOption?.menuItemId || "").trim() ||
                            dynamicFormAnswers?.__inbound_nombre_cliente ||
                            "",
                        categorizacion:
                            latestInteractionDetail.categorizacion || "",
                        motivoInteraccion: latestInteractionDetail.motivo || "",
                        submotivoInteraccion:
                            latestInteractionDetail.submotivo || "",
                        observaciones:
                            latestInteractionDetail.observaciones ||
                            observacion ||
                            "",
                    };

                    const campaignIdToUse =
                        String(selectedInboundOption?.campaignId || "").trim() ||
                        campaignIdSeleccionada;
                    const menuItemIdToUse =
                        String(selectedInboundOption?.menuItemId || "").trim() ||
                        menuItemIdSeleccionado;
                    const identificationToUse = getFirstFormValueByKeys(
                        inboundFormData,
                        [
                            "identificacion",
                            "Identificacion",
                            "Identificación",
                            "identification",
                            "numeroCedula",
                            "NumeroCedula",
                            "numeroDeCedula",
                            "cedula",
                        ],
                    );

                    if (!campaignIdToUse || !identificationToUse) {
                        setError(
                            "Nombre Cliente e Identificación son requeridos para guardar.",
                        );
                        return;
                    }

                    inboundFormData.identificacion = identificationToUse;

                    const { status, ok, json } = await guardarGestionInbound({
                        campaignId: campaignIdToUse,
                        campaign_id: campaignIdToUse,
                        categoryId: categoryIdSeleccionada,
                        menuItemId: menuItemIdToUse,
                        formData: inboundFormData,
                        fieldsMeta,
                        interactionDetails: normalizedInteractionDetails,
                        surveyPayload: surveyAnswers || {},
                        surveyFieldsMeta: surveyFieldsToRender.map((field) => ({
                            key: String(field?.key || "").trim(),
                            label: String(field?.label || "").trim(),
                        })),
                    });

                    if (status === 403) {
                        handle403(json);
                        return;
                    }

                    if (!ok) {
                        setError(
                            json?.detail ||
                                json?.error ||
                                "No se pudo guardar la gestion inbound",
                        );
                        return;
                    }

                    const imagesToUpload = (inboundImageDrafts || []).filter(
                        (item) => item?.file instanceof File,
                    );

                    if (imagesToUpload.length > 0) {
                        const formData = new FormData();
                        formData.append(
                            "interactionId",
                            String(json?.interactionId || "").trim(),
                        );
                        formData.append(
                            "contactId",
                            String(json?.contactId || "").trim(),
                        );
                        formData.append(
                            "clienteInboundId",
                            String(json?.clienteInboundId || "").trim(),
                        );
                        formData.append(
                            "gestionInboundId",
                            String(json?.gestionInboundId || "").trim(),
                        );
                        formData.append("campaignId", campaignIdToUse);
                        formData.append(
                            "categoryId",
                            String(categoryIdSeleccionada || "").trim(),
                        );
                        formData.append(
                            "menuItemId",
                            String(menuItemIdToUse || "").trim(),
                        );
                        formData.append(
                            "nombreClienteRef",
                            String(
                                inboundFormData?.nombreCliente ||
                                    selectedInboundOption?.label ||
                                    "",
                            ).trim(),
                        );
                        for (const item of imagesToUpload) {
                            formData.append("images", item.file);
                        }

                        const uploadResponse = await uploadInboundImages(formData);

                        if (!uploadResponse.ok) {
                            setError(
                                uploadResponse?.json?.detail ||
                                    uploadResponse?.json?.error ||
                                    "La gestión se guardó, pero falló la carga de imágenes.",
                            );
                            return;
                        }
                    }

                    if (typeof onChangeAgentPage === "function") {
                        onChangeAgentPage("inicio");
                    } else {
                        setRegistro(null);
                    }
                    return;
                } catch (err) {
                    console.error(err);
                    setError("Error de conexion con el servidor");
                    return;
                }
            }

            if (!registro) return;

            try {
                setError("");

                const payload = {
                    registro_id: registro.id,
                    estado_final: level2Seleccionado || level1Seleccionado,
                    level1: level1Seleccionado,
                    level2: level2Seleccionado,
                    campaign_id: registro?.campaign_id || campaignIdSeleccionada,
                    interactionId: interactionIdActual || null,
                    telefono_ad: telefonoSeleccionado || null,
                    comentarios: observacion || null,
                    fecha_agendamiento: surveyAnswers?.respuesta1 || null,
                    encuesta: surveyAnswers,
                    encuestaPreguntas: surveyFieldsToRender.map((field) =>
                        String(field.label || "").trim(),
                    ),
                    encuestaRespuestas: surveyFieldsToRender.map((field) =>
                        String(surveyAnswers?.[field.key] || "").trim(),
                    ),
                    encuestaKeys: surveyFieldsToRender.map((field) =>
                        String(field.key || "").trim(),
                    ),
                    dynamicForm2Payload: dynamicFormDetail || {},
                    dynamicForm3Payload: surveyAnswers || {},
                };

                const { status, ok, json } = await guardarGestion(payload);

                if (status === 403) {
                    handle403(json);
                    return;
                }

                if (!ok) {
                    setError(json?.error || "No se pudo guardar la gestion");
                    return;
                }

                if (estadoAgente === "disponible") {
                    await fetchSiguienteRegistro();
                } else {
                    setRegistro(null);
                }
            } catch (err) {
                console.error(err);
                setError("Error de conexion con el servidor");
            }
        },
        [
            campaignIdSeleccionada,
            categoryIdSeleccionada,
            dynamicFormAnswers,
            dynamicFormConfig,
            dynamicFormDetail,
            estadoAgente,
            fetchSiguienteRegistro,
            handle403,
            inboundChildOptions,
            inboundImageDrafts,
            inboundInteractionDetails,
            interactionIdActual,
            level1Seleccionado,
            level2Seleccionado,
            manualFlowActivo,
            menuItemIdSeleccionado,
            observacion,
            onChangeAgentPage,
            registro,
            setError,
            setRegistro,
            surveyAnswers,
            surveyFieldsToRender,
            telefonoSeleccionado,
        ],
    );
}
