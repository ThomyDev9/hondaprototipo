/**
 * MAPPING QUERIES
 *
 * Todas las sentencias SQL relacionadas con mapeos.
 * Organizadas por operación (SELECT, INSERT, UPDATE, DELETE)
 */

const mappingQueries = {
    // ============= SELECT QUERIES =============

    /**
     * Obtener todos los mapeos
     * Usado en: Listado completo
     */
    getAll: `
        SELECT 
            ID,
            descripcion,
            Estado
        FROM mapping
        ORDER BY descripcion ASC
    `,

    /**
     * Obtener mapeos activos
     * Usado en: Seleccionar mapeo al cargar bases
     */
    getActive: `
        SELECT 
            ID,
            descripcion,
            Estado
        FROM mapping
        WHERE Estado = 1
        ORDER BY descripcion ASC
    `,

    /**
     * Obtener mapeo por ID
     * Usado en: Detalles, validaciones
     */
    getById: `
        SELECT 
            ID,
            descripcion,
            Estado
        FROM mapping
        WHERE ID = ?
    `,

    /**
     * Validar que un mapeo existe y está activo
     * Usado en: Validaciones antes de usar
     */
    validateActive: `
        SELECT ID, Estado
        FROM mapping
        WHERE ID = ? AND Estado = 1
        LIMIT 1
    `,

    /**
     * Buscar mapeos por descripción
     * Usado en: Búsqueda
     */
    search: `
        SELECT 
            ID,
            descripcion,
            Estado
        FROM mapping
        WHERE descripcion LIKE ?
        ORDER BY descripcion ASC
    `,

    /**
     * Obtener mapeos con estadísticas
     * Usado en: Dashboard
     */
    getWithStats: `
        SELECT 
            m.ID,
            m.descripcion,
            m.Estado,
            COUNT(b.id) as basesCount
        FROM mapping m
        LEFT JOIN bases b ON b.mapeo = m.ID
        GROUP BY m.ID, m.descripcion, m.Estado
        ORDER BY m.descripcion ASC
    `,

    // ============= INSERT QUERIES =============

    /**
     * Crear nuevo mapeo
     * Usado en: Agregar mapeos (si es permitido)
     */
    create: `
        INSERT INTO mapping (descripcion, Estado, createdAt)
        VALUES (?, 1, NOW())
    `,

    // ============= UPDATE QUERIES =============

    /**
     * Actualizar mapeo
     */
    update: `
        UPDATE mapping
        SET 
            descripcion = ?,
            updatedAt = NOW()
        WHERE ID = ?
    `,

    /**
     * Cambiar estado de mapeo
     */
    updateState: `
        UPDATE mapping
        SET 
            Estado = ?,
            updatedAt = NOW()
        WHERE ID = ?
    `,

    // ============= DELETE QUERIES =============

    /**
     * Eliminar mapeo
     * ⚠️ Verificar que no esté en uso antes
     */
    delete: `
        DELETE FROM mapping
        WHERE ID = ? AND Estado = 0
    `,

    /**
     * Obtener mapeos que NO están en uso
     * Usado en: Validar antes de eliminar
     */
    getUnused: `
        SELECT 
            m.ID,
            m.descripcion
        FROM mapping m
        WHERE m.ID NOT IN (
            SELECT DISTINCT mapeo FROM bases WHERE mapeo IS NOT NULL
        )
        AND m.Estado = 0
    `,
};

export default mappingQueries;
