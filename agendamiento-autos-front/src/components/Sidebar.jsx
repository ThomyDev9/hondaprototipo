import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import AccordionMenu from "./AccordionMenu";

function Sidebar({ role, adminPage, onChangeAdminPage }) {
    const [collapsed, setCollapsed] = useState(false);
    const [outboundCategory, setOutboundCategory] = useState("Campañas Outbound");
    const effectiveRole = role || "ADMINISTRADOR";
    // Obtener el nombre de la categoría Outbound dinámicamente
    useEffect(() => {
        if (effectiveRole.toUpperCase() === "ASESOR") {
            const apiUrl = window.location.hostname === "localhost"
                ? "http://localhost:4004/api/menu/outbound-category"
                : "/api/menu/outbound-category";
            fetch(apiUrl)
                .then(res => res.json())
                .then(data => {
                    if (data && data.name) setOutboundCategory(data.name);
                });
        }
    }, [effectiveRole]);

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

    // El menú del agente incluye la opción dinámica de categoría
    const menuAgente = [
        { label: "Mi Gestión", key: "gestion" },
        { label: outboundCategory, key: "outbound-category", isAccordion: true },
    ];

    const getMenu = () => {
        if (effectiveRole === "ADMINISTRADOR") return menuAdmin;
        if (effectiveRole === "SUPERVISOR") return menuSupervisor;
        return menuAgente;
    };
    const menu = getMenu();

    const [showOutbound, setShowOutbound] = useState(false);
    const handleClick = (item) => {
        if (
            effectiveRole.toUpperCase() === "ADMINISTRADOR" &&
            onChangeAdminPage
        ) {
            onChangeAdminPage(item.key);
        }
        if (
            effectiveRole.toUpperCase() === "ASESOR" &&
            item.key === "outbound-category"
        ) {
            setShowOutbound((prev) => !prev);
        } else if (
            effectiveRole.toUpperCase() === "ASESOR" &&
            item.key !== "outbound-category"
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
                                border: "none",
                                color: "inherit",
                                background: "darkblue",
                                textAlign: "left",
                            }}
                            onClick={() => handleClick(item)}
                        >
                            {collapsed ? item.label[0] : item.label}
                        </button>
                    </li>
                ))}
                {/* Para ASESOR, mostrar el AccordionMenu solo al hacer clic en la opción de categoría */}
                {effectiveRole.toUpperCase() === "ASESOR" && !collapsed && showOutbound && (
                    <li style={{ padding: 0, background: "none", border: "none" }}>
                        <div style={{ marginTop: 0, width: "100%" }}>
                            <AccordionMenu />
                        </div>
                    </li>
                )}
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
        gap: "0.25rem",
        width: "100%",
    },
    menuItem: {
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
