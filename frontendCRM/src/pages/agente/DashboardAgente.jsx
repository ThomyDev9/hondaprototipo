// src/pages/DashboardAgente.jsx
import { useEffect, useRef, useState } from "react";
import { uuidv4 } from "../../utils/uuid";
// Per-tab session ID for multi-assignment
const AGENTE_TAB_SESSION_KEY = "agente_tab_session_id";
function getOrCreateTabSessionId() {
    // Si la URL tiene ?newtab=1, forzar nuevo id
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("newtab") === "1") {
        const newId = uuidv4();
        sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, newId);
        return newId;
    }
    // Si la pestaña fue restaurada/duplicada (pageshow persisted), forzar nuevo id
    let id = sessionStorage.getItem(AGENTE_TAB_SESSION_KEY);
    if (!id) {
        id = uuidv4();
        sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, id);
    }
    // Detectar duplicado/restaurado
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            const newId = uuidv4();
            sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, newId);
        }
    });
    return sessionStorage.getItem(AGENTE_TAB_SESSION_KEY);
}
import PropTypes from "prop-types";
import { PageContainer } from "../../components/common";
import AgentGestionForm from "./components/AgentGestionForm";
import GestionOutboundDemo from "./GestionOutboundDemo";
import { obtenerPlantillasDinamicas } from "../../services/formTemplate.service";
import "./DashboardAgente.css";
import OutMaquitaPage from "./OutMaquitaPage";
import OutHondaPage from "./OutHondaPage";
import { esGestionOutbound } from "../../utils/gestionOutbound";

const API_BASE = import.meta.env.VITE_API_BASE;

function buildInitialSurveyAnswers(surveyConfig) {
    if (!surveyConfig?.fields?.length) return {};
    return surveyConfig.fields.reduce((acc, field) => {
        acc[field.key] = "";
        return acc;
    }, {});
}

function chunkFields(fields = [], perRow = 5) {
    const rows = [];
    for (let index = 0; index < fields.length; index += perRow) {
        rows.push(fields.slice(index, index + perRow));
    }
    return rows;
}

function mapTemplateToForm2Config(form2Template) {
    if (!form2Template?.fields?.length) return null;

    return {
        title: form2Template.templateName || "Formulario 2",
        rows: chunkFields(
            form2Template.fields.map((field) => ({
                key: field.key,
                label: field.label,
            })),
            5,
        ),
    };
}

function mapTemplateToSurveyConfig(form3Template) {
    if (!form3Template?.fields?.length) return null;

    return {
        title: form3Template.templateName || "Formulario 3",
        fields: form3Template.fields.map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type || "text",
            options: Array.isArray(field.options) ? field.options : [],
            maxLength: field.maxLength || undefined,
        })),
    };
}

function findOptionIgnoreCase(options, target) {
    const normalizedTarget = String(target || "")
        .trim()
        .toLowerCase();
    if (!normalizedTarget) return "";

    return (
        options.find(
            (option) =>
                String(option || "")
                    .trim()
                    .toLowerCase() === normalizedTarget,
        ) || ""
    );
}

