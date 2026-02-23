/**
 * MAPPING SERVICE - Frontend
 * Servicio para obtener datos de mappeos desde el backend
 */

const API_BASE = import.meta.env.VITE_API_BASE;

/**
 * Obtener todos los mappeos activos
 * @returns {Promise<Array>} Array de mappeos
 */
export async function obtenerMapeos() {
    try {
        const response = await fetch(`${API_BASE}/mapping`);
        if (!response.ok) {
            throw new Error("Error obteniendo mappeos");
        }
        const json = await response.json();
        return json.data || [];
    } catch (err) {
        console.error("Error en obtenerMapeos:", err);
        throw err;
    }
}

/**
 * Obtener un mappeo específico
 * @param {number} id
 * @returns {Promise<Object>} Objeto mappeo
 */
export async function obtenerMapeo(id) {
    try {
        const response = await fetch(`${API_BASE}/mapping/${id}`);
        if (!response.ok) {
            throw new Error("Mappeo no encontrado");
        }
        const json = await response.json();
        return json.data;
    } catch (err) {
        console.error("Error en obtenerMapeo:", err);
        throw err;
    }
}

export default {
    obtenerMapeos,
    obtenerMapeo,
};
