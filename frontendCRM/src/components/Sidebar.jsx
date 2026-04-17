import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import AccordionMenu, {
    INBOUND_HISTORICO_CAMPAIGN_ID,
    INBOUND_HISTORICO_MENU_ITEM_ID,
} from "./AccordionMenu";
import {
    fetchAgentStatusOptions,
    fetchAgentMachineContext,
    fetchInboundCurrentCall,
    startAgentSession,
    upsertAgentSessionContext,
} from "../services/dashboard.service";
import { getOrCreateTabSessionId } from "../pages/agente/dashboardAgente.helpers";

const MENU_ICONS = {
    "administrar-bases": "\u{1F4C2}",
    campanias: "\u{1F4E3}",
    "management-levels": "\u2699\uFE0F",
    users: "\u{1F465}",
    settings: "\u2699\uFE0F",
    scripts: "\u{1F4DD}",
    dashboard: "\u{1F4CA}",
    agents: "\u{1F3A7}",
    reports: "\u{1F4C8}",
    inicio: "\u{1F3E0}",
    gestion: "\u260E\uFE0F",
    "grabaciones-outbound": "\u{1F399}\uFE0F",
    "grabaciones-inbound": "\u{1F4DE}",
    "consultor-leads": "\u{1F4CB}",
    "consultor-documents": "\u{1F4C1}",
    "consultor-credit-status": "\u{1F4B3}",
    "consultor-reassign": "\u{1F504}",
    "consultor-assignment": "\u2696\uFE0F",
};

function normalizeInboundAccessLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function allowsInboundOpenWithoutCall(...values) {
    const normalizedValues = values.map(normalizeInboundAccessLabel);

    return (
        normalizedValues.includes("kullki wasi") ||
        normalizedValues.includes("atm") ||
        normalizedValues.includes("oscus") ||
        normalizedValues.includes("atm oscus")
    );
}

function isInboundHistoricoAction({ campaignId = "", menuItemId = "" }) {
    return (
        String(campaignId || "").trim() === INBOUND_HISTORICO_CAMPAIGN_ID ||
        String(menuItemId || "").trim() === INBOUND_HISTORICO_MENU_ITEM_ID
    );
}

const SECURE_INBOUND_MANUAL_CODE = "KMB$221133";
const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";
const INBOUND_AUTO_TARGET_SESSION_KEY = "inbound_auto_last_target";
const INBOUND_AUTO_TARGET_SHARED_KEY = "inbound_auto_last_target_shared";
const INBOUND_DRAFT_STATE_SESSION_KEY = "inbound_manual_draft_state";
const INBOUND_AGENT_LOCK_SESSION_KEY = "inbound_agent_number_locked";
const INBOUND_AGENT_LOCK_SHARED_KEY = "inbound_agent_number_locked_shared";
const INBOUND_DEFAULT_TARGET_LABELS = [
    "gestion inbound",
    "kullki wasi",
    "atm oscus",
    "atm",
    "oscus",
];

