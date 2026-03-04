// src/pages/DashboardAgente.jsx
import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { PageContainer } from "../../components/common";
import AgentGestionForm from "./components/AgentGestionForm";
import outboundCampaignResolvers from "./campanias-outbound/index.js";
import "./DashboardAgente.css";

const { resolveDynamicFormConfig, resolveDynamicSurveyConfig } =
    outboundCampaignResolvers;

const API_BASE = import.meta.env.VITE_API_BASE;
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos

const ESTADOS_OPERATIVOS = [
    { code: "disponible", label: "Disponible" },
    { code: "baño", label: "Baño" },
    { code: "consulta", label: "Consulta" },
    { code: "lunch", label: "Lunch" },
    { code: "reunion", label: "Reunión" },
];

function buildInitialSurveyAnswers(surveyConfig) {
    if (!surveyConfig?.fields?.length) return {};
    return surveyConfig.fields.reduce((acc, field) => {
        acc[field.key] = "";
        return acc;
    }, {});
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

const CREDIT_OPTION_FIELD = {
    key: "respuesta10",
    label: "Opción de crédito seleccionada",
    type: "select",
    options: ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
};

export default function DashboardAgente({
    user,
    selectedCampaignId,
    selectedCampaignTick,
    requestedAgentStatus,
    onAgentStatusSync,
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

    const activeCampaignForSurvey =
        campaignIdSeleccionada || registro?.campaign_id || "";
    const isBvfPreAprobados = /BVF PRE APROBADOS/i.test(
        String(activeCampaignForSurvey),
    );
    const hasCreditField = dynamicSurveyConfig?.fields?.some(
        (field) => field.key === CREDIT_OPTION_FIELD.key,
    );
    let surveyFieldsToRender = [];
    if (dynamicSurveyConfig) {
        surveyFieldsToRender = dynamicSurveyConfig.fields;
        if (isBvfPreAprobados && !hasCreditField) {
            surveyFieldsToRender = [
                ...dynamicSurveyConfig.fields,
                CREDIT_OPTION_FIELD,
            ];
        }
    }

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

    useEffect(() => {
        if (!selectedCampaignId || !selectedCampaignTick || bloqueado) return;

        if (selectedCampaignTick === initialCampaignTickRef.current) {
            return;
        }

        setCampaignIdSeleccionada(selectedCampaignId);
        fetchSiguienteRegistro(selectedCampaignId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaignId, selectedCampaignTick, bloqueado]);

    useEffect(() => {
        if (!requestedAgentStatus || bloqueado) return;
        if (requestedAgentStatus === estadoAgente) return;

        handleCambioEstadoAgente(requestedAgentStatus);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedAgentStatus, bloqueado]);

    /* =====================  SIGUIENTE REGISTRO  ===================== */
    const fetchSiguienteRegistro = async (campaignIdOverride = null) => {
        try {
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

            const token = localStorage.getItem("access_token");

            const resp = await fetch(`${API_BASE}/agente/siguiente`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify({ campaignId: campaignIdToUse }),
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
                setError(
                    json.error || "No hay registros disponibles en tu cola",
                );
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
            const nextDynamicConfig = resolveDynamicFormConfig(campaignIdToUse);
            const nextSurveyConfig =
                resolveDynamicSurveyConfig(campaignIdToUse);
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
                setEstadoTelefonoSeleccionado(json.ultimoEstado || "");
                setInteractionIdActual(json.interactionId || "");
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

    const handleNoContestaAutofill = () => {
        const defaultLevel1 = "NU1 Regestionables";
        const defaultLevel2Target = "no contesta";
        const defaultEstadoTelefonoTarget = "no contesta";

        const level1Options = [
            ...new Set(levels.map((item) => item.level1).filter(Boolean)),
        ];
        const matchedLevel1 =
            findOptionIgnoreCase(level1Options, defaultLevel1) || defaultLevel1;

        const level2Options = levels
            .filter((item) => item.level1 === matchedLevel1)
            .map((item) => item.level2)
            .filter(Boolean);

        const matchedLevel2 =
            findOptionIgnoreCase(level2Options, defaultLevel2Target) ||
            defaultLevel2Target;

        const matchedEstadoTelefono =
            findOptionIgnoreCase(
                estadoTelefonos,
                defaultEstadoTelefonoTarget,
            ) || defaultEstadoTelefonoTarget;

        setLevel1Seleccionado(matchedLevel1);
        setLevel2Seleccionado(matchedLevel2);
        setEstadoTelefonoSeleccionado(matchedEstadoTelefono);
        setObservacion("");
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

    /* =====================  INACTIVIDAD (10 min)  ===================== */
    useEffect(() => {
        if (bloqueado) return;

        const handler = () => marcarActividad();

        globalThis.addEventListener("click", handler);
        globalThis.addEventListener("keydown", handler);
        globalThis.addEventListener("mousemove", handler);

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
            globalThis.removeEventListener("click", handler);
            globalThis.removeEventListener("keydown", handler);
            globalThis.removeEventListener("mousemove", handler);
            clearInterval(interval);
        };
    }, [bloqueado, registro]);

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

    /* =====================  UI BLOQUEADO  ===================== */
    if (bloqueado) {
        return (
            <PageContainer fullWidth className="agent-page-container">
                <div className="agent-page">
                    <h1 className="agent-title">Módulo de agente</h1>
                    <p className="agent-subtitle">
                        Tu usuario se encuentra{" "}
                        <strong>bloqueado por inactividad</strong> o marcado
                        como <strong>inactivo</strong>.
                    </p>
                    <p className="agent-subtitle">
                        Por favor, comunícate con un administrador para que te
                        desbloquee.
                    </p>
                    {error && <p className="agent-error-blocked">{error}</p>}
                </div>
            </PageContainer>
        );
    }

    const hasCampaignSelection = Boolean(campaignIdSeleccionada);
    const shouldShowQueueMessage =
        !loadingRegistro && !registro && hasCampaignSelection;

    /* =====================  UI NORMAL  ===================== */
    return (
        <PageContainer fullWidth className="agent-page-container">
            {/* Zona principal: gestión */}
            <section className="agent-main-row">
                {/* Panel de gestión */}
                <div className="agent-left-column">
                    {error && <p className="agent-error">{error}</p>}

                    {loadingRegistro && (
                        <p className="agent-info-text">Asignando registro...</p>
                    )}

                    {shouldShowQueueMessage && (
                        <p className="agent-info-text">
                            {estadoAgente === "disponible"
                                ? "No hay registros disponibles en tu cola en este momento."
                                : 'Estás en estado de pausa. Vuelve a "Disponible" para tomar registros.'}
                        </p>
                    )}

                    {registro && (
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
                            dynamicFormConfig={dynamicFormConfig}
                            dynamicFormDetail={dynamicFormDetail}
                            dynamicSurveyConfig={dynamicSurveyConfig}
                            surveyFieldsToRender={surveyFieldsToRender}
                            surveyAnswers={surveyAnswers}
                            onSurveyFieldChange={handleSurveyFieldChange}
                        />
                    )}
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
};
