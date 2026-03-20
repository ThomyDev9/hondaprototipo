const API_BASE = import.meta.env.VITE_API_BASE;

// Servicio genérico para obtener tipos de campaña para cualquier Outbound
export async function fetchTiposCampaniaOutbound(nombreCampania) {
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(
        `${API_BASE}/agente/tipos-campania?cliente=${encodeURIComponent(nombreCampania)}`,
        {
            headers: {
                Authorization: token ? `Bearer ${token}` : "",
            },
        },
    );
    const json = await res.json();
    // El backend devuelve un array de strings (nombres de tipo de campaña)
    return Array.isArray(json.data) ? json.data : [];
}
