// Utilidad para obtener las bases activas de una campaña
export async function fetchBasesActivasPorCampania(campaignId) {
    const API_BASE = import.meta.env.VITE_API_BASE;
    const token = localStorage.getItem("access_token") || "";
    const resp = await fetch(`${API_BASE}/agente/bases-activas-resumen`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    if (!json.data) return [];
    return json.data.filter((b) => b.campaignId === campaignId);
}
