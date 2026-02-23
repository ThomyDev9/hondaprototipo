import pool from "./db.js";
import campaignQueries from "./queries/campaign.queries.js";

/**
 * CAMPAIGN SERVICE
 * Maneja operaciones relacionadas con campañas
 * Usa queries centralizadas de campaign.queries.js
 */

/**
 * Obtener campañas distintas
 * @returns {Promise<Array>} Array de objetos con campo: CampaignId
 */
export async function obtenerCampanasDistintas() {
    try {
        const [rows] = await pool.query(campaignQueries.getDistinct);
        return rows;
    } catch (err) {
        console.error("Error obteniendo campañas distintas:", err);
        throw err;
    }
}

/**
 * Buscar campañas por filtro de texto (búsqueda parcial)
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Promise<Array>} Array de campañas que coinciden
 */
export async function buscarCampanas(searchTerm) {
    try {
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await pool.query(campaignQueries.search, [
            searchPattern,
        ]);
        return rows;
    } catch (err) {
        console.error("Error buscando campañas:", err);
        throw err;
    }
}

/**
 * Obtener campañas activas/vigentes
 */
export async function obtenerCampanasActivas() {
    try {
        const [rows] = await pool.query(campaignQueries.getActive);
        return rows;
    } catch (err) {
        console.error("Error obteniendo campañas activas:", err);
        throw err;
    }
}

/**
 * Validar que una campaña existe
 */
export async function validarCampania(id) {
    try {
        const [rows] = await pool.query(campaignQueries.validate, [id]);
        return rows.length > 0;
    } catch (err) {
        console.error("Error validando campaña:", err);
        throw err;
    }
}

export default {
    obtenerCampanasDistintas,
    buscarCampanas,
    obtenerCampanasActivas,
    validarCampania,
};
