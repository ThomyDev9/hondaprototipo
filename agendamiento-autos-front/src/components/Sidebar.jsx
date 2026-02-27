import { useState } from "react";
import PropTypes from "prop-types";
import AccordionMenu from "./AccordionMenu";

function Sidebar({ role, adminPage, onChangeAdminPage }) {
    const [collapsed, setCollapsed] = useState(false);
    const [showOutbound, setShowOutbound] = useState(false);
    const effectiveRole = role || "ADMINISTRADOR";

    const menuAdmin = [
        { label: "Administrar bases", key: "administrar-bases" },
        { label: "Ver bases", key: "listado-bases" },
        { label: "Usuarios", key: "users" },
        { label: "Configuración", key: "settings" },
    ];
    const menuSupervisor = [
        { label: "Dashboard", key: "dashboard" },
        { label: "Agentes", key: "agents" },
        { label: "Reportes", key: "reports" },
    ];
    const menuAgente = [
        { label: "Mi Gestión", key: "gestion" },
        {
            label: "Campañas Outbound",
            key: "campanias-outbound",
            isAccordion: true,
        },
    ];

    const getMenu = () => {
        if (effectiveRole === "ADMINISTRADOR") return menuAdmin;
        if (effectiveRole === "SUPERVISOR") return menuSupervisor;
        return menuAgente;
    };
    const menu = getMenu();

    const handleClick = (item) => {
        if (
            effectiveRole.toUpperCase() === "ADMINISTRADOR" &&
            onChangeAdminPage
        ) {
            onChangeAdminPage(item.key);
        }
        if (
            effectiveRole.toUpperCase() === "ASESOR" &&
            item.key === "campanias-outbound"
        ) {
            setShowOutbound((prev) => !prev);
        } else if (
            effectiveRole.toUpperCase() === "ASESOR" &&
            item.key !== "campanias-outbound"
        ) {
            setShowOutbound(false);
        }
    };
    const isActive = (item) => {
        if (effectiveRole === "ADMINISTRADOR") return item.key === adminPage;
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
                style={styles.collapseBtn}
                onClick={() => setCollapsed(!collapsed)}
            >
                {collapsed ? "→" : "←"}
            </button>

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
                                    : {}),
                                justifyContent: collapsed
                                    ? "center"
                                    : "flex-start",
                                width: "100%",
                                background: "none",
                                border: "none",
                                color: "inherit",
                                textAlign: "left",
                            }}
                            onClick={() => handleClick(item)}
                        >
                            {collapsed ? item.label[0] : item.label}
                        </button>
                        {/* Solo para ASESOR, mostrar el AccordionMenu al hacer clic en Campañas Outbound */}
                        {effectiveRole.toUpperCase() === "ASESOR" &&
                            item.key === "campanias-outbound" &&
                            showOutbound &&
                            !collapsed && (
                                <div
                                    style={{
                                        marginTop: "0.5rem",
                                        width: "100%",
                                    }}
                                >
                                    <AccordionMenu />
                                </div>
                            )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const styles = {
    sidebar: {
        backgroundColor: "#1D4ED8",
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
        background: "transparent",
        border: "none",
        color: "white",
        fontSize: "1.2rem",
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
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
    },
    menuItem: {
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        cursor: "pointer",
        transition: "0.2s",
        display: "flex",
        alignItems: "center",
    },
    menuItemActive: {
        backgroundColor: "#2563EB",
    },
};

Sidebar.propTypes = {
    role: PropTypes.string,
    adminPage: PropTypes.string,
    onChangeAdminPage: PropTypes.func,
};

export default Sidebar;
