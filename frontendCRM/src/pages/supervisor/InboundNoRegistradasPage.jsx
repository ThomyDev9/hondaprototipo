import { useEffect, useMemo, useRef, useState } from "react";
import "./GrabacionesOutboundPage.css";
import { PageContainer } from "../../components/common";
import {
    fetchFormCatalogos,
    fetchInboundUnregisteredByAdvisor,
    fetchInboundUnregisteredMine,
    guardarGestionInbound,
    assignInboundUnregisteredAdvisor,
    fetchSupervisorActiveAdvisors,
} from "../../services/dashboard.service";

const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";
const DEFAULT_INTERACTION_DETAIL = {
    categorizacion: "",
    motivo: "",
    submotivo: "",
    observaciones: "",
};

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

function normalizeDigits(value = "") {
    return String(value || "").replace(/[^\d]/g, "");
}

function buildUniqueOptions(values = []) {
    return Array.from(
        new Set(values.map((item) => String(item || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
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

export default function InboundNoRegistradasPage({ selfMode = false }) {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState([]);
    const [totals, setTotals] = useState({
        total: 0,
        missing: 0,
        assigned: 0,
        unassigned: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [audioUrls, setAudioUrls] = useState({});
    const [playingAudioId, setPlayingAudioId] = useState("");
    const currentAudioRef = useRef(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [scopeFilter, setScopeFilter] = useState("todo");
    const [advisorFilter, setAdvisorFilter] = useState("");
    const [queueFilter, setQueueFilter] = useState("");
    const [searchText, setSearchText] = useState("");

    const [selectedRow, setSelectedRow] = useState(null);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [registerFormLoading, setRegisterFormLoading] = useState(false);
    const [registerError, setRegisterError] = useState("");
    const [registerMessage, setRegisterMessage] = useState("");
    const [ghostSavingMap, setGhostSavingMap] = useState({});
    const [registerLevels, setRegisterLevels] = useState([]);
    const [registerForm, setRegisterForm] = useState({
        identificacion: "",
        apellidosNombres: "",
        celular: "",
        ciudad: "",
        correoCliente: "",
        convencional: "",
        tipoCliente: "Titular",
        tipoIdentificacion: "Cédula",
        tipoCanal: "Inbound",
        relacion: "Titular",
    });
    const [registerDetails, setRegisterDetails] = useState([
        { ...DEFAULT_INTERACTION_DETAIL },
    ]);
    const [advisorMasterCatalog, setAdvisorMasterCatalog] = useState([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignRow, setAssignRow] = useState(null);
    const [assignAdvisorUserId, setAssignAdvisorUserId] = useState("");
    const [assignAdvisorName, setAssignAdvisorName] = useState("");
    const [assignAdvisorZoiper, setAssignAdvisorZoiper] = useState("");
    const [assignSaving, setAssignSaving] = useState(false);

    const loadData = async (filters = {}) => {
        const nextStartDate =
            filters.startDate !== undefined ? filters.startDate : startDate;
        const nextEndDate =
            filters.endDate !== undefined ? filters.endDate : endDate;
        const nextScope =
            filters.scope !== undefined ? filters.scope : scopeFilter;

        if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
            setError("La fecha inicial no puede ser mayor que la fecha final.");
            setRows([]);
            setSummary([]);
            return;
        }

        setLoading(true);
        setError("");
        try {
            const fetcher = selfMode
                ? fetchInboundUnregisteredMine
                : fetchInboundUnregisteredByAdvisor;
            const { ok, json } = await fetcher({
                startDate: nextStartDate,
                endDate: nextEndDate,
                scope: nextScope,
            });

            if (!ok) {
                setRows([]);
                setSummary([]);
                setTotals({ total: 0, missing: 0, assigned: 0, unassigned: 0 });
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo cargar inbound no registradas.",
                );
                return;
            }

            setRows(Array.isArray(json?.data) ? json.data : []);
            setSummary(Array.isArray(json?.summary) ? json.summary : []);
            setTotals({
                total: Number(json?.totals?.total || 0),
                missing: Number(json?.totals?.missing || 0),
                assigned: Number(json?.totals?.assigned || 0),
                unassigned: Number(json?.totals?.unassigned || 0),
            });
            setScopeFilter(
                String(json?.filters?.scope || nextScope || "todo")
                    .trim()
                    .toLowerCase(),
            );
            setStartDate(String(json?.filters?.startDate || nextStartDate || ""));
            setEndDate(String(json?.filters?.endDate || nextEndDate || ""));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData({ startDate: "", endDate: "" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selfMode) return;
        const loadAdvisorCatalog = async () => {
            const { ok, json } = await fetchSupervisorActiveAdvisors();
            if (!ok) return;
            setAdvisorMasterCatalog(Array.isArray(json?.data) ? json.data : []);
        };
        loadAdvisorCatalog();
    }, [selfMode]);

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
            const audioBasePath = selfMode
                ? "agente/grabacion-sftp"
                : "supervisor/grabacion-sftp";
            const res = await fetch(
                `${API_BASE}/${audioBasePath}/${relativePath}?flow=inbound`,
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

    const openRegisterModal = async (row) => {
        const sourceDigits = normalizeDigits(row?.src || "");
        const destinationDigits = normalizeDigits(row?.dst || "");
        const phoneSeed = sourceDigits || destinationDigits;

        setSelectedRow(row);
        setIsRegisterModalOpen(true);
        setRegisterError("");
        setRegisterMessage("");
        setRegisterLevels([]);
        setRegisterDetails([{ ...DEFAULT_INTERACTION_DETAIL }]);
        setRegisterForm({
            identificacion: phoneSeed,
            apellidosNombres: "",
            celular: phoneSeed,
            ciudad: "",
            correoCliente: "",
            convencional: "",
            tipoCliente: "Titular",
            tipoIdentificacion: "Cédula",
            tipoCanal: "Inbound",
            relacion: "Titular",
        });

        const campaignIdForInbound = String(
            row?.subcampania || row?.campania || "",
        ).trim();

        if (!campaignIdForInbound) {
            return;
        }

        setRegisterFormLoading(true);
        try {
            const { ok, json } = await fetchFormCatalogos({
                campaignId: campaignIdForInbound,
                categoryId: INBOUND_MENU_CATEGORY_ID,
                menuItemId: String(row.menuItemId || "").trim(),
            });

            if (!ok) {
                setRegisterError(
                    json?.detail ||
                        json?.error ||
                        "No se pudieron cargar las opciones de gestión.",
                );
                return;
            }

            setRegisterLevels(Array.isArray(json?.levels) ? json.levels : []);
        } finally {
            setRegisterFormLoading(false);
        }
    };

    const closeRegisterModal = () => {
        if (registering) return;
        setIsRegisterModalOpen(false);
        setSelectedRow(null);
        setRegisterError("");
    };

    const handleRegisterFieldChange = (field, value) => {
        setRegisterForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleRegisterDetailChange = (index, field, value) => {
        setRegisterDetails((prev) =>
            prev.map((item, itemIndex) => {
                if (itemIndex !== index) return item;
                if (field === "categorizacion") {
                    return {
                        ...item,
                        categorizacion: value,
                        motivo: "",
                        submotivo: "",
                    };
                }
                if (field === "motivo") {
                    return {
                        ...item,
                        motivo: value,
                        submotivo: "",
                    };
                }
                return {
                    ...item,
                    [field]: value,
                };
            }),
        );
    };

    const addRegisterDetail = () => {
        setRegisterDetails((prev) => [
            ...prev,
            { ...DEFAULT_INTERACTION_DETAIL },
        ]);
    };

    const removeRegisterDetail = (index) => {
        setRegisterDetails((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, itemIndex) => itemIndex !== index);
        });
    };

    const advisorCatalog = useMemo(() => {
        const map = new Map();
        const ensureEntry = (name, zoiperRaw = "") => {
            const normalizedName = String(name || "").trim();
            if (!normalizedName || normalizedName === "SIN_ASIGNAR") return;
            const normalizedZoiper = String(zoiperRaw || "").trim();
            const entry = map.get(normalizedName) || {
                name: normalizedName,
                zoiperCodes: new Set(),
            };
            if (normalizedZoiper) {
                entry.zoiperCodes.add(normalizedZoiper);
            }
            map.set(normalizedName, entry);
        };

        for (const item of advisorMasterCatalog || []) {
            ensureEntry(item?.advisorName, item?.advisorZoiper);
        }
        for (const row of rows || []) {
            ensureEntry(row?.asesorProbable, row?.asesorZoiperCode);
        }
        for (const item of summary || []) {
            const rawCodes = String(item?.zoiperCodes || "").trim();
            const splitCodes = rawCodes
                ? rawCodes.split("/").map((code) => String(code || "").trim())
                : [];
            ensureEntry(item?.asesor, splitCodes[0] || "");
            splitCodes.forEach((code) => ensureEntry(item?.asesor, code));
        }

        return Array.from(map.values())
            .map((entry) => ({
                name: entry.name,
                zoiperCodes: Array.from(entry.zoiperCodes).sort((a, b) =>
                    a.localeCompare(b),
                ),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [advisorMasterCatalog, rows, summary]);

    const advisorOptions = useMemo(() => {
        const counts = new Map();
        for (const row of rows || []) {
            const advisor =
                String(row?.asesorProbable || "").trim() || "SIN_ASIGNAR";
            counts.set(advisor, Number(counts.get(advisor) || 0) + 1);
        }

        return Array.from(counts.entries())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            .map(([value, count]) => ({
                value,
                count,
                label: `${value} (${count})`,
            }));
    }, [rows]);

    const assignAdvisorOptions = useMemo(() => {
        const byId = new Map();
        for (const item of advisorMasterCatalog || []) {
            const idUser = Number(item?.idUser || 0) || 0;
            if (!idUser) continue;
            byId.set(String(idUser), {
                idUser,
                advisorName: String(item?.advisorName || "").trim(),
                advisorZoiper: String(item?.advisorZoiper || "").trim(),
            });
        }

        if (byId.size > 0) {
            return Array.from(byId.values()).filter((item) => item.advisorName);
        }

        return (advisorCatalog || []).map((item, index) => ({
            idUser: 0,
            optionKey: `fallback-${index}`,
            advisorName: String(item?.name || "").trim(),
            advisorZoiper: String(item?.zoiperCodes?.[0] || "").trim(),
        }));
    }, [advisorMasterCatalog, advisorCatalog]);

    const queueOptions = useMemo(() => {
        const counts = new Map();
        for (const row of rows || []) {
            const queue = String(row?.queueResolved || "").trim();
            if (!queue) continue;
            counts.set(queue, Number(counts.get(queue) || 0) + 1);
        }

        return Array.from(counts.entries())
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            .map(([value, count]) => ({
                value,
                count,
                label: `${value} (${count})`,
            }));
    }, [rows]);

    const filteredRows = useMemo(
        () =>
            rows.filter((row) => {
                const advisorMatch =
                    !advisorFilter ||
                    String(row?.asesorProbable || "") === advisorFilter;
                const queueMatch =
                    !queueFilter || String(row?.queueResolved || "") === queueFilter;
                const normalizedSearch = String(searchText || "")
                    .trim()
                    .toLowerCase();
                const textMatch =
                    !normalizedSearch ||
                    [
                        row?.recordingfile,
                        row?.src,
                        row?.dst,
                        row?.asesorProbable,
                        row?.asesorZoiperCode,
                        row?.queueResolved,
                        row?.subcampania,
                    ]
                        .map((value) => String(value || "").toLowerCase())
                        .some((value) => value.includes(normalizedSearch));

                return advisorMatch && queueMatch && textMatch;
            }),
        [rows, advisorFilter, queueFilter, searchText],
    );

    const registerCategorizacionOptions = useMemo(
        () => buildUniqueOptions(registerLevels.map((item) => item?.description)),
        [registerLevels],
    );

    const submitRegisterInbound = async (event) => {
        event.preventDefault();
        if (!selectedRow) return;

        const identificacion = String(registerForm.identificacion || "").trim();
        const campaignId = String(
            selectedRow?.subcampania || selectedRow?.campania || "",
        ).trim();
        const menuItemId = String(selectedRow?.menuItemId || "").trim();
        const normalizedDetails = registerDetails
            .map((item, index) => ({
                orden: index + 1,
                categorizacion: String(item?.categorizacion || "").trim(),
                motivo: String(item?.motivo || "").trim(),
                submotivo: String(item?.submotivo || "").trim(),
                observaciones: String(item?.observaciones || "").trim(),
            }))
            .filter(
                (item) =>
                    item.categorizacion ||
                    item.motivo ||
                    item.submotivo ||
                    item.observaciones,
            );

        if (!campaignId || !menuItemId) {
            setRegisterError(
                "No se pudo resolver campaña/subcampaña de esta llamada. Verifica la queue en menú_items.",
            );
            return;
        }

        if (!identificacion) {
            setRegisterError("Identificación es requerida.");
            return;
        }

        if (normalizedDetails.length === 0) {
            setRegisterError("Debes ingresar al menos una acción de interacción.");
            return;
        }

        if (
            normalizedDetails.some(
                (item) => !item.categorizacion || !item.motivo || !item.submotivo,
            )
        ) {
            setRegisterError(
                "Cada acción debe tener categorización, motivo y submotivo.",
            );
            return;
        }

        setRegistering(true);
        setRegisterError("");
        setRegisterMessage("");
        try {
            const formData = {
                identificacion,
                apellidosNombres: String(registerForm.apellidosNombres || "").trim(),
                celular: String(registerForm.celular || "").trim(),
                ciudad: String(registerForm.ciudad || "").trim(),
                correoCliente: String(registerForm.correoCliente || "").trim(),
                convencional: String(registerForm.convencional || "").trim(),
                ticketId: String(selectedRow?.uniqueid || "").trim(),
                idLlamada: String(selectedRow?.uniqueid || "").trim(),
                CAMPO5: String(selectedRow?.uniqueid || "").trim(),
                nombreCliente:
                    String(selectedRow?.subcampania || "").trim() || campaignId,
                __inbound_nombre_cliente: menuItemId,
                __inbound_tipo_cliente: String(registerForm.tipoCliente || "").trim(),
                __inbound_tipo_identificacion: String(
                    registerForm.tipoIdentificacion || "",
                ).trim(),
                __inbound_tipo_canal: String(registerForm.tipoCanal || "").trim(),
                __inbound_relacion: String(registerForm.relacion || "").trim(),
                __inbound_current_call_recordingfile: String(
                    selectedRow?.recordingfile || "",
                ).trim(),
                recordingfile: String(selectedRow?.recordingfile || "").trim(),
            };

            const payload = {
                campaignId,
                campaign_id: campaignId,
                categoryId: INBOUND_MENU_CATEGORY_ID,
                menuItemId,
                managementDateTime: selectedRow?.calldate || "",
                formData,
                fieldsMeta: [],
                interactionDetails: normalizedDetails.map((item, index) => ({
                    ...item,
                    orden: index + 1,
                    observaciones: item.observaciones,
                })),
                surveyPayload: {},
                surveyFieldsMeta: [],
            };

            const { ok, json } = await guardarGestionInbound(payload);

            if (!ok) {
                setRegisterError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo guardar la gestión inbound.",
                );
                return;
            }

            setRegisterMessage(
                `Gestión registrada con fecha ${selectedRow?.calldate ? new Date(selectedRow.calldate).toLocaleString() : "de la grabación"}`,
            );
            await loadData();
            setIsRegisterModalOpen(false);
        } finally {
            setRegistering(false);
        }
    };

    const markAsGhostInbound = async (row) => {
        const rowKey = `${String(row?.uniqueid || "").trim()}-${String(
            row?.recordingfile || "",
        ).trim()}`;
        const campaignId = String(row?.subcampania || row?.campania || "").trim();
        const menuItemId = String(row?.menuItemId || "").trim();
        const phoneSeed =
            normalizeDigits(row?.src || "") || normalizeDigits(row?.dst || "");
        const identification = String(
            phoneSeed || row?.uniqueid || "GHOST-UNKNOWN",
        ).trim();

        if (!campaignId || !menuItemId) {
            setError(
                "No se pudo resolver campaña/subcampaña para marcar fantasma.",
            );
            return;
        }

        const confirmApply = window.confirm(
            "¿Marcar esta llamada como fantasma automáticamente?",
        );
        if (!confirmApply) return;

        setGhostSavingMap((prev) => ({ ...prev, [rowKey]: true }));
        setError("");
        setRegisterMessage("");
        try {
            const payload = {
                campaignId,
                campaign_id: campaignId,
                categoryId: INBOUND_MENU_CATEGORY_ID,
                menuItemId,
                managementDateTime: row?.calldate || "",
                formData: {
                    identificacion: identification,
                    apellidosNombres: "SIN NOMBRE",
                    celular: String(phoneSeed || "").trim(),
                    ciudad: "QUITO",
                    correoCliente: "noaplica@gmail.com",
                    convencional: "",
                    ticketId: String(row?.uniqueid || "").trim(),
                    idLlamada: String(row?.uniqueid || "").trim(),
                    CAMPO5: String(row?.uniqueid || "").trim(),
                    nombreCliente: String(row?.subcampania || "").trim() || campaignId,
                    __inbound_nombre_cliente: menuItemId,
                    __inbound_tipo_cliente: "Titular",
                    __inbound_tipo_identificacion: "Cedula",
                    __inbound_tipo_canal: "Inbound",
                    __inbound_relacion: "Titular",
                    __inbound_current_call_recordingfile: String(
                        row?.recordingfile || "",
                    ).trim(),
                    recordingfile: String(row?.recordingfile || "").trim(),
                },
                fieldsMeta: [],
                interactionDetails: [
                    {
                        orden: 1,
                        categorizacion: "LLAMADA FANTASMA",
                        motivo: "LLAMADA FANTASMA",
                        submotivo: "LLAMADA FANTASMA",
                        observaciones: `Marcado automático como llamada fantasma. uniqueid=${String(row?.uniqueid || "").trim()}`,
                    },
                ],
                surveyPayload: {},
                surveyFieldsMeta: [],
            };

            const { ok, json } = await guardarGestionInbound(payload);
            if (!ok) {
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo marcar la llamada como fantasma.",
                );
                return;
            }

            setRegisterMessage("Llamada marcada como fantasma correctamente.");
            await loadData();
        } finally {
            setGhostSavingMap((prev) => ({ ...prev, [rowKey]: false }));
        }
    };

    const openManualAssignModal = (row) => {
        if (!assignAdvisorOptions.length) {
            setError(
                "No hay asesores disponibles para asignar en este momento.",
            );
            return;
        }
        const suggestedName = String(row?.asesorProbable || "").trim();
        const suggestedOption =
            assignAdvisorOptions.find(
                (item) => String(item?.advisorName || "").trim() === suggestedName,
            ) || null;
        const selectedOption = suggestedOption || assignAdvisorOptions[0] || null;
        const selectedName = String(selectedOption?.advisorName || "").trim();
        const selectedUserId = Number(selectedOption?.idUser || 0) || 0;
        const suggestedZoiper = String(row?.asesorZoiperCode || "").trim();
        const resolvedZoiper =
            suggestedZoiper || String(selectedOption?.advisorZoiper || "").trim();

        setAssignRow(row);
        setAssignAdvisorUserId(selectedUserId ? String(selectedUserId) : "");
        setAssignAdvisorName(selectedName);
        setAssignAdvisorZoiper(resolvedZoiper);
        setIsAssignModalOpen(true);
        setError("");
        setRegisterMessage("");
    };

    const closeAssignModal = () => {
        if (assignSaving) return;
        setIsAssignModalOpen(false);
        setAssignRow(null);
        setAssignAdvisorUserId("");
        setAssignAdvisorName("");
        setAssignAdvisorZoiper("");
    };

    const handleAssignAdvisorChange = (advisorUserIdOrName) => {
        const rawValue = String(advisorUserIdOrName || "").trim();
        const selectedByUserId = assignAdvisorOptions.find(
            (item) => String(item?.idUser || "") === rawValue,
        );
        const selected =
            selectedByUserId ||
            assignAdvisorOptions.find(
                (item) =>
                    String(item?.advisorName || "").trim() === rawValue,
            ) ||
            null;
        setAssignAdvisorUserId(
            selected?.idUser ? String(selected.idUser) : "",
        );
        setAssignAdvisorName(String(selected?.advisorName || rawValue).trim());
        setAssignAdvisorZoiper(String(selected?.advisorZoiper || "").trim());
    };

    const submitManualAssignAdvisor = async (event) => {
        event.preventDefault();
        if (!assignRow) return;

        const normalizedAdvisorName = String(assignAdvisorName || "").trim();
        if (!normalizedAdvisorName) {
            setError("Selecciona un asesor.");
            return;
        }

        setAssignSaving(true);
        setError("");
        setRegisterMessage("");
        const { ok, json } = await assignInboundUnregisteredAdvisor({
            uniqueid: String(assignRow?.uniqueid || "").trim(),
            recordingfile: String(assignRow?.recordingfile || "").trim(),
            managementDateTime: String(assignRow?.calldate || "").trim(),
            advisorUserId: assignAdvisorUserId,
            advisorName: normalizedAdvisorName,
            advisorZoiper: String(assignAdvisorZoiper || "").trim(),
            notes: "Asignacion manual desde pantalla supervisor",
        });
        setAssignSaving(false);

        if (!ok) {
            setError(
                json?.detail ||
                    json?.error ||
                    "No se pudo guardar la asignacion manual.",
            );
            return;
        }

        setRegisterMessage("Asignacion manual guardada correctamente.");
        closeAssignModal();
        await loadData();
    };
    return (
        <PageContainer>
            <div className="grabaciones-page">
                <div className="grabaciones-hero">
                    <div>
                        <h2 className="grabaciones-title">
                            {selfMode
                                ? "Mis Inbound No Registradas"
                                : "Inbound No Registradas (por asesor)"}
                        </h2>
                        <p className="grabaciones-helper-text">
                            Revisadas: {totals.total} | No registradas:{" "}
                            {totals.missing} | Con asesor: {totals.assigned} | Sin
                            asignar: {totals.unassigned}
                        </p>
                    </div>
                </div>

                <div className="grabaciones-filters-card">
                    <div className="grabaciones-filters-head">
                        <div>
                            <h3 className="grabaciones-filters-title">
                                {selfMode
                                    ? "Llamadas no registradas asignadas a tu usuario"
                                    : "Cruce por AgentNumber (Zoiper) + hora"}
                            </h3>
                        </div>
                        <div className="grabaciones-filters-actions">
                            <button
                                type="button"
                                className="grabaciones-primary-btn"
                                onClick={() => loadData()}
                                disabled={loading}
                            >
                                {loading ? "Consultando..." : "Buscar"}
                            </button>
                            <button
                                type="button"
                                className="grabaciones-chip-btn"
                                onClick={() => {
                                    setStartDate("");
                                    setEndDate("");
                                    setScopeFilter("todo");
                                    setAdvisorFilter("");
                                    setQueueFilter("");
                                    setSearchText("");
                                    loadData({
                                        startDate: "",
                                        endDate: "",
                                        scope: "todo",
                                    });
                                }}
                                disabled={loading}
                            >
                                Reiniciar
                            </button>
                        </div>
                    </div>

                    <div className="grabaciones-filters-grid">
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">Período</span>
                            <select
                                className="grabaciones-input"
                                value={scopeFilter}
                                onChange={(event) =>
                                    setScopeFilter(event.target.value)
                                }
                            >
                                <option value="todo">Todo</option>
                                <option value="historico">
                                    Histórico (hasta mes pasado)
                                </option>
                                <option value="nuevo">
                                    Nuevo sistema (mes actual)
                                </option>
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">
                                Fecha inicio
                            </span>
                            <input
                                className="grabaciones-input"
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                            />
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">Fecha fin</span>
                            <input
                                className="grabaciones-input"
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                            />
                        </div>
                        {!selfMode ? (
                            <div className="grabaciones-field">
                                <span className="grabaciones-field-label">
                                    Asesor
                                </span>
                                <select
                                    className="grabaciones-input"
                                    value={advisorFilter}
                                    onChange={(event) =>
                                        setAdvisorFilter(event.target.value)
                                    }
                                >
                                    <option value="">Todos</option>
                                    {advisorOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">Queue</span>
                            <select
                                className="grabaciones-input"
                                value={queueFilter}
                                onChange={(event) => setQueueFilter(event.target.value)}
                            >
                                <option value="">Todas</option>
                                {queueOptions.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grabaciones-field">
                            <span className="grabaciones-field-label">Texto</span>
                            <input
                                className="grabaciones-input"
                                type="text"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="asesor / zoiper / src / dst / recordingfile"
                            />
                        </div>
                    </div>
                </div>

                {error ? <p className="grabaciones-error">{error}</p> : null}
                {registerMessage ? (
                    <p className="grabaciones-state-card">{registerMessage}</p>
                ) : null}

                {!selfMode && summary.length > 0 ? (
                    <div
                        className="grabaciones-table-wrapper"
                        style={{ marginBottom: "1rem" }}
                    >
                        <table className="grabaciones-table">
                            <thead>
                                <tr>
                                    <th>Asesor</th>
                                    <th>Total no registradas</th>
                                    <th>Códigos Zoiper</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map((item, index) => (
                                    <tr key={`${item.asesor}-${index}`}>
                                        <td>{item.asesor || "SIN_ASIGNAR"}</td>
                                        <td>{item.totalNoRegistradas}</td>
                                        <td>{item.zoiperCodes || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}

                {loading ? (
                    <div className="grabaciones-state-card">Cargando datos...</div>
                ) : filteredRows.length === 0 ? (
                    <div className="grabaciones-state-card">
                        No hay llamadas no registradas con los filtros actuales.
                    </div>
                ) : (
                    <div className="grabaciones-table-wrapper">
                        <table className="grabaciones-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>src</th>
                                    <th>dst</th>
                                    <th>Queue</th>
                                    <th>Subcampaña</th>
                                    <th>dstchannel</th>
                                    <th>Asesor probable</th>
                                    <th>Zoiper</th>
                                    <th>Método cruce</th>
                                    <th>Recordingfile</th>
                                    <th>Grabación</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, index) => {
                                    const rowId = `audio-inb-unreg-${index}`;
                                    return (
                                        <tr key={`${row.uniqueid}-${index}`}>
                                            <td>
                                                {row.calldate
                                                    ? new Date(
                                                          row.calldate,
                                                      ).toLocaleString()
                                                    : ""}
                                            </td>
                                            <td>{row.src || "-"}</td>
                                            <td>{row.dst || "-"}</td>
                                            <td>{row.queueResolved || "-"}</td>
                                            <td>{row.subcampania || "-"}</td>
                                            <td>{row.dstchannel || "-"}</td>
                                            <td>{row.asesorProbable || "SIN_ASIGNAR"}</td>
                                            <td>
                                                {row.asesorZoiperCode ||
                                                    row.zoiperCandidate ||
                                                    "-"}
                                            </td>
                                            <td>{row.asesorMatchMethod || "-"}</td>
                                            <td
                                                style={{
                                                    maxWidth: "340px",
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {row.recordingfile || "-"}
                                            </td>
                                            <td>
                                                <AudioActions
                                                    row={row}
                                                    rowId={rowId}
                                                    audioUrls={audioUrls}
                                                    fetchAudioUrl={fetchAudioUrl}
                                                    playingAudioId={playingAudioId}
                                                    setPlayingAudioId={
                                                        setPlayingAudioId
                                                    }
                                                    currentAudioRef={currentAudioRef}
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="grabaciones-chip-btn grabaciones-chip-btn--register"
                                                    onClick={() =>
                                                        openRegisterModal(row)
                                                    }
                                                >
                                                    Registrar
                                                </button>
                                                {!selfMode ? (
                                                    <button
                                                        type="button"
                                                        className="grabaciones-chip-btn"
                                                        style={{
                                                            marginTop: "6px",
                                                            width: "100%",
                                                        }}
                                                        onClick={() =>
                                                            openManualAssignModal(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        Asignar asesor
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="grabaciones-chip-btn"
                                                    style={{ marginTop: "6px", width: "100%" }}
                                                    onClick={() =>
                                                        markAsGhostInbound(row)
                                                    }
                                                    disabled={
                                                        ghostSavingMap[
                                                            `${String(
                                                                row?.uniqueid || "",
                                                            ).trim()}-${String(
                                                                row?.recordingfile || "",
                                                            ).trim()}`
                                                        ]
                                                    }
                                                >
                                                    {ghostSavingMap[
                                                        `${String(
                                                            row?.uniqueid || "",
                                                        ).trim()}-${String(
                                                            row?.recordingfile || "",
                                                        ).trim()}`
                                                    ]
                                                        ? "Guardando..."
                                                        : "Marcar Fantasma"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isRegisterModalOpen && selectedRow ? (
                <div className="grabaciones-modal-overlay" onClick={closeRegisterModal}>
                    <div
                        className="grabaciones-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="grabaciones-modal-head">
                            <h3>Registrar gestión inbound</h3>
                            <button
                                type="button"
                                className="grabaciones-chip-btn"
                                onClick={closeRegisterModal}
                                disabled={registering}
                            >
                                Cerrar
                            </button>
                        </div>

                        <p className="grabaciones-helper-text">
                            Se guardará con fecha de grabación:{" "}
                            {selectedRow?.calldate
                                ? new Date(selectedRow.calldate).toLocaleString()
                                : "sin fecha"}
                        </p>

                        {registerError ? (
                            <p className="grabaciones-error">{registerError}</p>
                        ) : null}

                        <form
                            onSubmit={submitRegisterInbound}
                            className="grabaciones-modal-form"
                        >
                            <div className="grabaciones-filters-grid">
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Campaña
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={String(selectedRow?.campania || "")}
                                        disabled
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Subcampaña
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={String(selectedRow?.subcampania || "")}
                                        disabled
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Identificación *
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={registerForm.identificacion}
                                        onChange={(event) =>
                                            handleRegisterFieldChange(
                                                "identificacion",
                                                event.target.value,
                                            )
                                        }
                                        required
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Apellidos y nombres
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={registerForm.apellidosNombres}
                                        onChange={(event) =>
                                            handleRegisterFieldChange(
                                                "apellidosNombres",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Celular
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={registerForm.celular}
                                        onChange={(event) =>
                                            handleRegisterFieldChange(
                                                "celular",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Ciudad
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={registerForm.ciudad}
                                        onChange={(event) =>
                                            handleRegisterFieldChange(
                                                "ciudad",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Correo
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={registerForm.correoCliente}
                                        onChange={(event) =>
                                            handleRegisterFieldChange(
                                                "correoCliente",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Convencional
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={registerForm.convencional}
                                        onChange={(event) =>
                                            handleRegisterFieldChange(
                                                "convencional",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grabaciones-modal-section">
                                <h4>Clasificación de la interacción</h4>
                                {registerFormLoading ? (
                                    <p className="grabaciones-helper-text">
                                        Cargando opciones...
                                    </p>
                                ) : null}
                                {registerDetails.map((detail, index) => {
                                    const motivoOptions = buildUniqueOptions(
                                        registerLevels
                                            .filter(
                                                (item) =>
                                                    String(
                                                        item?.description || "",
                                                    ).trim() ===
                                                    String(
                                                        detail?.categorizacion ||
                                                            "",
                                                    ).trim(),
                                            )
                                            .map((item) => item?.level1),
                                    );

                                    const submotivoOptions = buildUniqueOptions(
                                        registerLevels
                                            .filter(
                                                (item) =>
                                                    String(
                                                        item?.description || "",
                                                    ).trim() ===
                                                        String(
                                                            detail?.categorizacion ||
                                                                "",
                                                        ).trim() &&
                                                    String(
                                                        item?.level1 || "",
                                                    ).trim() ===
                                                        String(
                                                            detail?.motivo || "",
                                                        ).trim(),
                                            )
                                            .map((item) => item?.level2),
                                    );

                                    return (
                                        <div
                                            key={`register-detail-${index}`}
                                            className="grabaciones-filters-card"
                                            style={{ padding: "12px", marginBottom: "10px" }}
                                        >
                                            <p className="grabaciones-helper-text">
                                                Acción {index + 1}
                                            </p>
                                            <div className="grabaciones-filters-grid">
                                                <div className="grabaciones-field">
                                                    <span className="grabaciones-field-label">
                                                        Categorización *
                                                    </span>
                                                    <select
                                                        className="grabaciones-input"
                                                        value={detail.categorizacion}
                                                        onChange={(event) =>
                                                            handleRegisterDetailChange(
                                                                index,
                                                                "categorizacion",
                                                                event.target.value,
                                                            )
                                                        }
                                                        required
                                                    >
                                                        <option value="">Selecciona...</option>
                                                        {registerCategorizacionOptions.map(
                                                            (option) => (
                                                                <option
                                                                    key={option}
                                                                    value={option}
                                                                >
                                                                    {option}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </div>
                                                <div className="grabaciones-field">
                                                    <span className="grabaciones-field-label">
                                                        Motivo *
                                                    </span>
                                                    <select
                                                        className="grabaciones-input"
                                                        value={detail.motivo}
                                                        onChange={(event) =>
                                                            handleRegisterDetailChange(
                                                                index,
                                                                "motivo",
                                                                event.target.value,
                                                            )
                                                        }
                                                        required
                                                    >
                                                        <option value="">Selecciona...</option>
                                                        {motivoOptions.map((option) => (
                                                            <option
                                                                key={option}
                                                                value={option}
                                                            >
                                                                {option}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="grabaciones-field">
                                                    <span className="grabaciones-field-label">
                                                        Submotivo *
                                                    </span>
                                                    <select
                                                        className="grabaciones-input"
                                                        value={detail.submotivo}
                                                        onChange={(event) =>
                                                            handleRegisterDetailChange(
                                                                index,
                                                                "submotivo",
                                                                event.target.value,
                                                            )
                                                        }
                                                        required
                                                    >
                                                        <option value="">Selecciona...</option>
                                                        {submotivoOptions.map((option) => (
                                                            <option
                                                                key={option}
                                                                value={option}
                                                            >
                                                                {option}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div
                                                    className="grabaciones-field"
                                                    style={{ gridColumn: "1 / -1" }}
                                                >
                                                    <span className="grabaciones-field-label">
                                                        Observación de interacción
                                                    </span>
                                                    <textarea
                                                        className="grabaciones-input"
                                                        rows={3}
                                                        value={detail.observaciones}
                                                        onChange={(event) =>
                                                            handleRegisterDetailChange(
                                                                index,
                                                                "observaciones",
                                                                event.target.value,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="grabaciones-modal-actions">
                                                {index === 0 ? (
                                                    <button
                                                        type="button"
                                                        className="grabaciones-chip-btn"
                                                        onClick={addRegisterDetail}
                                                    >
                                                        Agregar acción
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="grabaciones-chip-btn"
                                                    onClick={() =>
                                                        removeRegisterDetail(index)
                                                    }
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grabaciones-modal-actions">
                                <button
                                    type="submit"
                                    className="grabaciones-primary-btn"
                                    disabled={registering || registerFormLoading}
                                >
                                    {registering ? "Guardando..." : "Guardar gestión"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {isAssignModalOpen && assignRow ? (
                <div className="grabaciones-modal-overlay" onClick={closeAssignModal}>
                    <div
                        className="grabaciones-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="grabaciones-modal-head">
                            <h3>Asignar asesor</h3>
                            <button
                                type="button"
                                className="grabaciones-chip-btn"
                                onClick={closeAssignModal}
                                disabled={assignSaving}
                            >
                                Cerrar
                            </button>
                        </div>

                        <p className="grabaciones-helper-text">
                            Selecciona el asesor correcto para la llamada{" "}
                            {String(assignRow?.uniqueid || "").trim() || "-"}.
                        </p>

                        <form
                            onSubmit={submitManualAssignAdvisor}
                            className="grabaciones-modal-form"
                        >
                            <div className="grabaciones-filters-grid">
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Asesor *
                                    </span>
                                    <select
                                        className="grabaciones-input"
                                        value={assignAdvisorUserId || assignAdvisorName}
                                        onChange={(event) =>
                                            handleAssignAdvisorChange(
                                                event.target.value,
                                            )
                                        }
                                        required
                                    >
                                        <option value="">Selecciona...</option>
                                        {assignAdvisorOptions.map((item) => (
                                            <option
                                                key={
                                                    item.idUser
                                                        ? `adv-${item.idUser}`
                                                        : item.optionKey
                                                }
                                                value={
                                                    item.idUser
                                                        ? String(item.idUser)
                                                        : item.advisorName
                                                }
                                            >
                                                {item.advisorName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grabaciones-field">
                                    <span className="grabaciones-field-label">
                                        Codigo Zoiper (opcional)
                                    </span>
                                    <input
                                        className="grabaciones-input"
                                        value={assignAdvisorZoiper}
                                        onChange={(event) =>
                                            setAssignAdvisorZoiper(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Ej: 101"
                                    />
                                </div>
                            </div>

                            <div className="grabaciones-modal-actions">
                                <button
                                    type="submit"
                                    className="grabaciones-primary-btn"
                                    disabled={
                                        assignSaving ||
                                        assignAdvisorOptions.length === 0
                                    }
                                >
                                    {assignSaving
                                        ? "Guardando..."
                                        : "Guardar asignacion"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </PageContainer>
    );
}

