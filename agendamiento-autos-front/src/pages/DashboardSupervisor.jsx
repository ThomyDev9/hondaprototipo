import React, { useEffect, useState } from "react";
const token = localStorage.getItem("access_token");

function Card({ label, value, color = "#2563EB" }) {
    const style = {
        background: color,
        color: "white",
        padding: "16px",
        borderRadius: "8px",
        textAlign: "center",
        flex: 1,
    };
    return (
        <div style={style}>
            <h3>{label}</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold" }}>{value}</p>
        </div>
    );
}

export default function DashboardSupervisor() {
    const [dashboard, setDashboard] = useState(null);
    const [agentes, setAgentes] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Dashboard
        fetch("http://localhost:4004/supervisor/dashboard", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No autorizado");
                return res.json();
            })
            .then((data) => setDashboard(data))
            .catch((err) => {
                console.error("Error cargando dashboard:", err);
                setError("No se pudo cargar el dashboard");
            });

        // Agentes
        fetch("http://localhost:4004/supervisor/agentes", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No autorizado");
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    setAgentes(data);
                } else {
                    setAgentes([]);
                }
            })
            .catch((err) => {
                console.error("Error cargando agentes:", err);
                setError("No se pudo cargar la lista de agentes");
                setAgentes([]);
            });
    }, []);

    const styles = {
        cardsGrid: {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom: "24px",
        },
        table: {
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "24px",
        },
        thtd: {
            border: "1px solid #ddd",
            padding: "8px",
            textAlign: "center",
        },
    };

    return (
        <div style={{ padding: "24px" }}>
            <h1>Dashboard Supervisor</h1>
            <p>Monitoreo de agentes y bases asignadas.</p>

            {error && <p style={{ color: "red" }}>{error}</p>}

            {/* Cards resumen */}
            {dashboard && (
                <div style={styles.cardsGrid}>
                    <Card
                        label="Agentes activos"
                        value={dashboard.totalAgentes}
                    />
                    <Card
                        label="En exceso de pausa"
                        value={dashboard.agentesConExceso}
                        color="#EA580C"
                    />
                    <Card
                        label="Bloqueados"
                        value={dashboard.agentesBloqueados}
                        color="#DC2626"
                    />
                    <Card
                        label="Minutos máximos de pausa"
                        value={dashboard.pausaMax}
                        color="#16A34A"
                    />
                </div>
            )}

            {/* Tabla de agentes */}
            <h2>Detalle de agentes</h2>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.thtd}>Agente</th>
                        <th style={styles.thtd}>Estado</th>
                        <th style={styles.thtd}>Tiempo de pausa</th>
                        <th style={styles.thtd}>Bases asignadas</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.isArray(agentes) &&
                        agentes.map((a) => (
                            <tr key={a.id}>
                                <td style={styles.thtd}>{a.nombre}</td>
                                <td style={styles.thtd}>{a.estado}</td>
                                <td style={styles.thtd}>
                                    {a.minutosPausa} min
                                </td>
                                <td style={styles.thtd}>
                                    {a.bases?.join(", ")}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}
