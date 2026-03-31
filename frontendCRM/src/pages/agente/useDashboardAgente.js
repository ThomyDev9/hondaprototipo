import { useCallback, useEffect, useState } from "react";
import { esGestionOutbound } from "../../utils/gestionOutbound";
import {
    buildInitialSurveyAnswers,
    findOptionIgnoreCase,
} from "./dashboardAgente.helpers";
import useBaseCards from "./hooks/useBaseCards";
import useAgentGestionSubmit from "./hooks/useAgentGestionSubmit";
import usePhoneManagement from "./hooks/usePhoneManagement";
import useRegistroQueue from "./hooks/useRegistroQueue";

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

    const handleGuardarGestion = useAgentGestionSubmit({
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
    });

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
