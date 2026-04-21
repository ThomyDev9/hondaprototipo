import { useEffect, useMemo, useRef, useState } from "react";
import "./GrabacionesOutboundPage.css";
import { PageContainer } from "../../components/common";
import {
    fetchInboundMissingCalls,
    runInboundGhostDepuration,
} from "../../services/dashboard.service";

const getAuthToken = () => localStorage.getItem("access_token") || "";

function resolveRecordingPath(row = {}) {
    const recording = String(row?.recordingfile || "").trim();
    if (!recording) return "";
    if (recording.includes("/")) return recording;

    const callDate = row?.calldate ? new Date(row.calldate) : null;
    if (!callDate || Number.isNaN(callDate.getTime())) {
        return recording;
    }

    const year = callDate.getFullYear();
    const month = String(callDate.getMonth() + 1).padStart(2, "0");
    const day = String(callDate.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}/${recording}`;
}

function formatDuration(secondsValue) {
    const totalSeconds = Math.max(0, Number(secondsValue) || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

    const hasRecording = Boolean(row?.recordingfile);

    return hasRecording ? (
        <span className="grabaciones-actions">
            <button
                title="Escuchar"
                className="grabaciones-icon-btn"
                onClick={async () => {
                    const url = await fetchAudioUrl(row);
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
                src={audioUrls[resolveRecordingPath(row)] || ""}
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
                        fill={playingAudioId === rowId ? "#dc2626" : "#64748b"}
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
                    const url = await fetchAudioUrl(row);
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

export default function LlamadasInboundSinGestionPage() {
    const [rows, setRows] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [totals, setTotals] = useState({ total: 0, missing: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [audioUrls, setAudioUrls] = useState({});
    const [playingAudioId, setPlayingAudioId] = useState("");
    const currentAudioRef = useRef(null);

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [campaignFilter, setCampaignFilter] = useState("");
    const [subcampaignFilter, setSubcampaignFilter] = useState("");
    const [queueFilter, setQueueFilter] = useState("");
    const [phoneFilter, setPhoneFilter] = useState("");
    const [searchText, setSearchText] = useState("");
    const [runningDepuration, setRunningDepuration] = useState(false);
    const [depurationMessage, setDepurationMessage] = useState("");

    const loadRows = async (filters = {}) => {
        const nextStartDate =
            filters.startDate !== undefined ? filters.startDate : startDate;
        const nextEndDate =
            filters.endDate !== undefined ? filters.endDate : endDate;

        if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
            setError("La fecha inicial no puede ser mayor que la fecha final.");
            setRows([]);
            return;
        }

        setLoading(true);
        setError("");
        try {
            const { ok, json } = await fetchInboundMissingCalls({
                startDate: nextStartDate,
                endDate: nextEndDate,
            });

            if (!ok) {
                setRows([]);
                setTotals({ total: 0, missing: 0 });
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo cargar llamadas inbound sin gestión.",
                );
                return;
            }

            const data = Array.isArray(json?.data) ? json.data : [];
            const nextCatalog = Array.isArray(json?.catalog)
                ? json.catalog
                : [];
            const nextTotals = {
                total: Number(json?.totals?.total || 0),
                missing: Number(json?.totals?.missing || 0),
            };
            setCatalog(nextCatalog);
            setRows(data);
            setTotals(nextTotals);
        } finally {
            setLoading(false);
        }
    };

    const handleRunDepurationNow = async () => {
        const nextStartDate = String(startDate || "").trim();
        const nextEndDate = String(endDate || "").trim();

        if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
            setError("La fecha inicial no puede ser mayor que la fecha final.");
            return;
        }

        setRunningDepuration(true);
        setDepurationMessage("");
        setError("");
        try {
            const { ok, json } = await runInboundGhostDepuration({
                startDate: nextStartDate,
                endDate: nextEndDate,
            });

            if (!ok) {
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo ejecutar la depuración automática.",
                );
                return;
            }

            const data = json?.data || {};
            setDepurationMessage(
                `Depuración ejecutada. Revisadas: ${Number(data?.scanned || 0)} | Candidatas: ${Number(data?.candidates || 0)} | Nuevas gestiones: ${Number(data?.insertedGestiones || 0)} | Backfill gestiones: ${Number(data?.backfilledGestiones || 0)} | Omitidas por existentes: ${Number(data?.skippedExisting || 0)}`,
            );
            await loadRows();
        } finally {
            setRunningDepuration(false);
        }
    };

    useEffect(() => {
        loadRows({ startDate: "", endDate: "" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const fetchAudioUrl = async (row) => {
        const relativePath = resolveRecordingPath(row);
        if (!relativePath) return null;
        if (audioUrls[relativePath]) return audioUrls[relativePath];

        const API_BASE = import.meta.env.VITE_API_BASE;
        const token = getAuthToken();

        try {
            const res = await fetch(
                `${API_BASE}/supervisor/grabacion-sftp/${relativePath}?flow=inbound`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
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
                            : "Error al descargar la grabación"),
                );
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrls((prev) => ({ ...prev, [relativePath]: url }));
            return url;
        } catch (err) {
            alert(`No se pudo obtener la grabación: ${err.message}`);
            return null;
        }
    };

    const campaignOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    [
                        ...rows.map((row) => row.campania),
                        ...catalog.map((item) => item.campania),
                    ].filter(Boolean),
                ),
            ).sort((a, b) => a.localeCompare(b)),
        [rows, catalog],
    );

    const availableCatalogByCampaign = useMemo(
        () =>
            (catalog || []).filter((item) => {
                if (!campaignFilter) return true;
                return (
                    String(item?.campania || "") ===
                    String(campaignFilter || "")
                );
            }),
        [catalog, campaignFilter],
    );

    const subcampaignOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    [
                        ...rows
                            .filter((row) => {
                                if (!campaignFilter) return true;
                                return (
                                    String(row?.campania || "") ===
                                    String(campaignFilter || "")
                                );
                            })
                            .map((row) => row.subcampania),
                        ...availableCatalogByCampaign.map(
                            (item) => item.subcampania,
                        ),
                    ].filter(Boolean),
                ),
            ).sort((a, b) => a.localeCompare(b)),
        [rows, availableCatalogByCampaign, campaignFilter],
    );

    const availableCatalogByCampaignAndSubcampaign = useMemo(
        () =>
            availableCatalogByCampaign.filter((item) => {
                if (!subcampaignFilter) return true;
                return (
                    String(item?.subcampania || "") ===
                    String(subcampaignFilter || "")
                );
            }),
        [availableCatalogByCampaign, subcampaignFilter],
    );

    const queueOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    [
                        ...rows
                            .filter((row) => {
                                const campaignMatch =
                                    !campaignFilter ||
                                    String(row?.campania || "") ===
                                        String(campaignFilter || "");
                                const subcampaignMatch =
                                    !subcampaignFilter ||
                                    String(row?.subcampania || "") ===
                                        String(subcampaignFilter || "");
                                return campaignMatch && subcampaignMatch;
                            })
                            .map((row) => row.queueResolved),
                        ...availableCatalogByCampaignAndSubcampaign.flatMap(
                            (item) => item.queueTokens || [],
                        ),
                    ].filter(Boolean),
                ),
            ).sort((a, b) => a.localeCompare(b)),
        [
            rows,
            availableCatalogByCampaignAndSubcampaign,
            campaignFilter,
            subcampaignFilter,
        ],
    );

    useEffect(() => {
        if (
            subcampaignFilter &&
            !subcampaignOptions.includes(subcampaignFilter)
        ) {
            setSubcampaignFilter("");
        }
        if (queueFilter && !queueOptions.includes(queueFilter)) {
            setQueueFilter("");
        }
    }, [subcampaignFilter, subcampaignOptions, queueFilter, queueOptions]);

    const filteredRows = useMemo(
        () =>
            (rows || []).filter((row) => {
                const campaignMatch =
                    !campaignFilter ||
                    String(row?.campania || "") ===
                        String(campaignFilter || "");
                const subcampaignMatch =
                    !subcampaignFilter ||
                    String(row?.subcampania || "") ===
                        String(subcampaignFilter || "");
                const queueMatch =
                    !queueFilter ||
                    String(row?.queueResolved || "") ===
                        String(queueFilter || "");
                const phoneMatch =
                    !phoneFilter ||
                    String(row?.dst || "")
                        .toLowerCase()
                        .includes(String(phoneFilter || "").toLowerCase()) ||
                    String(row?.src || "")
                        .toLowerCase()
                        .includes(String(phoneFilter || "").toLowerCase());
                const normalizedSearch = String(searchText || "")
                    .trim()
                    .toLowerCase();
                const textMatch =
                    !normalizedSearch ||
                    [
                        row?.recordingfile,
                        row?.campania,
                        row?.subcampania,
                        row?.queueResolved,
                        row?.src,
                        row?.dst,
                        row?.disposition,
                    ]
                        .map((value) => String(value || "").toLowerCase())
                        .some((value) => value.includes(normalizedSearch));

                return (
                    campaignMatch &&
                    subcampaignMatch &&
                    queueMatch &&
                    phoneMatch &&
                    textMatch
                );
            }),
        [
            rows,
            campaignFilter,
            subcampaignFilter,
            queueFilter,
            phoneFilter,
            searchText,
        ],
    );

    return (
        <PageContainer>
            <div className="grabaciones-page">
                <div className="grabaciones-hero">
                    <div>
                        <h2 className="grabaciones-title">
                            Llamadas Inbound Sin Gestión
                        </h2>
                        <p className="grabaciones-helper-text">
                            Analizadas: {totals.total} | Sin gestión:{" "}
                            {totals.missing}
                        </p>
                    </div>
                </div>

                <div className="grabaciones-filters-card">
                    <div className="grabaciones-filters-head">
                        <div>
                            <h3 className="grabaciones-filters-title">
                                Depuración por recordingfile
                            </h3>
                        </div>
                        <div className="grabaciones-filters-actions">
                            <button
                                type="button"
                                className="grabaciones-primary-btn"
                                onClick={() => loadRows()}
                                disabled={loading}
                            >
                                {loading ? "Consultando..." : "Buscar"}
                            </button>
                            <button
                                type="button"
                                className="grabaciones-chip-btn"
                                onClick={handleRunDepurationNow}
                                disabled={loading || runningDepuration}
                            >
                                {runningDepuration
                                    ? "Depurando..."
                                    : "Depurar < 40s ahora"}
                            </button>
                            <button
                                type="button"
                                className="grabaciones-chip-btn"
                                onClick={() => {
                                    setStartDate("");
                                    setEndDate("");
                                    setCampaignFilter("");
                                    setSubcampaignFilter("");
                                    setQueueFilter("");
                                    setPhoneFilter("");
                                    setSearchText("");
                                    loadRows({ startDate: "", endDate: "" });
                                }}
                                disabled={loading}
                            >
                                Reiniciar
                            </button>
                        </div>
                    </div>
                    {depurationMessage ? (
                        <p className="grabaciones-helper-text">
                            {depurationMessage}
                        </p>
                    ) : null}

                    <div className="grabaciones-filters-grid">
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Fecha inicio
                            </span>
                            <input
                                className="grabaciones-input"
                                type="date"
                                value={startDate}
                                onChange={(event) =>
                                    setStartDate(event.target.value)
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
                                value={endDate}
                                onChange={(event) =>
                                    setEndDate(event.target.value)
                                }
                            />
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Campaña
                            </span>
                            <select
                                className="grabaciones-input"
                                value={campaignFilter}
                                onChange={(event) =>
                                    setCampaignFilter(event.target.value)
                                }
                            >
                                <option value="">Todas</option>
                                {campaignOptions.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Subcampaña
                            </span>
                            <select
                                className="grabaciones-input"
                                value={subcampaignFilter}
                                onChange={(event) =>
                                    setSubcampaignFilter(event.target.value)
                                }
                            >
                                <option value="">Todas</option>
                                {subcampaignOptions.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Queue
                            </span>
                            <select
                                className="grabaciones-input"
                                value={queueFilter}
                                onChange={(event) =>
                                    setQueueFilter(event.target.value)
                                }
                            >
                                <option value="">Todas</option>
                                {queueOptions.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Teléfono
                            </span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={phoneFilter}
                                onChange={(event) =>
                                    setPhoneFilter(event.target.value)
                                }
                                placeholder="src o dst"
                            />
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Texto
                            </span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={searchText}
                                onChange={(event) =>
                                    setSearchText(event.target.value)
                                }
                                placeholder="recordingfile / campaña / queue"
                            />
                        </div>
                    </div>
                </div>

                {error ? <p className="grabaciones-error">{error}</p> : null}
                {loading ? (
                    <div className="grabaciones-state-card">
                        Cargando datos...
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="grabaciones-state-card">
                        {rows.length > 0
                            ? `No hay resultados con los filtros actuales. Sin filtros hay ${rows.length} llamadas sin gestión.`
                            : "No hay llamadas inbound sin gestión para los filtros seleccionados."}
                    </div>
                ) : (
                    <div className="grabaciones-table-wrapper">
                        <table className="grabaciones-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Duración</th>
                                    <th>src</th>
                                    <th>dst</th>
                                    <th>Queue</th>
                                    <th>Subcampaña</th>
                                    <th>Recordingfile</th>
                                    <th>Estado</th>
                                    <th>Grabación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, index) => {
                                    const rowId = `audio-inb-missing-${index}`;
                                    return (
                                        <tr
                                            key={`${row.uniqueid}-${row.recordingfile}-${index}`}
                                        >
                                            <td>
                                                {row.calldate
                                                    ? new Date(
                                                          row.calldate,
                                                      ).toLocaleString()
                                                    : ""}
                                            </td>
                                            <td>
                                                {formatDuration(row.duration)}
                                            </td>
                                            <td>{row.src || "-"}</td>
                                            <td>{row.dst || "-"}</td>
                                            <td>{row.queueResolved || "-"}</td>
                                            <td>{row.subcampania || "-"}</td>
                                            <td
                                                style={{
                                                    maxWidth: "340px",
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {row.recordingfile || "-"}
                                            </td>
                                            <td>
                                                <span className="grabaciones-badge grabaciones-badge--fallback">
                                                    Sin gestión
                                                </span>
                                            </td>
                                            <td>
                                                <AudioActions
                                                    row={row}
                                                    rowId={rowId}
                                                    audioUrls={audioUrls}
                                                    fetchAudioUrl={
                                                        fetchAudioUrl
                                                    }
                                                    playingAudioId={
                                                        playingAudioId
                                                    }
                                                    setPlayingAudioId={
                                                        setPlayingAudioId
                                                    }
                                                    currentAudioRef={
                                                        currentAudioRef
                                                    }
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
