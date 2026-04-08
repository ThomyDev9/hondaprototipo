import { useEffect, useMemo, useState } from "react";
import { Button, PageContainer } from "../../components/common";

const getAuthToken = () => localStorage.getItem("access_token") || "";

function getTodayLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 10);
}

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
    const normalized = String(estado || "")
        .trim()
        .toLowerCase();

    if (normalized.includes("disponible")) return "#15803d";
    if (normalized.includes("break") || normalized.includes("pausa")) {
        return "#ea580c";
    }
    if (normalized.includes("login")) return "#2563eb";
    if (normalized.includes("logout")) return "#64748b";

    return "#475569";
}

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-EC");
}

function formatDuration(minutes = 0) {
    const total = Math.max(Number(minutes || 0), 0);
    const hours = Math.floor(total / 60);
    const restMinutes = total % 60;

    if (hours <= 0) return `${restMinutes} min`;
    return `${hours}h ${restMinutes}m`;
}

export default function AgentesSupervisorPageV2() {
    const today = getTodayLocalDate();
    const [agentes, setAgentes] = useState([]);
    const [estadisticas, setEstadisticas] = useState([]);
    const [acumulado, setAcumulado] = useState([]);
    const [acumuladoDetalle, setAcumuladoDetalle] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingAcumulado, setLoadingAcumulado] = useState(false);
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedEstado, setSelectedEstado] = useState("");
    const [searchParams, setSearchParams] = useState({
        startDate: today,
        endDate: today,
        agent: "",
        estado: "",
    });

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

                if (
                    agentesResult.status === "fulfilled" &&
                    agentesResult.value.ok
                ) {
                    agentesJson = await agentesResult.value.json();
                } else {
                    nextError = "No se pudo cargar el detalle de agentes.";
                }

                if (
                    estadosResult.status === "fulfilled" &&
                    estadosResult.value.ok
                ) {
                    estadosJson = await estadosResult.value.json();
                } else {
                    nextError = nextError
                        ? `${nextError} No se pudo cargar las estadisticas de estados.`
                        : "No se pudo cargar las estadisticas de estados.";
                }

                if (cancelled) return;

                setAgentes(Array.isArray(agentesJson) ? agentesJson : []);
                setEstadisticas(
                    Array.isArray(estadosJson?.data) ? estadosJson.data : [],
                );
                setError(nextError);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Error cargando agentes supervisor:", err);
                setError(
                    err.message ||
                        "No se pudo cargar la informacion de agentes",
                );
                setAgentes([]);
                setEstadisticas([]);
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

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();

        if (!token || !searchParams.startDate || !searchParams.endDate) {
            return;
        }

        const params = new URLSearchParams({
            startDate: searchParams.startDate,
            endDate: searchParams.endDate,
        });

        if (searchParams.agent) {
            params.set("agent", searchParams.agent);
        }

        if (searchParams.estado) {
            params.set("estado", searchParams.estado);
        }

        setLoadingAcumulado(true);

        fetch(`${API_BASE}/supervisor/agentes-acumulado?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(async (res) => {
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    throw new Error(
                        json.error ||
                            "No se pudo cargar el acumulado por estado",
                    );
                }
                return res.json();
            })
            .then((json) => {
                setAcumulado(Array.isArray(json?.summary) ? json.summary : []);
                setAcumuladoDetalle(
                    Array.isArray(json?.detail) ? json.detail : [],
                );
            })
            .catch((err) => {
                console.error("Error cargando acumulado por estado:", err);
                setError((current) =>
                    current
                        ? `${current} ${err.message || ""}`.trim()
                        : err.message ||
                          "No se pudo cargar el acumulado por estado",
                );
                setAcumulado([]);
                setAcumuladoDetalle([]);
            })
            .finally(() => {
                setLoadingAcumulado(false);
            });
    }, [searchParams]);

    const totalMonitoreados = agentes.length;
    const estadoMasLargo = useMemo(() => {
        return agentes.reduce((currentMax, item) => {
            if (!currentMax) return item;
            return item.minutosEnEstadoHoy > currentMax.minutosEnEstadoHoy
                ? item
                : currentMax;
        }, null);
    }, [agentes]);
    const agentOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    [
                        ...agentes.map((item) => item.agent),
                        ...acumulado.map((item) => item.agent),
                    ].filter(Boolean),
                ),
            ),
        [agentes, acumulado],
    );
    const stateOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    [
                        ...estadisticas.map((item) => item.estado),
                        ...agentes.map((item) => item.estado),
                    ].filter(Boolean),
                ),
            ),
        [estadisticas, agentes],
    );
    const totalMinutesFiltered = useMemo(
        () =>
            acumulado.reduce((acc, item) => acc + Number(item.minutos || 0), 0),
        [acumulado],
    );

    const handleSearch = () => {
        setError("");
        setSearchParams({
            startDate,
            endDate,
            agent: selectedAgent.trim(),
            estado: selectedEstado.trim(),
        });
    };

    return (
        <PageContainer title="Agentes Supervisor">
            <div style={styles.wrapper}>
                <h1 style={styles.title}>Actividad actual de agentes</h1>
                <p style={styles.subtitle}>
                    Detalle vivo por asesor usando la ultima fila registrada en
                    `session_estado_log`.
                </p>

                {error ? <p style={styles.error}>{error}</p> : null}

                <div style={styles.cardsGrid}>
                    <StatCard
                        label="Agentes monitoreados"
                        value={totalMonitoreados}
                        color="#1d4ed8"
                    />
                    <StatCard
                        label="Estados activos"
                        value={estadisticas.length}
                        color="#475569"
                    />
                    <StatCard
                        label="Estado mas largo hoy"
                        value={
                            estadoMasLargo
                                ? formatDuration(
                                      estadoMasLargo.minutosEnEstadoHoy,
                                  )
                                : "0 min"
                        }
                        color="#7c3aed"
                    />
                    <StatCard
                        label="Acumulado filtrado"
                        value={formatDuration(totalMinutesFiltered)}
                        color="#0f766e"
                    />
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Conteo por estado</h2>
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
                    <h2 style={styles.sectionTitle}>Acumulado por estado</h2>
                    <div style={styles.filterCard}>
                        <div style={styles.filtersGrid}>
                            <label style={styles.field}>
                                <span style={styles.fieldLabel}>
                                    Fecha inicial
                                </span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) =>
                                        setStartDate(event.target.value)
                                    }
                                    style={styles.input}
                                />
                            </label>
                            <label style={styles.field}>
                                <span style={styles.fieldLabel}>
                                    Fecha final
                                </span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) =>
                                        setEndDate(event.target.value)
                                    }
                                    style={styles.input}
                                />
                            </label>
                            <label style={styles.field}>
                                <span style={styles.fieldLabel}>Agente</span>
                                <input
                                    list="supervisor-agent-options"
                                    value={selectedAgent}
                                    onChange={(event) =>
                                        setSelectedAgent(event.target.value)
                                    }
                                    style={styles.input}
                                    placeholder="Todos o nombre exacto"
                                />
                                <datalist id="supervisor-agent-options">
                                    {agentOptions.map((agent) => (
                                        <option key={agent} value={agent} />
                                    ))}
                                </datalist>
                            </label>
                            <label style={styles.field}>
                                <span style={styles.fieldLabel}>Estado</span>
                                <select
                                    value={selectedEstado}
                                    onChange={(event) =>
                                        setSelectedEstado(event.target.value)
                                    }
                                    style={styles.input}
                                >
                                    <option value="">Todos</option>
                                    {stateOptions.map((estado) => (
                                        <option key={estado} value={estado}>
                                            {estado}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div style={styles.filterActions}>
                            <Button onClick={handleSearch}>Buscar</Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setStartDate(today);
                                    setEndDate(today);
                                    setSelectedAgent("");
                                    setSelectedEstado("");
                                    setSearchParams({
                                        startDate: today,
                                        endDate: today,
                                        agent: "",
                                        estado: "",
                                    });
                                }}
                            >
                                Limpiar filtros
                            </Button>
                        </div>
                        <div style={styles.activeFilters}>
                            <span>
                                Rango aplicado: {searchParams.startDate} a{" "}
                                {searchParams.endDate}
                            </span>
                            <span>
                                Agente: {searchParams.agent || "Todos"}
                            </span>
                            <span>
                                Estado: {searchParams.estado || "Todos"}
                            </span>
                        </div>
                    </div>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.thtd}>Estado</th>
                                    <th style={styles.thtd}>Minutos</th>
                                    <th style={styles.thtd}>Acumulado</th>
                                    <th style={styles.thtd}>Registros</th>
                                    <th style={styles.thtd}>Dias</th>
                                    <th style={styles.thtd}>Agentes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {acumulado.map((row) => (
                                    <tr key={row.estado}>
                                        <td style={styles.thtd}>{row.estado}</td>
                                        <td style={styles.thtd}>{row.minutos}</td>
                                        <td style={styles.thtd}>
                                            {formatDuration(row.minutos)}
                                        </td>
                                        <td style={styles.thtd}>{row.registros}</td>
                                        <td style={styles.thtd}>{row.dias}</td>
                                        <td style={styles.thtd}>{row.agentes}</td>
                                    </tr>
                                ))}
                                {!loadingAcumulado && acumulado.length === 0 ? (
                                    <tr>
                                        <td style={styles.thtd} colSpan={6}>
                                            No hay acumulados para los filtros
                                            seleccionados.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Detalle del acumulado</h2>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.thtd}>Fecha</th>
                                    <th style={styles.thtd}>Agente</th>
                                    <th style={styles.thtd}>Codigo</th>
                                    <th style={styles.thtd}>Estado</th>
                                    <th style={styles.thtd}>Minutos</th>
                                    <th style={styles.thtd}>Acumulado</th>
                                    <th style={styles.thtd}>Registros</th>
                                </tr>
                            </thead>
                            <tbody>
                                {acumuladoDetalle.map((row) => (
                                    <tr
                                        key={`${row.fecha}-${row.agent}-${row.estado}`}
                                    >
                                        <td style={styles.thtd}>{row.fecha}</td>
                                        <td style={styles.thtd}>{row.agent}</td>
                                        <td style={styles.thtd}>
                                            {row.agentNumber || "-"}
                                        </td>
                                        <td style={styles.thtd}>{row.estado}</td>
                                        <td style={styles.thtd}>{row.minutos}</td>
                                        <td style={styles.thtd}>
                                            {formatDuration(row.minutos)}
                                        </td>
                                        <td style={styles.thtd}>{row.registros}</td>
                                    </tr>
                                ))}
                                {!loadingAcumulado &&
                                acumulado.length > 0 &&
                                acumuladoDetalle.length === 0 ? (
                                    <tr>
                                        <td style={styles.thtd} colSpan={7}>
                                            No hay detalle para mostrar.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>
                        Detalle actual por agente
                    </h2>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.thtd}>Agente</th>
                                    <th style={styles.thtd}>Codigo</th>
                                    <th style={styles.thtd}>Estado actual</th>
                                    <th style={styles.thtd}>Inicio estado</th>
                                    <th style={styles.thtd}>Duracion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agentes.map((agente) => (
                                    <tr key={agente.id}>
                                        <td style={styles.thtd}>
                                            {agente.agent}
                                        </td>
                                        <td style={styles.thtd}>
                                            {agente.agentNumber || "-"}
                                        </td>
                                        <td style={styles.thtd}>
                                            {agente.estado}
                                        </td>
                                        <td style={styles.thtd}>
                                            {formatDateTime(
                                                agente.estadoInicio,
                                            ) || "-"}
                                        </td>
                                        <td style={styles.thtd}>
                                            {formatDuration(
                                                agente.minutosEnEstadoHoy,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!loading && agentes.length === 0 ? (
                                    <tr>
                                        <td style={styles.thtd} colSpan={5}>
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
    filterCard: {
        background: "#fff",
        borderRadius: "14px",
        padding: "16px",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
        marginBottom: "16px",
    },
    filterHint: {
        margin: "0 0 14px",
        color: "#475569",
        lineHeight: 1.45,
    },
    filtersGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "14px",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    fieldLabel: {
        color: "#334155",
        fontSize: "0.9rem",
        fontWeight: 600,
    },
    input: {
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        padding: "10px 12px",
        fontSize: "0.95rem",
        background: "#fff",
        color: "#0f172a",
    },
    filterActions: {
        marginTop: "14px",
        display: "flex",
        gap: "12px",
    },
    activeFilters: {
        marginTop: "12px",
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
        color: "#475569",
        fontSize: "0.9rem",
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
