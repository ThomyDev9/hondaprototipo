import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import AccordionMenu from "./AccordionMenu";

const AGENT_STATUS_OPTIONS = [
    { value: "disponible", label: "Disponible" },
    { value: "baño", label: "Baño" },
    { value: "consulta", label: "Consulta" },
    { value: "lunch", label: "Lunch" },
    { value: "reunion", label: "Reunión" },
];

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
};

function Sidebar({
    user,
    role,
    adminPage,
    onChangeAdminPage,
    onSelectCampaign,
    agentPage,
    onChangeAgentPage,
    onLogout,
    agentStatus,
    onChangeAgentStatus,
}) {
    const [collapsed, setCollapsed] = useState(false);
    const effectiveRole = role || "ADMINISTRADOR";
    const prevAgentPageRef = useRef(agentPage);

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
    ];
    const menuAgente = [{ label: "Inicio", key: "inicio" }];

    const getMenu = () => {
        if (effectiveRole === "ADMINISTRADOR") return menuAdmin;
        if (effectiveRole === "SUPERVISOR") return menuSupervisor;
        return menuAgente;
    };

    const fullName = String(user?.full_name || "").trim();
    const fallbackName = String(user?.username || user?.email || "").trim();
    const displayName = fullName || fallbackName || "Usuario";
    const menu = getMenu();

    const getMenuIcon = (key) => MENU_ICONS[key] || "\u2022";

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

        if (
            effectiveRole === "SUPERVISOR" &&
            item.key === "grabaciones-outbound" &&
            onChangeAdminPage
        ) {
            onChangeAdminPage(item.key);
        }
    };

    const isActive = (item) => {
        if (effectiveRole === "ADMINISTRADOR") return item.key === adminPage;
        if (effectiveRole === "ASESOR") return item.key === agentPage;
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
                            value={agentStatus || "disponible"}
                            onChange={(e) =>
                                onChangeAgentStatus?.(e.target.value)
                            }
                            style={styles.statusSelect}
                        >
                            {AGENT_STATUS_OPTIONS.map((item) => (
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
                    <AccordionMenu
                        onLeafSelect={({
                            campaignId,
                            importId,
                            menuItemId,
                            categoryId,
                            manualFlow,
                        }) => {
                            if (onSelectCampaign && campaignId) {
                                onChangeAgentPage?.("gestion");
                                onSelectCampaign(
                                    campaignId,
                                    importId,
                                    menuItemId,
                                    categoryId,
                                    manualFlow,
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
    onLogout: PropTypes.func,
    agentStatus: PropTypes.string,
    onChangeAgentStatus: PropTypes.func,
};

export default Sidebar;
