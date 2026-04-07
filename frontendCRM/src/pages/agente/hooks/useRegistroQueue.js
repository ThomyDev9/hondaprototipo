import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerPlantillasDinamicas } from "../../../services/formTemplate.service";
import { obtenerCampaniasDetalladasDesdeMenu } from "../../../services/campaign.service";
import { esGestionOutbound } from "../../../utils/gestionOutbound";
import { INBOUND_HISTORICO_MENU_ITEM_ID } from "../../../components/AccordionMenu";
import {
    buildInitialSurveyAnswers,
    getOrCreateTabSessionId,
    mapTemplateToForm2Config,
    mapTemplateToSurveyConfig,
} from "../dashboardAgente.helpers";
import { isEditableTicketInboundFlow } from "../inboundFlow.helpers";
import { parseAdditionalFields } from "../components/agentGestionForm.helpers";
import {
    fetchFormCatalogos,
    fetchInboundCurrentCall,
    fetchNextRegistro,
    releaseRegistro,
    changeAgentStatus,
} from "../../../services/dashboard.service";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";
const REDES_PARENT_MENU_ITEM_ID = "b3d8324e-2c69-11f1-b790-000c2904c92f";
const REDES_SHARED_LABEL = "gestion redes";
const INBOUND_SPECIAL_FIELDS = [
    "__inbound_tipo_cliente",
    "__inbound_tipo_identificacion",
    "__inbound_tipo_canal",
    "__inbound_relacion",
    "__inbound_nombre_cliente",
    "__inbound_categorizacion",
    "__inbound_motivo",
    "__inbound_submotivo",
    "__redes_nombre_cliente",
    "__redes_tipo_cliente",
    "__redes_fecha_gestion",
    "__redes_estado_conversacion",
    "__redes_tipo_red_social",
];

function normalizeFlowLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function isGestionRedesFlow({ menuItemId = "", campaignId = "" }) {
    return (
        String(menuItemId || "").trim() === REDES_PARENT_MENU_ITEM_ID ||
        normalizeFlowLabel(campaignId) === REDES_SHARED_LABEL
    );
}

function normalizeInboundQueueValue(value) {
    return String(value || "")
        .trim()
        .replace(/\.0+$/, "")
        .replace(/[^\d]/g, "");
}

function matchesInboundQueue(inboundQueueValue, activeQueueValue) {
    const normalizedActiveQueue = normalizeInboundQueueValue(activeQueueValue);
    if (!normalizedActiveQueue) {
        return false;
    }

    return String(inboundQueueValue || "")
        .split(/[;,|]/)
        .flatMap((entry) =>
            String(entry || "")
                .split(/\s+/)
                .map((token) => normalizeInboundQueueValue(token)),
        )
        .filter(Boolean)
        .includes(normalizedActiveQueue);
}

