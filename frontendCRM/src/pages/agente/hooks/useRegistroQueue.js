import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerPlantillasDinamicas } from "../../../services/formTemplate.service";
import { obtenerCampaniasDetalladasDesdeMenu } from "../../../services/campaign.service";
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
const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";
const INBOUND_SPECIAL_FIELDS = [
    "__inbound_tipo_cliente",
    "__inbound_tipo_identificacion",
    "__inbound_tipo_canal",
    "__inbound_relacion",
    "__inbound_nombre_cliente",
    "__inbound_categorizacion",
    "__inbound_motivo",
    "__inbound_submotivo",
];

export default function useRegistroQueue({
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
}) {
    const [registro, setRegistro] = useState(null);
    const [loadingRegistro, setLoadingRegistro] = useState(false);
    const [campaignIdSeleccionada, setCampaignIdSeleccionada] = useState("");
    const [importIdSeleccionada, setImportIdSeleccionada] = useState("");
    const [menuItemIdSeleccionado, setMenuItemIdSeleccionado] = useState("");
    const [categoryIdSeleccionada, setCategoryIdSeleccionada] = useState("");
    const [manualFlowActivo, setManualFlowActivo] = useState(false);
    const [levels, setLevels] = useState([]);
    const [level1Seleccionado, setLevel1Seleccionado] = useState("");
    const [level2Seleccionado, setLevel2Seleccionado] = useState("");
    const [telefonos, setTelefonos] = useState([]);
    const [estadoTelefonos, setEstadoTelefonos] = useState([]);
    const [dynamicFormConfig, setDynamicFormConfig] = useState(null);
    const [dynamicFormDetail, setDynamicFormDetail] = useState(null);
    const [dynamicFormAnswers, setDynamicFormAnswers] = useState({});
    const [dynamicSurveyConfig, setDynamicSurveyConfig] = useState(null);
    const [surveyAnswers, setSurveyAnswers] = useState({});
    const [inboundChildOptions, setInboundChildOptions] = useState([]);
    const [estadoAgente, setEstadoAgente] = useState("disponible");
    const [observacion, setObservacion] = useState("");

    const lastActivityRef = useRef(Date.now());
    const initialCampaignTickRef = useRef(selectedCampaignTick || 0);
    const dynamicFormAnswersRef = useRef({});

    useEffect(() => {
        dynamicFormAnswersRef.current = dynamicFormAnswers;
    }, [dynamicFormAnswers]);

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

    const resetDynamicState = useCallback(() => {
        setDynamicFormConfig(null);
        setDynamicFormDetail(null);
        setDynamicFormAnswers({});
        setDynamicSurveyConfig(null);
        setSurveyAnswers({});
        setInboundChildOptions([]);
    }, []);

    const loadInboundChildOptions = useCallback(
        async ({ categoryId, menuItemId }) => {
            const normalizedCategoryId = String(categoryId || "").trim();
            const normalizedMenuItemId = String(menuItemId || "").trim();

            if (
                normalizedCategoryId !== INBOUND_MENU_CATEGORY_ID ||
                !normalizedMenuItemId
            ) {
                setInboundChildOptions([]);
                return null;
            }

            try {
                const tree = await obtenerCampaniasDetalladasDesdeMenu(
                    normalizedCategoryId,
                );
                const rootNode = tree.find(
                    (item) =>
                        String(item?.id || "").trim() === normalizedMenuItemId ||
                        (item?.subcampanias || []).some(
                            (child) =>
                                String(child?.id || "").trim() ===
                                normalizedMenuItemId,
                        ),
                );

                const options = Array.isArray(rootNode?.subcampanias)
                    ? rootNode.subcampanias
                          .map((child) => ({
                              value: String(child?.id || "").trim(),
                              label: String(
                                  child?.nombre || child?.campania || "",
                              ).trim(),
                              campaignId: String(
                                  child?.nombre || child?.campania || "",
                              ).trim(),
                              menuItemId: String(child?.id || "").trim(),
                              categoryId: normalizedCategoryId,
                              parentMenuItemId: String(
                                  rootNode?.id || "",
                              ).trim(),
                              parentCampaignId: String(
                                  rootNode?.campania || "",
                              ).trim(),
                          }))
                          .filter((item) => item.value && item.label)
                    : [];

                setInboundChildOptions(options);
                return {
                    rootNode,
                    options,
                };
            } catch (error) {
                console.error(
                    "Error cargando hijos inbound para formulario manual:",
                    error,
                );
                setInboundChildOptions([]);
                return null;
            }
        },
        [],
    );

    const loadTemplatesAndCatalogs = useCallback(
        async ({
            campaignId,
            menuItemId = "",
            categoryId = "",
            contactId = "",
            detail = null,
        }) => {
            const currentAnswers = { ...(dynamicFormAnswersRef.current || {}) };
            const preservedInboundValues = Object.fromEntries(
                INBOUND_SPECIAL_FIELDS.map((key) => [
                    key,
                    String(currentAnswers?.[key] || ""),
                ]),
            );
            let nextDynamicConfig = null;
            let nextSurveyConfig = null;

            try {
                const dynamicTemplates = await obtenerPlantillasDinamicas(
                    campaignId,
                    {
                        menuItemId,
                        categoryId,
                    },
                );
                nextDynamicConfig = mapTemplateToForm2Config(
                    dynamicTemplates.form2,
                );
                nextSurveyConfig = mapTemplateToSurveyConfig(
                    dynamicTemplates.form3,
                );
            } catch (templateError) {
                console.error(
                    "Error cargando plantillas dinÃƒÂ¡micas:",
                    templateError,
                );
            }

            if (menuItemId && !nextDynamicConfig) {
                setError(
                    "No se encontrÃƒÂ³ un Formulario 2 activo para esta opciÃƒÂ³n.",
                );
            }

            setDynamicFormConfig(nextDynamicConfig);
            setDynamicFormDetail(detail);
            setDynamicSurveyConfig(nextSurveyConfig);
            setSurveyAnswers(buildInitialSurveyAnswers(nextSurveyConfig));

            const initialFormAnswers = {};
            for (const row of nextDynamicConfig?.rows || []) {
                for (const field of row || []) {
                    const detailValue =
                        detail?.[field.key] !== undefined &&
                        detail?.[field.key] !== null
                            ? String(detail[field.key])
                            : "";
                    const currentValue =
                        currentAnswers?.[field.key] !== undefined &&
                        currentAnswers?.[field.key] !== null
                            ? String(currentAnswers[field.key])
                            : "";

                    initialFormAnswers[field.key] = detailValue || currentValue;
                }
            }
            setDynamicFormAnswers({
                ...currentAnswers,
                ...preservedInboundValues,
                ...initialFormAnswers,
            });

            const catalogResp = await fetchFormCatalogos({
                campaignId,
                contactId,
            });

            if (catalogResp.ok) {
                const catalog = catalogResp.json || {};
                setLevels(
                    Array.isArray(catalog.levels) ? catalog.levels : [],
                );
                setTelefonos(
                    Array.isArray(catalog.telefonos) ? catalog.telefonos : [],
                );
                setEstadoTelefonos(
                    Array.isArray(catalog.estadoTelefonos)
                        ? catalog.estadoTelefonos
                        : [],
                );
                setLevel1Seleccionado("");
                setLevel2Seleccionado("");
            } else {
                setLevels([]);
                setTelefonos([]);
                setEstadoTelefonos([]);
            }
        },
        [],
    );

    const handleInboundChildSelection = useCallback(
        async ({ childMenuItemId, childCampaignId }) => {
            const normalizedChildMenuItemId = String(
                childMenuItemId || "",
            ).trim();
            const normalizedChildCampaignId = String(
                childCampaignId || "",
            ).trim();

            if (!manualFlowActivo || !categoryIdSeleccionada) {
                return;
            }

            if (!normalizedChildMenuItemId || !normalizedChildCampaignId) {
                setLoadingRegistro(true);
                await loadTemplatesAndCatalogs({
                    campaignId: campaignIdSeleccionada,
                    menuItemId: menuItemIdSeleccionado,
                    categoryId: categoryIdSeleccionada,
                    contactId: "",
                    detail: null,
                }).finally(() => {
                    setLoadingRegistro(false);
                });
                return;
            }

            setLoadingRegistro(true);
            await loadTemplatesAndCatalogs({
                campaignId: normalizedChildCampaignId,
                menuItemId: normalizedChildMenuItemId,
                categoryId: categoryIdSeleccionada,
                contactId: "",
                detail: null,
            }).finally(() => {
                setLoadingRegistro(false);
            });
        },
        [
            manualFlowActivo,
            categoryIdSeleccionada,
            loadTemplatesAndCatalogs,
            campaignIdSeleccionada,
            menuItemIdSeleccionado,
        ],
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
                        "Selecciona una campaÃƒÂ±a y base para cargar registros",
                    );
                    resetDynamicState();
                    return;
                }

                if (esGestionOutbound(campaignIdToUse)) {
                    setLoadingRegistro(false);
                    setRegistro(null);
                    resetDynamicState();
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
                    resetDynamicState();
                    return;
                }

                if (status === 404) {
                    setRegistro(null);
                    resetDynamicState();
                    const normalizedError = String(json?.error || "").trim();
                    if (
                        normalizedError ===
                        "No hay registros disponibles en la base activa"
                    ) {
                        setError("");
                        if (typeof onChangeAgentPage === "function") {
                            onChangeAgentPage("inicio");
                        }
                        return;
                    }
                    if (
                        json?.error === "No hay base activa para esta campaÃƒÂ±a" &&
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
                    resetDynamicState();
                    setError(
                        json?.error || "No se pudo asignar siguiente registro",
                    );
                    return;
                }

                setRegistro(json.registro || null);
                setObservacion("");

                const record = json.registro || null;
                await loadTemplatesAndCatalogs({
                    campaignId: campaignIdToUse,
                    menuItemId: selectedMenuItemId,
                    categoryId: selectedCategoryId,
                    contactId: record?.id || "",
                    detail: json.detalleCliente || null,
                });

                marcarActividad();
            } catch (err) {
                console.error(err);
                setError("Error de conexiÃƒÂ³n con el servidor");
            } finally {
                setLoadingRegistro(false);
            }
        },
        [
            campaignIdSeleccionada,
            importIdSeleccionada,
            selectedImportId,
            selectedMenuItemId,
            selectedCategoryId,
            handle403,
            loadTemplatesAndCatalogs,
            marcarActividad,
            onChangeAgentPage,
            resetDynamicState,
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
                    ["baÃƒÂ±o", "consulta", "lunch", "reunion"].includes(
                        nuevoEstado,
                    )
                ) {
                    setRegistro(null);
                }

                if (
                    nuevoEstado === "disponible" &&
                    campaignIdSeleccionada &&
                    !manualFlowActivo
                ) {
                    await fetchSiguienteRegistro();
                }
            } catch (err) {
                console.error(err);
                setError("Error de conexiÃƒÂ³n con el servidor");
            }
        },
        [
            campaignIdSeleccionada,
            fetchSiguienteRegistro,
            handle403,
            manualFlowActivo,
            marcarActividad,
            onAgentStatusSync,
            setError,
        ],
    );

    const selectBaseCard = useCallback(
        (card) => {
            setCampaignIdSeleccionada(card.campaignId);
            setImportIdSeleccionada(card.importId);
            setMenuItemIdSeleccionado("");
            setCategoryIdSeleccionada("");
            setManualFlowActivo(false);
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
        setMenuItemIdSeleccionado(selectedMenuItemId || "");
        setCategoryIdSeleccionada(selectedCategoryId || "");
        setManualFlowActivo(Boolean(selectedManualFlow));
        if (isOutbound) {
            setImportIdSeleccionada("");
            setRegistro(null);
            resetDynamicState();
            setLevel1Seleccionado("");
            setLevel2Seleccionado("");
            setTelefonos([]);
            setEstadoTelefonos([]);
        } else if (selectedManualFlow) {
            setLoadingRegistro(true);
            setImportIdSeleccionada("");
            setRegistro(null);
            setObservacion("");
            Promise.resolve(
                loadInboundChildOptions({
                    categoryId: selectedCategoryId || "",
                    menuItemId: selectedMenuItemId || "",
                }).then((inboundData) =>
                    loadTemplatesAndCatalogs({
                        campaignId: selectedCampaignId,
                        menuItemId: selectedMenuItemId || "",
                        categoryId: selectedCategoryId || "",
                        contactId: "",
                        detail: null,
                    }).then(() => {
                        const preselectedChild = inboundData?.options?.find(
                            (item) =>
                                String(item.menuItemId) ===
                                String(selectedMenuItemId || ""),
                        );

                        if (preselectedChild) {
                            setDynamicFormAnswers((prev) => ({
                                ...prev,
                                __inbound_nombre_cliente:
                                    preselectedChild.menuItemId,
                            }));
                        }
                    }),
                ),
            ).finally(() => {
                setLoadingRegistro(false);
            });
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
        selectedMenuItemId,
        selectedCategoryId,
        selectedManualFlow,
        loadTemplatesAndCatalogs,
        loadInboundChildOptions,
        resetDynamicState,
    ]);

    useEffect(() => {
        const releaseAndReset = async () => {
            await releaseRegistroIfPresent("Error liberando registro");
            setRegistro(null);
            setError("");
            setCampaignIdSeleccionada("");
            setImportIdSeleccionada("");
            setMenuItemIdSeleccionado("");
            setCategoryIdSeleccionada("");
            setManualFlowActivo(false);
            resetDynamicState();
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
        dynamicFormAnswers,
        setDynamicFormAnswers,
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
        manualFlowActivo,
        menuItemIdSeleccionado,
        categoryIdSeleccionada,
        inboundChildOptions,
        hasCampaignSelection,
        handleCambioEstadoAgente,
        handleInboundChildSelection,
        fetchSiguienteRegistro,
        selectBaseCard,
        releaseRegistroIfPresent,
    };
}
