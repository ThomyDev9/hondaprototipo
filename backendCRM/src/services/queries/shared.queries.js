/**
 * SHARED QUERIES
 *
 * Sentencias SQL reutilizables en múltiples módulos.
 * Funciones y patrones comunes para todas las entidades.
 */

const sharedQueries = {
    // ============= PATRONES COMUNES =============

    /**
     * Obtener total de registros de cualquier tabla
     * Uso: SELECT -> {table: 'user', conditions: 'WHERE State = 1'}
     */
    countAll: (table) => `SELECT COUNT(*) as total FROM ${table}`,

    countWhere: (table, whereClause) => `
        SELECT COUNT(*) as total FROM ${table} WHERE ${whereClause}
    `,

    // ============= BÚSQUEDA Y FILTRADO =============

    /**
     * Buscar en múltiples campos
     * Uso: Implementar en cada servicio según sus campos
     */
    buildSearchQuery: (table, fields, searchTerm) => {
        const conditions = fields
            .map((f) => `${f} LIKE '%${searchTerm}%'`)
            .join(" OR ");
        return `SELECT * FROM ${table} WHERE ${conditions}`;
    },

    /**
     * Obtener registros con paginación (patrón estándar)
     */
    getPaginatedQuery: (table, page = 1, limit = 20) => {
        const offset = (page - 1) * limit;
        return {
            data: `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`,
            count: `SELECT COUNT(*) as total FROM ${table}`,
        };
    },

    /**
     * Obtener registros ordenados
     */
    getSortedQuery: (table, orderBy = "id", direction = "ASC") => `
        SELECT * FROM ${table}
        ORDER BY ${orderBy} ${direction}
    `,

    // ============= VALIDACIÓN =============

    /**
     * Verificar si un registro existe por su ID
     * Uso: Para cada tabla con su campo ID
     */
    checkExists: (table, idField, idValue) => `
        SELECT COUNT(*) as existe FROM ${table}
        WHERE ${idField} = ?
        LIMIT 1
    `,

    /**
     * Verificar si un registro existe por un campo específico
     */
    checkExistsByField: (table, field, value) => `
        SELECT COUNT(*) as existe FROM ${table}
        WHERE ${field} = ?
        LIMIT 1
    `,

    // ============= ESTADÍSTICAS =============

    /**
     * Obtener distribución de estados de una tabla
     */
    getStateDistribution: (table, stateField = "Estado") => `
        SELECT 
            ${stateField},
            COUNT(*) as cantidad
        FROM ${table}
        GROUP BY ${stateField}
    `,

    /**
     * Obtener registros creados en rango de fechas
     */
    getByDateRange: (table, fromDate, toDate, dateField = "createdAt") => `
        SELECT * FROM ${table}
        WHERE ${dateField} BETWEEN ? AND ?
        ORDER BY ${dateField} DESC
    `,

    /**
     * Obtener registros recientes (últimos X días)
     */
    getRecent: (table, days = 30, dateField = "createdAt") => `
        SELECT * FROM ${table}
        WHERE ${dateField} >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
        ORDER BY ${dateField} DESC
    `,

    /**
     * Obtener última actualización
     */
    getLastUpdate: (table, dateField = "updatedAt") => `
        SELECT MAX(${dateField}) as lastUpdate FROM ${table}
    `,

    // ============= ESTADÍSTICAS AVANZADAS =============

    /**
     * Obtener correlación entre entidades
     * Ej: usuarios por grupo, bases por mapeo, etc.
     */
    getRelationshipStats: (
        childTable,
        parentTable,
        childField,
        parentField,
    ) => `
        SELECT 
            p.${parentField},
            COUNT(c.${childField}) as cantidad
        FROM ${parentTable} p
        LEFT JOIN ${childTable} c ON c.${childField} = p.${parentField}
        GROUP BY p.${parentField}
        ORDER BY cantidad DESC
    `,

    /**
     * Obtener registros sin relación (huérfanos)
     */
    getOrphans: (childTable, parentTable, childField, parentField) => `
        SELECT c.* FROM ${childTable} c
        LEFT JOIN ${parentTable} p ON p.${parentField} = c.${childField}
        WHERE p.${parentField} IS NULL
    `,

    // ============= HERRAMIENTAS PARA MANTENIMIENTO =============

    /**
     * Obtener registros duplicados
     */
    getDuplicates: (table, field) => `
        SELECT ${field}, COUNT(*) as duplicates
        FROM ${table}
        GROUP BY ${field}
        HAVING COUNT(*) > 1
    `,

    /**
     * Obtener registros NULL en campo específico
     */
    getNullRecords: (table, field) => `
        SELECT * FROM ${table}
        WHERE ${field} IS NULL
    `,

    /**
     * Dar formato a fechas (ejemplo para MySQL)
     */
    formatDate: (field, format = "%Y-%m-%d") => `
        DATE_FORMAT(${field}, '${format}')
    `,

    // ============= HELPERS =============

    /**
     * Query para obtener información de la tabla misma
     */
    getTableInfo: (table) => `
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_KEY,
            DEFAULT,
            EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()
    `,

    /**
     * Query para obtener indexes de una tabla
     */
    getTableIndexes: (table) => `
        SHOW INDEX FROM ${table}
    `,
};

export default sharedQueries;
