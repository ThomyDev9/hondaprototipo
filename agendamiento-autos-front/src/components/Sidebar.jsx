import { useState } from "react";

export default function Sidebar({ role, adminPage, onChangeAdminPage }) {
    const [collapsed, setCollapsed] = useState(false); // controla si la sidebar está colapsada
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
        { label: "Tomar siguiente", key: "next" },
    ];

    const menu =
        effectiveRole === "ADMINISTRADOR"
            ? menuAdmin
            : effectiveRole === "SUPERVISOR"
              ? menuSupervisor
              : menuAgente;

    const handleClick = (item) => {
        if (effectiveRole === "ADMINISTRADOR" && onChangeAdminPage) {
            onChangeAdminPage(item.key);
        }
    };

    const isActive = (item) => {
        if (effectiveRole === "ADMINISTRADOR") {
            return item.key === adminPage;
        }
        return false;
    };

    return (
        <div
            style={{
                ...styles.sidebar,
                width: collapsed ? "60px" : "240px", // ancho según collapsed
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
                            ...styles.menuItem,
                            ...(isActive(item) ? styles.menuItemActive : {}),
                            justifyContent: collapsed ? "center" : "flex-start",
                        }}
                        onClick={() => handleClick(item)}
                    >
                        {collapsed ? item.label[0] : item.label}
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
        height: "100vh", // ocupa toda la altura
        transition: "width 0.3s, padding 0.3s",
        boxSizing: "border-box",
        overflow: "hidden",
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
