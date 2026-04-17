import { useState, useEffect, useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardSupervisor from "./pages/supervisor/DashboardSupervisorV2";
import ReportesSupervisorPage from "./pages/supervisor/ReportesSupervisorPage";
import AgentesSupervisorPage from "./pages/supervisor/AgentesSupervisorPageV2";
import GrabacionesOutboundPage from "./pages/supervisor/GrabacionesOutboundPage";
import GrabacionesInboundPage from "./pages/supervisor/GrabacionesInboundPage";
import DashboardAgente from "./pages/agente/DashboardAgente";
import InboundEmailComposerPage from "./pages/agente/InboundEmailComposerPage";
import DashboardConsultor from "./pages/consultor/DashboardConsultor";
import AdministrarBases from "./pages/admin/AdministrarBases";
import UsuariosAdmin from "./pages/admin/UsuariosAdmin";
import CampaniasAdmin from "./pages/admin/CampaniasAdmin";
import ConfiguracionAdmin from "./pages/admin/ConfiguracionAdmin";
import NivelesGestionAdmin from "./pages/admin/NivelesGestionAdmin";
import ScriptsAdmin from "./pages/admin/ScriptsAdmin";
import { endAgentSession } from "./services/dashboard.service";
import {
    getCurrentTabSessionId,
    resetTabSessionId,
} from "./pages/agente/dashboardAgente.helpers";

const API_BASE = import.meta.env.VITE_API_BASE;
const ZOIPER_REQUIRED_ERROR =
    "Esta máquina no tiene Zoiper configurado para inbound. Comunícate con sistemas para registrar IP + código Zoiper.";

function App() {
    const standaloneMode =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("standalone")
            : "";

    //const [username, setUsername] = useState("Akimobill1");
    //const [password, setPassword] = useState("lGpQEm194");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { userInfo, setUserInfo } = useContext(AuthContext);

    const [adminPage, setAdminPage] = useState("administrar-bases");
    const [selectedAgentCampaign, setSelectedAgentCampaign] = useState({
        campaignId: "",
        campaignLabel: "",
        tick: 0,
        importId: "",
        menuItemId: "",
        categoryId: "",
        manualFlow: false,
        secureInboundManual: false,
        followupInboundManual: false,
    });
    const [agentPage, setAgentPage] = useState("inicio");
    const [consultorPage, setConsultorPage] = useState("consultor-leads");
    const [selectedAgentStatus, setSelectedAgentStatus] = useState("");
    const clearInboundSessionStorage = () => {
        sessionStorage.removeItem("inbound_agent_number");
        sessionStorage.removeItem("inbound_auto_last_target");
        sessionStorage.removeItem("inbound_manual_draft_state");
        localStorage.removeItem("inbound_agent_number_shared");
        localStorage.removeItem("inbound_auto_last_target_shared");
    };

    const hydrateZoiperCodeByMachine = async (token) => {
        const response = await fetch(`${API_BASE}/agente/machine-context`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));
        const mappedZoiperCode = String(
            body?.data?.mappedZoiperCode || "",
        ).trim();

        if (!response.ok || !mappedZoiperCode) {
            return {
                ok: false,
                error: ZOIPER_REQUIRED_ERROR,
            };
        }

        sessionStorage.setItem("inbound_agent_number", mappedZoiperCode);
        localStorage.setItem("inbound_agent_number_shared", mappedZoiperCode);
        return {
            ok: true,
            mappedZoiperCode,
        };
    };

    useEffect(() => {
        const validateToken = async () => {
            const token = localStorage.getItem("access_token");
            if (!token) return;

            try {
                const meResp = await fetch(`${API_BASE}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!meResp.ok) {
                    throw new Error("Token invalido");
                }

                const meJson = await meResp.json();

                if (!meJson.user.username) {
                    console.warn("Username no disponible en sesion actual");
                }

                const roles = Array.isArray(meJson?.user?.roles)
                    ? meJson.user.roles
                    : [];
                if (roles.includes("ASESOR")) {
                    const zoiperCheck = await hydrateZoiperCodeByMachine(token);
                    if (!zoiperCheck.ok) {
                        clearInboundSessionStorage();
                        localStorage.removeItem("access_token");
                        localStorage.removeItem("import_user");
                        setUserInfo(null);
                        setError(zoiperCheck.error || ZOIPER_REQUIRED_ERROR);
                        return;
                    }
                }

                setSelectedAgentCampaign({
                    campaignId: "",
                    campaignLabel: "",
                    tick: 0,
                    importId: "",
                    menuItemId: "",
                    categoryId: "",
                    manualFlow: false,
                    secureInboundManual: false,
                    followupInboundManual: false,
                });
                setAgentPage("inicio");
                setUserInfo(meJson.user);
            } catch (err) {
                console.error("Error validando token:", err);
                localStorage.removeItem("access_token");
                localStorage.removeItem("import_user");
            }
        };

        validateToken();
    }, [setUserInfo]);

    if (standaloneMode === "inbound-email") {
        return <InboundEmailComposerPage />;
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const resp = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                throw new Error(body.error || "Error en login");
            }

            const json = await resp.json();
            const accessToken = json.token;
            localStorage.setItem("access_token", accessToken);
            localStorage.setItem("import_user", username);
            clearInboundSessionStorage();
            resetTabSessionId();

            const meResp = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!meResp.ok) {
                const body = await meResp.json().catch(() => ({}));
                throw new Error(body.error || "Error consultando /auth/me");
            }

            const meJson = await meResp.json();

            if (!meJson.user.username) {
                console.warn("Username no disponible en el token");
            }

            const roles = Array.isArray(meJson?.user?.roles)
                ? meJson.user.roles
                : [];
            if (roles.includes("ASESOR")) {
                const zoiperCheck = await hydrateZoiperCodeByMachine(accessToken);
                if (!zoiperCheck.ok) {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("import_user");
                    clearInboundSessionStorage();
                    throw new Error(zoiperCheck.error || ZOIPER_REQUIRED_ERROR);
                }
            }

            setSelectedAgentCampaign({
                campaignId: "",
                campaignLabel: "",
                tick: 0,
                importId: "",
                menuItemId: "",
                categoryId: "",
                manualFlow: false,
                secureInboundManual: false,
                followupInboundManual: false,
            });
            setAgentPage("inicio");
            setUserInfo(meJson.user);
        } catch (err) {
            console.error("Error login:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (userInfo?.roles?.includes("ASESOR")) {
            const sessionId = getCurrentTabSessionId();
            if (sessionId) {
                try {
                    await endAgentSession({
                        sessionId,
                        agentNumber: String(
                            sessionStorage.getItem("inbound_agent_number") ||
                                "",
                        ).trim(),
                    });
                } catch (err) {
                    console.error("Error cerrando sesion del agente:", err);
                }
            }
        }

        localStorage.removeItem("access_token");
        localStorage.removeItem("import_user");
        clearInboundSessionStorage();
        setSelectedAgentCampaign({
            campaignId: "",
            campaignLabel: "",
            tick: 0,
            importId: "",
            menuItemId: "",
            categoryId: "",
            manualFlow: false,
            secureInboundManual: false,
            followupInboundManual: false,
        });
        setAgentPage("inicio");
        setSelectedAgentStatus("");
        setUserInfo(null);
        resetTabSessionId();
    };

    if (userInfo) {
        return (
            <DashboardLayout
                user={userInfo}
                onLogout={handleLogout}
                adminPage={adminPage}
                onChangeAdminPage={setAdminPage}
                selectedAgentStatus={selectedAgentStatus}
                onChangeAgentStatus={setSelectedAgentStatus}
                onSelectCampaign={(
                    campaignId,
                    importId,
                    menuItemId,
                    categoryId,
                    manualFlow = false,
                    campaignLabel = "",
                    secureInboundManual = false,
                    followupInboundManual = false,
                ) => {
                    setAgentPage("gestion");
                    setSelectedAgentCampaign({
                        campaignId,
                        campaignLabel: campaignLabel || campaignId || "",
                        tick: Date.now(),
                        importId: importId || "",
                        menuItemId: menuItemId || "",
                        categoryId: categoryId || "",
                        manualFlow: Boolean(manualFlow),
                        secureInboundManual: Boolean(secureInboundManual),
                        followupInboundManual: Boolean(followupInboundManual),
                    });
                }}
                agentPage={agentPage}
                onChangeAgentPage={(nextPage) => {
                    setAgentPage(nextPage);
                    if (nextPage === "inicio") {
                        setSelectedAgentCampaign({
                            campaignId: "",
                            campaignLabel: "",
                            tick: 0,
                            importId: "",
                            menuItemId: "",
                            categoryId: "",
                            manualFlow: false,
                            secureInboundManual: false,
                            followupInboundManual: false,
                        });
                    }
                }}
                consultorPage={consultorPage}
                onChangeConsultorPage={setConsultorPage}
            >
                {userInfo.roles?.includes("ADMINISTRADOR") && (
                    <>
                        {adminPage === "administrar-bases" && (
                            <AdministrarBases />
                        )}
                        {adminPage === "campanias" && <CampaniasAdmin />}
                        {adminPage === "management-levels" && (
                            <NivelesGestionAdmin />
                        )}
                        {adminPage === "users" && <UsuariosAdmin />}
                        {adminPage === "settings" && <ConfiguracionAdmin />}
                        {adminPage === "scripts" && <ScriptsAdmin />}
                    </>
                )}

                {userInfo.roles?.includes("SUPERVISOR") &&
                    (adminPage === "agents" ? (
                        <AgentesSupervisorPage />
                    ) : adminPage === "reports" ? (
                        <ReportesSupervisorPage />
                    ) : adminPage === "grabaciones-outbound" ? (
                        <GrabacionesOutboundPage />
                    ) : adminPage === "grabaciones-inbound" ? (
                        <GrabacionesInboundPage />
                    ) : (
                        <DashboardSupervisor />
                    ))}

                {userInfo.roles?.includes("ASESOR") && (
                    <DashboardAgente
                        user={userInfo}
                        selectedCampaignId={selectedAgentCampaign.campaignId}
                        selectedCampaignLabel={
                            selectedAgentCampaign.campaignLabel
                        }
                        selectedCampaignTick={selectedAgentCampaign.tick}
                        selectedImportId={selectedAgentCampaign.importId}
                        selectedMenuItemId={selectedAgentCampaign.menuItemId}
                        selectedCategoryId={selectedAgentCampaign.categoryId}
                        selectedManualFlow={selectedAgentCampaign.manualFlow}
                        selectedSecureInboundManual={
                            selectedAgentCampaign.secureInboundManual
                        }
                        selectedFollowupInboundManual={
                            selectedAgentCampaign.followupInboundManual
                        }
                        requestedAgentStatus={selectedAgentStatus}
                        onAgentStatusSync={setSelectedAgentStatus}
                        agentPage={agentPage}
                        onSelectCampaign={(
                            campaignId,
                            importId,
                            menuItemId,
                            categoryId,
                            manualFlow = false,
                            campaignLabel = "",
                            secureInboundManual = false,
                            followupInboundManual = false,
                        ) => {
                            setAgentPage("gestion");
                            setSelectedAgentCampaign({
                                campaignId,
                                campaignLabel:
                                    campaignLabel || campaignId || "",
                                tick: Date.now(),
                                importId: importId || "",
                                menuItemId: menuItemId || "",
                                categoryId: categoryId || "",
                                manualFlow: Boolean(manualFlow),
                                secureInboundManual: Boolean(
                                    secureInboundManual,
                                ),
                                followupInboundManual: Boolean(
                                    followupInboundManual,
                                ),
                            });
                        }}
                        onChangeAgentPage={setAgentPage}
                    />
                )}

                {(userInfo.roles?.includes("CONSULTOR") ||
                    userInfo.roles?.includes("CONSULTOR_ADMIN")) && (
                    <DashboardConsultor
                        key={consultorPage}
                        page={consultorPage}
                    />
                )}
            </DashboardLayout>
        );
    }

    return (
        <div className="login-shell">
            <div className="login-backdrop login-backdrop-left" />
            <div className="login-backdrop login-backdrop-right" />
            <div className="login-layout">
                <section className="login-card">
                    <div className="login-card-glow" />
                    <div className="login-card-topline" />
                    <div className="login-brand-top login-brand-top-centered">
                        <img
                            src="/Logo_KMB.svg"
                            alt="Kimobill"
                            className="login-brand-logo"
                        />
                        <div className="login-brand-badge">Acceso CRM</div>
                    </div>
                    <div className="login-card-header">
                        <div>
                            <p className="login-card-kicker">
                                Accede con tus credenciales
                            </p>
                            <h2 className="login-card-title">Iniciar sesión</h2>
                        </div>
                    </div>
                    <form className="login-form" onSubmit={handleLogin}>
                        <label className="login-field">
                            <span className="login-label">Usuario</span>
                            <span className="login-input-shell">
                                <span className="login-input-icon">U</span>
                                <input
                                    className="login-input"
                                    type="text"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    required
                                    placeholder="Ingresa tu usuario"
                                    autoComplete="username"
                                />
                            </span>
                        </label>
                        <label className="login-field">
                            <span className="login-label">Contraseña</span>
                            <span className="login-input-shell">
                                <span className="login-input-icon">C</span>
                                <input
                                    className="login-input"
                                    type="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                    placeholder="Ingresa tu contraseña"
                                    autoComplete="current-password"
                                />
                            </span>
                        </label>
                        {error ? <p className="login-error">{error}</p> : null}
                        <button
                            className="login-submit"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Ingresando..." : "Ingresar"}
                        </button>
                    </form>
                    <div className="login-card-foot">
                        <span className="login-foot-chip">Acceso seguro</span>
                        <span className="login-foot-chip">Uso interno</span>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default App;
