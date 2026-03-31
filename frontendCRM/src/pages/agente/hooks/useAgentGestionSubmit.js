import { useCallback } from "react";
import {
    guardarGestion,
    guardarGestionInbound,
} from "../../../services/dashboard.service";

const INBOUND_SPECIAL_FIELDS_META = [
    { name: "__inbound_tipo_cliente", label: "Tipo cliente" },
    { name: "__inbound_tipo_identificacion", label: "Tipo de identificación" },
    { name: "__inbound_tipo_canal", label: "Tipo de canal" },
    { name: "__inbound_relacion", label: "Relacion" },
    { name: "__inbound_nombre_cliente", label: "Nombre Cliente" },
    { name: "__inbound_categorizacion", label: "Categorizacion" },
    { name: "__inbound_motivo", label: "Motivo de la interaccion" },
    { name: "__inbound_submotivo", label: "Submotivo de la interaccion" },
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
                            dynamicFormAnswers?.__inbound_nombre_cliente || "",
                        categorizacion:
                            dynamicFormAnswers?.__inbound_categorizacion || "",
                        motivoInteraccion:
                            dynamicFormAnswers?.__inbound_motivo || "",
                        submotivoInteraccion:
                            dynamicFormAnswers?.__inbound_submotivo || "",
                        observaciones:
                            dynamicFormAnswers?.observaciones ||
                            observacion ||
                            "",
                    };
                    const selectedInboundOption = (inboundChildOptions || []).find(
                        (item) =>
                            String(item?.value || "") ===
                            String(
                                dynamicFormAnswers?.__inbound_nombre_cliente || "",
                            ),
                    );
                    const campaignIdToUse =
                        campaignIdSeleccionada ||
                        String(selectedInboundOption?.campaignId || "").trim();
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
                        menuItemId: menuItemIdSeleccionado,
                        formData: inboundFormData,
                        fieldsMeta,
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
                    campaign_id:
                        registro?.campaign_id || campaignIdSeleccionada,
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
