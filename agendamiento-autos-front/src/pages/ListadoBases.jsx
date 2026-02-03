// src/pages/ListadoBases.jsx
import { useEffect, useState } from "react";

const API_BASE = "http://localhost:4004";

export default function ListadoBases() {
    const [bases, setBases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchBases = async () => {
            try {
                setLoading(true);
                setError("");

                const token = localStorage.getItem("access_token");

                const resp = await fetch(`${API_BASE}/bases`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                });

                const json = await resp.json();

                if (!resp.ok) {
                    setError(json.error || "Error cargando bases");
                    return;
                }

                setBases(json.bases || []);
            } catch (err) {
                console.error(err);
                setError("Error de conexión con el servidor");
            } finally {
                setLoading(false);
            }
        };

        fetchBases();
    }, []);

    return (
        <div style={styles.wrapper}>
            <h1 style={styles.title}>Listado de bases cargadas</h1>
            <p style={styles.subtitle}>
                Aquí puedes ver todas las bases importadas al sistema y su
                estado.
            </p>

            {loading && <p>Cargando bases...</p>}
            {error && <p style={styles.error}>{error}</p>}

            {!loading && !error && bases.length === 0 && (
                <p>No hay bases cargadas aún.</p>
            )}

            {!loading && !error && bases.length > 0 && (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nombre</th>
                            <th style={styles.th}>Descripción</th>
                            <th style={styles.th}>Registros</th>
                            <th style={styles.th}>Estado</th>
                            <th style={styles.th}>Fecha de carga</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bases.map((b) => (
                            <tr key={b.id} style={styles.tr}>
                                <td style={styles.td}>{b.name}</td>
                                <td style={styles.td}>{b.description}</td>
                                <td style={styles.tdCenter}>
                                    {b.total_registros ?? b.total_records}
                                </td>
                                <td style={styles.td}>
                                    <span
                                        style={styles.badge(
                                            b.estado || b.status,
                                        )}
                                    >
                                        {b.estado || b.status || "pendiente"}
                                    </span>
                                </td>
                                <td style={styles.td}>
                                    {b.created_at || b.uploaded_at
                                        ? new Date(
                                              b.created_at || b.uploaded_at,
                                          ).toLocaleString("es-EC")
                                        : "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

const styles = {
    wrapper: {
        backgroundColor: "#FFFFFF",
        padding: "2rem",
        borderRadius: "1rem",
        boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    },
    title: {
        fontSize: "1.5rem",
        marginBottom: "0.25rem",
        color: "#0F172A",
    },
    subtitle: {
        fontSize: "0.9rem",
        marginBottom: "1.5rem",
        color: "#64748B",
    },
    error: {
        color: "#DC2626",
        fontSize: "0.9rem",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "0.9rem",
    },
    th: {
        textAlign: "left",
        padding: "0.75rem",
        borderBottom: "1px solid #E2E8F0",
        backgroundColor: "#F8FAFC",
        color: "#475569",
    },
    tr: {
        borderBottom: "1px solid #E2E8F0",
    },
    td: {
        padding: "0.75rem",
        color: "#0F172A",
        verticalAlign: "top",
    },
    tdCenter: {
        padding: "0.75rem",
        textAlign: "center",
        color: "#0F172A",
    },
    badge: (status) => ({
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        borderRadius: "999px",
        fontSize: "0.75rem",
        textTransform: "capitalize",
        backgroundColor:
            status === "finalizada"
                ? "rgba(34,197,94,0.1)"
                : status === "en_gestion"
                  ? "rgba(234,179,8,0.15)"
                  : "rgba(148,163,184,0.25)",
        color:
            status === "finalizada"
                ? "#16A34A"
                : status === "en_gestion"
                  ? "#CA8A04"
                  : "#475569",
    }),
};
