import { useState, useEffect, useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardSupervisor from "./pages/supervisor/DashboardSupervisor";
import GrabacionesOutboundPage from "./pages/supervisor/GrabacionesOutboundPage";
import DashboardAgente from "./pages/agente/DashboardAgente";
import AdministrarBases from "./pages/admin/AdministrarBases";
import UsuariosAdmin from "./pages/admin/UsuariosAdmin";
import CampaniasAdmin from "./pages/admin/CampaniasAdmin";
import ConfiguracionAdmin from "./pages/admin/ConfiguracionAdmin";
import NivelesGestionAdmin from "./pages/admin/NivelesGestionAdmin";

const API_BASE = import.meta.env.VITE_API_BASE;

function App() {
    const [username, setUsername] = useState("Akimobill1");
    const [password, setPassword] = useState("lGpQEm194");
    //const [username, setUsername] = useState("");
    //const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { userInfo, setUserInfo } = useContext(AuthContext);

    // 'administrar-bases' | 'campanias' | 'management-levels' | 'users' | 'settings'
    const [adminPage, setAdminPage] = useState("administrar-bases");
    const [selectedAgentCampaign, setSelectedAgentCampaign] = useState({
        campaignId: "",
        tick: 0,
    });
    const [agentPage, setAgentPage] = useState("inicio");
    const [selectedAgentStatus, setSelectedAgentStatus] =
        useState("disponible");

    // ✅ Validar token al cargar la página
    useEffect(() => {
        const validateToken = async () => {
            const token = localStorage.getItem("access_token");
            if (!token) return;

            try {
                const meResp = await fetch(`${API_BASE}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!meResp.ok) {
                    throw new Error("Token inválido");
                }

                const meJson = await meResp.json();

                // ℹ️ Si username es null, solo advertir pero permitir continuar
                if (!meJson.user.username) {
                    console.warn("⚠️ Username no disponible en sesión actual");
                }

                setSelectedAgentCampaign({ campaignId: "", tick: 0 });
                setAgentPage("inicio");
                setUserInfo(meJson.user);
            } catch (err) {
                console.error("Error validando token:", err);
                localStorage.removeItem("access_token");
                localStorage.removeItem("import_user");
            }
        };

        validateToken();
    }, []);

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

            // pedir datos del usuario
            const meResp = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!meResp.ok) {
                const body = await meResp.json().catch(() => ({}));
                throw new Error(body.error || "Error consultando /auth/me");
            }

            const meJson = await meResp.json();

            // ⚠️ Si no hay username, solo advertir (puede ser null si no se desencriptó)
            if (!meJson.user.username) {
                console.warn("⚠️ Username no disponible en el token");
            }

            setSelectedAgentCampaign({ campaignId: "", tick: 0 });
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
        localStorage.removeItem("access_token");
        localStorage.removeItem("import_user");
        setSelectedAgentCampaign({ campaignId: "", tick: 0 });
        setAgentPage("inicio");
        setSelectedAgentStatus("disponible");
        setUserInfo(null);
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
                onSelectCampaign={(campaignId) => {
                    setAgentPage("gestion");
                    setSelectedAgentCampaign({
                        campaignId,
                        tick: Date.now(),
                    });
                }}
                agentPage={agentPage}
                onChangeAgentPage={(nextPage) => {
                    setAgentPage(nextPage);
                    if (nextPage === "inicio") {
                        setSelectedAgentCampaign({ campaignId: "", tick: 0 });
                    }
                }}
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
                    </>
                )}

                {userInfo.roles?.includes("SUPERVISOR") &&
                    (adminPage === "grabaciones-outbound" ? (
                        <GrabacionesOutboundPage />
                    ) : (
                        <DashboardSupervisor />
                    ))}

                {userInfo.roles?.includes("ASESOR") && (
                    <DashboardAgente
                        user={userInfo}
                        selectedCampaignId={selectedAgentCampaign.campaignId}
                        selectedCampaignTick={selectedAgentCampaign.tick}
                        requestedAgentStatus={selectedAgentStatus}
                        onAgentStatusSync={setSelectedAgentStatus}
                        agentPage={agentPage}
                        onSelectCampaign={(campaignId) => {
                            setAgentPage("gestion");
                            setSelectedAgentCampaign({
                                campaignId,
                                tick: Date.now(),
                            });
                        }}
                        onChangeAgentPage={setAgentPage}
                    />
                )}
            </DashboardLayout>
        );
    }

    // pantalla de login igual que antes…
    return (
        <div
            style={{
                background: "#c0bce4",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100vw", // evita scroll horizontal
                height: "100vh",
            }}
        >
            <form onSubmit={handleLogin}>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Usuario"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Contraseña"
                />
                {error && <p style={{ color: "red" }}>{error}</p>}
                <button type="submit" disabled={loading}>
                    {loading ? "Ingresando..." : "Ingresar"}
                </button>
            </form>
        </div>
    );
}

export default App;