export default function useRegistroQueue({
    selectedCampaignId,
    selectedCampaignLabel,
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
    const [estadoAgente, setEstadoAgente] = useState("");
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
        async ({ categoryId, menuItemId, campaignId }) => {
            const normalizedCategoryId = String(categoryId || "").trim();
            const normalizedMenuItemId = String(menuItemId || "").trim();
            const shouldLoadInboundChildren =
                normalizedCategoryId === INBOUND_MENU_CATEGORY_ID &&
                normalizedMenuItemId;
            const shouldLoadRedesChildren =
                isGestionRedesFlow({
                    menuItemId: normalizedMenuItemId,
                    campaignId,
                });

            if (!shouldLoadInboundChildren && !shouldLoadRedesChildren) {
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
                              inboundQueue: String(
                                  child?.inboundQueue || "",
                              ).trim(),
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
            const additionalDetailValues = parseAdditionalFields(detail);
            for (const row of nextDynamicConfig?.rows || []) {
                for (const field of row || []) {
                    const detailValue =
                        detail?.[field.key] !== undefined &&
                        detail?.[field.key] !== null
                            ? String(detail[field.key])
                            : additionalDetailValues?.[field.key] !==
                                    undefined &&
                                  additionalDetailValues?.[field.key] !== null
                                ? String(additionalDetailValues[field.key])
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
                categoryId,
                menuItemId,
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
        async ({
            childMenuItemId,
            childCampaignId,
            preserveCurrentTemplate = false,
        }) => {
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
            const loadPromise = preserveCurrentTemplate
                ? fetchFormCatalogos({
                      campaignId: normalizedChildCampaignId,
                      contactId: "",
                  }).then((catalogResp) => {
                      if (catalogResp.ok) {
                          const catalog = catalogResp.json || {};
                          setLevels(
                              Array.isArray(catalog.levels)
                                  ? catalog.levels
                                  : [],
                          );
                          setTelefonos(
                              Array.isArray(catalog.telefonos)
                                  ? catalog.telefonos
                                  : [],
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
                  })
                : loadTemplatesAndCatalogs({
                      campaignId: normalizedChildCampaignId,
                      menuItemId: normalizedChildMenuItemId,
                      categoryId: categoryIdSeleccionada,
                      contactId: "",
                      detail: null,
                  });

            await loadPromise.finally(() => {
                setLoadingRegistro(false);
            });
        },
        [
            manualFlowActivo,
            categoryIdSeleccionada,
            loadTemplatesAndCatalogs,
            campaignIdSeleccionada,
            menuItemIdSeleccionado,
            setLevel1Seleccionado,
            setLevel2Seleccionado,
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
                const tabSessionId = getOrCreateTabSessionId();
                const agentNumber = String(
                    sessionStorage.getItem("inbound_agent_number") || "",
                ).trim();

                const { status, ok, json } = await changeAgentStatus({
                    estado: nuevoEstado,
                    registroId: registro?.id ?? null,
                    tabSessionId,
                    agentNumber,
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
                    nuevoEstado !== "Disponible"
                ) {
                    setRegistro(null);
                }

                if (
                    nuevoEstado === "Disponible" &&
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
        const isInboundHistoricoView =
            String(selectedMenuItemId || "").trim() ===
            INBOUND_HISTORICO_MENU_ITEM_ID;
        const isRedesManualFlow =
            Boolean(selectedManualFlow) &&
            isGestionRedesFlow({
                menuItemId: selectedMenuItemId,
                campaignId: selectedCampaignId,
            });
        setCampaignIdSeleccionada(selectedCampaignId);
        setMenuItemIdSeleccionado(selectedMenuItemId || "");
        setCategoryIdSeleccionada(selectedCategoryId || "");
        setManualFlowActivo(Boolean(selectedManualFlow));
        if (isInboundHistoricoView) {
            setImportIdSeleccionada("");
            setRegistro(null);
            resetDynamicState();
            setLevel1Seleccionado("");
            setLevel2Seleccionado("");
            setTelefonos([]);
            setEstadoTelefonos([]);
            setLoadingRegistro(false);
            return;
        }
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
            const loadManualFlow = async () => {
                const childData = await loadInboundChildOptions({
                    categoryId: selectedCategoryId || "",
                    menuItemId: selectedMenuItemId || "",
                    campaignId: selectedCampaignId || "",
                });

                await loadTemplatesAndCatalogs({
                    campaignId: selectedCampaignId,
                    menuItemId: selectedMenuItemId || "",
                    categoryId: selectedCategoryId || "",
                    contactId: "",
                    detail: null,
                });

                if (isRedesManualFlow) {
                    const today = new Date().toISOString().slice(0, 10);
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __redes_tipo_cliente:
                            String(prev?.__redes_tipo_cliente || "").trim() ||
                            "Asesor",
                        __redes_tipo_red_social:
                            String(prev?.__redes_tipo_red_social || "").trim(),
                        __redes_fecha_gestion:
                            String(prev?.__redes_fecha_gestion || "").trim() ||
                            today,
                        __redes_estado_conversacion:
                            String(
                                prev?.__redes_estado_conversacion || "",
                            ).trim() || "Finalizado",
                    }));
                    return;
                }

                const preselectedChild = childData?.options?.find(
                    (item) =>
                        String(item.menuItemId) ===
                        String(selectedMenuItemId || ""),
                );

                const currentInboundAgentNumber = String(
                    sessionStorage.getItem("inbound_agent_number") || "",
                ).trim();

                let queueMatchedChild = null;
                if (currentInboundAgentNumber) {
                    try {
                        const { ok, json } = await fetchInboundCurrentCall({
                            agentNumber: currentInboundAgentNumber,
                        });
                        const activeQueue = String(
                            json?.data?.queue || "",
                        ).trim();

                        if (ok && activeQueue) {
                            queueMatchedChild =
                                childData?.options?.find((item) =>
                                    matchesInboundQueue(
                                        item?.inboundQueue,
                                        activeQueue,
                                    ),
                                ) || null;
                        }
                    } catch {
                        queueMatchedChild = null;
                    }
                }

                if (queueMatchedChild) {
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __inbound_nombre_cliente:
                            queueMatchedChild.menuItemId || "",
                        __inbound_nombre_cliente_label:
                            queueMatchedChild.label || "",
                    }));
                    await loadTemplatesAndCatalogs({
                        campaignId:
                            queueMatchedChild.campaignId || selectedCampaignId,
                        menuItemId: queueMatchedChild.menuItemId || "",
                        categoryId: selectedCategoryId || "",
                        contactId: "",
                        detail: null,
                    });
                    return;
                }

                if (preselectedChild) {
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __inbound_nombre_cliente: preselectedChild.menuItemId,
                        __inbound_nombre_cliente_label:
                            preselectedChild.label || "",
                    }));
                    return;
                }

                if (
                    isEditableTicketInboundFlow(
                        selectedCampaignLabel,
                        selectedCampaignId,
                    ) &&
                    String(selectedCampaignLabel || selectedCampaignId || "").trim()
                ) {
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __inbound_nombre_cliente: String(
                            selectedMenuItemId || prev?.__inbound_nombre_cliente || "",
                        ).trim(),
                        __inbound_nombre_cliente_label:
                            String(
                                selectedCampaignLabel || selectedCampaignId || "",
                            ).trim(),
                    }));
                }
            };

            Promise.resolve(loadManualFlow()).finally(() => {
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
        setDynamicFormAnswers,
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
