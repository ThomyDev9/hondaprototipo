import pool from "./db.js";
import mappingQueries from "./queries/mapping.queries.js";

/**
 * MAPPING SERVICE
 * Maneja operaciones relacionadas con mappeos
 * Usa queries centralizadas de mapping.queries.js
 */

/**
 * Obtener todos los mappeos activos
 * @returns {Promise<Array>} Array de mappeos con campos: ID, descripcion, Estado
 */
export async function obtenerMapaeosActivos() {
    try {
        const [rows] = await pool.query(mappingQueries.getActive);
        return rows;
    } catch (err) {
        console.error("Error obteniendo mappeos activos:", err);
        throw err;
    }
}

/**
 * Obtener un mappeo específico por ID
 * @param {number} id - ID del mappeo
 * @returns {Promise<Object>} Objeto mappeo o null si no existe
 */
export async function obtenerMapaeoPorId(id) {
    try {
        const [rows] = await pool.query(mappingQueries.getById, [id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (err) {
        console.error("Error obteniendo mappeo por ID:", err);
        throw err;
    }
}

/**
 * Obtener todos los mappeos
 */
export async function obtenerMapeos() {
    try {
        const [rows] = await pool.query(mappingQueries.getAll);
        return rows;
    } catch (err) {
        console.error("Error obteniendo mappeos:", err);
        throw err;
    }
}

/**
 * Validar que un mappeo existe y está activo
 */
export async function validarMappeoActivo(id) {
    try {
        const [rows] = await pool.query(mappingQueries.validateActive, [id]);
        return rows.length > 0;
    } catch (err) {
        console.error("Error validando mappeo:", err);
        throw err;
    }
}

export default {
    obtenerMapaeosActivos,
    obtenerMapaeoPorId,
    obtenerMapeos,
    validarMappeoActivo,
};
