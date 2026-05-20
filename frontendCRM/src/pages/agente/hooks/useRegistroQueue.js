import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerPlantillasDinamicas } from "../../../services/formTemplate.service";
import { obtenerCampaniasDetalladasDesdeMenu } from "../../../services/campaign.service";
import { esGestionOutbound } from "../../../utils/gestionOutbound";
import {
    INBOUND_HISTORICO_MENU_ITEM_ID,
    REDES_HISTORICO_MENU_ITEM_ID,
} from "../../../components/AccordionMenu";
import {
    buildInitialSurveyAnswers,
    getOrCreateTabSessionId,
    getTodayLocalDate,
    mapTemplateToForm2Config,
    mapTemplateToSurveyConfig,
} from "../dashboardAgente.helpers";
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
const INBOUND_ROOT_MENU_ITEM_ID = "8a90ebfe-2c82-11f1-b790-000c2904c92f";
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
const INBOUND_DEBUG =
    String(import.meta.env.VITE_INBOUND_DEBUG || "1").trim() === "1";

function inboundDebugLog(event, payload = {}) {
    if (!INBOUND_DEBUG) return;
    try {
        console.info(
            `[INBOUND_DEBUG][useRegistroQueue] ${event} ${JSON.stringify(payload)}`,
        );
    } catch {
        // no-op
    }
}

function normalizeFlowLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function isFollowupInboundFlowLabel(value) {
    const normalized = normalizeFlowLabel(value);
    return (
        normalized === "seguimiento inbound" ||
        normalized.includes("seguimiento inbound")
    );
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

function findInboundChildrenByQueue(options = [], activeQueueValue = "") {
    return (Array.isArray(options) ? options : []).filter((item) =>
        matchesInboundQueue(item?.inboundQueue, activeQueueValue),
    );
}

function resolveInboundQueueChildMatch({
    options = [],
    activeQueueValue = "",
    preferredMenuItemId = "",
    selectedCampaignLabel = "",
}) {
    const matches = findInboundChildrenByQueue(options, activeQueueValue);
    inboundDebugLog("resolveInboundQueueChildMatch:start", {
        activeQueueValue,
        matches: matches.map((item) => ({
            menuItemId: item?.menuItemId,
            label: item?.label,
            campaignId: item?.campaignId,
            inboundQueue: item?.inboundQueue,
        })),
        preferredMenuItemId,
        selectedCampaignLabel,
    });
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const preferred = String(preferredMenuItemId || "").trim();
    if (preferred) {
        const preferredMatch = matches.find(
            (item) => String(item?.menuItemId || "").trim() === preferred,
        );
        if (preferredMatch) {
            inboundDebugLog("resolveInboundQueueChildMatch:preferred-match", {
                preferredMenuItemId: preferred,
                selected: preferredMatch,
            });
            return preferredMatch;
        }
    }

    const inboundDefaultMatch = matches.find((item) => {
        const label = normalizeFlowLabel(item?.label || item?.campaignId || "");
        return (
            label === "gestion inbound" ||
            label === "gestion inbound manual" ||
            label.includes("gestion inbound")
        );
    });
    if (inboundDefaultMatch) {
        inboundDebugLog("resolveInboundQueueChildMatch:inbound-default", {
            selected: inboundDefaultMatch,
        });
        return inboundDefaultMatch;
    }

    const normalizedCampaignLabel = normalizeFlowLabel(selectedCampaignLabel);
    if (normalizedCampaignLabel) {
        const labelMatch = matches.find((item) => {
            const label = normalizeFlowLabel(item?.label || item?.campaignId || "");
            return label === normalizedCampaignLabel;
        });
        if (labelMatch) {
            inboundDebugLog("resolveInboundQueueChildMatch:campaign-exact", {
                selectedCampaignLabel,
                selected: labelMatch,
            });
            return labelMatch;
        }
    }

    inboundDebugLog("resolveInboundQueueChildMatch:no-selection", {
        reason: "ambiguous_matches_without_safe_rule",
    });
    return null;
}

export default function useRegistroQueue({
    selectedCampaignId,
    selectedCampaignLabel,
    selectedCampaignTick,
    selectedImportId,
    selectedMenuItemId,
    selectedCategoryId,
    selectedManualFlow,
    selectedSecureInboundManual,
    selectedFollowupInboundManual,
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
    const isFollowupInboundFlowEffective = Boolean(
        selectedFollowupInboundManual ||
            isFollowupInboundFlowLabel(selectedCampaignLabel) ||
            isFollowupInboundFlowLabel(selectedCampaignId),
    );

    const lastActivityRef = useRef(Date.now());
    const initialCampaignTickRef = useRef(selectedCampaignTick || 0);
    const dynamicFormAnswersRef = useRef({});
    const inboundManualLoadInFlightRef = useRef(false);
    const lastInboundAutoRouteCallRef = useRef("");

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

            // Sincroniza el contexto visual/funcional del flujo manual inbound
            // con el hijo resuelto por cola para evitar que quede "pegado" al padre previo.
            setCampaignIdSeleccionada(normalizedChildCampaignId);
            setMenuItemIdSeleccionado(normalizedChildMenuItemId);

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
                INBOUND_HISTORICO_MENU_ITEM_ID ||
            String(selectedMenuItemId || "").trim() ===
                REDES_HISTORICO_MENU_ITEM_ID;
        const isRedesManualFlow =
            Boolean(selectedManualFlow) &&
            isGestionRedesFlow({
                menuItemId: selectedMenuItemId,
                campaignId: selectedCampaignId,
            });
        const isInboundManualFlow =
            Boolean(selectedManualFlow) &&
            String(selectedCategoryId || "").trim() === INBOUND_MENU_CATEGORY_ID &&
            !isRedesManualFlow;
        const isInboundManualAutoRouteMode =
            isInboundManualFlow &&
            String(selectedMenuItemId || "").trim() === INBOUND_ROOT_MENU_ITEM_ID &&
            !selectedSecureInboundManual &&
            !selectedFollowupInboundManual;
        const resolvedInboundChildMenuItemId = String(
            dynamicFormAnswersRef.current?.__inbound_nombre_cliente || "",
        ).trim();
        const shouldPreserveResolvedInboundContext =
            isInboundManualFlow &&
            String(selectedMenuItemId || "").trim() ===
                INBOUND_ROOT_MENU_ITEM_ID &&
            Boolean(resolvedInboundChildMenuItemId) &&
            !selectedSecureInboundManual &&
            !isFollowupInboundFlowEffective;

        if (!shouldPreserveResolvedInboundContext) {
            if (isInboundManualAutoRouteMode) {
                // Evita mostrar primero el contexto padre ("Gestion Inbound")
                // y luego saltar al hijo. Se resolvera por cola y se aplicara directo.
                setCampaignIdSeleccionada("");
                setMenuItemIdSeleccionado("");
                setCategoryIdSeleccionada(selectedCategoryId || "");
            } else {
                setCampaignIdSeleccionada(selectedCampaignId);
                setMenuItemIdSeleccionado(selectedMenuItemId || "");
                setCategoryIdSeleccionada(selectedCategoryId || "");
            }
        } else {
            inboundDebugLog("preserve-resolved-inbound-context", {
                selectedCampaignId,
                selectedMenuItemId,
                selectedCategoryId,
                resolvedInboundChildMenuItemId,
                currentCampaignIdSeleccionada: campaignIdSeleccionada,
                currentMenuItemIdSeleccionado: menuItemIdSeleccionado,
                currentCategoryIdSeleccionada: categoryIdSeleccionada,
            });
        }
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
            if (inboundManualLoadInFlightRef.current) {
                inboundDebugLog("manualFlow:skip-duplicate-load", {
                    reason: "load_in_flight",
                    selectedCampaignId,
                    selectedMenuItemId,
                    selectedCategoryId,
                });
                return;
            }
            inboundManualLoadInFlightRef.current = true;
            setLoadingRegistro(true);
            setImportIdSeleccionada("");
            setRegistro(null);
            setObservacion("");
            const isInboundManualAutoRouteMode =
                String(selectedCategoryId || "").trim() ===
                    INBOUND_MENU_CATEGORY_ID &&
                String(selectedMenuItemId || "").trim() ===
                    INBOUND_ROOT_MENU_ITEM_ID &&
                !selectedSecureInboundManual &&
                !isFollowupInboundFlowEffective &&
                !isRedesManualFlow;
            if (isInboundManualAutoRouteMode) {
                // Limpia el cliente previo para evitar saltos visuales entre llamadas.
                setDynamicFormAnswers((prev) => ({
                    ...prev,
                    __inbound_nombre_cliente: "",
                    __inbound_nombre_cliente_label: "",
                }));
            }
            const loadManualFlow = async () => {
                const effectiveCampaignId = shouldPreserveResolvedInboundContext
                    ? campaignIdSeleccionada || selectedCampaignId || ""
                    : selectedCampaignId || "";
                const effectiveMenuItemId = shouldPreserveResolvedInboundContext
                    ? menuItemIdSeleccionado || selectedMenuItemId || ""
                    : selectedMenuItemId || "";
                const effectiveCategoryId = shouldPreserveResolvedInboundContext
                    ? categoryIdSeleccionada || selectedCategoryId || ""
                    : selectedCategoryId || "";

                const childData = await loadInboundChildOptions({
                    categoryId: effectiveCategoryId,
                    menuItemId: effectiveMenuItemId,
                    campaignId: effectiveCampaignId,
                });
                inboundDebugLog("manualFlow:child-options-loaded", {
                    selectedCampaignId: effectiveCampaignId,
                    selectedMenuItemId: effectiveMenuItemId,
                    selectedCategoryId: effectiveCategoryId,
                    options: (childData?.options || []).map((item) => ({
                        menuItemId: item?.menuItemId,
                        label: item?.label,
                        campaignId: item?.campaignId,
                        inboundQueue: item?.inboundQueue,
                    })),
                });

                if (isRedesManualFlow) {
                    await loadTemplatesAndCatalogs({
                        campaignId: effectiveCampaignId,
                        menuItemId: effectiveMenuItemId,
                        categoryId: effectiveCategoryId,
                        contactId: "",
                        detail: null,
                    });
                    const today = getTodayLocalDate();
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __redes_pqrs_flow:
                            String(prev?.__redes_pqrs_flow || "").trim() ||
                            "Credito/Inversion",
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

                if (selectedSecureInboundManual || isFollowupInboundFlowEffective) {
                    await loadTemplatesAndCatalogs({
                        campaignId: effectiveCampaignId,
                        menuItemId: effectiveMenuItemId,
                        categoryId: effectiveCategoryId,
                        contactId: "",
                        detail: null,
                    });
                    if (selectedSecureInboundManual) {
                        setDynamicFormAnswers((prev) => ({
                            ...prev,
                            __inbound_nombre_cliente: "",
                            __inbound_nombre_cliente_label: "",
                            __inbound_manual_client_locked: "",
                        }));
                    }
                    return;
                }

                const preselectedChild = childData?.options?.find(
                    (item) =>
                        String(item.menuItemId) ===
                        String(effectiveMenuItemId || ""),
                );

                const currentInboundAgentNumber = String(
                    sessionStorage.getItem("inbound_agent_number") || "",
                ).trim();

                let queueMatchedChild = null;
                let hasActiveInboundQueue = false;
                let currentCallUniqueId = "";
                let resolvedInboundTicketId = "";
                let resolvedInboundPhone = "";
                const manualInboundClientLocked =
                    String(
                        dynamicFormAnswersRef.current
                            ?.__inbound_manual_client_locked || "",
                    ).trim() === "1";
                if (currentInboundAgentNumber) {
                    try {
                        const { ok, json } = await fetchInboundCurrentCall({
                            agentNumber: currentInboundAgentNumber,
                        });
                        const activeQueue = String(
                            json?.data?.queue || "",
                        ).trim();
                        currentCallUniqueId = String(
                            json?.data?.ticketId ||
                                json?.data?.idCallEntry ||
                                "",
                        ).trim();
                        hasActiveInboundQueue = Boolean(ok && activeQueue);
                        inboundDebugLog("manualFlow:active-call", {
                            currentInboundAgentNumber,
                            ok,
                            activeQueue,
                            ticketId: String(json?.data?.ticketId || "").trim(),
                            idCallEntry: String(json?.data?.idCallEntry || "").trim(),
                        });

                        const resolvedTicketId = String(
                            json?.data?.ticketId || json?.data?.idCallEntry || "",
                        ).trim();
                        const resolvedPhone = String(
                            json?.data?.phone || "",
                        ).trim();
                        resolvedInboundTicketId = resolvedTicketId;
                        resolvedInboundPhone = resolvedPhone;
                        if (ok && !selectedSecureInboundManual && !isFollowupInboundFlowEffective) {
                            // Hidrata siempre ticket/celular en inbound normal.
                            setDynamicFormAnswers((prev) => ({
                                ...prev,
                                ...(resolvedTicketId
                                    ? {
                                          CAMPO5: resolvedTicketId,
                                          ticketId: resolvedTicketId,
                                          idLlamada: resolvedTicketId,
                                      }
                                    : {}),
                                ...(resolvedPhone
                                    ? {
                                          CAMPO3: resolvedPhone,
                                      }
                                    : {}),
                                __inbound_current_call_id: resolvedTicketId,
                                __inbound_current_call_phone: resolvedPhone,
                                __inbound_current_call_queue: activeQueue,
                            }));
                        }

                        if (ok && activeQueue) {
                            const currentSelectedClient = String(
                                dynamicFormAnswersRef.current?.__inbound_nombre_cliente ||
                                    "",
                            ).trim();
                            queueMatchedChild = resolveInboundQueueChildMatch({
                                options: childData?.options || [],
                                activeQueueValue: activeQueue,
                                preferredMenuItemId: currentSelectedClient,
                                selectedCampaignLabel,
                            });
                            inboundDebugLog("manualFlow:queue-match-result", {
                                activeQueue,
                                selected: queueMatchedChild
                                    ? {
                                          menuItemId: queueMatchedChild.menuItemId,
                                          label: queueMatchedChild.label,
                                          campaignId: queueMatchedChild.campaignId,
                                      }
                                    : null,
                            });
                        }
                    } catch {
                        inboundDebugLog("manualFlow:active-call-error", {
                            currentInboundAgentNumber,
                        });
                        queueMatchedChild = null;
                    }
                }

                if (queueMatchedChild) {
                    if (
                        isFollowupInboundFlowEffective &&
                        manualInboundClientLocked
                    ) {
                        inboundDebugLog("manualFlow:skip-queue-apply-manual-lock", {
                            selectedFollowupInboundManual:
                                isFollowupInboundFlowEffective,
                            manualInboundClientLocked,
                            queueMatchedChild: {
                                menuItemId: queueMatchedChild.menuItemId,
                                label: queueMatchedChild.label,
                                campaignId: queueMatchedChild.campaignId,
                            },
                        });
                        return;
                    }
                    const matchedMenuItemId = String(
                        queueMatchedChild.menuItemId || "",
                    ).trim();
                    const currentlySelectedMenuItemId = String(
                        dynamicFormAnswersRef.current?.__inbound_nombre_cliente ||
                            "",
                    ).trim();
                    const sameSelection =
                        matchedMenuItemId &&
                        matchedMenuItemId === currentlySelectedMenuItemId;
                    const alreadyRoutedThisCall =
                        currentCallUniqueId &&
                        lastInboundAutoRouteCallRef.current ===
                            currentCallUniqueId;

                    if (sameSelection && alreadyRoutedThisCall) {
                        inboundDebugLog(
                            "manualFlow:skip-duplicate-apply-for-call",
                            {
                                currentCallUniqueId,
                                matchedMenuItemId,
                            },
                        );
                        return;
                    }

                    inboundDebugLog("manualFlow:apply-queue-matched-child", {
                        child: queueMatchedChild,
                    });
                    if (currentCallUniqueId) {
                        lastInboundAutoRouteCallRef.current = currentCallUniqueId;
                    }
                    setCampaignIdSeleccionada(
                        String(queueMatchedChild.campaignId || "").trim(),
                    );
                    setMenuItemIdSeleccionado(
                        String(queueMatchedChild.menuItemId || "").trim(),
                    );
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
                        categoryId: effectiveCategoryId,
                        contactId: "",
                        detail: null,
                    });
                    // Reaplica el cliente resuelto para evitar que un refresh de plantilla
                    // lo deje vacio por condiciones de carrera de estado.
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __inbound_nombre_cliente:
                            queueMatchedChild.menuItemId || "",
                        __inbound_nombre_cliente_label:
                            queueMatchedChild.label || "",
                        ...(resolvedInboundTicketId
                            ? {
                                  CAMPO5: resolvedInboundTicketId,
                                  ticketId: resolvedInboundTicketId,
                                  idLlamada: resolvedInboundTicketId,
                              }
                            : {}),
                        ...(resolvedInboundPhone
                            ? {
                                  CAMPO3: resolvedInboundPhone,
                              }
                            : {}),
                    }));
                    return;
                }

                if (preselectedChild) {
                    if (hasActiveInboundQueue && !queueMatchedChild) {
                        inboundDebugLog("manualFlow:clear-preselected-child", {
                            reason: "has_active_queue_but_no_safe_match",
                            preselectedChild,
                        });
                        setDynamicFormAnswers((prev) => ({
                            ...prev,
                            __inbound_nombre_cliente: "",
                            __inbound_nombre_cliente_label: "",
                        }));
                        return;
                    }
                    inboundDebugLog("manualFlow:apply-preselected-child", {
                        preselectedChild,
                    });
                    setCampaignIdSeleccionada(
                        String(preselectedChild.campaignId || "").trim(),
                    );
                    setMenuItemIdSeleccionado(
                        String(preselectedChild.menuItemId || "").trim(),
                    );
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __inbound_nombre_cliente: preselectedChild.menuItemId,
                        __inbound_nombre_cliente_label:
                            preselectedChild.label || "",
                    }));
                    await loadTemplatesAndCatalogs({
                        campaignId:
                            String(preselectedChild.campaignId || "").trim() ||
                            effectiveCampaignId,
                        menuItemId:
                            String(preselectedChild.menuItemId || "").trim() ||
                            effectiveMenuItemId,
                        categoryId: effectiveCategoryId,
                        contactId: "",
                        detail: null,
                    });
                    setDynamicFormAnswers((prev) => ({
                        ...prev,
                        __inbound_nombre_cliente:
                            preselectedChild.menuItemId || "",
                        __inbound_nombre_cliente_label:
                            preselectedChild.label || "",
                        ...(resolvedInboundTicketId
                            ? {
                                  CAMPO5: resolvedInboundTicketId,
                                  ticketId: resolvedInboundTicketId,
                                  idLlamada: resolvedInboundTicketId,
                              }
                            : {}),
                        ...(resolvedInboundPhone
                            ? {
                                  CAMPO3: resolvedInboundPhone,
                              }
                            : {}),
                    }));
                    return;
                }

                await loadTemplatesAndCatalogs({
                    campaignId: effectiveCampaignId,
                    menuItemId: effectiveMenuItemId,
                    categoryId: effectiveCategoryId,
                    contactId: "",
                    detail: null,
                });

            };

            Promise.resolve(loadManualFlow()).finally(() => {
                inboundManualLoadInFlightRef.current = false;
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
        selectedSecureInboundManual,
        selectedFollowupInboundManual,
        selectedCampaignLabel,
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
