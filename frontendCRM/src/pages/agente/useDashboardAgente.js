import { useCallback, useEffect, useState } from "react";
import { esGestionOutbound } from "../../utils/gestionOutbound";
import {
    buildInitialSurveyAnswers,
    findOptionIgnoreCase,
} from "./dashboardAgente.helpers";
import useBaseCards from "./hooks/useBaseCards";
import usePhoneManagement from "./hooks/usePhoneManagement";
import useRegistroQueue from "./hooks/useRegistroQueue";
import {
    guardarGestion,
    guardarGestionInbound,
} from "../../services/dashboard.service";

const INBOUND_SPECIAL_FIELDS_META = [
    { name: "__inbound_tipo_cliente", label: "Tipo cliente" },
    { name: "__inbound_tipo_canal", label: "Tipo de canal" },
    { name: "__inbound_relacion", label: "Relacion" },
    { name: "__inbound_nombre_cliente", label: "Nombre Cliente" },
    { name: "__inbound_categorizacion", label: "Categorizacion" },
    { name: "__inbound_motivo", label: "Motivo de la interaccion" },
    { name: "__inbound_submotivo", label: "Submotivo de la interaccion" },
];

export default function useDashboardAgenteState({
    user,
    selectedCampaignId,
    selectedCampaignTick,
    selectedMenuItemId,
    selectedCategoryId,
    selectedManualFlow,
    requestedAgentStatus,
    onAgentStatusSync,
    agentPage,
    onChangeAgentPage,
    selectedImportId,
}) {
    const roles = user?.roles || [];
    const isAgente = roles.includes("ASESOR");

    const [error, setError] = useState("");
    const [bloqueado, setBloqueado] = useState(
        user?.bloqueado === true || user?.is_active === false,
    );

    const {
        activeBaseCards,
        regestionBaseCards,
        loadingActiveBaseCards,
        loadingRegestionBaseCards,
        refreshBases,
    } = useBaseCards();

    const handle403 = useCallback((json) => {
        const msg = (json?.error || "Permiso denegado").toLowerCase();
        if (msg.includes("bloqueado")) {
            setBloqueado(true);
        }
        setError(json?.error || "Permiso denegado");
    }, []);

    const {
        registro,
        setRegistro,
        loadingRegistro,
        campaignIdSeleccionada,
        levels,
        level1Seleccionado,
        level2Seleccionado,
        setLevel1Seleccionado: setLevel1SeleccionadoBase,
        setLevel2Seleccionado,
        telefonos,
        estadoTelefonos,
        dynamicFormConfig,
        dynamicFormDetail,
        dynamicFormAnswers,
        setDynamicFormAnswers,
        dynamicSurveyConfig,
        surveyAnswers,
        observacion,
        setObservacion,
        manualFlowActivo,
        menuItemIdSeleccionado,
        categoryIdSeleccionada,
        inboundChildOptions,
        hasCampaignSelection,
        estadoAgente,
        handleCambioEstadoAgente,
        handleInboundChildSelection,
        fetchSiguienteRegistro,
        selectBaseCard,
        releaseRegistroIfPresent,
        setSurveyAnswers,
    } = useRegistroQueue({
        selectedCampaignId,
        selectedCampaignTick,
        selectedImportId,
        selectedMenuItemId,
        selectedCategoryId,
        selectedManualFlow,
        agentPage,
        bloqueado,
        handle403,
        setError,
        onChangeAgentPage,
        onAgentStatusSync,
    });

    const {
        telefonoSeleccionado,
        estadoTelefonoSeleccionado,
        interactionIdActual,
        handleTelefonoChange,
        handleEstadoTelefonoChange,
        resetPhoneSelection,
        setEstadoTelefonoSeleccionado,
    } = usePhoneManagement({
        registro,
        handle403,
        setError,
    });

    const surveyFieldsToRender = dynamicSurveyConfig?.fields || [];

    const handleLevel1SelectionChange = useCallback(
        (value) => {
            const normalizedLevel1 = String(value || "").trim().toUpperCase();
            const shouldClearSurvey =
                normalizedLevel1.startsWith("NU1") ||
                normalizedLevel1.startsWith("NU2");

            setLevel1SeleccionadoBase(value);
            setLevel2Seleccionado("");
            if (shouldClearSurvey) {
                setSurveyAnswers(buildInitialSurveyAnswers(dynamicSurveyConfig));
            }
        },
        [
            dynamicSurveyConfig,
            setLevel1SeleccionadoBase,
            setLevel2Seleccionado,
            setSurveyAnswers,
        ],
    );

    const applyGestionQuickFill = useCallback(
        ({
            level1Target,
            level2Target,
            estadoTelefonoTarget,
            observacion: observacionTarget,
        }) => {
            const level1Options = [
                ...new Set(levels.map((item) => item.level1).filter(Boolean)),
            ];

            const matchedLevel1 =
                findOptionIgnoreCase(level1Options, level1Target) ||
                level1Target;

            const level2Options = levels
                .filter((item) => item.level1 === matchedLevel1)
                .map((item) => item.level2)
                .filter(Boolean);

            const matchedLevel2 =
                findOptionIgnoreCase(level2Options, level2Target) ||
                level2Target;

            const matchedEstadoTelefono =
                findOptionIgnoreCase(estadoTelefonos, estadoTelefonoTarget) ||
                estadoTelefonoTarget;

            handleLevel1SelectionChange(matchedLevel1);
            setLevel2Seleccionado(matchedLevel2);
            setEstadoTelefonoSeleccionado(matchedEstadoTelefono);
            setObservacion(observacionTarget || "");
        },
        [
            handleLevel1SelectionChange,
            estadoTelefonos,
            levels,
            setLevel2Seleccionado,
            setEstadoTelefonoSeleccionado,
            setObservacion,
        ],
    );

    const handleNoContestaAutofill = useCallback(() => {
        applyGestionQuickFill({
            level1Target: "NU1 Regestionables",
            level2Target: "no contesta",
            estadoTelefonoTarget: "no contesta",
            observacion: "No contesta",
        });
    }, [applyGestionQuickFill]);

    const handleGrabadoraAutofill = useCallback(() => {
        applyGestionQuickFill({
            level1Target: "NU1 Regestionables",
            level2Target: "grabadora",
            estadoTelefonoTarget: "grabadora",
            observacion: "Contesta grabadora",
        });
    }, [applyGestionQuickFill]);

    const handleContestaTerceroAutofill = useCallback(() => {
        applyGestionQuickFill({
            level1Target: "NU1 Regestionables",
            level2Target: "contesta tercero",
            estadoTelefonoTarget: "contactado",
            observacion: "Contesta tercero",
        });
    }, [applyGestionQuickFill]);

    const handleSurveyFieldChange = useCallback(
        (fieldKey, value) => {
            setSurveyAnswers((prev) => ({
                ...prev,
                [fieldKey]: value,
            }));
        },
        [setSurveyAnswers],
    );

    const handleDynamicFormFieldChange = useCallback(
        async (fieldKey, value) => {
            if (fieldKey === "__inbound_nombre_cliente") {
                const selectedOption = (inboundChildOptions || []).find(
                    (item) => String(item.value) === String(value),
                );

                setDynamicFormAnswers((prev) => ({
                    ...prev,
                    [fieldKey]: value,
                    __inbound_categorizacion: "",
                    __inbound_motivo: "",
                    __inbound_submotivo: "",
                }));

                await handleInboundChildSelection({
                    childMenuItemId: selectedOption?.menuItemId || "",
                    childCampaignId: selectedOption?.campaignId || "",
                });
                setDynamicFormAnswers((prev) => ({
                    ...prev,
                    [fieldKey]: value,
                    __inbound_categorizacion: "",
                    __inbound_motivo: "",
                    __inbound_submotivo: "",
                }));
                return;
            }

            if (fieldKey === "__inbound_categorizacion") {
                setDynamicFormAnswers((prev) => ({
                    ...prev,
                    [fieldKey]: value,
                    __inbound_motivo: "",
                    __inbound_submotivo: "",
                }));
                return;
            }

            if (fieldKey === "__inbound_motivo") {
                setDynamicFormAnswers((prev) => ({
                    ...prev,
                    [fieldKey]: value,
                    __inbound_submotivo: "",
                }));
                return;
            }

            setDynamicFormAnswers((prev) => ({
                ...prev,
                [fieldKey]: value,
            }));
        },
        [
            handleInboundChildSelection,
            inboundChildOptions,
            setDynamicFormAnswers,
        ],
    );

    const handleGuardarGestion = useCallback(
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
                        tipoCanal:
                            dynamicFormAnswers?.__inbound_tipo_canal || "",
                        relacion:
                            dynamicFormAnswers?.__inbound_relacion || "",
                        nombreCliente:
                            dynamicFormAnswers?.__inbound_nombre_cliente || "",
                        categorizacion:
                            dynamicFormAnswers?.__inbound_categorizacion || "",
                        motivoInteraccion:
                            dynamicFormAnswers?.__inbound_motivo || "",
                        submotivoInteraccion:
                            dynamicFormAnswers?.__inbound_submotivo || "",
                        observaciones:
                            dynamicFormAnswers?.observaciones || observacion || "",
                    };

                    const { status, ok, json } = await guardarGestionInbound({
                        campaignId: campaignIdSeleccionada,
                        campaign_id: campaignIdSeleccionada,
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
            interactionIdActual,
            level1Seleccionado,
            level2Seleccionado,
            manualFlowActivo,
            menuItemIdSeleccionado,
            observacion,
            onChangeAgentPage,
            registro,
            surveyAnswers,
            surveyFieldsToRender,
            telefonoSeleccionado,
        ],
    );

    const handleCancelarGestion = useCallback(async () => {
        await releaseRegistroIfPresent("Error liberando registro");
        if (typeof onChangeAgentPage === "function") {
            onChangeAgentPage("inicio");
        }
    }, [onChangeAgentPage, releaseRegistroIfPresent]);

    useEffect(() => {
        const label = String(
            campaignIdSeleccionada || selectedCampaignId || "",
        ).toLowerCase();
        if (!bloqueado && !esGestionOutbound(label) && !manualFlowActivo) {
            refreshBases();
        }
    }, [
        bloqueado,
        campaignIdSeleccionada,
        manualFlowActivo,
        refreshBases,
        selectedCampaignId,
    ]);

    useEffect(() => {
        resetPhoneSelection();
    }, [registro, resetPhoneSelection]);

    useEffect(() => {
        if (!requestedAgentStatus || bloqueado) return;
        if (requestedAgentStatus === estadoAgente) return;
        handleCambioEstadoAgente(requestedAgentStatus);
    }, [
        requestedAgentStatus,
        bloqueado,
        estadoAgente,
        handleCambioEstadoAgente,
    ]);

    const isHomeView = agentPage === "inicio";
    const isGestionOutbound = esGestionOutbound(
        campaignIdSeleccionada || selectedCampaignId,
    );
    const shouldShowQueueMessage =
        !loadingRegistro &&
        !registro &&
        hasCampaignSelection &&
        !error &&
        !manualFlowActivo &&
        !esGestionOutbound(campaignIdSeleccionada);

    return {
        isAgente,
        registro,
        loadingRegistro,
        error,
        observacion,
        setObservacion,
        estadoAgente,
        campaignIdSeleccionada,
        levels,
        level1Seleccionado,
        level2Seleccionado,
        setLevel1Seleccionado: handleLevel1SelectionChange,
        setLevel2Seleccionado,
        telefonos,
        telefonoSeleccionado,
        estadoTelefonos,
        estadoTelefonoSeleccionado,
        dynamicFormConfig,
        dynamicFormDetail,
        dynamicFormAnswers,
        dynamicSurveyConfig,
        surveyAnswers,
        surveyFieldsToRender,
        activeBaseCards,
        loadingActiveBaseCards,
        regestionBaseCards,
        loadingRegestionBaseCards,
        hasCampaignSelection,
        manualFlowActivo,
        menuItemIdSeleccionado,
        categoryIdSeleccionada,
        inboundChildOptions,
        shouldShowQueueMessage,
        isHomeView,
        isGestionOutbound,
        handleTelefonoChange,
        handleEstadoTelefonoChange,
        handleNoContestaAutofill,
        handleGrabadoraAutofill,
        handleContestaTerceroAutofill,
        handleSurveyFieldChange,
        handleDynamicFormFieldChange,
        handleGuardarGestion,
        handleCancelarGestion,
        selectBaseCard,
    };
}
