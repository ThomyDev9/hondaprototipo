import React, { useEffect, useMemo, useRef, useState } from "react";
import "./GrabacionesOutboundPage.css";
import { PageContainer } from "../../components/common";

const getAuthToken = () => localStorage.getItem("access_token") || "";

function toLocalDateString(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function AudioActions({
    row,
    rowId,
    audioUrls,
    fetchAudioUrl,
    playingAudioId,
    setPlayingAudioId,
    currentAudioRef,
}) {
    const stopCurrentAudio = () => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        setPlayingAudioId("");
    };

    return row.recordingfile ? (
        <span className="grabaciones-actions">
            <button
                title="Escuchar"
                className="grabaciones-icon-btn"
                onClick={async () => {
                    const url = await fetchAudioUrl(row.recordingfile);
                    if (!url) return;
                    const audio = document.getElementById(rowId);
                    if (!audio) return;
                    if (
                        currentAudioRef.current &&
                        currentAudioRef.current !== audio
                    ) {
                        currentAudioRef.current.pause();
                        currentAudioRef.current.currentTime = 0;
                    }
                    audio.src = url;
                    currentAudioRef.current = audio;
                    audio.play();
                    setPlayingAudioId(rowId);
                }}
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    className="grabaciones-icon"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <circle cx="11" cy="11" r="11" fill="#2563EB" />
                    <polygon points="8,6 17,11 8,16" fill="#fff" />
                </svg>
            </button>
            <audio
                id={rowId}
                style={{ display: "none" }}
                src={audioUrls[row.recordingfile] || ""}
                onEnded={() => {
                    if (playingAudioId === rowId) {
                        setPlayingAudioId("");
                        currentAudioRef.current = null;
                    }
                }}
            />
            <button
                title="Detener"
                className="grabaciones-icon-btn"
                onClick={() => {
                    if (playingAudioId === rowId) {
                        stopCurrentAudio();
                        return;
                    }
                    const audio = document.getElementById(rowId);
                    if (audio) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                }}
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    className="grabaciones-icon"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <circle
                        cx="11"
                        cy="11"
                        r="11"
                        fill={
                            playingAudioId === rowId ? "#dc2626" : "#64748b"
                        }
                    />
                    <rect
                        x="7"
                        y="7"
                        width="8"
                        height="8"
                        rx="1.5"
                        fill="#fff"
                    />
                </svg>
            </button>
            <button
                title="Descargar"
                className="grabaciones-icon-btn"
                onClick={async () => {
                    const url = await fetchAudioUrl(row.recordingfile);
                    if (!url) return;
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = String(row.recordingfile).split("/").pop();
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }}
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    className="grabaciones-icon"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <circle cx="11" cy="11" r="11" fill="#2563EB" />
                    <path
                        d="M11 6v7m0 0l-3-3m3 3l3-3"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <rect
                        x="7"
                        y="16"
                        width="8"
                        height="2"
                        rx="1"
                        fill="#fff"
                    />
                </svg>
            </button>
        </span>
    ) : (
        "-"
    );
}

