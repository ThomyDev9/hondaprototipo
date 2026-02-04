// src/pages/DashboardAgente.jsx
import { useEffect, useRef, useState } from "react";
import CalendarioCitas from "../components/CalendarioCitas";

const API_BASE = import.meta.env.VITE_API_URL;
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos

const ESTADOS_RESULTADO = [
    { code: "ub_exito_agendo_cita", label: "Contacto - Cita agendada" },
    { code: "no_desea", label: "No desea / No interesado" },
    { code: "re_llamada", label: "Volver a llamar" },
    { code: "sin_contacto", label: "No contesta / Buzón" },
    { code: "numero_incorrecto", label: "Número incorrecto" },
    { code: "ya_tiene_cita", label: "Ya tiene cita" },
    { code: "inubicable", label: "Inubicable / No llamar más" },
];

const ESTADOS_OPERATIVOS = [
    { code: "disponible", label: "Disponible" },
    { code: "baño", label: "Baño" },
    { code: "consulta", label: "Consulta" },
    { code: "lunch", label: "Lunch" },
    { code: "reunion", label: "Reunión" },
];

export default function DashboardAgente({ user }) {
    const roles = user?.roles || [];
    const isAgente = roles.includes("AGENTE");

    // si por alguna razón llega alguien sin rol AGENTE
    if (!isAgente) {
        return (
            <div style={styles.page}>
                <h1 style={styles.title}>Módulo de agente</h1>
                <p style={styles.subtitle}>
                    <strong>Permiso denegado.</strong> Tu usuario no tiene rol
                    de agente asignado.
                </p>
                <p style={styles.subtitle}>
                    Pide a un administrador que te asigne el rol{" "}
                    <strong>AGENTE</strong>
                    desde el módulo de Usuarios.
                </p>
            </div>
        );
    }

    const [resumenHoy, setResumenHoy] = useState(null);
    const [registro, setRegistro] = useState(null);
    const [loadingRegistro, setLoadingRegistro] = useState(false);
    const [error, setError] = useState("");

    // bloqueado real viene del backend (/auth/me) o por inactividad
    const [bloqueado, setBloqueado] = useState(
        user?.bloqueado === true || user?.is_active === false,
    );

    const [estadoSeleccionado, setEstadoSeleccionado] = useState(
        "ub_exito_agendo_cita",
    );
    const [fechaCita, setFechaCita] = useState("");
    const [agenciaCita, setAgenciaCita] = useState("");
    const [comentarios, setComentarios] = useState("");

    const [estadoAgente, setEstadoAgente] = useState("disponible");
    const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);

    // para inactividad
    const lastActivityRef = useRef(Date.now());
    const inactivityHandledRef = useRef(false);

    const marcarActividad = () => {
        lastActivityRef.current = Date.now();
        inactivityHandledRef.current = false;
    };

    const handle403 = (json) => {
        const msg = (json?.error || "Permiso denegado").toLowerCase();

        // si el backend dice que está bloqueado → bloqueamos
        if (msg.includes("bloqueado")) {
            setBloqueado(true);
        }

        // solo mostramos el mensaje tal cual, no sobreescribimos con “bloqueado por inactividad”
        setError(json?.error || "Permiso denegado");
        setRegistro(null);
    };

    /* =====================  RESUMEN DE HOY  ===================== */
    const fetchResumen = async () => {
        try {
            setError("");
            const token = localStorage.getItem("access_token");

            const resp = await fetch(`${API_BASE}/agente/resumen-hoy`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
            });

            const json = await resp.json();

            if (resp.status === 403) {
                handle403(json);
                return;
            }

            if (!resp.ok) {
                setError(json.error || "No se pudo cargar el resumen de hoy");
                return;
            }

            setResumenHoy(json.resumen || null);
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        }
    };

    useEffect(() => {
        if (!bloqueado) {
            fetchResumen();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bloqueado]);

    /* =====================  SIGUIENTE REGISTRO  ===================== */
    const fetchSiguienteRegistro = async () => {
        try {
            setLoadingRegistro(true);
            setError("");
            setRegistro(null);

            const token = localStorage.getItem("access_token");

            const resp = await fetch(`${API_BASE}/agente/siguiente`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
            });

            const json = await resp.json();

            if (resp.status === 403) {
                handle403(json);
                return;
            }

            if (resp.status === 404) {
                setRegistro(null);
                setError(
                    json.error || "No hay registros disponibles en tu cola",
                );
                return;
            }

            if (!resp.ok) {
                setError(json.error || "No se pudo asignar siguiente registro");
                return;
            }

            setRegistro(json.registro || null);
            setEstadoSeleccionado("ub_exito_agendo_cita");
            setFechaCita("");
            setAgenciaCita("");
            setComentarios("");
            marcarActividad();
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        } finally {
            setLoadingRegistro(false);
        }
    };

    // Cargar automáticamente el primer registro cuando entra al módulo
    useEffect(() => {
        if (!bloqueado) {
            fetchSiguienteRegistro();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bloqueado]);

    /* =====================  CAMBIO DE ESTADO DEL AGENTE  ===================== */
    const handleCambioEstadoAgente = async (nuevoEstado) => {
        try {
            setError("");
            const token = localStorage.getItem("access_token");

            const payload = {
                estado: nuevoEstado,
                registro_id: registro?.id ?? null,
            };

            const resp = await fetch(`${API_BASE}/agente/estado`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(payload),
            });

            const json = await resp.json();

            if (resp.status === 403) {
                handle403(json);
                return;
            }

            if (!resp.ok) {
                setError(
                    json.error || "No se pudo cambiar el estado del agente",
                );
                return;
            }

            setEstadoAgente(nuevoEstado);
            marcarActividad();

            if (
                ["baño", "consulta", "lunch", "reunion"].includes(nuevoEstado)
            ) {
                setRegistro(null);
            }

            if (nuevoEstado === "disponible") {
                await fetchSiguienteRegistro();
            }
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        }
    };

    /* =====================  GUARDAR GESTIÓN  ===================== */
    const handleGuardarGestion = async (e) => {
        e.preventDefault();
        if (!registro) return;

        try {
            setError("");
            const token = localStorage.getItem("access_token");

            const payload = {
                registro_id: registro.id,
                estado_final: estadoSeleccionado,
                fecha_cita:
                    estadoSeleccionado === "ub_exito_agendo_cita"
                        ? fechaCita
                        : null,
                agencia_cita:
                    estadoSeleccionado === "ub_exito_agendo_cita"
                        ? agenciaCita
                        : null,
                comentarios: comentarios || null,
            };

            if (
                estadoSeleccionado === "ub_exito_agendo_cita" &&
                (!fechaCita || !agenciaCita)
            ) {
                setError(
                    "Para agendar una cita debes ingresar fecha/hora y agencia.",
                );
                return;
            }

            const resp = await fetch(`${API_BASE}/agente/guardar-gestion`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(payload),
            });

            const json = await resp.json();

            if (resp.status === 403) {
                handle403(json);
                return;
            }

            if (!resp.ok) {
                setError(json.error || "No se pudo guardar la gestión");
                return;
            }

            // refrescamos resumen desde BD
            await fetchResumen();

            // si se creó cita, refrescamos calendario
            if (json.cita_creada) {
                setCalendarRefreshToken((prev) => prev + 1);
            }

            // Después de guardar, el sistema pide automáticamente el siguiente registro
            if (estadoAgente === "disponible") {
                await fetchSiguienteRegistro();
            } else {
                setRegistro(null);
            }
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        }
    };

    /* =====================  INACTIVIDAD (10 min)  ===================== */
    useEffect(() => {
        if (bloqueado) return;

        const handler = () => marcarActividad();

        window.addEventListener("click", handler);
        window.addEventListener("keydown", handler);
        window.addEventListener("mousemove", handler);

        const interval = setInterval(async () => {
            if (bloqueado || !registro) return;

            const ahora = Date.now();
            const diff = ahora - lastActivityRef.current;

            if (diff > INACTIVITY_MS && !inactivityHandledRef.current) {
                inactivityHandledRef.current = true;

                try {
                    const token = localStorage.getItem("access_token");
                    await fetch(`${API_BASE}/agente/bloquearme`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                        body: JSON.stringify({
                            registro_id: registro?.id ?? null,
                        }),
                    });
                } catch (err) {
                    console.error("Error llamando /agente/bloquearme:", err);
                }

                setBloqueado(true);
                setRegistro(null);
                setError(
                    "Has sido bloqueado por inactividad (más de 10 minutos sin actividad). Comunícate con un administrador.",
                );
            }
        }, 30_000);

        return () => {
            window.removeEventListener("click", handler);
            window.removeEventListener("keydown", handler);
            window.removeEventListener("mousemove", handler);
            clearInterval(interval);
        };
    }, [bloqueado, registro]);

    /* =====================  UI BLOQUEADO  ===================== */
    if (bloqueado) {
        return (
            <div style={styles.page}>
                <h1 style={styles.title}>Módulo de agente</h1>
                <p style={styles.subtitle}>
                    Tu usuario se encuentra{" "}
                    <strong>bloqueado por inactividad</strong> o marcado como{" "}
                    <strong>inactivo</strong>.
                </p>
                <p style={styles.subtitle}>
                    Por favor, comunícate con un administrador para que te
                    desbloquee.
                </p>
                {error && (
                    <p style={{ color: "#EA580C", marginTop: "1rem" }}>
                        {error}
                    </p>
                )}
            </div>
        );
    }

    /* =====================  UI NORMAL  ===================== */
    return (
        <div style={styles.page}>
            <div style={styles.headerRow}>
                <div>
                    <h1 style={styles.title}>Módulo de agente</h1>
                    <p style={styles.subtitle}>
                        Gestiona llamadas, registra estados y agenda citas de
                        forma controlada.
                    </p>
                </div>

                <div style={styles.estadoBox}>
                    <span style={styles.estadoLabel}>Mi estado:</span>
                    <div style={styles.estadoChips}>
                        {ESTADOS_OPERATIVOS.map((st) => (
                            <button
                                key={st.code}
                                type="button"
                                onClick={() =>
                                    handleCambioEstadoAgente(st.code)
                                }
                                style={{
                                    ...styles.estadoChip,
                                    ...(estadoAgente === st.code
                                        ? styles.estadoChipActive
                                        : {}),
                                }}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Resumen de hoy */}
            <section style={styles.cardRow}>
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Mi gestión de hoy</h2>
                    <p style={styles.cardText}>
                        Resumen de tu actividad en el día. El sistema asigna
                        automáticamente el siguiente registro después de cada
                        gestión.
                    </p>
                    <div style={styles.metricsRow}>
                        <div style={styles.metricBox}>
                            <span style={styles.metricLabel}>
                                Registros gestionados
                            </span>
                            <span style={styles.metricValue}>
                                {resumenHoy?.total_gestionados ?? 0}
                            </span>
                        </div>
                        <div style={styles.metricBox}>
                            <span style={styles.metricLabel}>
                                Citas agendadas
                            </span>
                            <span style={styles.metricValue}>
                                {resumenHoy?.total_citas ?? 0}
                            </span>
                        </div>
                        <div style={styles.metricBox}>
                            <span style={styles.metricLabel}>Re-llamadas</span>
                            <span style={styles.metricValue}>
                                {resumenHoy?.total_rellamadas ?? 0}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Zona principal: gestión + calendario */}
            <section style={styles.mainRow}>
                {/* Panel de gestión */}
                <div style={styles.leftColumn}>
                    <div style={styles.card}>
                        <h2 style={styles.cardTitle}>Registro actual</h2>

                        {error && (
                            <p
                                style={{
                                    color: "#EA580C",
                                    marginBottom: "0.75rem",
                                }}
                            >
                                {error}
                            </p>
                        )}

                        {loadingRegistro && (
                            <p style={{ color: "#64748B" }}>
                                Asignando registro...
                            </p>
                        )}

                        {!loadingRegistro && !registro && (
                            <p style={{ color: "#64748B" }}>
                                {estadoAgente !== "disponible"
                                    ? 'Estás en estado de pausa. Vuelve a "Disponible" para tomar registros.'
                                    : "No hay registros disponibles en tu cola en este momento."}
                            </p>
                        )}

                        {registro && (
                            <>
                                <div style={styles.registroBox}>
                                    <p>
                                        <strong>Base:</strong>{" "}
                                        {registro.base_nombre}
                                    </p>
                                    <p>
                                        <strong>Nombre:</strong>{" "}
                                        {registro.nombre_completo}
                                    </p>
                                    <p>
                                        <strong>Placa:</strong>{" "}
                                        {registro.placa || "N/D"}
                                    </p>
                                    <p>
                                        <strong>Teléfono 1:</strong>{" "}
                                        {registro.telefono1 || "N/D"}
                                    </p>
                                    <p>
                                        <strong>Teléfono 2:</strong>{" "}
                                        {registro.telefono2 || "N/D"}
                                    </p>
                                    <p>
                                        <strong>Modelo:</strong>{" "}
                                        {registro.modelo || "N/D"}
                                    </p>
                                    <p>
                                        <strong>Intentos previos:</strong>{" "}
                                        {registro.intentos_totales ?? 0}
                                    </p>
                                </div>

                                <form
                                    onSubmit={handleGuardarGestion}
                                    style={{ marginTop: "1rem" }}
                                >
                                    <div>
                                        <span style={styles.label}>
                                            Resultado de la gestión
                                        </span>
                                        <div style={styles.chipsRow}>
                                            {ESTADOS_RESULTADO.map((opt) => (
                                                <button
                                                    key={opt.code}
                                                    type="button"
                                                    onClick={() =>
                                                        setEstadoSeleccionado(
                                                            opt.code,
                                                        )
                                                    }
                                                    style={{
                                                        ...styles.chip,
                                                        ...(estadoSeleccionado ===
                                                        opt.code
                                                            ? styles.chipActive
                                                            : {}),
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {estadoSeleccionado ===
                                        "ub_exito_agendo_cita" && (
                                        <>
                                            <div style={{ marginTop: "1rem" }}>
                                                <label style={styles.label}>
                                                    Fecha y hora de la cita
                                                    <input
                                                        type="datetime-local"
                                                        value={fechaCita}
                                                        onChange={(e) =>
                                                            setFechaCita(
                                                                e.target.value,
                                                            )
                                                        }
                                                        style={styles.input}
                                                    />
                                                </label>
                                            </div>
                                            <div
                                                style={{ marginTop: "0.75rem" }}
                                            >
                                                <label style={styles.label}>
                                                    Agencia de la cita
                                                    <input
                                                        type="text"
                                                        placeholder="Ej: Agencia Norte, Agencia Matriz, etc."
                                                        value={agenciaCita}
                                                        onChange={(e) =>
                                                            setAgenciaCita(
                                                                e.target.value,
                                                            )
                                                        }
                                                        style={styles.input}
                                                    />
                                                </label>
                                            </div>
                                        </>
                                    )}

                                    <div style={{ marginTop: "1rem" }}>
                                        <label style={styles.label}>
                                            Comentarios de la llamada
                                            <textarea
                                                placeholder="Ej: Cliente prefiere WhatsApp para confirmación."
                                                value={comentarios}
                                                onChange={(e) =>
                                                    setComentarios(
                                                        e.target.value,
                                                    )
                                                }
                                                style={styles.textarea}
                                            />
                                        </label>
                                    </div>

                                    <div style={{ marginTop: "1.25rem" }}>
                                        <button
                                            type="submit"
                                            style={styles.primaryButton}
                                        >
                                            Guardar gestión y asignar siguiente
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>

                {/* Calendario */}
                <div style={styles.rightColumn}>
                    <div style={styles.card}>
                        <CalendarioCitas refreshToken={calendarRefreshToken} />
                    </div>
                </div>
            </section>
        </div>
    );
}

/* =====================  ESTILOS  ===================== */

const styles = {
    page: {
        padding: "2rem",
        backgroundColor: "#F3F4F6",
        minHeight: "100vh",
    },
    headerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "1.25rem",
    },
    title: {
        fontSize: "1.75rem",
        fontWeight: 700,
        color: "#0F172A",
        marginBottom: "0.25rem",
    },
    subtitle: {
        fontSize: "0.95rem",
        color: "#6B7280",
        marginBottom: "0.25rem",
    },
    estadoBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: "999px",
        padding: "0.4rem 0.8rem",
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
    },
    estadoLabel: {
        fontSize: "0.8rem",
        color: "#6B7280",
    },
    estadoChips: {
        display: "flex",
        gap: "0.3rem",
    },
    estadoChip: {
        borderRadius: "999px",
        border: "1px solid #E5E7EB",
        padding: "0.25rem 0.6rem",
        fontSize: "0.75rem",
        backgroundColor: "#FFFFFF",
        color: "#374151",
        cursor: "pointer",
    },
    estadoChipActive: {
        backgroundColor: "#22C55E",
        color: "#FFFFFF",
        borderColor: "#22C55E",
    },
    cardRow: {
        display: "flex",
        gap: "1.5rem",
        marginBottom: "1.5rem",
    },
    card: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: "1rem",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.04)",
    },
    cardTitle: {
        fontSize: "1.1rem",
        fontWeight: 600,
        color: "#111827",
        marginBottom: "0.5rem",
    },
    cardText: {
        fontSize: "0.9rem",
        color: "#6B7280",
        marginBottom: "1rem",
    },
    metricsRow: {
        display: "flex",
        gap: "1rem",
    },
    metricBox: {
        flex: 1,
        backgroundColor: "#EFF6FF",
        borderRadius: "0.75rem",
        padding: "0.75rem 1rem",
    },
    metricLabel: {
        fontSize: "0.8rem",
        color: "#64748B",
    },
    metricValue: {
        fontSize: "1.4rem",
        fontWeight: 700,
        color: "#111827",
    },
    mainRow: {
        display: "flex",
        gap: "1.5rem",
        marginTop: "1rem",
    },
    leftColumn: {
        flex: 3,
    },
    rightColumn: {
        flex: 4,
    },
    registroBox: {
        backgroundColor: "#F9FAFB",
        borderRadius: "0.75rem",
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        fontSize: "0.9rem",
        color: "#111827",
    },
    label: {
        display: "block",
        fontSize: "0.85rem",
        fontWeight: 500,
        color: "#374151",
        marginBottom: "0.35rem",
    },
    chipsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        marginTop: "0.25rem",
    },
    chip: {
        borderRadius: "999px",
        border: "1px solid #E5E7EB",
        padding: "0.35rem 0.75rem",
        fontSize: "0.8rem",
        backgroundColor: "#FFFFFF",
        color: "#374151",
        cursor: "pointer",
    },
    chipActive: {
        backgroundColor: "#2563EB",
        color: "#FFFFFF",
        borderColor: "#2563EB",
    },
    input: {
        width: "100%",
        padding: "0.5rem 0.6rem",
        borderRadius: "0.6rem",
        border: "1px solid #E5E7EB",
        fontSize: "0.9rem",
    },
    textarea: {
        width: "100%",
        minHeight: "80px",
        padding: "0.5rem 0.6rem",
        borderRadius: "0.6rem",
        border: "1px solid #E5E7EB",
        fontSize: "0.9rem",
        resize: "vertical",
    },
    primaryButton: {
        backgroundColor: "#2563EB",
        color: "#FFFFFF",
        border: "none",
        borderRadius: "999px",
        padding: "0.6rem 1.5rem",
        fontSize: "0.9rem",
        fontWeight: 600,
        cursor: "pointer",
    },
};
