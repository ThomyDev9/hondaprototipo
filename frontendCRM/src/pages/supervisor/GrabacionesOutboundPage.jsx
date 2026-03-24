import React, { useEffect, useRef, useState } from "react";
import "./GrabacionesOutboundPage.css";
// ...existing code...
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

export default function GrabacionesOutboundPage() {
    const [grabaciones, setGrabaciones] = useState([]);
    const [loadingGrabaciones, setLoadingGrabaciones] = useState(false);
    const [audioUrls, setAudioUrls] = useState({});
    const [error, setError] = useState(null);
    const [playingAudioId, setPlayingAudioId] = useState("");
    const currentAudioRef = useRef(null);
    // Filtros
    const [filtroCampania, setFiltroCampania] = useState("");
    const [filtroBase, setFiltroBase] = useState("");
    const [filtroResultado, setFiltroResultado] = useState("");
    const [filtroAgente, setFiltroAgente] = useState("");
    const [filtroTelefono, setFiltroTelefono] = useState("");
    const [filtroFecha, setFiltroFecha] = useState("");

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
        setLoadingGrabaciones(true);
        fetch(`${API_BASE}/supervisor/grabaciones`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No autorizado");
                return res.json();
            })
            .then((data) => setGrabaciones(Array.isArray(data) ? data : []))
            .catch((err) => {
                setError("No se pudo cargar las grabaciones");
                setGrabaciones([]);
            })
            .finally(() => setLoadingGrabaciones(false));
    }, []);

    // Limpia los object URLs al desmontar
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
                `${API_BASE}/supervisor/grabacion-sftp/${recordingfile}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
            );
            if (!res.ok) throw new Error("No autorizado o error de descarga");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrls((prev) => ({ ...prev, [recordingfile]: url }));
            return url;
        } catch (err) {
            alert("No se pudo obtener la grabación: " + err.message);
            return null;
        }
    };

    const stopCurrentAudio = () => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        setPlayingAudioId("");
    };

    // Opciones únicas para selects
    const campanias = Array.from(
        new Set(grabaciones.map((g) => g.CampaignId).filter(Boolean)),
    );
    const bases = Array.from(
        new Set(
            grabaciones
                .map((g) => g.ImportId || g.Importid || g.ImportID)
                .filter(Boolean),
        ),
    );
    const resultados = Array.from(
        new Set(grabaciones.map((g) => g.ResultLevel1).filter(Boolean)),
    );
    const agentes = Array.from(
        new Set(grabaciones.map((g) => g.AgentName || g.Agent).filter(Boolean)),
    );

    const totalConAudio = grabaciones.filter((g) => g.recordingfile).length;
    const totalVinculadas = grabaciones.filter(
        (g) => g.recordingfile && g.recordingLinked,
    ).length;

    // Filtro aplicado
    const grabacionesFiltradas = grabaciones.filter((g) => {
        const fechaGrabacion =
            g.calldateLocal || toLocalDateString(g.calldate || g.TmStmp);
        const fechaOk = !filtroFecha || fechaGrabacion === filtroFecha;
        const campaniaOk = !filtroCampania || g.CampaignId === filtroCampania;
        const baseOk =
            !filtroBase ||
            (g.ImportId || g.Importid || g.ImportID) === filtroBase;
        const resultadoOk =
            !filtroResultado || g.ResultLevel1 === filtroResultado;
        const agenteOk =
            !filtroAgente || (g.AgentName || g.Agent) === filtroAgente;
        const telefonoOk =
            !filtroTelefono || (g.dst && g.dst.includes(filtroTelefono));
        return (
            fechaOk &&
            campaniaOk &&
            baseOk &&
            resultadoOk &&
            agenteOk &&
            telefonoOk
        );
    });

    // Descarga en bloque
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
                if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = g.recordingfile;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    descargadas++;
                }
            } catch (e) {}
        }
        if (descargadas === 0) {
            alert("No se pudo descargar ninguna grabación.");
        }
    };

    const limpiarFiltros = () => {
        setFiltroCampania("");
        setFiltroBase("");
        setFiltroResultado("");
        setFiltroAgente("");
        setFiltroTelefono("");
        setFiltroFecha("");
    };

    return (
        <PageContainer>
            <div className="grabaciones-page">
                <div className="grabaciones-hero">
                    <div>
                        <h2 className="grabaciones-title">
                            Grabaciones Outbound
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
                                title="Descargar todas las grabaciones filtradas"
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
                                {campanias.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Base
                            </span>
                            <select
                                className="grabaciones-input"
                                value={filtroBase}
                                onChange={(e) => setFiltroBase(e.target.value)}
                            >
                                <option value="">Todas las bases</option>
                                {bases.map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Resultado
                            </span>
                            <select
                                className="grabaciones-input"
                                value={filtroResultado}
                                onChange={(e) =>
                                    setFiltroResultado(e.target.value)
                                }
                            >
                                <option value="">Todos los resultados</option>
                                {resultados.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
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
                                onChange={(e) =>
                                    setFiltroAgente(e.target.value)
                                }
                            >
                                <option value="">Todos los agentes</option>
                                {agentes.map((a) => (
                                    <option key={a} value={a}>
                                        {a}
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
                                Telefono
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
                    </div>
                </div>
                {error && <p className="grabaciones-error">{error}</p>}
                {loadingGrabaciones ? (
                    <div className="grabaciones-state-card">
                        Cargando grabaciones...
                    </div>
                ) : grabacionesFiltradas.length === 0 ? (
                    <div className="grabaciones-state-card">
                        No hay grabaciones disponibles.
                    </div>
                ) : (
                    <div className="grabaciones-table-wrapper">
                        <table className="grabaciones-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Teléfono</th>
                                    <th>Usuario</th>
                                    <th>Agente</th>
                                    <th>Cliente</th>
                                    <th>Campaña</th>
                                    <th>Base</th>
                                    <th>Resultado</th>
                                    <th>Vinculo</th>
                                    <th>Grabación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grabacionesFiltradas.map((g, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            {g.calldate
                                                ? new Date(
                                                      g.calldate,
                                                  ).toLocaleString()
                                                : ""}
                                        </td>
                                        <td>{g.dst}</td>
                                        <td>{g.Agent || ""}</td>
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
                                        <td>
                                            {g.ImportId ||
                                                g.Importid ||
                                                g.ImportID ||
                                                ""}
                                        </td>
                                        <td>{g.ResultLevel1}</td>
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
                                            {g.recordingfile ? (
                                                <>
                                                    <span className="grabaciones-actions">
                                                        {/* Icono escuchar */}
                                                        <button
                                                            title="Escuchar"
                                                            className="grabaciones-icon-btn"
                                                            onClick={async () => {
                                                                const url =
                                                                    await fetchAudioUrl(
                                                                        g.recordingfile,
                                                                    );
                                                                if (url) {
                                                                    const audio =
                                                                        document.getElementById(
                                                                            `audio-outbound-${idx}`,
                                                                        );
                                                                    if (audio) {
                                                                        if (
                                                                            currentAudioRef.current &&
                                                                            currentAudioRef.current !==
                                                                                audio
                                                                        ) {
                                                                            currentAudioRef.current.pause();
                                                                            currentAudioRef.current.currentTime = 0;
                                                                        }
                                                                        audio.src =
                                                                            url;
                                                                        currentAudioRef.current =
                                                                            audio;
                                                                        audio.play();
                                                                        setPlayingAudioId(
                                                                            `audio-outbound-${idx}`,
                                                                        );
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            {/* SVG play icon */}
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
                                                                    fill="#2563EB"
                                                                />
                                                                <polygon
                                                                    points="8,6 17,11 8,16"
                                                                    fill="#fff"
                                                                />
                                                            </svg>
                                                        </button>
                                                        {/* Reproductor oculto */}
                                                        <audio
                                                            id={`audio-outbound-${idx}`}
                                                            style={{
                                                                display: "none",
                                                            }}
                                                            src={
                                                                audioUrls[
                                                                    g
                                                                        .recordingfile
                                                                ] || ""
                                                            }
                                                            onEnded={() => {
                                                                if (
                                                                    playingAudioId ===
                                                                    `audio-outbound-${idx}`
                                                                ) {
                                                                    setPlayingAudioId(
                                                                        "",
                                                                    );
                                                                    currentAudioRef.current =
                                                                        null;
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            title="Detener"
                                                            className="grabaciones-icon-btn"
                                                            onClick={() => {
                                                                const audioId = `audio-outbound-${idx}`;
                                                                if (
                                                                    playingAudioId ===
                                                                    audioId
                                                                ) {
                                                                    stopCurrentAudio();
                                                                    return;
                                                                }

                                                                const audio =
                                                                    document.getElementById(
                                                                        audioId,
                                                                    );
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
                                                                        playingAudioId ===
                                                                        `audio-outbound-${idx}`
                                                                            ? "#dc2626"
                                                                            : "#64748b"
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
                                                        {/* Icono descargar */}
                                                        <button
                                                            title="Descargar"
                                                            className="grabaciones-icon-btn"
                                                            onClick={async () => {
                                                                const url =
                                                                    await fetchAudioUrl(
                                                                        g.recordingfile,
                                                                    );
                                                                if (url) {
                                                                    const a =
                                                                        document.createElement(
                                                                            "a",
                                                                        );
                                                                    a.href =
                                                                        url;
                                                                    a.download =
                                                                        g.recordingfile;
                                                                    document.body.appendChild(
                                                                        a,
                                                                    );
                                                                    a.click();
                                                                    document.body.removeChild(
                                                                        a,
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {/* SVG download icon */}
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
                                                                    fill="#2563EB"
                                                                />
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
                                                </>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
