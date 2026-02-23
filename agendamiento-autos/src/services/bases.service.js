import pool from "./db.js";
import basesQueries from "./queries/bases.queries.js";

/**
 * BASES SERVICE
 * Centraliza lógica de negocio para bases de datos
 * Usa sistema de queries centralizado
 */

export async function obtenerBases() {
    try {
        const [rows] = await pool.query(basesQueries.getAll);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases:", error);
        throw error;
    }
}

export async function obtenerBasePorId(id) {
    try {
        const [rows] = await pool.query(basesQueries.getById, [id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error al obtener base por ID:", error);
        throw error;
    }
}

export async function obtenerBasesPorMapeo(mapeoId) {
    try {
        const [rows] = await pool.query(basesQueries.getByMappeo, [mapeoId]);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases por mapeo:", error);
        throw error;
    }
}

export async function obtenerBasesPorCampania(campania) {
    try {
        const [rows] = await pool.query(basesQueries.getByCampania, [campania]);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases por campaña:", error);
        throw error;
    }
}

export async function buscarBases(searchTerm) {
    try {
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await pool.query(basesQueries.search, [
            searchPattern,
            searchPattern,
        ]);
        return rows;
    } catch (error) {
        console.error("Error al buscar bases:", error);
        throw error;
    }
}

export async function crearBase(baseData) {
    try {
        const { nombre, mapeo, campania, estado = 1 } = baseData;

        const [result] = await pool.query(basesQueries.create, [
            nombre,
            mapeo,
            campania,
            estado,
        ]);

        return {
            id: result.insertId,
            nombre,
            mapeo,
            campania,
            estado,
        };
    } catch (error) {
        console.error("Error al crear base:", error);
        throw error;
    }
}

export async function actualizarBase(id, baseData) {
    try {
        const { nombre, mapeo, campania, estado } = baseData;

        await pool.query(basesQueries.update, [
            nombre,
            mapeo,
            campania,
            estado,
            id,
        ]);

        return await obtenerBasePorId(id);
    } catch (error) {
        console.error("Error al actualizar base:", error);
        throw error;
    }
}

export async function cambiarEstadoBase(id) {
    try {
        await pool.query(basesQueries.updateState, [id]);
        return await obtenerBasePorId(id);
    } catch (error) {
        console.error("Error al cambiar estado de la base:", error);
        throw error;
    }
}

export async function contarBases() {
    try {
        const [rows] = await pool.query(basesQueries.count);
        return rows[0].total || 0;
    } catch (error) {
        console.error("Error al contar bases:", error);
        throw error;
    }
}

export async function obtenerBasesActivas() {
    try {
        const [rows] = await pool.query(basesQueries.getActive);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases activas:", error);
        throw error;
    }
}

export async function obtenerResumenBases() {
    try {
        const [rows] = await pool.query(basesQueries.getSummary);
        return rows;
    } catch (error) {
        console.error("Error al obtener resumen de bases:", error);
        throw error;
    }
}
