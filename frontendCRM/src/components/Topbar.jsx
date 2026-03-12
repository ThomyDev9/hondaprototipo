import PropTypes from "prop-types";

const AGENT_STATUS_OPTIONS = [
    { value: "disponible", label: "Disponible" },
    { value: "baño", label: "Baño" },
    { value: "consulta", label: "Consulta" },
    { value: "lunch", label: "Lunch" },
    { value: "reunion", label: "Reunión" },
];

export default function Topbar({
    user,
    onLogout,
    agentStatus,
    onChangeAgentStatus,
}) {
    const role = user?.roles?.[0] || "ADMIN";
    const isAsesor = role === "ASESOR";

    return (
        <div style={styles.topbar}>
            <div></div>
            <div style={styles.right}>
                <span style={styles.role}>{role}</span>

                {isAsesor && (
                    <select
                        value={agentStatus || "disponible"}
                        onChange={(e) => onChangeAgentStatus?.(e.target.value)}
                        style={styles.statusSelect}
                    >
                        {AGENT_STATUS_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                )}

                <span style={styles.name}>{user.email}</span>
                <button style={styles.button} onClick={onLogout}>
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}

const styles = {
    topbar: {
        height: "60px",
        minHeight: "60px",
        backgroundColor: "#69b413",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 1.5rem",
        flexShrink: 0,
    },
    right: {
        display: "flex",
        alignItems: "center",
        gap: "1rem",
    },
    role: {
        backgroundColor: "#1D4ED8",
        padding: "0.25rem 0.75rem",
        borderRadius: "999px",
        color: "white",
        fontSize: "0.8rem",
        fontWeight: "600",
    },
    name: {
        fontSize: "0.9rem",
        color: "#1E293B",
    },
    statusSelect: {
        padding: "0.3rem 0.5rem",
        borderRadius: "8px",
        border: "1px solid #cbd5e1",
        backgroundColor: "#ffffff",
        fontSize: "0.82rem",
        color: "#0f172a",
    },
    button: {
        padding: "0.4rem 0.9rem",
        borderRadius: "999px",
        border: "1px solid #3469d1",
        backgroundColor: "#610fd5",
        cursor: "pointer",
        fontSize: "0.85rem",
    },
};

Topbar.propTypes = {
    user: PropTypes.shape({
        roles: PropTypes.arrayOf(PropTypes.string),
        email: PropTypes.string,
    }),
    onLogout: PropTypes.func,
    agentStatus: PropTypes.string,
    onChangeAgentStatus: PropTypes.func,
};
