// src/pages/DashboardAdmin.jsx
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function DashboardAdmin() {
    const [loading, setLoading] = useState(false);
    const [resumen, setResumen] = useState(null);
    const [error, setError] = useState("");
    const [agentes, setAgentes] = useState([]);
    const [pausaMax, setPausaMax] = useState(30);
    const [savingPausa, setSavingPausa] = useState(false);
    const [reciclandoBaseId, setReciclandoBaseId] = useState(null);
    const [exportandoBaseId, setExportandoBaseId] = useState(null);
    const token = localStorage.getItem("access_token");

    const cargarResumen = async () => {
        if (!token) {
            setError("No hay token, inicia sesión de nuevo.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };

            const [basesResp, agentesResp, pausaResp] = await Promise.all([
                fetch(`${API_BASE}/admin/bases-resumen`, { headers }),
                fetch(`${API_BASE}/admin/dashboard/agentes`, { headers }),
                fetch(`${API_BASE}/admin/parametros/pausa-max`, { headers }),
            ]);

            const basesJson = await basesResp.json();
            const agentesJson = await agentesResp.json();
            const pausaJson = await pausaResp.json();

            if (!basesResp.ok) {
                console.error("Error /admin/bases-resumen:", basesJson);
                setError(
                    basesJson.error || "Error obteniendo resumen de bases",
                );
            } else {
                setResumen(basesJson);
            }

            if (!agentesResp.ok) {
                console.error("Error /admin/dashboard/agentes:", agentesJson);
                setError(
                    (prev) =>
                        prev ||
                        agentesJson.error ||
                        "Error obteniendo resumen de agentes",
                );
            } else {
                setAgentes(agentesJson.agentes || []);
            }

            if (pausaResp.ok) {
                setPausaMax(pausaJson.pausaMaxMinDia ?? 30);
            } else {
                console.error("Error /admin/parametros/pausa-max:", pausaJson);
            }
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarResumen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tot = resumen?.totales;
    const agentesTotales = agentes.length;
    const agentesConExceso = agentes.filter((a) => a.exceso_pausa).length;
    const agentesBloqueados = agentes.filter((a) => a.bloqueado).length;

    // ===== Exportar reporte por base =====
    const handleExportReporteBase = async (base) => {
        if (!token) {
            alert("Sesión expirada, inicia sesión de nuevo.");
            return;
        }

        try {
            setExportandoBaseId(base.base_id);

            const params = new URLSearchParams({ base_id: base.base_id });
            const resp = await fetch(
                `${API_BASE}/admin/reportes/gestion/export?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!resp.ok) {
                const json = await resp.json().catch(() => ({}));
                console.error("Error exportando reporte:", json);
                alert(
                    json.error || "No se pudo generar el reporte de gestión.",
                );
                return;
            }

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            // nombre bonito usando el nombre de la base
            const safeName = (base.base || "base")
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^\w-]+/g, "");
            a.download = `reporte_gestion_${safeName}.csv`;

            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error de conexión al exportar reporte:", err);
            alert("Error de conexión al exportar el reporte.");
        } finally {
            setExportandoBaseId(null);
        }
    };

    const handleGuardarPausa = async (e) => {
        e.preventDefault();

        const valor = Number(pausaMax);
        if (isNaN(valor) || valor <= 0) {
            alert("Ingresa un número de minutos válido");
            return;
        }

        try {
            setSavingPausa(true);
            const resp = await fetch(`${API_BASE}/admin/parametros/pausa-max`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify({ valor }),
            });
            const json = await resp.json();
            if (!resp.ok) {
                console.error(json);
                alert(json.error || "No se pudo actualizar el parámetro");
                return;
            }
            setPausaMax(json.pausaMaxMinDia ?? valor);
            alert("Parámetro actualizado correctamente");
        } catch (err) {
            console.error(err);
            alert("Error de conexión al guardar el parámetro");
        } finally {
            setSavingPausa(false);
        }
    };

    const handleReciclarBase = async (base) => {
        if (!token) {
            alert("Sesión expirada, inicia sesión de nuevo.");
            return;
        }

        const confirmar = window.confirm(
            `¿Reciclar registros de la base "${base.base}" con estados ` +
                "re-gestionable / re_llamada / sin_contacto y menos de 6 intentos?",
        );
        if (!confirmar) return;

        try {
            setReciclandoBaseId(base.base_id);

            const resp = await fetch(
                `${API_BASE}/admin/bases/${base.base_id}/reciclar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            const json = await resp.json();

            if (!resp.ok) {
                console.error("Error reciclando base:", json);
                alert(json.error || "No se pudo reciclar la base");
                return;
            }

            alert(
                `Reciclados ${json.registros_reciclados} registros de la base "${base.base}".`,
            );
            await cargarResumen();
        } catch (err) {
            console.error(err);
            alert("Error de conexión al reciclar la base");
        } finally {
            setReciclandoBaseId(null);
        }
    };

    return (
        <div style={styles.wrapper}>
            <div style={styles.headerRow}>
                <div>
                    <h1 style={styles.title}>Panel administrador</h1>
                    <p style={styles.subtitle}>
                        Aquí ves cómo van tus bases, cuánto falta por gestionar
                        y el comportamiento de los estados y agentes.
                    </p>
                </div>

                <button
                    style={styles.refreshButton}
                    onClick={cargarResumen}
                    disabled={loading}
                    type="button"
                >
                    {loading ? "Actualizando..." : "Actualizar"}
                </button>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            {tot && (
                <div style={styles.cardsGrid}>
                    <Card
                        label="Bases cargadas"
                        value={tot.total_bases}
                        highlight
                    />
                    <Card
                        label="Registros totales"
                        value={tot.total_registros}
                    />
                    <Card
                        label="Sin gestionar"
                        value={tot.total_sin_gestionar}
                    />
                    <Card
                        label="Citas agendadas"
                        value={tot.total_con_cita}
                        color="#16A34A"
                    />
                    <Card label="No desea" value={tot.total_no_desea} />
                    <Card label="Rellamadas" value={tot.total_rel_llamada} />
                    <Card
                        label="Re-gestionables"
                        value={tot.total_re_gestionable}
                    />
                    <Card label="Inubicables" value={tot.total_inubicable} />
                </div>
            )}

            <div style={styles.cardsGridAgents}>
                <Card label="Agentes" value={agentesTotales} />
                <Card
                    label="Agentes en exceso de pausa"
                    value={agentesConExceso}
                    color="#EA580C"
                />
                <Card
                    label="Agentes bloqueados"
                    value={agentesBloqueados}
                    color="#DC2626"
                />

                <div style={styles.cardParam}>
                    <span style={styles.cardLabel}>
                        Minutos máximos de pausa diarios
                    </span>
                    <form
                        onSubmit={handleGuardarPausa}
                        style={styles.paramForm}
                    >
                        <input
                            type="number"
                            min={1}
                            value={pausaMax}
                            onChange={(e) => setPausaMax(e.target.value)}
                            style={styles.paramInput}
                        />
                        <button
                            type="submit"
                            style={styles.paramButton}
                            disabled={savingPausa}
                        >
                            {savingPausa ? "Guardando..." : "Guardar"}
                        </button>
                    </form>
                </div>
            </div>

            {/* Tabla de bases */}
            <div style={styles.tableCard}>
                <h2 style={styles.tableTitle}>Detalle por base</h2>
                <p style={styles.tableSubtitle}>
                    Avance, registros pendientes y distribución por estados.
                </p>
                {/* {console.log("Resumen bases:", resumen?.bases)} */}
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Base</th>
                                <th style={styles.th}>Registros</th>
                                <th style={styles.th}>Sin gestionar</th>
                                <th style={styles.th}>Citas</th>
                                <th style={styles.th}>No desea</th>
                                <th style={styles.th}>Rellamadas</th>
                                <th style={styles.th}>Re-gestionables</th>
                                <th style={styles.th}>Inubicables</th>
                                <th style={styles.th}>Avance</th>
                                <th style={styles.th}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resumen?.bases?.map((b) => {
                                const puedeReciclar =
                                    (b.re_gestionables || 0) > 0 ||
                                    (b.rellamadas || 0) > 0;

                                return (
                                    <tr key={b.base_id}>
                                        <td style={styles.tdBase}>
                                            <div style={{ fontWeight: 600 }}>
                                                {b.base}
                                            </div>
                                            <div style={styles.baseDesc}>
                                                {b.description}
                                            </div>
                                        </td>
                                        <td style={styles.td}>{b.registros}</td>
                                        <td style={styles.td}>
                                            {b.sin_gestionar}
                                        </td>
                                        <td style={styles.td}>{b.citas}</td>
                                        <td style={styles.td}>{b.no_desea}</td>
                                        <td style={styles.td}>
                                            {b.rellamadas}
                                        </td>
                                        <td style={styles.td}>
                                            {b.re_gestionables}
                                        </td>
                                        <td style={styles.td}>
                                            {b.inubicables}
                                        </td>
                                        <td style={styles.tdProgress}>
                                            <Progress
                                                value={Number.parseFloat(
                                                    b.avance,
                                                )}
                                            />
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.actionsRow}>
                                                <button
                                                    type="button"
                                                    style={styles.exportButton}
                                                    onClick={() =>
                                                        handleExportReporteBase(
                                                            b,
                                                        )
                                                    }
                                                    disabled={
                                                        exportandoBaseId ===
                                                        b.base_id
                                                    }
                                                >
                                                    {exportandoBaseId ===
                                                    b.base_id
                                                        ? "Exportando..."
                                                        : "Exportar"}
                                                </button>
                                                <button
                                                    type="button"
                                                    style={{
                                                        ...styles.btnReciclar,
                                                        ...(puedeReciclar
                                                            ? {}
                                                            : styles.btnReciclarDisabled),
                                                    }}
                                                    disabled={
                                                        !puedeReciclar ||
                                                        reciclandoBaseId ===
                                                            b.base_id
                                                    }
                                                    onClick={() =>
                                                        handleReciclarBase(b)
                                                    }
                                                >
                                                    {reciclandoBaseId ===
                                                    b.base_id
                                                        ? "Reciclando..."
                                                        : "Reciclar base"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(!resumen ||
                                !resumen.bases ||
                                resumen.bases.length === 0) && (
                                <tr>
                                    <td style={styles.tdEmpty} colSpan={10}>
                                        No hay bases cargadas todavía.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabla de agentes */}
            <div style={{ ...styles.tableCard, marginTop: "1.5rem" }}>
                <h2 style={styles.tableTitle}>Monitoreo de agentes</h2>
                <p style={styles.tableSubtitle}>
                    Estado actual, registros y citas del día, minutos de pausa y
                    alertas para recursos humanos.
                </p>
                {console.log("Resumen agentes:", agentes)}
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Agente</th>
                                <th style={styles.th}>Estado</th>
                                <th style={styles.th}>Registros hoy</th>
                                <th style={styles.th}>Citas hoy</th>
                                <th style={styles.th}>Pausa hoy (min)</th>
                                <th style={styles.th}>Alertas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agentes.map((a) => {
                                const rowStyle = a.exceso_pausa
                                    ? styles.rowExcesoPausa
                                    : undefined;
                                return (
                                    <tr key={a.agente_id} style={rowStyle}>
                                        <td style={styles.tdBase}>
                                            <div style={{ fontWeight: 600 }}>
                                                {a.full_name || "Sin nombre"}
                                            </div>
                                            {a.email && (
                                                <div style={styles.baseDesc}>
                                                    {a.email}
                                                </div>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <span style={styles.badgeEstado}>
                                                {a.estado_operativo}
                                            </span>
                                            {a.bloqueado && (
                                                <span
                                                    style={
                                                        styles.badgeBloqueado
                                                    }
                                                >
                                                    BLOQUEADO
                                                </span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            {a.registros_gestionados_hoy}
                                        </td>
                                        <td style={styles.td}>
                                            {a.citas_agendadas_hoy}
                                        </td>
                                        <td style={styles.td}>
                                            {a.minutos_pausa_hoy}
                                        </td>
                                        <td style={styles.td}>
                                            {a.exceso_pausa && (
                                                <span
                                                    style={styles.badgeAlerta}
                                                >
                                                    Exceso pausa
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {agentes.length === 0 && (
                                <tr>
                                    <td style={styles.tdEmpty} colSpan={6}>
                                        No hay agentes registrados o no se pudo
                                        obtener la información.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Card({ label, value, highlight, color }) {
    return (
        <div
            style={{
                ...styles.card,
                ...(highlight ? styles.cardHighlight : {}),
            }}
        >
            <span style={styles.cardLabel}>{label}</span>
            <span
                style={{
                    ...styles.cardValue,
                    ...(color ? { color } : {}),
                }}
            >
                {value ?? 0}
            </span>
        </div>
    );
}

function Progress({ value }) {
    const safe = Number.isFinite(value) ? value : 0;
    return (
        <div style={styles.progressOuter}>
            <div style={{ ...styles.progressInner, width: `${safe}%` }} />
            <span style={styles.progressText}>{safe}%</span>
        </div>
    );
}

const styles = {
    wrapper: {
        maxWidth: "1200px",
        padding: "2rem",
        backgroundColor: "#FFFFFF",
        borderRadius: "1rem",
        boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    },
    headerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "1.5rem",
    },
    title: {
        fontSize: "1.5rem",
        color: "#0F172A",
        marginBottom: "0.25rem",
    },
    subtitle: {
        fontSize: "0.9rem",
        color: "#64748B",
    },
    refreshButton: {
        padding: "0.6rem 1.1rem",
        borderRadius: "999px",
        backgroundColor: "#1D4ED8",
        color: "#FFFFFF",
        border: "none",
        fontSize: "0.9rem",
        fontWeight: 600,
        cursor: "pointer",
    },
    error: {
        color: "#DC2626",
        fontSize: "0.9rem",
        marginBottom: "0.75rem",
    },
    cardsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.9rem",
        marginBottom: "1.5rem",
    },
    card: {
        padding: "0.9rem 1rem",
        borderRadius: "0.75rem",
        backgroundColor: "#F8FAFC",
        border: "1px solid #E2E8F0",
    },
    cardHighlight: {
        backgroundColor: "#EFF6FF",
        borderColor: "#BFDBFE",
    },
    cardLabel: {
        fontSize: "0.8rem",
        color: "#64748B",
    },
    cardValue: {
        marginTop: "0.25rem",
        fontSize: "1.4rem",
        fontWeight: 700,
        color: "#0F172A",
    },
    cardsGridAgents: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(200px, 300px))",
        gap: "16px",
        justifyContent: "center", // centra las tarjetas
    },

    cardParam: {
        background: "#fff",
        borderRadius: "8px",
        padding: "16px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "320px", // evita que se expanda demasiado
        boxSizing: "border-box",
    },

    paramForm: {
        display: "flex",
        gap: "8px",
        width: "70%",
        alignItems: "center",
    },

    paramInput: {
        flex: "1", // se adapta al espacio restante
        minWidth: "0", // evita overflow
        padding: "8px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        boxSizing: "border-box",
    },

    paramButton: {
        flexShrink: "0", // no se expande
        padding: "8px 12px",
        backgroundColor: "#2563EB",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        whiteSpace: "nowrap", // evita que el texto se rompa
    },

    paramHint: {
        fontSize: "0.75rem",
        color: "#A16207",
    },
    tableCard: {
        padding: "1.2rem 1.3rem",
        borderRadius: "0.75rem",
        border: "1px solid #E2E8F0",
        backgroundColor: "#F9FAFB",
    },
    tableTitle: {
        fontSize: "1.1rem",
        color: "#0F172A",
        marginBottom: "0.25rem",
    },
    tableSubtitle: {
        fontSize: "0.85rem",
        color: "#6B7280",
        marginBottom: "0.75rem",
    },
    tableWrapper: {
        overflowX: "auto",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "0.85rem",
    },
    th: {
        padding: "0.5rem 0.4rem",
        borderBottom: "1px solid #E5E7EB",
        whiteSpace: "nowrap",
        color: "#6B7280",
    },
    tdBase: {
        padding: "0.5rem 0.4rem",
        borderBottom: "1px solid #E5E7EB",
    },
    baseDesc: {
        fontSize: "0.75rem",
        color: "#9CA3AF",
    },
    td: {
        padding: "0.5rem 0.4rem",
        borderBottom: "1px solid #E5E7EB",
        textAlign: "center",
    },
    tdProgress: {
        padding: "0.5rem 0.4rem",
        borderBottom: "1px solid #E5E7EB",
        minWidth: "140px",
    },
    tdEmpty: {
        padding: "0.75rem",
        textAlign: "center",
        color: "#9CA3AF",
    },
    progressOuter: {
        position: "relative",
        height: "0.6rem",
        borderRadius: "999px",
        backgroundColor: "#E5E7EB",
        overflow: "hidden",
    },
    progressInner: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: "999px",
        backgroundColor: "#1D4ED8",
    },
    progressText: {
        marginLeft: "0.4rem",
        fontSize: "0.7rem",
        color: "#6B7280",
    },
    rowExcesoPausa: {
        backgroundColor: "#FEF3C7",
    },
    badgeEstado: {
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        backgroundColor: "#EEF2FF",
        color: "#4338CA",
        fontSize: "0.7rem",
        marginRight: "0.25rem",
    },
    badgeBloqueado: {
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        backgroundColor: "#FEE2E2",
        color: "#B91C1C",
        fontSize: "0.7rem",
        marginLeft: "0.25rem",
    },
    badgeAlerta: {
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        backgroundColor: "#FEF3C7",
        color: "#B45309",
        fontSize: "0.7rem",
    },
    actionsRow: {
        display: "flex",
        gap: "0.4rem",
        justifyContent: "center",
    },
    exportButton: {
        padding: "0.25rem 0.7rem",
        borderRadius: "999px",
        backgroundColor: "#FFFFFF",
        color: "#1D4ED8",
        border: "1px solid #1D4ED8",
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: "pointer",
    },
    btnReciclar: {
        padding: "0.25rem 0.7rem",
        borderRadius: "999px",
        border: "none",
        backgroundColor: "#0EA5E9",
        color: "#FFFFFF",
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: "pointer",
    },
    btnReciclarDisabled: {
        backgroundColor: "#E5E7EB",
        color: "#9CA3AF",
        cursor: "not-allowed",
    },
};