function Sidebar({
    user,
    role,
    adminPage,
    onChangeAdminPage,
    onSelectCampaign,
    agentPage,
    onChangeAgentPage,
    consultorPage,
    onChangeConsultorPage,
    onLogout,
    agentStatus,
    onChangeAgentStatus,
}) {
    const API_BASE = import.meta.env.VITE_API_BASE;
    const [collapsed, setCollapsed] = useState(false);
    const [inboundAgentNumber, setInboundAgentNumber] = useState("");
    const [isInboundAgentNumberLocked, setIsInboundAgentNumberLocked] =
        useState(false);
    const [hasActiveInboundCall, setHasActiveInboundCall] = useState(false);
    const [activeInboundCallId, setActiveInboundCallId] = useState("");
    const [pendingInboundCallId, setPendingInboundCallId] = useState("");
    const [agentStatusOptions, setAgentStatusOptions] = useState([]);
    const [sessionStatus, setSessionStatus] = useState("");
    const [sessionHydrated, setSessionHydrated] = useState(false);
    const effectiveRole = role || "ADMINISTRADOR";
    const prevAgentPageRef = useRef(agentPage);
    const sessionIdRef = useRef("");
    const lastAutoOpenedInboundCallRef = useRef("");
    const previousInboundCallIdRef = useRef("");

    useEffect(() => {
        if (
            effectiveRole === "ASESOR" &&
            agentPage === "gestion" &&
            prevAgentPageRef.current !== "gestion"
        ) {
            setCollapsed(true);
        }
        prevAgentPageRef.current = agentPage;
    }, [agentPage, effectiveRole]);

    useEffect(() => {
        sessionIdRef.current = getOrCreateTabSessionId();
        const searchParams = new URLSearchParams(window.location.search);
        const inboundAgentFromQuery = String(
            searchParams.get("inboundAgentNumber") || "",
        ).trim();
        const storedValue =
            inboundAgentFromQuery ||
            String(
                sessionStorage.getItem("inbound_agent_number") || "",
            ).trim() ||
            String(
                localStorage.getItem("inbound_agent_number_shared") || "",
            ).trim();
        const storedLocked =
            String(
                sessionStorage.getItem(INBOUND_AGENT_LOCK_SESSION_KEY) ||
                    localStorage.getItem(INBOUND_AGENT_LOCK_SHARED_KEY) ||
                    "",
            ).trim() === "1";

        setInboundAgentNumber(storedValue);
        setIsInboundAgentNumberLocked(storedLocked);
        if (storedValue) {
            sessionStorage.setItem("inbound_agent_number", storedValue);
            localStorage.setItem("inbound_agent_number_shared", storedValue);
        }

        if (inboundAgentFromQuery) {
            searchParams.delete("inboundAgentNumber");
            const nextSearch = searchParams.toString();
            const nextUrl = `${window.location.pathname}${
                nextSearch ? `?${nextSearch}` : ""
            }${window.location.hash || ""}`;
            window.history.replaceState({}, "", nextUrl);
        }
    }, []);

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;

        const hasSavedTarget =
            Boolean(sessionStorage.getItem(INBOUND_AUTO_TARGET_SESSION_KEY)) ||
            Boolean(localStorage.getItem(INBOUND_AUTO_TARGET_SHARED_KEY));

        if (hasSavedTarget) {
            return;
        }

        let cancelled = false;

        const normalizeLabel = (value) =>
            String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .toLowerCase();

        const getNodeLabel = (node) =>
            String(
                node?.campania ||
                    node?.subcampania ||
                    node?.nombre ||
                    node?.label ||
                    "",
            ).trim();

        const flattenNodes = (nodes = [], parentLabel = "") =>
            (Array.isArray(nodes) ? nodes : []).flatMap((node) => {
                const label = getNodeLabel(node);
                const entry = {
                    node,
                    label,
                    normalizedLabel: normalizeLabel(label),
                    parentLabel,
                };
                const children = Array.isArray(node?.subcampanias)
                    ? node.subcampanias
                    : [];

                return [entry, ...flattenNodes(children, label || parentLabel)];
            });

        const ensureDefaultInboundTarget = async () => {
            try {
                const token = localStorage.getItem("access_token") || "";
                const res = await fetch(
                    `${API_BASE}/api/menu/categories/${encodeURIComponent(
                        INBOUND_MENU_CATEGORY_ID,
                    )}/tree-detailed`,
                    {
                        headers: token
                            ? { Authorization: `Bearer ${token}` }
                            : undefined,
                    },
                );
                const json = await res.json().catch(() => ({}));
                if (cancelled || !res.ok) return;

                const flat = flattenNodes(json?.data || []);
                const picked =
                    flat.find((entry) =>
                        INBOUND_DEFAULT_TARGET_LABELS.includes(
                            entry.normalizedLabel,
                        ),
                    ) || null;

                if (!picked) return;

                const campaignId = String(
                    picked?.node?.campaignId ||
                        picked?.node?.nombre ||
                        picked?.node?.subcampania ||
                        picked?.label ||
                        "",
                ).trim();
                const menuItemId = String(picked?.node?.id || "").trim();
                const payload = {
                    campaignId,
                    importId: "",
                    menuItemId,
                    categoryId: INBOUND_MENU_CATEGORY_ID,
                    manualFlow: true,
                    leafLabel: picked?.label || campaignId || "",
                    secureInboundManual: false,
                    followupInboundManual: false,
                };

                if (!campaignId) return;

                sessionStorage.setItem(
                    INBOUND_AUTO_TARGET_SESSION_KEY,
                    JSON.stringify(payload),
                );
                localStorage.setItem(
                    INBOUND_AUTO_TARGET_SHARED_KEY,
                    JSON.stringify(payload),
                );
            } catch {
                // no-op
            }
        };

        ensureDefaultInboundTarget();

        return () => {
            cancelled = true;
        };
    }, [API_BASE, effectiveRole]);

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;

        let cancelled = false;

        const loadStatusOptions = async () => {
            const { ok, json } = await fetchAgentStatusOptions();
            if (cancelled || !ok) return;

            const options = Array.isArray(json?.data) ? json.data : [];
            setAgentStatusOptions(options);

            if (
                sessionHydrated &&
                String(agentStatus || "").trim() &&
                !options.some(
                    (item) =>
                        String(item?.value || "") === String(agentStatus || ""),
                )
            ) {
                onChangeAgentStatus?.(String(options[0]?.value || "").trim());
            }
        };

        loadStatusOptions();

        return () => {
            cancelled = true;
        };
    }, [agentStatus, effectiveRole, onChangeAgentStatus, sessionHydrated]);

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;

        let cancelled = false;

        const hydrateSessionContext = async () => {
            const sessionId = String(sessionIdRef.current || "").trim();
            if (!sessionId) {
                setSessionHydrated(true);
                return;
            }

            try {
                const { ok, json } = await startAgentSession({
                    sessionId,
                    agentNumber: inboundAgentNumber,
                });
                if (cancelled) return;
                if (!ok) {
                    setSessionHydrated(true);
                    return;
                }

                const sessionData = json?.data || null;
                const nextAgentNumber = String(
                    sessionData?.AgentNumber || "",
                ).trim();
                const nextEstado = String(sessionData?.Estado || "").trim();
                const machineContext = await fetchAgentMachineContext();
                const machineMappedCode = String(
                    machineContext?.json?.data?.mappedZoiperCode || "",
                ).trim();
                const hasMachineMappedCode = Boolean(
                    machineContext?.ok && machineMappedCode,
                );

                if (hasMachineMappedCode) {
                    // Si hay mapeo IP+Zoiper, el código queda forzado y bloqueado.
                    setInboundAgentNumber(machineMappedCode);
                    setIsInboundAgentNumberLocked(true);
                    sessionStorage.setItem(
                        "inbound_agent_number",
                        machineMappedCode,
                    );
                    sessionStorage.setItem(
                        INBOUND_AGENT_LOCK_SESSION_KEY,
                        "1",
                    );
                    localStorage.setItem(
                        "inbound_agent_number_shared",
                        machineMappedCode,
                    );
                    localStorage.setItem(
                        INBOUND_AGENT_LOCK_SHARED_KEY,
                        "1",
                    );
                } else if (nextAgentNumber) {
                    setInboundAgentNumber(nextAgentNumber);
                    setIsInboundAgentNumberLocked(false);
                    sessionStorage.setItem(
                        "inbound_agent_number",
                        nextAgentNumber,
                    );
                    localStorage.setItem(
                        "inbound_agent_number_shared",
                        nextAgentNumber,
                    );
                    sessionStorage.removeItem(INBOUND_AGENT_LOCK_SESSION_KEY);
                    localStorage.removeItem(INBOUND_AGENT_LOCK_SHARED_KEY);
                } else {
                    setIsInboundAgentNumberLocked(false);
                    sessionStorage.removeItem(INBOUND_AGENT_LOCK_SESSION_KEY);
                    localStorage.removeItem(INBOUND_AGENT_LOCK_SHARED_KEY);
                }

                if (nextEstado) {
                    setSessionStatus(nextEstado);
                    if (
                        nextEstado !== "Login" &&
                        String(agentStatus || "").trim() !== nextEstado
                    ) {
                        onChangeAgentStatus?.(nextEstado);
                    }
                }

                setSessionHydrated(true);
            } catch {
                if (!cancelled) {
                    setSessionHydrated(true);
                }
            }
        };

        hydrateSessionContext();

        return () => {
            cancelled = true;
        };
    }, [effectiveRole, onChangeAgentStatus]);

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;

        const sessionId = String(sessionIdRef.current || "").trim();
        const resolvedEstado =
            String(agentStatus || "").trim() ||
            (String(sessionStatus || "").trim() === "Login"
                ? ""
                : String(sessionStatus || "").trim());

        if (!sessionId || !resolvedEstado) return;

        const timeoutId = window.setTimeout(() => {
            upsertAgentSessionContext({
                sessionId,
                estado: resolvedEstado,
                agentNumber: inboundAgentNumber,
            }).then(({ ok, json }) => {
                if (!ok) return;
                const persistedEstado = String(json?.data?.Estado || "").trim();
                if (persistedEstado) {
                    setSessionStatus(persistedEstado);
                }
            });
        }, 300);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        agentStatus,
        agentStatusOptions,
        effectiveRole,
        inboundAgentNumber,
        sessionStatus,
    ]);

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;

        let cancelled = false;
        let running = false;

        const syncInboundCallState = async () => {
            if (running || cancelled) {
                return;
            }
            running = true;
            try {
                const currentInboundAgentNumber = String(
                    inboundAgentNumber || "",
                ).trim();

                if (!currentInboundAgentNumber) {
                    if (!cancelled) {
                        setHasActiveInboundCall(false);
                        setActiveInboundCallId("");
                    }
                    return;
                }

                const { ok, json } = await fetchInboundCurrentCall({
                    agentNumber: currentInboundAgentNumber,
                });

                if (!cancelled) {
                    setHasActiveInboundCall(Boolean(ok && json?.data));
                    setActiveInboundCallId(
                        ok && json?.data
                            ? String(
                                  json.data?.idCallEntry ||
                                      json.data?.ticketId ||
                                      "",
                              ).trim()
                            : "",
                    );
                }
            } catch {
                if (!cancelled) {
                    setHasActiveInboundCall(false);
                    setActiveInboundCallId("");
                }
            } finally {
                running = false;
            }
        };

        syncInboundCallState();
        const intervalId = setInterval(syncInboundCallState, 3500);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [effectiveRole, inboundAgentNumber]);

    const resolveSavedInboundTarget = () => {
        const savedTargetRaw =
            sessionStorage.getItem(INBOUND_AUTO_TARGET_SESSION_KEY) ||
            localStorage.getItem(INBOUND_AUTO_TARGET_SHARED_KEY) ||
            "";
        if (!savedTargetRaw) {
            return null;
        }

        try {
            return JSON.parse(savedTargetRaw);
        } catch {
            return null;
        }
    };

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;
        if (agentPage !== "inicio") return;
        if (!hasActiveInboundCall || !activeInboundCallId) return;
        if (lastAutoOpenedInboundCallRef.current === activeInboundCallId)
            return;
        const savedTarget = resolveSavedInboundTarget();

        const campaignId = String(savedTarget?.campaignId || "").trim();
        if (!campaignId || typeof onSelectCampaign !== "function") {
            return;
        }

        lastAutoOpenedInboundCallRef.current = activeInboundCallId;
        onChangeAgentPage?.("gestion");
        onSelectCampaign(
            campaignId,
            String(savedTarget?.importId || "").trim(),
            String(savedTarget?.menuItemId || "").trim(),
            String(savedTarget?.categoryId || "").trim(),
            Boolean(savedTarget?.manualFlow),
            String(savedTarget?.leafLabel || campaignId).trim(),
            Boolean(savedTarget?.secureInboundManual),
            Boolean(savedTarget?.followupInboundManual),
        );
    }, [
        activeInboundCallId,
        agentPage,
        effectiveRole,
        hasActiveInboundCall,
        onChangeAgentPage,
        onSelectCampaign,
    ]);

    useEffect(() => {
        if (effectiveRole.toUpperCase() !== "ASESOR") return;

        const currentCallId = String(activeInboundCallId || "").trim();
        if (!currentCallId) {
            return;
        }

        const previousCallId = String(
            previousInboundCallIdRef.current || "",
        ).trim();
        if (!previousCallId) {
            previousInboundCallIdRef.current = currentCallId;
            return;
        }

        if (previousCallId === currentCallId) {
            return;
        }
        previousInboundCallIdRef.current = currentCallId;

        if (agentPage !== "gestion") {
            return;
        }

        let draftState = null;
        try {
            draftState = JSON.parse(
                sessionStorage.getItem(INBOUND_DRAFT_STATE_SESSION_KEY) || "{}",
            );
        } catch {
            draftState = null;
        }

        const hasDraft = Boolean(draftState?.hasDraft);
        const draftCallId = String(draftState?.callId || "").trim();
        const isDifferentCall = !draftCallId || draftCallId !== currentCallId;
        const savedInboundTarget = resolveSavedInboundTarget();
        const isInboundManualTarget =
            Boolean(savedInboundTarget?.manualFlow) &&
            String(savedInboundTarget?.categoryId || "").trim() ===
                "fa70b8a1-2c69-11f1-b790-000c2904c92f";
        const hasInboundContext = Boolean(draftCallId) || isInboundManualTarget;

        if ((hasDraft || hasInboundContext) && isDifferentCall) {
            setPendingInboundCallId(currentCallId);
        }
    }, [activeInboundCallId, agentPage, effectiveRole]);

    const handleOpenPendingInboundInNewTab = () => {
        const savedTarget = resolveSavedInboundTarget();
        const campaignId = String(savedTarget?.campaignId || "").trim();
        if (!campaignId) {
            alert(
                "No se pudo identificar la gestión inbound para abrir la nueva llamada.",
            );
            return;
        }

        const url = new URL(window.location.href);
        const resolvedAgentNumber = String(inboundAgentNumber || "").trim();
        if (resolvedAgentNumber) {
            url.searchParams.set("inboundAgentNumber", resolvedAgentNumber);
        }

        const openedWindow = window.open(url.toString(), "_blank");
        if (!openedWindow) {
            alert(
                "Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para continuar.",
            );
            return;
        }

        setPendingInboundCallId("");
    };

    const menuAdmin = [
        { label: "Administrar bases", key: "administrar-bases" },
        { label: "Administrar Campañas", key: "campanias" },
        { label: "Niveles de gestión", key: "management-levels" },
        { label: "Administrar Usuarios", key: "users" },
        { label: "Configuración", key: "settings" },
        { label: "Scripts", key: "scripts" },
    ];
    const menuSupervisor = [
        { label: "Dashboard", key: "dashboard" },
        { label: "Agentes", key: "agents" },
        { label: "Reportes", key: "reports" },
        { label: "Grabaciones Outbound", key: "grabaciones-outbound" },
        { label: "Grabaciones Inbound", key: "grabaciones-inbound" },
    ];
    const menuAgente = [{ label: "Inicio", key: "inicio" }];
    const menuConsultor = [
        { label: "Gestion Externa", key: "consultor-leads" },
        { label: "Seguimiento Documentos", key: "consultor-documents" },
        { label: "Estado Credito", key: "consultor-credit-status" },
    ];
    const menuConsultorAdmin = [
        { label: "Gestion Externa", key: "consultor-leads" },
        { label: "Seguimiento Documentos", key: "consultor-documents" },
        { label: "Estado Credito", key: "consultor-credit-status" },
        { label: "Reasignar Leads", key: "consultor-reassign" },
        { label: "Configuracion Asignacion", key: "consultor-assignment" },
    ];

    const getMenu = () => {
        if (effectiveRole === "ADMINISTRADOR") return menuAdmin;
        if (effectiveRole === "SUPERVISOR") return menuSupervisor;
        if (effectiveRole === "CONSULTOR_ADMIN") {
            return menuConsultorAdmin;
        }
        if (effectiveRole === "CONSULTOR") {
            return menuConsultor;
        }
        return menuAgente;
    };

    const fullName = String(user?.full_name || "").trim();
    const fallbackName = String(user?.username || user?.email || "").trim();
    const displayName = fullName || fallbackName || "Usuario";
    const menu = getMenu();

    const getMenuIcon = (key) => MENU_ICONS[key] || "\u2022";

    const hasInboundCurrentCallWithRetry = async (
        agentNumber,
        retries = 3,
        waitMs = 350,
    ) => {
        const normalizedAgent = String(agentNumber || "").trim();
        if (!normalizedAgent) {
            return false;
        }

        for (let attempt = 0; attempt < retries; attempt += 1) {
            try {
                const { ok, json } = await fetchInboundCurrentCall({
                    agentNumber: normalizedAgent,
                });
                if (ok && json?.data) {
                    return true;
                }
            } catch {
                // no-op
            }

            if (attempt < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }

        return false;
    };

    const handleClick = (item) => {
        if (
            effectiveRole.toUpperCase() === "ADMINISTRADOR" &&
            onChangeAdminPage
        ) {
            onChangeAdminPage(item.key);
        }

        if (effectiveRole.toUpperCase() === "ASESOR" && item.key === "inicio") {
            onChangeAgentPage?.("inicio");
            return;
        }

        if (
            effectiveRole.toUpperCase() === "ASESOR" &&
            item.key === "gestion"
        ) {
            onChangeAgentPage?.("gestion");
            return;
        }

        if (effectiveRole === "SUPERVISOR" && onChangeAdminPage) {
            onChangeAdminPage(item.key);
        }

        if (
            ["CONSULTOR", "CONSULTOR_ADMIN"].includes(
                effectiveRole.toUpperCase(),
            ) &&
            onChangeConsultorPage
        ) {
            onChangeConsultorPage(item.key);
        }
    };

    const isActive = (item) => {
        if (effectiveRole === "SUPERVISOR") {
            const supervisorPage = [
                "dashboard",
                "reports",
                "grabaciones-outbound",
                "grabaciones-inbound",
            ].includes(adminPage)
                ? adminPage
                : "dashboard";
            return item.key === supervisorPage;
        }
        if (effectiveRole === "ADMINISTRADOR") {
            return item.key === adminPage;
        }
        if (effectiveRole === "ASESOR") return item.key === agentPage;
        if (["CONSULTOR", "CONSULTOR_ADMIN"].includes(effectiveRole)) {
            return item.key === consultorPage;
        }
        return false;
    };

    return (
        <div
            style={{
                ...styles.sidebar,
                width: collapsed ? "60px" : "240px",
                padding: collapsed ? "1rem 0.5rem" : "1.5rem 1rem",
            }}
        >
            <button
                type="button"
                style={styles.collapseBtn}
                onClick={() => setCollapsed(!collapsed)}
            >
                {collapsed ? "\u203A" : "\u2039"}
            </button>

            {!collapsed && (
                <div style={styles.userPanel}>
                    <span style={styles.roleBadge}>{effectiveRole}</span>
                    <span style={styles.userName}>{displayName}</span>

                    {effectiveRole.toUpperCase() === "ASESOR" && (
                        <select
                            value={agentStatus || ""}
                            onChange={(e) =>
                                onChangeAgentStatus?.(e.target.value)
                            }
                            style={styles.statusSelect}
                        >
                            <option value="">Selecciona estado</option>
                            {agentStatusOptions.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            <ul style={styles.menu}>
                {menu.map((item) => (
                    <li
                        key={item.key}
                        style={{
                            padding: 0,
                            background: "none",
                            border: "none",
                        }}
                    >
                        <button
                            type="button"
                            style={{
                                ...styles.menuItem,
                                ...(isActive(item)
                                    ? styles.menuItemActive
                                    : styles.menuItemInactive),
                                justifyContent: collapsed
                                    ? "center"
                                    : "flex-start",
                                width: "100%",
                                border: "none",
                                color: "inherit",
                                textAlign: "left",
                            }}
                            onClick={() => handleClick(item)}
                        >
                            <span style={styles.menuIcon}>
                                {getMenuIcon(item.key)}
                            </span>
                            {!collapsed && (
                                <span style={styles.menuLabel}>
                                    {item.label}
                                </span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>

            {effectiveRole.toUpperCase() === "ASESOR" && !collapsed && (
                <div style={{ width: "100%", marginTop: "0.75rem" }}>
                    <div style={styles.inboundAgentCard}>
                        <label
                            htmlFor="sidebar-inbound-agent-number"
                            style={styles.inboundAgentLabel}
                        >
                            Código agente inbound
                        </label>
                        <input
                            id="sidebar-inbound-agent-number"
                            type="text"
                            value={inboundAgentNumber}
                            readOnly={isInboundAgentNumberLocked}
                            disabled={isInboundAgentNumberLocked}
                            onChange={(event) => {
                                if (isInboundAgentNumberLocked) return;
                                const nextValue = String(
                                    event.target.value || "",
                                ).trim();
                                setInboundAgentNumber(nextValue);
                                sessionStorage.setItem(
                                    "inbound_agent_number",
                                    nextValue,
                                );
                                localStorage.setItem(
                                    "inbound_agent_number_shared",
                                    nextValue,
                                );
                            }}
                            placeholder="Ej: 9001"
                            style={{
                                ...styles.inboundAgentInput,
                                ...(isInboundAgentNumberLocked
                                    ? styles.inboundAgentInputLocked
                                    : {}),
                            }}
                        />
                        <span style={styles.inboundAgentHint}>
                            {isInboundAgentNumberLocked
                                ? "Código detectado automáticamente por IP. Está bloqueado para evitar cambios."
                                : ""}
                        </span>
                    </div>
                    <AccordionMenu
                        hiddenNormalizedLabels={
                            hasActiveInboundCall
                                ? ["kullki wasi", "atm", "oscus", "atm oscus"]
                                : []
                        }
                        onLeafSelect={async ({
                            campaignId,
                            importId,
                            menuItemId,
                            categoryId,
                            manualFlow,
                            leafLabel,
                            secureInboundManual,
                            followupInboundManual,
                        }) => {
                            const isUnlockedInboundManual =
                                Boolean(secureInboundManual) ||
                                Boolean(followupInboundManual);
                            const allowsOpenWithoutCall =
                                allowsInboundOpenWithoutCall(
                                    leafLabel,
                                    campaignId,
                                );
                            const isHistoricoInbound = isInboundHistoricoAction(
                                {
                                    campaignId,
                                    menuItemId,
                                },
                            );
                            const requiresInboundAgentCode =
                                Boolean(manualFlow) &&
                                String(categoryId || "").trim() ===
                                    "fa70b8a1-2c69-11f1-b790-000c2904c92f";
                            const currentInboundAgentNumber = String(
                                inboundAgentNumber || "",
                            ).trim();

                            if (
                                requiresInboundAgentCode &&
                                !isHistoricoInbound &&
                                !isUnlockedInboundManual &&
                                !currentInboundAgentNumber
                            ) {
                                alert(
                                    "Debes ingresar el código agente inbound antes de abrir la gestión inbound.",
                                );
                                return;
                            }

                            if (secureInboundManual) {
                                const enteredCode = String(
                                    window.prompt(
                                        "Ingresa el código de seguridad para abrir la gestión inbound manual:",
                                        "",
                                    ) || "",
                                ).trim();

                                if (
                                    enteredCode !== SECURE_INBOUND_MANUAL_CODE
                                ) {
                                    alert(
                                        "Código de seguridad inválido para la gestión inbound manual.",
                                    );
                                    return;
                                }
                            }

                            if (
                                requiresInboundAgentCode &&
                                !isHistoricoInbound &&
                                !isUnlockedInboundManual &&
                                !allowsOpenWithoutCall
                            ) {
                                const hasActiveCall =
                                    await hasInboundCurrentCallWithRetry(
                                        currentInboundAgentNumber,
                                    );

                                if (!hasActiveCall) {
                                    alert(
                                        "No tienes una llamada inbound activa asignada. Solo puedes abrir la gestión inbound cuando tengas una llamada en curso.",
                                    );
                                    return;
                                }
                            }

                            if (onSelectCampaign && campaignId) {
                                if (
                                    requiresInboundAgentCode &&
                                    !isHistoricoInbound
                                ) {
                                    sessionStorage.setItem(
                                        INBOUND_AUTO_TARGET_SESSION_KEY,
                                        JSON.stringify({
                                            campaignId,
                                            importId: importId || "",
                                            menuItemId: menuItemId || "",
                                            categoryId: categoryId || "",
                                            manualFlow: Boolean(manualFlow),
                                            leafLabel:
                                                leafLabel || campaignId || "",
                                            secureInboundManual:
                                                Boolean(secureInboundManual),
                                            followupInboundManual: Boolean(
                                                followupInboundManual,
                                            ),
                                        }),
                                    );
                                    localStorage.setItem(
                                        INBOUND_AUTO_TARGET_SHARED_KEY,
                                        JSON.stringify({
                                            campaignId,
                                            importId: importId || "",
                                            menuItemId: menuItemId || "",
                                            categoryId: categoryId || "",
                                            manualFlow: Boolean(manualFlow),
                                            leafLabel:
                                                leafLabel || campaignId || "",
                                            secureInboundManual:
                                                Boolean(secureInboundManual),
                                            followupInboundManual: Boolean(
                                                followupInboundManual,
                                            ),
                                        }),
                                    );
                                }
                                onChangeAgentPage?.("gestion");
                                onSelectCampaign(
                                    campaignId,
                                    importId,
                                    menuItemId,
                                    categoryId,
                                    manualFlow,
                                    leafLabel || campaignId || "",
                                    secureInboundManual,
                                    followupInboundManual,
                                );
                            }
                        }}
                    />
                </div>
            )}

            <div style={styles.footer}>
                <button
                    type="button"
                    style={{
                        ...styles.logoutButton,
                        justifyContent: collapsed ? "center" : "flex-start",
                    }}
                    onClick={onLogout}
                >
                    <span style={styles.logoutIcon} aria-hidden="true">
                        {"\u21A9"}
                    </span>
                    {!collapsed && (
                        <span style={styles.logoutLabel}>Cerrar sesión</span>
                    )}
                </button>
            </div>

            {Boolean(pendingInboundCallId) && agentPage === "gestion" && (
                <div style={styles.inboundPendingOverlay}>
                    <div style={styles.inboundPendingModal}>
                        <span style={styles.inboundPendingTitle}>
                            Nueva llamada ingresada
                        </span>
                        <span style={styles.inboundPendingText}>
                            Tienes una nueva llamada inbound mientras tu gestión
                            actual aún no se guarda. Ábrela en otra pestaña para
                            no perder tus datos.
                        </span>
                        <div style={styles.inboundPendingActions}>
                            <button
                                type="button"
                                style={styles.inboundPendingButton}
                                onClick={handleOpenPendingInboundInNewTab}
                            >
                                Abrir nueva llamada
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    sidebar: {
        background:
            "linear-gradient(180deg, #0f3b82 0%, #0b2f68 45%, #082449 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "width 0.3s, padding 0.3s",
        boxSizing: "border-box",
        overflow: "hidden",
        flex: "none",
    },
    collapseBtn: {
        alignSelf: "flex-end",
        background: "rgba(255, 255, 255, 0.12)",
        border: "1px solid rgba(226, 232, 240, 0.28)",
        borderRadius: "999px",
        color: "#f8fafc",
        fontSize: "1rem",
        width: "30px",
        height: "30px",
        cursor: "pointer",
        marginBottom: "1rem",
    },
    title: {
        fontSize: "1.4rem",
        fontWeight: "700",
        margin: 0,
        textAlign: "center",
    },
    menu: {
        listStyle: "none",
        padding: 0,
        margin: "0.75rem 0 0",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
    },
    menuItem: {
        padding: "0.75rem 1rem",
        borderRadius: "0.6rem",
        cursor: "pointer",
        transition: "0.2s",
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
    },
    menuItemInactive: {
        backgroundColor: "rgba(15, 23, 42, 0.22)",
        border: "1px solid rgba(226, 232, 240, 0.18)",
    },
    menuItemActive: {
        backgroundColor: "#0f172a",
        border: "1px solid rgba(191, 219, 254, 0.9)",
    },
    menuIcon: {
        width: "1.15rem",
        textAlign: "center",
        fontSize: "0.95rem",
        lineHeight: 1,
    },
    menuLabel: {
        fontSize: "0.88rem",
        fontWeight: 600,
    },
    userPanel: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        marginBottom: "0.5rem",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid rgba(226, 232, 240, 0.2)",
    },
    roleBadge: {
        backgroundColor: "#0F172A",
        border: "1px solid rgba(191, 219, 254, 0.9)",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 700,
        padding: "0.2rem 0.6rem",
        alignSelf: "flex-start",
    },
    userName: {
        fontSize: "0.9rem",
        fontWeight: 600,
        color: "#E2E8F0",
        lineHeight: 1.2,
        wordBreak: "break-word",
    },
    statusSelect: {
        width: "100%",
        padding: "0.42rem 0.55rem",
        borderRadius: "8px",
        border: "1px solid rgba(226, 232, 240, 0.5)",
        backgroundColor: "#ffffff",
        color: "#0F172A",
        fontSize: "0.8rem",
    },
    inboundAgentCard: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        marginBottom: "0.75rem",
        padding: "0.65rem",
        borderRadius: "0.8rem",
        background:
            "linear-gradient(180deg, rgba(255,248,235,0.98) 0%, rgba(255,241,204,0.98) 100%)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        boxSizing: "border-box",
    },
    inboundAgentLabel: {
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "#7c4a03",
    },
    inboundAgentInput: {
        width: "100%",
        padding: "0.45rem 0.55rem",
        borderRadius: "8px",
        border: "1px solid rgba(217, 119, 6, 0.35)",
        backgroundColor: "#ffffff",
        color: "#0F172A",
        fontSize: "0.8rem",
        boxSizing: "border-box",
    },
    inboundAgentInputLocked: {
        backgroundColor: "#f8fafc",
        color: "#334155",
        border: "1px solid rgba(148, 163, 184, 0.45)",
        cursor: "not-allowed",
    },
    inboundAgentHint: {
        fontSize: "0.72rem",
        lineHeight: 1.25,
        color: "#92400e",
    },
    inboundPendingOverlay: {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1400,
        padding: "1rem",
    },
    inboundPendingModal: {
        width: "100%",
        maxWidth: "460px",
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
        padding: "1rem",
        borderRadius: "1rem",
        background:
            "linear-gradient(180deg, rgba(239,246,255,0.98) 0%, rgba(219,234,254,0.98) 100%)",
        border: "1px solid rgba(59, 130, 246, 0.5)",
        boxShadow: "0 24px 48px rgba(15, 23, 42, 0.28)",
        boxSizing: "border-box",
    },
    inboundPendingTitle: {
        fontSize: "0.96rem",
        fontWeight: 700,
        color: "#1d4ed8",
        lineHeight: 1.2,
    },
    inboundPendingText: {
        fontSize: "0.82rem",
        lineHeight: 1.3,
        color: "#1e3a8a",
    },
    inboundPendingActions: {
        marginTop: "0.25rem",
        display: "flex",
        gap: "0.55rem",
        justifyContent: "flex-end",
    },
    inboundPendingButton: {
        border: "1px solid rgba(30, 64, 175, 0.45)",
        backgroundColor: "#1d4ed8",
        color: "#fff",
        borderRadius: "8px",
        padding: "0.4rem 0.55rem",
        fontSize: "0.76rem",
        fontWeight: 600,
        cursor: "pointer",
    },
    logoutButton: {
        width: "100%",
        padding: "0.45rem 0.7rem",
        borderRadius: "999px",
        border: "1px solid rgba(191, 219, 254, 0.9)",
        backgroundColor: "#0F172A",
        color: "#ffffff",
        cursor: "pointer",
        fontSize: "0.82rem",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "0.45rem",
    },
    footer: {
        width: "100%",
        marginTop: "auto",
        paddingTop: "0.8rem",
        borderTop: "1px solid rgba(226, 232, 240, 0.2)",
    },
    logoutIcon: {
        fontSize: "0.95rem",
        lineHeight: 1,
    },
    logoutLabel: {
        fontSize: "0.82rem",
    },
};

Sidebar.propTypes = {
    user: PropTypes.shape({
        full_name: PropTypes.string,
        username: PropTypes.string,
        email: PropTypes.string,
    }),
    role: PropTypes.string,
    adminPage: PropTypes.string,
    onChangeAdminPage: PropTypes.func,
    onSelectCampaign: PropTypes.func,
    agentPage: PropTypes.string,
    onChangeAgentPage: PropTypes.func,
    consultorPage: PropTypes.string,
    onChangeConsultorPage: PropTypes.func,
    onLogout: PropTypes.func,
    agentStatus: PropTypes.string,
    onChangeAgentStatus: PropTypes.func,
};

export default Sidebar;
