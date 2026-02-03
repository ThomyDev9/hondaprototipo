// src/components/CalendarioCitas.jsx
import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const API_BASE = "http://localhost:4004";

export default function CalendarioCitas({ refreshToken }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const cargarCitas = async () => {
        try {
            setLoading(true);
            setError("");

            const token = localStorage.getItem("access_token");
            if (!token) {
                setError("Sesión no encontrada.");
                return;
            }

            const resp = await fetch(`${API_BASE}/agente/citas`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            const json = await resp.json();

            if (!resp.ok) {
                console.error("Error /agente/citas:", json);
                setError(json.error || "No se pudieron cargar las citas.");
                return;
            }

            const citas = json.citas || [];

            const mappedEvents = citas.map((cita) => {
                const nombre = cita.nombre_cliente || "Cliente sin nombre";
                const placa = cita.placa ? ` · ${cita.placa}` : "";
                const agencia = cita.agencia_cita
                    ? ` · ${cita.agencia_cita}`
                    : "";

                return {
                    id: cita.id,
                    title: `${nombre}${placa}${agencia}`,
                    start: cita.fecha_cita,
                    allDay: false,
                };
            });

            setEvents(mappedEvents);
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarCitas();
    }, [refreshToken]);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h3 style={styles.title}>Mi calendario de citas</h3>
                    <p style={styles.subtitle}>
                        Visual estilo Outlook: mes, semana o día.
                    </p>
                </div>
                {loading && <span style={styles.badge}>Actualizando…</span>}
            </div>

            {error && <p style={{ color: "#EA580C" }}>{error}</p>}

            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                height={650}
                events={events}
            />
        </div>
    );
}

const styles = {
    container: {
        paddingTop: "0.5rem",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "0.75rem",
    },
    title: {
        fontSize: "1rem",
        fontWeight: 600,
        color: "#0F172A",
    },
    subtitle: {
        fontSize: "0.85rem",
        color: "#64748B",
    },
    badge: {
        backgroundColor: "#DBEAFE",
        color: "#1D4ED8",
        padding: "0.2rem 0.5rem",
        borderRadius: "999px",
        fontSize: "0.75rem",
    },
};
