import React, { useEffect, useMemo, useRef, useState } from "react";
import "./GrabacionesOutboundPage.css";
// ...existing code...
import { PageContainer } from "../../components/common";

const getAuthToken = () => localStorage.getItem("access_token") || null;

function getRecordingFilename(recordingfile) {
    return (
        String(recordingfile || null)
            .split("/")
            .pop() || "grabacion.wav"
    );
}
function toLocalDateString(value) {
    if (!value) return "";
    const raw = String(value).trim();

    // MySQL datetime often comes as "YYYY-MM-DD HH:mm:ss".
    // Normalize to a JS-parsable local datetime first.
    const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    let date = new Date(normalized);

    // Fallback for edge cases where parsing still fails.
    if (Number.isNaN(date.getTime()) && raw.includes(" ")) {
        const onlyDate = raw.split(" ")[0];
        date = new Date(`${onlyDate}T00:00:00`);
    }

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getRowKey(recording = {}, idx = 0) {
    const id = String(recording?.Id || null).trim();
    const contactId = String(recording?.ContactId || null).trim();
    const interactionId = String(recording?.InteractionId || null).trim();
    const calldate = String(recording?.calldate || null).trim();
    const recordingfile = String(recording?.recordingfile || null).trim();
    const composite = [id, contactId, interactionId, calldate, recordingfile]
        .filter(Boolean)
        .join("|");
    return composite || `row-${idx}`;
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

export default function GrabacionesOutboundPage() {
    const [grabaciones, setGrabaciones] = useState([]);
    const [loadingGrabaciones, setLoadingGrabaciones] = useState(false);
    const [loadingFiltros, setLoadingFiltros] = useState(false);
    const [audioUrls, setAudioUrls] = useState({});
    const [error, setError] = useState(null);
    const [filtrosError, setFiltrosError] = useState(null);
    const [playingAudioId, setPlayingAudioId] = useState("");
    const [campaignOptions, setCampaignOptions] = useState([]);
    const [basesByCampaign, setBasesByCampaign] = useState({});
    const [selectedRows, setSelectedRows] = useState({});
    const [hasSearched, setHasSearched] = useState(false);
    const currentAudioRef = useRef(null);
    // Filtros
    const [filtroCampania, setFiltroCampania] = useState("");
    const [filtroBase, setFiltroBase] = useState("");
    const [filtroResultado, setFiltroResultado] = useState("");
    const [filtroAgente, setFiltroAgente] = useState("");
    const [filtroTelefono, setFiltroTelefono] = useState("");
    const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
    const [filtroFechaFin, setFiltroFechaFin] = useState("");

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
        const queryParams = new URLSearchParams();
        if (filtroFechaInicio) queryParams.set("startDate", filtroFechaInicio);
        if (filtroFechaFin) queryParams.set("endDate", filtroFechaFin);
        const queryString = queryParams.toString();
        setLoadingFiltros(true);
        fetch(
            `${API_BASE}/supervisor/grabaciones/filtros${queryString ? `?${queryString}` : ""}`,
            {
                cache: "no-store",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        )
            .then((res) => {
                if (!res.ok) {
                    return res
                        .json()
                        .catch(() => ({}))
                        .then((errorPayload) => {
                            const detail = String(
                                errorPayload?.error ||
                                    errorPayload?.message ||
                                    "",
                            ).trim();
                            throw new Error(
                                detail || "No se pudo cargar filtros",
                            );
                        });
                }
                return res.json();
            })
            .then((data) => {
                setCampaignOptions(
                    Array.isArray(data?.campaigns) ? data.campaigns : [],
                );
                setBasesByCampaign(
                    data?.basesByCampaign &&
                        typeof data.basesByCampaign === "object"
                        ? data.basesByCampaign
                        : {},
                );
                setFiltrosError(null);
            })
            .catch((err = {}) => {
                setFiltrosError(
                    String(err?.message || null).trim() ||
                        "No se pudo cargar filtros",
                );
                setCampaignOptions([]);
                setBasesByCampaign({});
            })
            .finally(() => setLoadingFiltros(false));
    }, [filtroFechaInicio, filtroFechaFin]);

    const cargarGrabaciones = async () => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();
        const queryParams = new URLSearchParams();
        if (filtroFechaInicio) queryParams.set("startDate", filtroFechaInicio);
        if (filtroFechaFin) queryParams.set("endDate", filtroFechaFin);
        if (normalizeText(filtroCampania)) {
            queryParams.set("campaignId", normalizeText(filtroCampania));
        }
        const normalizedBase = normalizeText(filtroBase);
        if (normalizedBase && normalizedBase.toUpperCase() !== "OUTBOUND") {
            queryParams.set("importId", normalizedBase);
        }
        const queryString = queryParams.toString();

        setLoadingGrabaciones(true);
        setError(null);
        setHasSearched(true);
        try {
            const requestUrl = `${API_BASE}/supervisor/grabaciones${queryString ? `?${queryString}` : ""}`;
            const res = await fetch(
                requestUrl,
                {
                    cache: "no-store",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );
            if (!res.ok) {
                const errorPayload = await res.json().catch(() => ({}));
                throw new Error(
                    String(
                        errorPayload?.error || errorPayload?.message || null,
                    ).trim() || "No se pudo cargar las grabaciones",
                );
            }
            const data = await res.json();
            setGrabaciones(Array.isArray(data) ? data : []);
            setSelectedRows({});
        } catch (err) {
            setError(
                String(err?.message || null).trim() ||
                    "No se pudo cargar las grabaciones",
            );
            setGrabaciones([]);
            setSelectedRows({});
        } finally {
            setLoadingGrabaciones(false);
        }
    };

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
                `${API_BASE}/supervisor/grabacion-sftp/${recordingfile}?flow=outbound`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
            );
            if (!res.ok) {
                let backendMessage = "";
                try {
                    const errorData = await res.json();
                    backendMessage =
                        String(errorData?.error || null).trim() ||
                        String(errorData?.message || null).trim();
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
            alert("No se pudo obtener la grabacion: " + err.message);
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

    // Opciones Ãºnicas para selects
    const campanias = campaignOptions;
    const bases = useMemo(() => {
        if (!filtroCampania) return [];
        return Array.isArray(basesByCampaign?.[filtroCampania])
            ? basesByCampaign[filtroCampania]
            : [];
    }, [basesByCampaign, filtroCampania]);
    const resultados = Array.from(
        new Set(grabaciones.map((g) => g.ResultLevel1).filter(Boolean)),
    );
    const agentes = Array.from(
        new Set(grabaciones.map((g) => g.AgentName || g.Agent).filter(Boolean)),
    );

    // Filtro aplicado
    const hasResultadoFilter = normalizeText(filtroResultado) !== "";
    const hasAgenteFilter = normalizeText(filtroAgente) !== "";
    const hasTelefonoFilter = normalizeText(filtroTelefono) !== "";
    const filtroBusqueda = normalizeText(filtroTelefono);

    const grabacionesFiltradas = useMemo(() => {
        // Si no hay filtros locales activos, no filtrar nada.
        if (!hasResultadoFilter && !hasAgenteFilter && !hasTelefonoFilter) {
            return grabaciones;
        }

        return grabaciones.filter((g) => {
            const resultadoOk =
                !hasResultadoFilter ||
                normalizeText(g.ResultLevel1).toLowerCase() ===
                    normalizeText(filtroResultado).toLowerCase();
            const agenteOk =
                !hasAgenteFilter ||
                normalizeText(g.AgentName || g.Agent).toLowerCase() ===
                    normalizeText(filtroAgente).toLowerCase();
            const valorCedula = normalizeText(
                g.Cedula || g.IDENTIFICACION || g.ContactId,
            );
            const valorTelefono = normalizeText(g.dst || g.ContactAddress);
            const telefonoOk =
                !hasTelefonoFilter ||
                valorTelefono.includes(filtroBusqueda) ||
                valorCedula.includes(filtroBusqueda);

            return resultadoOk && agenteOk && telefonoOk;
        });
    }, [
        grabaciones,
        hasResultadoFilter,
        hasAgenteFilter,
        hasTelefonoFilter,
        filtroResultado,
        filtroAgente,
        filtroBusqueda,
    ]);

    const totalFiltradas = grabacionesFiltradas.length;
    const totalFiltradasConAudio = grabacionesFiltradas.filter(
        (g) => g.recordingfile,
    ).length;
    const selectedFilteredCount = grabacionesFiltradas.filter((g, idx) =>
        Boolean(selectedRows[getRowKey(g, idx)]),
    ).length;
    const allFilteredSelected =
        totalFiltradas > 0 &&
        grabacionesFiltradas.every((g, idx) =>
            Boolean(selectedRows[getRowKey(g, idx)]),
        );

    useEffect(() => {
        if (!filtroBase) return;
        if (!bases.includes(filtroBase)) {
            setFiltroBase("");
        }
    }, [bases, filtroBase]);

    useEffect(() => {
        if (!filtroResultado) return;
        if (!resultados.includes(filtroResultado)) {
            setFiltroResultado("");
        }
    }, [filtroResultado, resultados]);

    useEffect(() => {
        if (!filtroAgente) return;
        if (!agentes.includes(filtroAgente)) {
            setFiltroAgente("");
        }
    }, [agentes, filtroAgente]);
    // Descarga en bloque
    const handleDescargarTodas = async () => {
        const seleccionadas = grabacionesFiltradas.filter((g, idx) =>
            Boolean(selectedRows[getRowKey(g, idx)]),
        );
        const targetRows =
            seleccionadas.length > 0 ? seleccionadas : grabacionesFiltradas;
        if (targetRows.length === 0) {
            alert("No hay grabaciones para descargar.");
            return;
        }
        let descargadas = 0;
        for (const g of targetRows) {
            if (!g.recordingfile) continue;
            try {
                const url = await fetchAudioUrl(g.recordingfile);
                if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = getRecordingFilename(g.recordingfile);
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

    const toggleSelectAllFiltered = () => {
        if (allFilteredSelected) {
            const next = { ...selectedRows };
            for (let i = 0; i < grabacionesFiltradas.length; i += 1) {
                const key = getRowKey(grabacionesFiltradas[i], i);
                delete next[key];
            }
            setSelectedRows(next);
            return;
        }

        const next = { ...selectedRows };
        for (let i = 0; i < grabacionesFiltradas.length; i += 1) {
            const key = getRowKey(grabacionesFiltradas[i], i);
            next[key] = true;
        }
        setSelectedRows(next);
    };

    const toggleRowSelection = (rowKey) => {
        setSelectedRows((prev) => ({
            ...prev,
            [rowKey]: !prev[rowKey],
        }));
    };
    const limpiarFiltros = () => {
        setFiltroCampania("");
        setFiltroBase("");
        setFiltroResultado("");
        setFiltroAgente("");
        setFiltroTelefono("");
        setFiltroFechaInicio("");
        setFiltroFechaFin("");
        setGrabaciones([]);
        setSelectedRows({});
        setHasSearched(false);
        setError(null);
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
                <div className="grabaciones-filters-card grabaciones-filters-card--enhanced">
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
                                    title="Descargar seleccionadas o todas las filtradas si no hay selección"
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
                                <option value="">
                                    {filtroCampania
                                        ? "Selecciona base"
                                        : "Primero selecciona campaña"}
                                </option>
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
                                Teléfono / Cédula
                            </span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={filtroTelefono}
                                onChange={(e) =>
                                    setFiltroTelefono(e.target.value)
                                }
                                placeholder="Buscar por teléfono o cédula"
                            />
                        </div>
                    </div>
                </div>
                {filtrosError && (
                    <p className="grabaciones-error">{filtrosError}</p>
                )}
                {error && <p className="grabaciones-error">{error}</p>}
                {(loadingFiltros && (
                    <div className="grabaciones-state-card">
                        Cargando filtros...
                    </div>
                )) ||
                    (loadingGrabaciones && (
                    <div className="grabaciones-state-card">
                        Cargando grabaciones...
                    </div>
                )) ||
                    (grabacionesFiltradas.length === 0 && (
                    <div className="grabaciones-state-card">
                        {hasSearched
                            ? "No hay grabaciones disponibles para los filtros seleccionados."
                            : "Selecciona campaña y base, luego clic en Buscar grabaciones."}
                    </div>
                )) || (
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
                                    <th>Cédula</th>
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
                                {grabacionesFiltradas.map((g, idx) => {
                                    const rowKey = getRowKey(g, idx);
                                    return (
                                        <tr key={rowKey}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(
                                                        selectedRows[rowKey],
                                                    )}
                                                    onChange={() =>
                                                        toggleRowSelection(
                                                            rowKey,
                                                        )
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
                                            <td>
                                                {g.Cedula ||
                                                    g.IDENTIFICACION ||
                                                    g.ContactId ||
                                                    ""}
                                            </td>
                                            <td>{g.dst}</td>
                                            <td>{g.Agent || null}</td>
                                            <td>
                                                <div className="grabaciones-agent-main">
                                                    {g.AgentName || g.Agent}
                                                </div>
                                                <div className="grabaciones-agent-sub">
                                                    {g.Agent || null}
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
                                                                        if (
                                                                            audio
                                                                        ) {
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
                                                                    display:
                                                                        "none",
                                                                }}
                                                                src={
                                                                    audioUrls[
                                                                        g
                                                                            .recordingfile
                                                                    ] || null
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
                                                                            getRecordingFilename(
                                                                                g.recordingfile,
                                                                            );
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
