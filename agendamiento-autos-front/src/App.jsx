import { useState } from "react";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardAdmin from "./pages/DashboardAdmin";
import DashboardSupervisor from "./pages/DashboardSupervisor";
import DashboardAgente from "./pages/DashboardAgente";
import CargarBases from "./pages/CargarBases";
import ListadoBases from "./pages/ListadoBases";
import UsuariosAdmin from "./pages/UsuariosAdmin";

const API_BASE = import.meta.env.VITE_API_BASE;

function App() {
    const [email, setEmail] = useState("admin@citas.com");
    const [password, setPassword] = useState("admin");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [userInfo, setUserInfo] = useState(null);

    // 'cargar-bases' | 'listado-bases' | 'users' | 'settings'
    const [adminPage, setAdminPage] = useState("cargar-bases");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const resp = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                throw new Error(body.error || "Error en login");
            }

            const json = await resp.json();
            const accessToken = json.token;
            localStorage.setItem("access_token", accessToken);

            // pedir datos del usuario
            const meResp = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!meResp.ok) {
                const body = await meResp.json().catch(() => ({}));
                throw new Error(body.error || "Error consultando /auth/me");
            }

            const meJson = await meResp.json();
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
                {userInfo.roles?.includes("ADMIN") && (
                    <>
                        {adminPage === "cargar-bases" && <CargarBases />}
                        {adminPage === "listado-bases" && <DashboardAdmin />}
                        {adminPage === "users" && <UsuariosAdmin />}
                    </>
                )}

                {userInfo.roles?.includes("SUPERVISOR") && (
                    <DashboardSupervisor />
                )}

                {userInfo.roles?.includes("AGENTE") && (
                    <DashboardAgente user={userInfo} />
                )}
            </DashboardLayout>
        );
    }

    // pantalla de login igual que antes…
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
