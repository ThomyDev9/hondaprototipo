/**
 * CAMPAIGN SERVICE - Frontend
 * Servicio para obtener datos de campañas desde el backend
 */

const API_BASE = import.meta.env.VITE_API_BASE;

/**
 * Obtener todas las campañas distintas
 * @returns {Promise<Array>} Array de campañas con formato {value, label}
 */
export async function obtenerCampanas() {
    try {
        const response = await fetch(`${API_BASE}/campaigns`);
        if (!response.ok) {
            throw new Error("Error obteniendo campañas");
        }
        const json = await response.json();
        // Transformar datos para que tengan value y label
        const transformed = (json.data || []).map((item) => ({
            value: item.CampaignId,
            label: item.CampaignId,
        }));
        return transformed;
    } catch (err) {
        console.error("Error en obtenerCampanas:", err);
        throw err;
    }
}

/**
 * Buscar campañas por término
 * @param {string} searchTerm
 * @returns {Promise<Array>} Array de campañas filtradas con formato {value, label}
 */
export async function buscarCampanas(searchTerm) {
    try {
        const params = new URLSearchParams({ q: searchTerm });
        const response = await fetch(`${API_BASE}/campaigns/search?${params}`);
        if (!response.ok) {
            throw new Error("Error buscando campañas");
        }
        const json = await response.json();
        // Transformar datos para que tengan value y label
        const transformed = (json.data || []).map((item) => ({
            value: item.CampaignId,
            label: item.CampaignId,
        }));
        return transformed;
    } catch (err) {
        console.error("Error en buscarCampanas:", err);
        throw err;
    }
}

export default {
    obtenerCampanas,
    buscarCampanas,
};
