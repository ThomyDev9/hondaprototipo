import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "../../components/common";

const getAuthToken = () => localStorage.getItem("access_token") || "";

function StatCard({ label, value, color = "#2563eb" }) {
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
        </div>
    );
}

function resolveStateColor(estado = "") {
    const normalized = String(estado || "").trim().toLowerCase();

    if (normalized.includes("disponible") || normalized === "activo") {
        return "#15803d";
    }
    if (normalized.includes("break") || normalized.includes("pausa")) {
        return "#ea580c";
    }
    if (normalized.includes("login")) {
        return "#2563eb";
    }
    if (normalized.includes("bloqueado")) {
        return "#dc2626";
    }
    if (normalized.includes("logout") || normalized.includes("inactivo")) {
        return "#64748b";
    }

    return "#475569";
}

export default function AgentesSupervisorPage() {
    const [agentes, setAgentes] = useState([]);
    const [estadisticas, setEstadisticas] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();

        if (!token) {
            setError("No hay sesion activa");
            setLoading(false);
            return;
        }

        let cancelled = false;

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        Promise.allSettled([
            fetch(`${API_BASE}/supervisor/agentes`, { headers }),
            fetch(`${API_BASE}/supervisor/agentes-estados`, { headers }),
        ])
            .then(async ([agentesResult, estadosResult]) => {
                let nextError = "";
                let agentesJson = [];
                let estadosJson = { data: [] };

                if (agentesResult.status === "fulfilled") {
                    if (agentesResult.value.ok) {
                        agentesJson = await agentesResult.value.json();
                    } else {
                        nextError = "No se pudo cargar el detalle de agentes.";
                    }
                } else {
                    nextError = "No se pudo cargar el detalle de agentes.";
                }

                if (estadosResult.status === "fulfilled") {
                    if (estadosResult.value.ok) {
                        estadosJson = await estadosResult.value.json();
                    } else {
                        nextError = nextError
                            ? `${nextError} No se pudo cargar las estadisticas de estados.`
                            : "No se pudo cargar las estadisticas de estados.";
                    }
                } else {
                    nextError = nextError
                        ? `${nextError} No se pudo cargar las estadisticas de estados.`
                        : "No se pudo cargar las estadisticas de estados.";
                }

                if (cancelled) {
                    return;
                }

                setAgentes(Array.isArray(agentesJson) ? agentesJson : []);
                setEstadisticas(
                    Array.isArray(estadosJson?.data) ? estadosJson.data : [],
                );
                setError(nextError);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error("Error cargando agentes supervisor:", err);
                    setError(
                        err.message || "No se pudo cargar la informacion de agentes",
                    );
                    setAgentes([]);
                    setEstadisticas([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const totalMonitoreados = agentes.length;
    const resumenOperativo = useMemo(() => {
        return agentes.reduce(
            (acc, agente) => {
                const estado = String(agente?.estado || "").trim().toLowerCase();
                if (estado === "activo") acc.activos += 1;
                if (estado === "bloqueado") acc.bloqueados += 1;
                if (estado === "inactivo") acc.inactivos += 1;
                if (Number(agente?.exceso_pausa || 0) === 1) acc.exceso += 1;
                return acc;
            },
            { activos: 0, bloqueados: 0, inactivos: 0, exceso: 0 },
        );
    }, [agentes]);

    return (
        <PageContainer title="Agentes Supervisor">
            <div style={styles.wrapper}>
                <h1 style={styles.title}>Estado de agentes</h1>
                <p style={styles.subtitle}>
                    Resumen de estados actuales de sesion y detalle operativo por
                    asesor.
                </p>

                {error ? <p style={styles.error}>{error}</p> : null}

                <div style={styles.cardsGrid}>
                    <StatCard
                        label="Agentes monitoreados"
                        value={totalMonitoreados}
                        color="#1d4ed8"
                    />
                    <StatCard
                        label="Activos"
                        value={resumenOperativo.activos}
                        color="#15803d"
                    />
                    <StatCard
                        label="Bloqueados"
                        value={resumenOperativo.bloqueados}
                        color="#dc2626"
                    />
                    <StatCard
                        label="Exceso de pausa"
                        value={resumenOperativo.exceso}
                        color="#ea580c"
                    />
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Estadisticas por estado</h2>
                    <div style={styles.stateGrid}>
                        {estadisticas.map((item) => (
                            <StatCard
                                key={item.estado}
                                label={item.estado}
                                value={item.total}
                                color={resolveStateColor(item.estado)}
                            />
                        ))}
                        {!loading && estadisticas.length === 0 ? (
                            <div style={styles.emptyBox}>
                                No hay estados de sesion disponibles.
                            </div>
                        ) : null}
                    </div>
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Detalle de agentes</h2>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.thtd}>Agente</th>
                                    <th style={styles.thtd}>Estado operativo</th>
                                    <th style={styles.thtd}>Minutos pausa</th>
                                    <th style={styles.thtd}>Exceso pausa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agentes.map((agente) => (
                                    <tr key={agente.id}>
                                        <td style={styles.thtd}>{agente.nombre}</td>
                                        <td style={styles.thtd}>{agente.estado}</td>
                                        <td style={styles.thtd}>
                                            {Number(agente.minutosPausa || 0)}
                                        </td>
                                        <td style={styles.thtd}>
                                            {Number(agente.exceso_pausa || 0) === 1
                                                ? "Si"
                                                : "No"}
                                        </td>
                                    </tr>
                                ))}
                                {!loading && agentes.length === 0 ? (
                                    <tr>
                                        <td style={styles.thtd} colSpan={4}>
                                            No hay agentes para mostrar.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
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
    cardsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
    },
    section: {
        marginTop: "24px",
    },
    sectionTitle: {
        margin: "0 0 14px",
        color: "#0f172a",
    },
    stateGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
    },
    emptyBox: {
        padding: "18px",
        borderRadius: "14px",
        background: "#e2e8f0",
        color: "#334155",
    },
    tableWrapper: {
        overflowX: "auto",
        background: "#fff",
        borderRadius: "14px",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    thtd: {
        borderBottom: "1px solid #e2e8f0",
        padding: "12px",
        textAlign: "left",
    },
};
