import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerPlantillasDinamicas } from "../../../services/formTemplate.service";
import { esGestionOutbound } from "../../../utils/gestionOutbound";
import {
    buildInitialSurveyAnswers,
    getOrCreateTabSessionId,
    mapTemplateToForm2Config,
    mapTemplateToSurveyConfig,
} from "../dashboardAgente.helpers";
import {
    fetchFormCatalogos,
    fetchNextRegistro,
    releaseRegistro,
    changeAgentStatus,
} from "../../../services/dashboard.service";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export default function useRegistroQueue({
    selectedCampaignId,
    selectedCampaignTick,
    selectedImportId,
    agentPage,
    bloqueado,
    handle403,
    setError,
    onChangeAgentPage,
    onAgentStatusSync,
}) {
    const [registro, setRegistro] = useState(null);
    const [loadingRegistro, setLoadingRegistro] = useState(false);
    const [campaignIdSeleccionada, setCampaignIdSeleccionada] = useState("");
    const [importIdSeleccionada, setImportIdSeleccionada] = useState("");
    const [levels, setLevels] = useState([]);
    const [level1Seleccionado, setLevel1Seleccionado] = useState("");
    const [level2Seleccionado, setLevel2Seleccionado] = useState("");
    const [telefonos, setTelefonos] = useState([]);
    const [estadoTelefonos, setEstadoTelefonos] = useState([]);
    const [dynamicFormConfig, setDynamicFormConfig] = useState(null);
    const [dynamicFormDetail, setDynamicFormDetail] = useState(null);
    const [dynamicSurveyConfig, setDynamicSurveyConfig] = useState(null);
    const [surveyAnswers, setSurveyAnswers] = useState({});
    const [estadoAgente, setEstadoAgente] = useState("disponible");
    const [observacion, setObservacion] = useState("");

    const lastActivityRef = useRef(Date.now());
    const initialCampaignTickRef = useRef(selectedCampaignTick || 0);

    const marcarActividad = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    const releaseRegistroIfPresent = useCallback(
        async (errorMessage) => {
            if (!registro?.id) return;
            try {
                await releaseRegistro(registro.id);
            } catch {
                if (errorMessage) {
                    setError(errorMessage);
                }
            }
        },
        [registro, setError],
    );

    const fetchSiguienteRegistro = useCallback(
        async (campaignIdOverride = null, importIdOverride = null) => {
            try {
                const tabSessionId = getOrCreateTabSessionId();
                setLoadingRegistro(true);
                setError("");
                setRegistro(null);

                const campaignIdToUse =
                    campaignIdOverride || campaignIdSeleccionada;
                const importIdToUse =
                    importIdOverride ||
                    importIdSeleccionada ||
                    selectedImportId;

                if (
                    !campaignIdToUse ||
                    (!importIdToUse && !esGestionOutbound(campaignIdToUse))
                ) {
                    setError(
                        "Selecciona una campaña y base para cargar registros",
                    );
                    setDynamicFormConfig(null);
                    setDynamicFormDetail(null);
                    setDynamicSurveyConfig(null);
                    setSurveyAnswers({});
                    return;
                }

                if (esGestionOutbound(campaignIdToUse)) {
                    setLoadingRegistro(false);
                    setRegistro(null);
                    setDynamicFormConfig(null);
                    setDynamicFormDetail(null);
                    setDynamicSurveyConfig(null);
                    setSurveyAnswers({});
                    return;
                }

                const { status, ok, json } = await fetchNextRegistro({
                    campaignId: campaignIdToUse,
                    importId: importIdToUse,
                    tabSessionId,
                });

                if (status === 403) {
                    handle403(json);
                    setRegistro(null);
                    setLevels([]);
                    setTelefonos([]);
                    setEstadoTelefonos([]);
                    setDynamicFormConfig(null);
                    setDynamicFormDetail(null);
                    setDynamicSurveyConfig(null);
                    setSurveyAnswers({});
                    return;
                }

                if (status === 404) {
                    setRegistro(null);
                    setDynamicFormConfig(null);
                    setDynamicFormDetail(null);
                    setDynamicSurveyConfig(null);
                    setSurveyAnswers({});
                    if (
                        json?.error === "No hay base activa para esta campaña" &&
                        esGestionOutbound(campaignIdToUse)
                    ) {
                        setError("");
                    } else {
                        setError(
                            json?.error ||
                                "No hay registros disponibles en tu cola",
                        );
                    }
                    return;
                }

                if (!ok) {
                    setDynamicFormConfig(null);
                    setDynamicFormDetail(null);
                    setDynamicSurveyConfig(null);
                    setSurveyAnswers({});
                    setError(
                        json?.error || "No se pudo asignar siguiente registro",
                    );
                    return;
                }

                setRegistro(json.registro || null);
                setObservacion("");

                const record = json.registro || null;
                let nextDynamicConfig = null;
                let nextSurveyConfig = null;

                try {
                    const dynamicTemplates =
                        await obtenerPlantillasDinamicas(campaignIdToUse);
                    nextDynamicConfig = mapTemplateToForm2Config(
                        dynamicTemplates.form2,
                    );
                    nextSurveyConfig = mapTemplateToSurveyConfig(
                        dynamicTemplates.form3,
                    );
                } catch (templateError) {
                    console.error(
                        "Error cargando plantillas dinámicas:",
                        templateError,
                    );
                }

                setDynamicFormConfig(nextDynamicConfig);
                setDynamicFormDetail(json.detalleCliente || null);
                setDynamicSurveyConfig(nextSurveyConfig);
                setSurveyAnswers(
                    buildInitialSurveyAnswers(nextSurveyConfig),
                );

                if (record?.id && campaignIdToUse) {
                    const catalogResp = await fetchFormCatalogos({
                        campaignId: campaignIdToUse,
                        contactId: record.id,
                    });

                    if (catalogResp.ok) {
                        const catalog = catalogResp.json || {};
                        const levelsData = Array.isArray(catalog.levels)
                            ? catalog.levels
                            : [];
                        const telefonosData = Array.isArray(
                            catalog.telefonos,
                        )
                            ? catalog.telefonos
                            : [];
                        const estadosData = Array.isArray(
                            catalog.estadoTelefonos,
                        )
                            ? catalog.estadoTelefonos
                            : [];
                        setLevels(levelsData);
                        setTelefonos(telefonosData);
                        setEstadoTelefonos(estadosData);
                        setLevel1Seleccionado("");
                        setLevel2Seleccionado("");
                    }

                    if (nextDynamicConfig && !json.detalleCliente) {
                        setDynamicFormDetail(null);
                    }
                }

                marcarActividad();
            } catch (err) {
                console.error(err);
                setError("Error de conexión con el servidor");
            } finally {
                setLoadingRegistro(false);
            }
        },
        [
            campaignIdSeleccionada,
            importIdSeleccionada,
            selectedImportId,
            handle403,
            marcarActividad,
            setError,
        ],
    );

    const handleCambioEstadoAgente = useCallback(
        async (nuevoEstado) => {
            try {
                setError("");

                const { status, ok, json } = await changeAgentStatus({
                    estado: nuevoEstado,
                    registroId: registro?.id ?? null,
                });

                if (status === 403) {
                    handle403(json);
                    return;
                }

                if (!ok) {
                    setError(
                        json?.error || "No se pudo cambiar el estado del agente",
                    );
                    return;
                }

                setEstadoAgente(nuevoEstado);
                onAgentStatusSync?.(nuevoEstado);
                marcarActividad();

                if (
                    ["baño", "consulta", "lunch", "reunion"].includes(
                        nuevoEstado,
                    )
                ) {
                    setRegistro(null);
                }

                if (nuevoEstado === "disponible" && campaignIdSeleccionada) {
                    await fetchSiguienteRegistro();
                }
            } catch (err) {
                console.error(err);
                setError("Error de conexión con el servidor");
            }
        },
        [
            campaignIdSeleccionada,
            fetchSiguienteRegistro,
            handle403,
            marcarActividad,
            onAgentStatusSync,
            setError,
        ],
    );

    const selectBaseCard = useCallback(
        (card) => {
            setCampaignIdSeleccionada(card.campaignId);
            setImportIdSeleccionada(card.importId);
            fetchSiguienteRegistro(card.campaignId, card.importId);
            if (typeof onChangeAgentPage === "function") {
                onChangeAgentPage("gestion");
            }
        },
        [fetchSiguienteRegistro, onChangeAgentPage],
    );

    useEffect(() => {
        if (agentPage === "inicio") return;
        if (!selectedCampaignId || !selectedCampaignTick || bloqueado) return;
        if (selectedCampaignTick === initialCampaignTickRef.current) {
            return;
        }

        const isOutbound = esGestionOutbound(selectedCampaignId);
        setCampaignIdSeleccionada(selectedCampaignId);
        if (isOutbound) {
            setImportIdSeleccionada("");
            setRegistro(null);
            setDynamicFormConfig(null);
            setDynamicFormDetail(null);
            setDynamicSurveyConfig(null);
            setSurveyAnswers({});
            setLevel1Seleccionado("");
            setLevel2Seleccionado("");
            setTelefonos([]);
            setEstadoTelefonos([]);
        } else {
            fetchSiguienteRegistro(selectedCampaignId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        agentPage,
        bloqueado,
        fetchSiguienteRegistro,
        selectedCampaignId,
        selectedCampaignTick,
    ]);

    useEffect(() => {
        const releaseAndReset = async () => {
            await releaseRegistroIfPresent("Error liberando registro");
            setRegistro(null);
            setError("");
            setCampaignIdSeleccionada("");
        };
        if (agentPage === "inicio") {
            releaseAndReset();
        }
    }, [agentPage, releaseRegistroIfPresent, setError]);

    useEffect(() => {
        if (!registro || agentPage === "inicio" || bloqueado) return;
        const timeout = setTimeout(async () => {
            await releaseRegistroIfPresent(
                "Error liberando registro por inactividad",
            );
            if (typeof onChangeAgentPage === "function") {
                onChangeAgentPage("inicio");
            }
        }, INACTIVITY_TIMEOUT_MS);
        return () => clearTimeout(timeout);
    }, [
        registro,
        agentPage,
        bloqueado,
        onChangeAgentPage,
        releaseRegistroIfPresent,
    ]);

    useEffect(() => {
        if (!selectedCampaignId || !selectedCampaignTick || bloqueado) return;
        if (!level1Seleccionado) {
            setLevel2Seleccionado("");
        }
    }, [level1Seleccionado, level2Seleccionado, levels]);

    const hasCampaignSelection = Boolean(campaignIdSeleccionada);

    return {
        registro,
        setRegistro,
        loadingRegistro,
        campaignIdSeleccionada,
        setCampaignIdSeleccionada,
        importIdSeleccionada,
        setImportIdSeleccionada,
        dynamicFormConfig,
        dynamicFormDetail,
        dynamicSurveyConfig,
        surveyAnswers,
        setSurveyAnswers,
        levels,
        setLevels,
        level1Seleccionado,
        setLevel1Seleccionado,
        level2Seleccionado,
        setLevel2Seleccionado,
        telefonos,
        setTelefonos,
        estadoTelefonos,
        setEstadoTelefonos,
        estadoAgente,
        setEstadoAgente,
        observacion,
        setObservacion,
        hasCampaignSelection,
        handleCambioEstadoAgente,
        fetchSiguienteRegistro,
        selectBaseCard,
        releaseRegistroIfPresent,
    };
}
