import { useEffect, useState } from "react";
import { PageContainer } from "../../components/common";

const getAuthToken = () => localStorage.getItem("access_token") || "";

function StatCard({ label, value, color = "#2563eb", hint = "" }) {
    return (
        <div
            style={{
                background: color,
                color: "#fff",
                borderRadius: "14px",
                padding: "18px",
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
            }}
        >
            <div style={{ fontSize: "0.9rem", opacity: 0.92 }}>{label}</div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800 }}>{value}</div>
            {hint ? (
                <div style={{ marginTop: "6px", fontSize: "0.8rem", opacity: 0.9 }}>
                    {hint}
                </div>
            ) : null}
        </div>
    );
}

function formatDuration(minutes = 0) {
    const total = Math.max(Number(minutes || 0), 0);
    const hours = Math.floor(total / 60);
    const restMinutes = total % 60;

    if (hours <= 0) {
        return `${restMinutes} min`;
    }

    return `${hours}h ${restMinutes}m`;
}

export default function DashboardSupervisorV2() {
    const [dashboard, setDashboard] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();

        if (!token) {
            setError("No hay sesion activa");
            return;
        }

        fetch(`${API_BASE}/supervisor/dashboard`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No se pudo cargar el dashboard");
                return res.json();
            })
            .then((data) => setDashboard(data))
            .catch((err) => {
                console.error("Error cargando dashboard supervisor:", err);
                setError(err.message || "No se pudo cargar el dashboard");
            });
    }, []);

    return (
        <PageContainer title="Dashboard Supervisor">
            <div style={styles.wrapper}>
                <h1 style={styles.title}>Resumen de agentes</h1>
                <p style={styles.subtitle}>
                    Vista actual de estados usando la ultima interaccion registrada
                    por agente.
                </p>

                {error ? <p style={styles.error}>{error}</p> : null}

                <div style={styles.grid}>
                    <StatCard
                        label="Agentes con actividad"
                        value={dashboard?.totalAgentes ?? 0}
                        color="#1d4ed8"
                    />
                    <StatCard
                        label="Disponibles"
                        value={dashboard?.disponibles ?? 0}
                        color="#15803d"
                    />
                    <StatCard
                        label="En pausa o break"
                        value={dashboard?.pausa ?? 0}
                        color="#ea580c"
                    />
                    <StatCard
                        label="Estados detectados"
                        value={dashboard?.totalEstados ?? 0}
                        color="#475569"
                    />
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Estado mas largo hoy</h2>
                    <div style={styles.longestCard}>
                        {dashboard?.estadoMasLargo ? (
                            <>
                                <strong>{dashboard.estadoMasLargo.agent}</strong>
                                <span>
                                    {dashboard.estadoMasLargo.estado} acumulado hoy{" "}
                                    {formatDuration(
                                        dashboard.estadoMasLargo.minutosEnEstadoHoy,
                                    )}
                                </span>
                            </>
                        ) : (
                            <span>No hay actividad reciente para mostrar.</span>
                        )}
                    </div>
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Distribucion por estado</h2>
                    <div style={styles.stateList}>
                        {(dashboard?.estados || []).map((item) => (
                            <div key={item.estado} style={styles.stateRow}>
                                <span>{item.estado}</span>
                                <strong>{item.total}</strong>
                            </div>
                        ))}
                        {dashboard && (!dashboard.estados || dashboard.estados.length === 0) ? (
                            <div style={styles.empty}>No hay estados para mostrar.</div>
                        ) : null}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}

const styles = {
    wrapper: {
        padding: "24px",
    },
    title: {
        margin: 0,
        fontSize: "1.8rem",
        color: "#0f172a",
    },
    subtitle: {
        margin: "8px 0 24px",
        color: "#475569",
    },
    error: {
        color: "#b91c1c",
        fontWeight: 600,
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
    },
    section: {
        marginTop: "24px",
    },
    sectionTitle: {
        margin: "0 0 12px",
        color: "#0f172a",
    },
    longestCard: {
        background: "#fff",
        borderRadius: "14px",
        padding: "18px",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        color: "#1e293b",
    },
    stateList: {
        background: "#fff",
        borderRadius: "14px",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
        overflow: "hidden",
    },
    stateRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: "1px solid #e2e8f0",
        color: "#1e293b",
    },
    empty: {
        padding: "16px",
        color: "#64748b",
    },
};
