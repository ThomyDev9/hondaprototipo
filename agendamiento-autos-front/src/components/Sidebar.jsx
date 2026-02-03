// src/components/Sidebar.jsx
export default function Sidebar({ role, adminPage, onChangeAdminPage }) {
    const effectiveRole = role || "ADMIN";

    const menuAdmin = [
        { label: "Cargar bases", key: "cargar-bases" },
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
        effectiveRole === "ADMIN"
            ? menuAdmin
            : effectiveRole === "SUPERVISOR"
              ? menuSupervisor
              : menuAgente;

    const handleClick = (item) => {
        // Para ADMIN usamos adminPage para navegar entre pantallas internas
        if (effectiveRole === "ADMIN" && onChangeAdminPage) {
            onChangeAdminPage(item.key); // ahora soporta 'users' y 'settings' también
        }
        // Para SUPERVISOR / AGENTE ya verás luego cómo lo manejamos
    };

    const isActive = (item) => {
        if (effectiveRole === "ADMIN") {
            return item.key === adminPage;
        }
        return false;
    };

    return (
        <div style={styles.sidebar}>
            <h2 style={styles.title}>Citas</h2>
            <ul style={styles.menu}>
                {menu.map((item) => (
                    <li
                        key={item.key}
                        style={{
                            ...styles.menuItem,
                            ...(isActive(item) ? styles.menuItemActive : {}),
                        }}
                        onClick={() => handleClick(item)}
                    >
                        {item.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const styles = {
    sidebar: {
        width: "240px",
        backgroundColor: "#1D4ED8",
        color: "white",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
    },
    title: {
        textAlign: "center",
        fontSize: "1.4rem",
        fontWeight: "700",
        margin: 0,
    },
    menu: {
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
    },
    menuItem: {
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        cursor: "pointer",
        transition: "0.2s",
    },
    menuItemActive: {
        backgroundColor: "#2563EB",
    },
};