export default function GrabacionesInboundPage() {
    const [grabaciones, setGrabaciones] = useState([]);
    const [loadingGrabaciones, setLoadingGrabaciones] = useState(false);
    const [audioUrls, setAudioUrls] = useState({});
    const [error, setError] = useState(null);
    const [playingAudioId, setPlayingAudioId] = useState("");
    const currentAudioRef = useRef(null);
    const [filtroCampania, setFiltroCampania] = useState("");
    const [filtroCategorizacion, setFiltroCategorizacion] = useState("");
    const [filtroAgente, setFiltroAgente] = useState("");
    const [filtroTelefono, setFiltroTelefono] = useState("");
    const [filtroIdentificacion, setFiltroIdentificacion] = useState("");
    const [filtroFecha, setFiltroFecha] = useState("");

    const grabacionesVista = useMemo(() => {
        const rows = Array.isArray(grabaciones) ? grabaciones : [];
        const byInteraction = new Map();

        for (const row of rows) {
            const interactionId = String(row?.InteractionId || "").trim();
            if (!interactionId) {
                const fallbackKey = `row-${String(row?.id || "").trim()}-${String(
                    row?.recordingfile || "",
                ).trim()}`;
                if (!byInteraction.has(fallbackKey)) {
                    byInteraction.set(fallbackKey, row);
                }
                continue;
            }

            const current = byInteraction.get(interactionId);
            if (!current) {
                byInteraction.set(interactionId, row);
                continue;
            }

            const currentOrder = Number(current?.ActionOrder || current?.action_order || 0);
            const nextOrder = Number(row?.ActionOrder || row?.action_order || 0);

            // Prioriza accion 1 para evitar duplicados visuales por multiples acciones.
            if (currentOrder !== 1 && nextOrder === 1) {
                byInteraction.set(interactionId, row);
            }
        }

        return Array.from(byInteraction.values());
    }, [grabaciones]);

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
        setLoadingGrabaciones(true);
        fetch(`${API_BASE}/supervisor/grabaciones-inbound`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No autorizado");
                return res.json();
            })
            .then((data) => setGrabaciones(Array.isArray(data) ? data : []))
            .catch(() => {
                setError("No se pudo cargar las grabaciones inbound");
                setGrabaciones([]);
            })
            .finally(() => setLoadingGrabaciones(false));
    }, []);

    useEffect(() => {
        return () => {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.currentTime = 0;
                currentAudioRef.current = null;
            }
            Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
        };
    }, [audioUrls]);

    const fetchAudioUrl = async (recordingfile) => {
        if (audioUrls[recordingfile]) return audioUrls[recordingfile];
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
        try {
            const res = await fetch(
                `${API_BASE}/supervisor/grabacion-sftp/${recordingfile}?flow=inbound`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) {
                let backendMessage = "";
                try {
                    const errorData = await res.json();
                    backendMessage =
                        String(errorData?.error || "").trim() ||
                        String(errorData?.message || "").trim();
                } catch {
                    backendMessage = "";
                }

                throw new Error(
                    backendMessage ||
                        (res.status === 401 || res.status === 403
                            ? "No autorizado"
                            : "Error al descargar la grabacion"),
                );
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrls((prev) => ({ ...prev, [recordingfile]: url }));
            return url;
        } catch (err) {
            alert(`No se pudo obtener la grabacion: ${err.message}`);
            return null;
        }
    };

    const campanias = Array.from(
        new Set(grabacionesVista.map((g) => g.CampaignId).filter(Boolean)),
    );
    const categorizaciones = Array.from(
        new Set(grabacionesVista.map((g) => g.Categorizacion).filter(Boolean)),
    );
    const agentes = Array.from(
        new Set(grabacionesVista.map((g) => g.AgentName || g.Agent).filter(Boolean)),
    );

    const grabacionesFiltradas = grabacionesVista.filter((g) => {
        const fechaGrabacion =
            g.calldateLocal || toLocalDateString(g.calldate || g.TmStmp);
        const telefono = String(g.dst || g.ContactAddress || "");
        const identificacion = String(g.Identification || "");
        return (
            (!filtroFecha || fechaGrabacion === filtroFecha) &&
            (!filtroCampania || g.CampaignId === filtroCampania) &&
            (!filtroCategorizacion ||
                g.Categorizacion === filtroCategorizacion) &&
            (!filtroAgente || (g.AgentName || g.Agent) === filtroAgente) &&
            (!filtroTelefono || telefono.includes(filtroTelefono)) &&
            (!filtroIdentificacion ||
                identificacion.includes(filtroIdentificacion))
        );
    });

    const handleDescargarTodas = async () => {
        if (grabacionesFiltradas.length === 0) {
            alert("No hay grabaciones para descargar.");
            return;
        }
        let descargadas = 0;
        for (const g of grabacionesFiltradas) {
            if (!g.recordingfile) continue;
            try {
                const url = await fetchAudioUrl(g.recordingfile);
                if (!url) continue;
                const a = document.createElement("a");
                a.href = url;
                a.download = String(g.recordingfile).split("/").pop();
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                descargadas++;
            } catch {}
        }
        if (descargadas === 0) {
            alert("No se pudo descargar ninguna grabación.");
        }
    };

    const limpiarFiltros = () => {
        setFiltroCampania("");
        setFiltroCategorizacion("");
        setFiltroAgente("");
        setFiltroTelefono("");
        setFiltroIdentificacion("");
        setFiltroFecha("");
    };

    return (
        <PageContainer>
            <div className="grabaciones-page">
                <div className="grabaciones-hero">
                    <div>
                        <h2 className="grabaciones-title">
                            Grabaciones Inbound
                        </h2>
                    </div>
                </div>

                <div className="grabaciones-filters-card">
                    <div className="grabaciones-filters-head">
                        <div>
                            <h3 className="grabaciones-filters-title">
                                Filtros de búsqueda
                            </h3>
                        </div>
                        <div className="grabaciones-filters-actions">
                            <button
                                type="button"
                                className="grabaciones-primary-btn"
                                onClick={handleDescargarTodas}
                            >
                                Descargar todas
                            </button>
                            <button
                                type="button"
                                className="grabaciones-chip-btn"
                                onClick={limpiarFiltros}
                            >
                                Reiniciar
                            </button>
                        </div>
                    </div>

                    <div className="grabaciones-filters-grid">
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Campaña
                            </span>
                            <select
                                className="grabaciones-input"
                                value={filtroCampania}
                                onChange={(e) =>
                                    setFiltroCampania(e.target.value)
                                }
                            >
                                <option value="">Todas las campañas</option>
                                {campanias.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Categorización
                            </span>
                            <select
                                className="grabaciones-input"
                                value={filtroCategorizacion}
                                onChange={(e) =>
                                    setFiltroCategorizacion(e.target.value)
                                }
                            >
                                <option value="">Todas</option>
                                {categorizaciones.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Agente
                            </span>
                            <select
                                className="grabaciones-input"
                                value={filtroAgente}
                                onChange={(e) => setFiltroAgente(e.target.value)}
                            >
                                <option value="">Todos los agentes</option>
                                {agentes.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Fecha
                            </span>
                            <input
                                className="grabaciones-input"
                                type="date"
                                value={filtroFecha}
                                onChange={(e) => setFiltroFecha(e.target.value)}
                            />
                        </div>

                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Teléfono
                            </span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={filtroTelefono}
                                onChange={(e) =>
                                    setFiltroTelefono(e.target.value)
                                }
                                placeholder="Teléfono"
                            />
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Identificación
                            </span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={filtroIdentificacion}
                                onChange={(e) =>
                                    setFiltroIdentificacion(e.target.value)
                                }
                                placeholder="Identificación"
                            />
                        </div>
                    </div>
                </div>

                {error && <p className="grabaciones-error">{error}</p>}
                {loadingGrabaciones ? (
                    <div className="grabaciones-state-card">
                        Cargando grabaciones...
                    </div>
                ) : grabacionesFiltradas.length === 0 ? (
                    <div className="grabaciones-state-card">
                        No hay grabaciones inbound disponibles.
                    </div>
                ) : (
                    <div className="grabaciones-table-wrapper">
                        <table className="grabaciones-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Teléfono</th>
                                    <th>Identificación</th>
                                    <th>Agente</th>
                                    <th>Cliente</th>
                                    <th>Campaña</th>
                                    <th>Categorización</th>
                                    <th>Ticket</th>
                                    <th>Vínculo</th>
                                    <th>Grabación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grabacionesFiltradas.map((g, idx) => {
                                    const rowId = `audio-inbound-${idx}`;
                                    return (
                                        <tr
                                            key={`${g.ContactId}-${g.InteractionId}-${idx}`}
                                        >
                                            <td>
                                                {g.calldate
                                                    ? new Date(
                                                          g.calldate,
                                                      ).toLocaleString()
                                                    : ""}
                                            </td>
                                            <td>{g.dst || g.ContactAddress}</td>
                                            <td>{g.Identification || "-"}</td>
                                            <td>
                                                <div className="grabaciones-agent-main">
                                                    {g.AgentName || g.Agent}
                                                </div>
                                                <div className="grabaciones-agent-sub">
                                                    {g.Agent || ""}
                                                </div>
                                            </td>
                                            <td>{g.ContactName}</td>
                                            <td>{g.CampaignId}</td>
                                            <td>{g.Categorizacion || "-"}</td>
                                            <td>{g.TicketId || "-"}</td>
                                            <td>
                                                {g.recordingfile ? (
                                                    <span
                                                        className={`grabaciones-badge ${g.recordingLinked ? "grabaciones-badge--linked" : "grabaciones-badge--fallback"}`}
                                                    >
                                                        {g.recordingLinked
                                                            ? "Vinculada"
                                                            : "Fallback"}
                                                    </span>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                            <td>
                                                <AudioActions
                                                    row={g}
                                                    rowId={rowId}
                                                    audioUrls={audioUrls}
                                                    fetchAudioUrl={fetchAudioUrl}
                                                    playingAudioId={playingAudioId}
                                                    setPlayingAudioId={setPlayingAudioId}
                                                    currentAudioRef={currentAudioRef}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