export default function DashboardAgente({
    user,
    selectedCampaignId,
    selectedCampaignTick,
    requestedAgentStatus,
    onAgentStatusSync,
    agentPage,
    onSelectCampaign,
    onChangeAgentPage,
}) {
    const roles = user?.roles || [];
    const isAgente = roles.includes("ASESOR");

    const [registro, setRegistro] = useState(null);
    const [loadingRegistro, setLoadingRegistro] = useState(false);
    const [error, setError] = useState("");

    // bloqueado real viene del backend (/auth/me) o por inactividad
    const [bloqueado, setBloqueado] = useState(
        user?.bloqueado === true || user?.is_active === false,
    );
    const [observacion, setObservacion] = useState("");

    const [estadoAgente, setEstadoAgente] = useState("disponible");
    const [campaignIdSeleccionada, setCampaignIdSeleccionada] = useState("");
    const [levels, setLevels] = useState([]);
    const [level1Seleccionado, setLevel1Seleccionado] = useState("");
    const [level2Seleccionado, setLevel2Seleccionado] = useState("");
    const [telefonos, setTelefonos] = useState([]);
    const [telefonoSeleccionado, setTelefonoSeleccionado] = useState("");
    const [estadoTelefonos, setEstadoTelefonos] = useState([]);
    const [estadoTelefonoSeleccionado, setEstadoTelefonoSeleccionado] =
        useState("");
    const [interactionIdActual, setInteractionIdActual] = useState("");
    const [dynamicFormConfig, setDynamicFormConfig] = useState(null);
    const [dynamicFormDetail, setDynamicFormDetail] = useState(null);
    const [dynamicSurveyConfig, setDynamicSurveyConfig] = useState(null);
    const [surveyAnswers, setSurveyAnswers] = useState({});
    const [activeBaseCards, setActiveBaseCards] = useState([]);
    const [loadingActiveBaseCards] = useState(false);
    const [regestionBaseCards, setRegestionBaseCards] = useState([]);
    const [loadingRegestionBaseCards] = useState(false);

    const surveyFieldsToRender = dynamicSurveyConfig?.fields || [];

    // para inactividad
    const lastActivityRef = useRef(Date.now());
    const inactivityHandledRef = useRef(false);
    const initialCampaignTickRef = useRef(selectedCampaignTick || 0);

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

    const loadBases = async () => {
        const token = localStorage.getItem("access_token") || "";

        try {
            const [activasResp, regestionResp] = await Promise.all([
                fetch(`${API_BASE}/agente/bases-activas-resumen`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_BASE}/agente/bases-regestion-resumen`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const activasJson = await activasResp.json();
            const regestionJson = await regestionResp.json();

            setActiveBaseCards(activasJson.data || []);
            setRegestionBaseCards(regestionJson.data || []);
        } catch (err) {
            console.error(err);
        }
    };
    useEffect(() => {
        if (!bloqueado) loadBases();
    }, [bloqueado]);

    useEffect(() => {
        if (agentPage === "inicio") return;
        if (!selectedCampaignId || !selectedCampaignTick || bloqueado) return;

        if (selectedCampaignTick === initialCampaignTickRef.current) {
            return;
        }

        // Excluir campañas Out que no usan autoasignación
        const label = String(selectedCampaignId || "").toLowerCase();
        const isOutManual = [
            "out maquita cushunchic",
            "out honda",
            "out cacpeco",
            "out kullki wasi",
            "out mutualista imbabura",
        ].some((l) => label.includes(l));
        setCampaignIdSeleccionada(selectedCampaignId);
        if (!isOutManual) {
            fetchSiguienteRegistro(selectedCampaignId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaignId, selectedCampaignTick, bloqueado, agentPage]);

    // Unify Cancel and Inicio logic: always release record if exists
    useEffect(() => {
        const releaseAndReset = async () => {
            if (registro?.id) {
                try {
                    setError("");
                    const token = localStorage.getItem("access_token");
                    await fetch(`${API_BASE}/agente/liberar-registro`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                        body: JSON.stringify({ registro_id: registro.id }),
                    });
                } catch {
                    setError("Error liberando registro");
                }
            }
            setRegistro(null);
            setError("");
            setCampaignIdSeleccionada("");
        };
        if (agentPage === "inicio") {
            releaseAndReset();
        }
        // Add registro?.id to dependencies to avoid React warning
    }, [agentPage, registro?.id]);
    // 15-min inactivity timeout: auto-cancel and release record
    useEffect(() => {
        if (!registro || agentPage === "inicio" || bloqueado) return;
        const timeoutMs = 15 * 60 * 1000; // 15 minutes
        const handle = setTimeout(async () => {
            if (registro?.id) {
                try {
                    setError("");
                    const token = localStorage.getItem("access_token");
                    await fetch(`${API_BASE}/agente/liberar-registro`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                        body: JSON.stringify({ registro_id: registro.id }),
                    });
                } catch {
                    setError("Error liberando registro por inactividad");
                }
            }
            if (typeof onChangeAgentPage === "function") {
                onChangeAgentPage("inicio");
            }
        }, timeoutMs);
        return () => clearTimeout(handle);
    }, [registro, agentPage, bloqueado, onChangeAgentPage]);

    useEffect(() => {
        if (!requestedAgentStatus || bloqueado) return;
        if (requestedAgentStatus === estadoAgente) return;

        handleCambioEstadoAgente(requestedAgentStatus);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedAgentStatus, bloqueado]);

    /* =====================  SIGUIENTE REGISTRO  ===================== */

    const fetchSiguienteRegistro = async (campaignIdOverride = null) => {
        try {
            const tabSessionId = getOrCreateTabSessionId();
            setLoadingRegistro(true);
            setError("");
            setRegistro(null);

            const campaignIdToUse =
                campaignIdOverride || campaignIdSeleccionada;

            if (!campaignIdToUse) {
                setError(
                    "Selecciona una opción del menú de campañas para cargar registros",
                );
                setDynamicFormConfig(null);
                setDynamicFormDetail(null);
                setDynamicSurveyConfig(null);
                setSurveyAnswers({});
                return;
            }

            // Solo llamar a /agente/siguiente si NO es gestión outbound
            if (esGestionOutbound(campaignIdToUse)) {
                setLoadingRegistro(false);
                setRegistro(null);
                setDynamicFormConfig(null);
                setDynamicFormDetail(null);
                setDynamicSurveyConfig(null);
                setSurveyAnswers({});
                return;
            }

            const token = localStorage.getItem("access_token");

            const resp = await fetch(`${API_BASE}/agente/siguiente`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify({
                    campaignId: campaignIdToUse,
                    tabSessionId,
                }),
            });

            const json = await resp.json();

            if (resp.status === 403) {
                handle403(json);
                setDynamicFormConfig(null);
                setDynamicFormDetail(null);
                setDynamicSurveyConfig(null);
                setSurveyAnswers({});
                return;
            }

            if (resp.status === 404) {
                setRegistro(null);
                setDynamicFormConfig(null);
                setDynamicFormDetail(null);
                setDynamicSurveyConfig(null);
                setSurveyAnswers({});
                // Omitir mensaje de base activa para campañas de Gestión Outbound
                if (
                    json.error === "No hay base activa para esta campaña" &&
                    esGestionOutbound(campaignIdToUse)
                ) {
                    setError("");
                } else {
                    setError(
                        json.error || "No hay registros disponibles en tu cola",
                    );
                }
                return;
            }

            if (!resp.ok) {
                setDynamicFormConfig(null);
                setDynamicFormDetail(null);
                setDynamicSurveyConfig(null);
                setSurveyAnswers({});
                setError(json.error || "No se pudo asignar siguiente registro");
                return;
            }

            setRegistro(json.registro || null);
            setObservacion("");

            const record = json.registro || null;
            let nextDynamicConfig = null;
            let nextSurveyConfig = null;

            try {
                const dynamicTemplates =
                    await obtenerPlantillasDinamicas(campaignIdToUse);
                nextDynamicConfig = mapTemplateToForm2Config(
                    dynamicTemplates.form2,
                );
                nextSurveyConfig = mapTemplateToSurveyConfig(
                    dynamicTemplates.form3,
                );
            } catch (templateError) {
                console.error(
                    "Error cargando plantillas dinámicas:",
                    templateError,
                );
            }

            setDynamicFormConfig(nextDynamicConfig);
            setDynamicFormDetail(json.detalleCliente || null);
            setDynamicSurveyConfig(nextSurveyConfig);
            setSurveyAnswers(buildInitialSurveyAnswers(nextSurveyConfig));

            if (record?.id && campaignIdToUse) {
                const catalogResp = await fetch(
                    `${API_BASE}/agente/form-catalogos?campaignId=${encodeURIComponent(campaignIdToUse)}&contactId=${encodeURIComponent(record.id)}`,
                    {
                        headers: {
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                    },
                );

                if (catalogResp.ok) {
                    const catalog = await catalogResp.json();
                    const levelsData = Array.isArray(catalog.levels)
                        ? catalog.levels
                        : [];
                    const telefonosData = Array.isArray(catalog.telefonos)
                        ? catalog.telefonos
                        : [];
                    const estadosData = Array.isArray(catalog.estadoTelefonos)
                        ? catalog.estadoTelefonos
                        : [];
                    setLevels(levelsData);
                    setTelefonos(telefonosData);
                    setEstadoTelefonos(estadosData);
                    setLevel1Seleccionado("");
                    setLevel2Seleccionado("");
                    setTelefonoSeleccionado("");
                    setEstadoTelefonoSeleccionado("");
                    setInteractionIdActual("");
                }

                if (nextDynamicConfig && !json.detalleCliente) {
                    setDynamicFormDetail(null);
                }
            }

            marcarActividad();
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        } finally {
            setLoadingRegistro(false);
        }
    };

    useEffect(() => {
        if (!level1Seleccionado) {
            setLevel2Seleccionado("");
            return;
        }

        const validLevel2Options = levels
            .filter((item) => item.level1 === level1Seleccionado)
            .map((item) => item.level2)
            .filter(Boolean);

        if (!validLevel2Options.includes(level2Seleccionado)) {
            setLevel2Seleccionado("");
        }
    }, [level1Seleccionado, level2Seleccionado, levels]);

    const buildInteractionId = () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        const micro = String(
            now.getMilliseconds() * 1000 + Math.floor(Math.random() * 1000),
        ).padStart(6, "0");
        const rand8 = String(Math.floor(Math.random() * 100000000)).padStart(
            8,
            "0",
        );
        const yyyy = String(now.getFullYear());
        const mon = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        return `${hh}${mm}${ss}${micro}-${rand8}-${yyyy}${mon}${dd}`;
    };

    const formatNowForMysql = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const handleEstadoTelefonoChange = async (nuevoEstado) => {
        setEstadoTelefonoSeleccionado(nuevoEstado);

        if (!nuevoEstado) {
            return;
        }

        const newInteractionId = buildInteractionId();
        setInteractionIdActual(newInteractionId);

        if (!(registro?.contact_id || registro?.id) || !telefonoSeleccionado) {
            setError("Selecciona un teléfono antes de actualizar estado");
            return;
        }

        await persistPhoneStatus(
            telefonoSeleccionado,
            nuevoEstado,
            newInteractionId,
        );
    };

    const persistPhoneStatus = async (telefono, estado, interactionIdValue) => {
        const contactIdToUse = registro?.contact_id || registro?.id;
        const interactionToUse = String(
            interactionIdValue || interactionIdActual || "",
        ).trim();

        if (!telefono || !estado || !contactIdToUse || !interactionToUse) {
            return;
        }

        try {
            const token = localStorage.getItem("access_token");
            const payload = {
                IDC: contactIdToUse,
                fonos: telefono,
                estatusTel: estado,
                horaInicioLlamada: formatNowForMysql(),
                interactionId: interactionToUse,
                identificacionCliente: registro?.identification || "",
            };

            const resp = await fetch(`${API_BASE}/agente/update-phones`, {
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
                    json.error ||
                        "No se pudo actualizar el estado del teléfono",
                );
            }
        } catch (err) {
            console.error(err);
            setError("Error actualizando estado de teléfono");
        }
    };

    const handleTelefonoChange = async (nuevoTelefono) => {
        setTelefonoSeleccionado(nuevoTelefono);

        const contactIdToUse = registro?.contact_id || registro?.id;

        if (!contactIdToUse || !nuevoTelefono) {
            setEstadoTelefonoSeleccionado("");
            return;
        }

        try {
            const token = localStorage.getItem("access_token");
            const resp = await fetch(
                `${API_BASE}/agente/ultimo-estado-telefono?contactId=${encodeURIComponent(contactIdToUse)}&telefono=${encodeURIComponent(nuevoTelefono)}`,
                {
                    headers: {
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                },
            );

            if (resp.ok) {
                const json = await resp.json();
                const ultimoEstado = String(json.ultimoEstado || "").trim();
                const interactionId = String(json.interactionId || "").trim();

                if (ultimoEstado) {
                    setEstadoTelefonoSeleccionado(ultimoEstado);
                }

                if (interactionId) {
                    setInteractionIdActual(interactionId);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSurveyFieldChange = (fieldKey, value) => {
        setSurveyAnswers((prev) => ({
            ...prev,
            [fieldKey]: value,
        }));
    };

    const applyGestionQuickFill = ({
        level1Target,
        level2Target,
        estadoTelefonoTarget,
        observacion,
    }) => {
        const level1Options = [
            ...new Set(levels.map((item) => item.level1).filter(Boolean)),
        ];

        const matchedLevel1 =
            findOptionIgnoreCase(level1Options, level1Target) || level1Target;

        const level2Options = levels
            .filter((item) => item.level1 === matchedLevel1)
            .map((item) => item.level2)
            .filter(Boolean);

        const matchedLevel2 =
            findOptionIgnoreCase(level2Options, level2Target) || level2Target;

        const matchedEstadoTelefono =
            findOptionIgnoreCase(estadoTelefonos, estadoTelefonoTarget) ||
            estadoTelefonoTarget;

        setLevel1Seleccionado(matchedLevel1);
        setLevel2Seleccionado(matchedLevel2);
        setEstadoTelefonoSeleccionado(matchedEstadoTelefono);
        setObservacion(observacion || "");
    };

    const handleNoContestaAutofill = () => {
        applyGestionQuickFill({
            level1Target: "NU1 Regestionables",
            level2Target: "no contesta",
            estadoTelefonoTarget: "no contesta",
            observacion: "No contesta",
        });
    };

    const handleGrabadoraAutofill = () => {
        applyGestionQuickFill({
            level1Target: "NU1 Regestionables",
            level2Target: "grabadora",
            estadoTelefonoTarget: "grabadora",
        });
    };

    const handleContestaTerceroAutofill = () => {
        applyGestionQuickFill({
            level1Target: "NU1 Regestionables",
            level2Target: "contesta tercero",
            estadoTelefonoTarget: "contactado",
        });
    };

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
            onAgentStatusSync?.(nuevoEstado);
            marcarActividad();

            if (
                ["baño", "consulta", "lunch", "reunion"].includes(nuevoEstado)
            ) {
                setRegistro(null);
            }

            if (nuevoEstado === "disponible" && campaignIdSeleccionada) {
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
                estado_final: level2Seleccionado || level1Seleccionado,
                level1: level1Seleccionado,
                level2: level2Seleccionado,
                campaign_id: registro?.campaign_id || campaignIdSeleccionada,
                interactionId: interactionIdActual || null,
                telefono_ad: telefonoSeleccionado || null,
                comentarios: observacion || null,
                fecha_agendamiento: surveyAnswers?.respuesta1 || null,
                encuesta: surveyAnswers,
                encuestaPreguntas: surveyFieldsToRender.map((field) =>
                    String(field.label || "").trim(),
                ),
                encuestaRespuestas: surveyFieldsToRender.map((field) =>
                    String(surveyAnswers?.[field.key] || "").trim(),
                ),
                encuestaKeys: surveyFieldsToRender.map((field) =>
                    String(field.key || "").trim(),
                ),
                dynamicForm2Payload: dynamicFormDetail || {},
                dynamicForm3Payload: surveyAnswers || {},
            };

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

    if (!isAgente) {
        return (
            <PageContainer fullWidth className="agent-page-container">
                <div className="agent-page">
                    <h1 className="agent-title">Módulo de asesor</h1>
                    <p className="agent-subtitle">
                        <strong>Permiso denegado.</strong> Tu usuario no tiene
                        rol de asesor asignado.
                    </p>
                    <p className="agent-subtitle">
                        Pide a un administrador que te asigne el rol ASESOR
                        desde el módulo de Usuarios.
                    </p>
                </div>
            </PageContainer>
        );
    }

    const hasCampaignSelection = Boolean(campaignIdSeleccionada);
    const shouldShowQueueMessage =
        !loadingRegistro &&
        !registro &&
        hasCampaignSelection &&
        !error &&
        ![
            "out maquita cushunchic",
            "out honda",
            "out cacpeco",
            "out kullki wasi",
            "out mutualista imbabura",
        ].some((l) =>
            String(campaignIdSeleccionada || "")
                .toLowerCase()
                .includes(l),
        );
    const isHomeView = agentPage === "inicio";

    let activeBaseCardsContent = null;
    if (loadingActiveBaseCards) {
        activeBaseCardsContent = (
            <p className="agent-info-text">Cargando bases activas...</p>
        );
    } else if (activeBaseCards.length === 0) {
        activeBaseCardsContent = (
            <p className="agent-info-text">No hay bases activas disponibles.</p>
        );
    } else {
        activeBaseCardsContent = (
            <div className="agent-base-cards-grid">
                {activeBaseCards.map((card) => (
                    <article
                        key={`${card.campaignId}-${card.importId}`}
                        className="agent-base-card agent-base-card--horizontal"
                    >
                        <div className="agent-base-card__info-horizontal">
                            <div className="agent-base-card__campaign-horizontal">
                                {card.campaignId}
                            </div>
                            <div className="agent-base-card__import-id">
                                {card.importId || card.base}
                            </div>
                            <div className="agent-base-card__metrics-horizontal">
                                <div className="agent-base-card__metric-horizontal">
                                    {card.pendientes}
                                    <span className="agent-base-card__metric-label-horizontal">
                                        Por gestionar
                                    </span>
                                </div>
                                <div className="agent-base-card__metric-horizontal">
                                    {card.totalRegistros}
                                    <span className="agent-base-card__metric-label-horizontal">
                                        Total base
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="agent-base-card__button-horizontal"
                            onClick={() => {
                                onSelectCampaign?.(card.campaignId);
                            }}
                        >
                            Ingresar
                        </button>
                    </article>
                ))}
            </div>
        );
    }

    let regestionBaseCardsContent = null;
    if (loadingRegestionBaseCards) {
        regestionBaseCardsContent = (
            <p className="agent-info-text">Cargando bases regestión...</p>
        );
    } else if (regestionBaseCards.length === 0) {
        regestionBaseCardsContent = (
            <p className="agent-info-text">
                No hay bases regestión disponibles.
            </p>
        );
    } else {
        regestionBaseCardsContent = (
            <div className="agent-base-cards-grid">
                {regestionBaseCards.map((card) => (
                    <article
                        key={`${card.campaignId}-${card.importId}`}
                        className="agent-base-card agent-base-card--horizontal"
                    >
                        <div className="agent-base-card__info-horizontal">
                            <div className="agent-base-card__campaign-horizontal">
                                {card.campaignId}
                            </div>
                            <div className="agent-base-card__metrics-horizontal">
                                <div className="agent-base-card__metric-horizontal">
                                    {card.totalReciclables}
                                    <span className="agent-base-card__metric-label-horizontal">
                                        Reciclables
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="agent-base-card__button-horizontal"
                            onClick={() => {
                                onSelectCampaign?.(card.campaignId);
                            }}
                        >
                            Ingresar
                        </button>
                    </article>
                ))}
            </div>
        );
    }

    /* =====================  UI NORMAL  ===================== */
    return (
        <PageContainer fullWidth className="agent-page-container">
            {/* Zona principal: gestión */}
            <section className="agent-main-row">
                {/* Panel de gestión */}
                <div>
                    {!registro && isHomeView && (
                        <>
                            <section className="agent-base-cards agent-base-cards--home">
                                <h2 className="agent-base-cards__title">
                                    Bases activas disponibles
                                </h2>
                                {activeBaseCardsContent}
                            </section>
                            <section className="agent-base-cards agent-base-cards--home">
                                <h2 className="agent-base-cards__title">
                                    Bases regestión disponibles
                                </h2>
                                {regestionBaseCardsContent}
                            </section>
                        </>
                    )}

                    {error && <p className="agent-error">{error}</p>}

                    {loadingRegistro &&
                        !isHomeView &&
                        !esGestionOutbound(campaignIdSeleccionada) && (
                            <p className="agent-info-text">
                                Asignando registro...
                            </p>
                        )}

                    {shouldShowQueueMessage &&
                        !isHomeView &&
                        !esGestionOutbound(campaignIdSeleccionada) && (
                            <p className="agent-info-text">
                                {estadoAgente === "disponible"
                                    ? "No hay registros disponibles en tu cola en este momento."
                                    : 'Estás en estado de pausa. Vuelve a "Disponible" para tomar registros.'}
                            </p>
                        )}

                    {registro && !isHomeView && (
                        <AgentGestionForm
                            registro={registro}
                            onSubmit={handleGuardarGestion}
                            levels={levels}
                            level1Seleccionado={level1Seleccionado}
                            level2Seleccionado={level2Seleccionado}
                            onLevel1Change={setLevel1Seleccionado}
                            onLevel2Change={setLevel2Seleccionado}
                            telefonos={telefonos}
                            telefonoSeleccionado={telefonoSeleccionado}
                            onTelefonoChange={handleTelefonoChange}
                            estadoTelefonos={estadoTelefonos}
                            estadoTelefonoSeleccionado={
                                estadoTelefonoSeleccionado
                            }
                            onEstadoTelefonoChange={handleEstadoTelefonoChange}
                            observacion={observacion}
                            onObservacionChange={setObservacion}
                            onNoContestaClick={handleNoContestaAutofill}
                            onGrabadoraClick={handleGrabadoraAutofill}
                            onContestaTerceroClick={
                                handleContestaTerceroAutofill
                            }
                            dynamicFormConfig={dynamicFormConfig}
                            dynamicFormDetail={dynamicFormDetail}
                            dynamicSurveyConfig={dynamicSurveyConfig}
                            surveyFieldsToRender={surveyFieldsToRender}
                            surveyAnswers={surveyAnswers}
                            onSurveyFieldChange={handleSurveyFieldChange}
                            onCancelarGestion={async () => {
                                if (registro?.id) {
                                    try {
                                        setError("");
                                        const token =
                                            localStorage.getItem(
                                                "access_token",
                                            );
                                        await fetch(
                                            `${API_BASE}/agente/liberar-registro`,
                                            {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type":
                                                        "application/json",
                                                    Authorization: token
                                                        ? `Bearer ${token}`
                                                        : "",
                                                },
                                                body: JSON.stringify({
                                                    registro_id: registro.id,
                                                }),
                                            },
                                        );
                                    } catch {
                                        setError("Error liberando registro");
                                    }
                                }
                                if (typeof onChangeAgentPage === "function") {
                                    onChangeAgentPage("inicio");
                                }
                            }}
                        />
                    )}
                    {/* Mostrar Formulario F2 solo en campañas Out específicas */}
                    {isAgente &&
                        (() => {
                            const label = (
                                registro?.campania ||
                                registro?.campaign_name ||
                                registro?.campaign ||
                                registro?.nombre_campania ||
                                registro?.label ||
                                campaignIdSeleccionada ||
                                ""
                            ).toLowerCase();
                            if (
                                [
                                    "out cacpeco",
                                    "out kullki wasi",
                                    "out mutualista imbabura",
                                ].some((l) => label.includes(l))
                            ) {
                                return <GestionOutboundDemo />;
                            }
                            if (label.includes("out maquita cushunchic")) {
                                return <OutMaquitaPage />;
                            }
                            if (label.includes("out honda")) {
                                return <OutHondaPage />;
                            }
                            return null;
                        })()}
                </div>
            </section>
        </PageContainer>
    );
}

DashboardAgente.propTypes = {
    user: PropTypes.shape({
        roles: PropTypes.arrayOf(PropTypes.string),
        bloqueado: PropTypes.bool,
        is_active: PropTypes.bool,
        name: PropTypes.string,
        username: PropTypes.string,
    }),
    selectedCampaignId: PropTypes.string,
    selectedCampaignTick: PropTypes.number,
    requestedAgentStatus: PropTypes.string,
    onAgentStatusSync: PropTypes.func,
    agentPage: PropTypes.string,
    onSelectCampaign: PropTypes.func,
};
