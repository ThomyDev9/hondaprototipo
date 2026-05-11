import React, { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
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
                src={audioUrls[row.recordingfile] || null}
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
    const [loadingFiltros, setLoadingFiltros] = useState(false);
    const [audioUrls, setAudioUrls] = useState({});
    const [error, setError] = useState(null);
    const [filtrosError, setFiltrosError] = useState(null);
    const [playingAudioId, setPlayingAudioId] = useState("");
    const [selectedRows, setSelectedRows] = useState({});
    const [hasSearched, setHasSearched] = useState(false);
    const [campaignOptions, setCampaignOptions] = useState([]);
    const [categorizacionOptions, setCategorizacionOptions] = useState([]);
    const [agenteOptions, setAgenteOptions] = useState([]);
    const currentAudioRef = useRef(null);
    const [filtroCampania, setFiltroCampania] = useState("");
    const [filtroCategorizacion, setFiltroCategorizacion] = useState("");
    const [filtroAgente, setFiltroAgente] = useState("");
    const [filtroBusqueda, setFiltroBusqueda] = useState("");
    const [filtroFechaInicio, setFiltroFechaInicio] = useState(
        toLocalDateString(new Date()),
    );
    const [filtroFechaFin, setFiltroFechaFin] = useState(
        toLocalDateString(new Date()),
    );

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
        const queryParams = new URLSearchParams();
        if (filtroFechaInicio) queryParams.set("startDate", filtroFechaInicio);
        if (filtroFechaFin) queryParams.set("endDate", filtroFechaFin);
        const queryString = queryParams.toString();
        setLoadingFiltros(true);
        fetch(`${API_BASE}/supervisor/grabaciones-inbound/filtros${queryString ? `?${queryString}` : ""}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No autorizado");
                return res.json();
            })
            .then((data) => {
                setCampaignOptions(Array.isArray(data?.campaigns) ? data.campaigns : []);
                setCategorizacionOptions(
                    Array.isArray(data?.categorizaciones)
                        ? data.categorizaciones
                        : [],
                );
                setAgenteOptions(Array.isArray(data?.agentes) ? data.agentes : []);
                setFiltrosError(null);
            })
            .catch(() => {
                setFiltrosError("No se pudo cargar filtros inbound");
                setCampaignOptions([]);
                setCategorizacionOptions([]);
                setAgenteOptions([]);
            })
            .finally(() => setLoadingFiltros(false));
    }, [filtroFechaInicio, filtroFechaFin]);

    const cargarGrabaciones = async () => {
        if (!String(filtroCampania || "").trim()) {
            setError("Selecciona una campaña para buscar grabaciones.");
            return;
        }
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
        const queryParams = new URLSearchParams();
        if (filtroFechaInicio) queryParams.set("startDate", filtroFechaInicio);
        if (filtroFechaFin) queryParams.set("endDate", filtroFechaFin);
        if (filtroCampania) queryParams.set("campaignId", filtroCampania);
        if (filtroBusqueda) queryParams.set("search", filtroBusqueda);
        const queryString = queryParams.toString();

        setLoadingGrabaciones(true);
        setError(null);
        setHasSearched(true);
        try {
            const res = await fetch(
                `${API_BASE}/supervisor/grabaciones-inbound${queryString ? `?${queryString}` : ""}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) throw new Error("No se pudo cargar las grabaciones inbound");
            const data = await res.json();
            setGrabaciones(Array.isArray(data) ? data : []);
            setSelectedRows({});
        } catch {
            setError("No se pudo cargar las grabaciones inbound");
            setGrabaciones([]);
            setSelectedRows({});
        } finally {
            setLoadingGrabaciones(false);
        }
    };

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

    const fetchAudioBlob = async (recordingfile) => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
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

        return res.blob();
    };

    const campanias = campaignOptions;
    const categorizaciones = categorizacionOptions;
    const agentes = agenteOptions;

    const grabacionesFiltradas = grabacionesVista.filter((g) => {
        const fechaGrabacion =
            g.calldateLocal || toLocalDateString(g.calldate || g.TmStmp);
        const telefono = String(g.dst || g.ContactAddress || "");
        const identificacion = String(g.Identification || "");
        const busqueda = String(filtroBusqueda || "").trim();
        return (
            (!filtroFechaInicio || fechaGrabacion >= filtroFechaInicio) &&
            (!filtroFechaFin || fechaGrabacion <= filtroFechaFin) &&
            (!filtroCampania || g.CampaignId === filtroCampania) &&
            (!filtroCategorizacion ||
                g.Categorizacion === filtroCategorizacion) &&
            (!filtroAgente || (g.AgentName || g.Agent) === filtroAgente) &&
            (!busqueda ||
                telefono.includes(busqueda) ||
                identificacion.includes(busqueda))
        );
    });

    const totalFiltradas = grabacionesFiltradas.length;
    const totalFiltradasConAudio = grabacionesFiltradas.filter(
        (g) => g.recordingfile,
    ).length;
    const selectedFilteredCount = grabacionesFiltradas.filter((g, idx) => {
        const key = `${g.ContactId || ""}|${g.InteractionId || ""}|${idx}`;
        return Boolean(selectedRows[key]);
    }).length;
    const allFilteredSelected =
        totalFiltradas > 0 &&
        grabacionesFiltradas.every((g, idx) => {
            const key = `${g.ContactId || ""}|${g.InteractionId || ""}|${idx}`;
            return Boolean(selectedRows[key]);
        });

    const handleDescargarTodas = async () => {
        const seleccionadas = grabacionesFiltradas.filter((g, idx) => {
            const key = `${g.ContactId || ""}|${g.InteractionId || ""}|${idx}`;
            return Boolean(selectedRows[key]);
        });
        const targetRows =
            seleccionadas.length > 0 ? seleccionadas : grabacionesFiltradas;

        if (targetRows.length === 0) {
            alert("No hay grabaciones para descargar.");
            return;
        }

        const zip = new JSZip();
        const usedNames = new Map();
        let descargadas = 0;

        for (const g of targetRows) {
            if (!g.recordingfile) continue;
            try {
                const blob = await fetchAudioBlob(g.recordingfile);
                const baseName =
                    String(g.recordingfile).split("/").pop() || "grabacion.wav";
                const duplicateCount = usedNames.get(baseName) || 0;
                usedNames.set(baseName, duplicateCount + 1);

                const dotIndex = baseName.lastIndexOf(".");
                const hasExt = dotIndex > 0;
                const name = hasExt ? baseName.slice(0, dotIndex) : baseName;
                const ext = hasExt ? baseName.slice(dotIndex) : "";
                const finalName =
                    duplicateCount === 0
                        ? baseName
                        : `${name}_${duplicateCount + 1}${ext}`;

                zip.file(finalName, blob);
                descargadas++;
            } catch {}
        }

        if (descargadas === 0) {
            alert("No se pudo descargar ninguna grabacion.");
            return;
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `grabaciones_inbound_${toLocalDateString(new Date()) || "hoy"}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
const limpiarFiltros = () => {
        setFiltroCampania("");
        setFiltroCategorizacion("");
        setFiltroAgente("");
        setFiltroBusqueda("");
        setFiltroFechaInicio(toLocalDateString(new Date()));
        setFiltroFechaFin(toLocalDateString(new Date()));
        setSelectedRows({});
        setHasSearched(false);
        setGrabaciones([]);
    };

    const toggleSelectAllFiltered = () => {
        if (allFilteredSelected) {
            const next = { ...selectedRows };
            for (let i = 0; i < grabacionesFiltradas.length; i += 1) {
                const g = grabacionesFiltradas[i];
                const key = `${g.ContactId || ""}|${g.InteractionId || ""}|${i}`;
                delete next[key];
            }
            setSelectedRows(next);
            return;
        }

        const next = { ...selectedRows };
        for (let i = 0; i < grabacionesFiltradas.length; i += 1) {
            const g = grabacionesFiltradas[i];
            const key = `${g.ContactId || ""}|${g.InteractionId || ""}|${i}`;
            next[key] = true;
        }
        setSelectedRows(next);
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
                        <div className="grabaciones-head-right">
                            <div className="grabaciones-head-summary">
                                <span className="grabaciones-summary-pill">
                                    Total filtradas: <strong>{totalFiltradas}</strong>
                                </span>
                                <span className="grabaciones-summary-pill">
                                    Con audio: <strong>{totalFiltradasConAudio}</strong>
                                </span>
                                <span className="grabaciones-summary-pill">
                                    Seleccionadas: <strong>{selectedFilteredCount}</strong>
                                </span>
                            </div>
                            <div className="grabaciones-filters-actions">
                                <button
                                    type="button"
                                    className="grabaciones-primary-btn"
                                    onClick={cargarGrabaciones}
                                >
                                    Buscar grabaciones
                                </button>
                                <button
                                    type="button"
                                    className="grabaciones-secondary-btn"
                                    onClick={handleDescargarTodas}
                                >
                                    Descargar selección/filtradas
                                </button>
                                <button
                                    type="button"
                                    className="grabaciones-chip-btn"
                                    onClick={limpiarFiltros}
                                >
                                    Reiniciar filtros
                                </button>
                            </div>
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
                                <option value="">Selecciona campaña</option>
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
                                Fecha inicio
                            </span>
                            <input
                                className="grabaciones-input"
                                type="date"
                                value={filtroFechaInicio}
                                onChange={(e) =>
                                    setFiltroFechaInicio(e.target.value)
                                }
                            />
                        </div>

                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Fecha fin
                            </span>
                            <input
                                className="grabaciones-input"
                                type="date"
                                value={filtroFechaFin}
                                onChange={(e) =>
                                    setFiltroFechaFin(e.target.value)
                                }
                            />
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Teléfono / Identificación
                            </span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={filtroBusqueda}
                                onChange={(e) =>
                                    setFiltroBusqueda(e.target.value)
                                }
                                placeholder="Buscar por teléfono o identificación"
                            />
                        </div>
                    </div>
                </div>

                {filtrosError && <p className="grabaciones-error">{filtrosError}</p>}
                {error && <p className="grabaciones-error">{error}</p>}
                {loadingFiltros ? (
                    <div className="grabaciones-state-card">
                        Cargando filtros...
                    </div>
                ) : loadingGrabaciones ? (
                    <div className="grabaciones-state-card">
                        Cargando grabaciones...
                    </div>
                ) : grabacionesFiltradas.length === 0 ? (
                    <div className="grabaciones-state-card">
                        {hasSearched
                            ? "No hay grabaciones inbound para los filtros seleccionados."
                            : "Selecciona campaña y luego haz clic en Buscar grabaciones."}
                    </div>
                ) : (
                    <div className="grabaciones-table-wrapper">
                        <table className="grabaciones-table">
                            <thead>
                                <tr>
                                    <th>
                                        <input
                                            type="checkbox"
                                            checked={allFilteredSelected}
                                            onChange={toggleSelectAllFiltered}
                                            title="Seleccionar todas las filas filtradas"
                                        />
                                    </th>
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
                                    const selectKey = `${g.ContactId || ""}|${g.InteractionId || ""}|${idx}`;
                                    return (
                                        <tr
                                            key={`${g.ContactId}-${g.InteractionId}-${idx}`}
                                        >
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(
                                                        selectedRows[selectKey],
                                                    )}
                                                    onChange={() =>
                                                        setSelectedRows((prev) => ({
                                                            ...prev,
                                                            [selectKey]:
                                                                !prev[selectKey],
                                                        }))
                                                    }
                                                />
                                            </td>
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

