// Servicio para obtener tipos de campaña para Out Maquita Cushunchic
const API_BASE = import.meta.env.VITE_API_BASE;

export async function fetchTiposCampaniaOutMaquita() {
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(
        `${API_BASE}/agente/tipos-campania?cliente=Out%20Maquita%20Cushunchic`,
        {
            headers: {
                Authorization: token ? `Bearer ${token}` : "",
            },
        },
    );
    const json = await res.json();
    // Espera que el backend devuelva un array de objetos con campo TipoCampania
    return Array.isArray(json.data) ? json.data : [];
}

// Servicio para obtener tipos de campaña para Out Honda
export async function fetchTiposCampaniaOutHonda() {
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(
        `${API_BASE}/agente/tipos-campania?cliente=Out%20Honda`,
        {
            headers: {
                Authorization: token ? `Bearer ${token}` : "",
            },
        },
    );
    const json = await res.json();
    // Espera que el backend devuelva un array de objetos con campo TipoCampania
    return Array.isArray(json.data) ? json.data : [];
}
