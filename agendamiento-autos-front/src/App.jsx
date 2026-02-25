import { useState, useEffect } from "react";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardAdmin from "./pages/admin/DashboardAdmin";
import DashboardSupervisor from "./pages/supervisor/DashboardSupervisor";
import DashboardAgente from "./pages/agente/DashboardAgente";
import AdministrarBases from "./pages/admin/AdministrarBases";
import UsuariosAdmin from "./pages/admin/UsuariosAdmin";

const API_BASE = import.meta.env.VITE_API_BASE;

function App() {
    const [username, setUsername] = useState("Akimobill1");
    const [password, setPassword] = useState("lGpQEm194");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [userInfo, setUserInfo] = useState(null);

    // 'administrar-bases' | 'listado-bases' | 'users' | 'settings'
    const [adminPage, setAdminPage] = useState("administrar-bases");

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
        setUserInfo(null);
    };

    if (userInfo) {
        return (
            <DashboardLayout
                user={userInfo}
                onLogout={handleLogout}
                adminPage={adminPage}
                onChangeAdminPage={setAdminPage}
            >
                {userInfo.roles?.includes("ADMINISTRADOR") && (
                    <>
                        {adminPage === "administrar-bases" && (
                            <AdministrarBases />
                        )}
                        {adminPage === "listado-bases" && <DashboardAdmin />}
                        {adminPage === "users" && <UsuariosAdmin />}
                    </>
                )}

                {userInfo.roles?.includes("SUPERVISOR") && (
                    <DashboardSupervisor />
                )}

                {userInfo.roles?.includes("ASESOR") && (
                    <DashboardAgente user={userInfo} />
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
