/**
 * BASE DATA ACCESS OBJECT (DAO)
 *
 * Clase base que proporciona operaciones CRUD comunes.
 * Todos los otros DAOs heredarán de esta clase.
 *
 * BENEFICIOS:
 * ✅ Evita repetición de código
 * ✅ Interfaz consistente
 * ✅ Fácil de mantener y extender
 * ✅ Manejo de errores centralizado
 */

export class BaseDAO {
    /**
     * @param {Object} pool - Pool de conexiones MySQL
     * @param {string} tableName - Nombre de la tabla
     * @param {string} idField - Campo ID de la tabla
     */
    constructor(pool, tableName, idField = "id") {
        this.pool = pool;
        this.tableName = tableName;
        this.idField = idField;
    }

    /**
     * Obtener todos los registros
     * @returns {Promise<Array>} Array de registros
     */
    async getAll() {
        try {
            const [rows] = await this.pool.query(
                `SELECT * FROM ${this.tableName}`,
            );
            return rows;
        } catch (err) {
            console.error(
                `Error obteniendo todos los registros de ${this.tableName}:`,
                err,
            );
            throw err;
        }
    }

    /**
     * Obtener registro por ID
     * @param {any} id - Valor del ID
     * @returns {Promise<Object|null>} Registro o null
     */
    async getById(id) {
        try {
            const [rows] = await this.pool.query(
                `SELECT * FROM ${this.tableName} WHERE ${this.idField} = ?`,
                [id],
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (err) {
            console.error(
                `Error obteniendo registro por ID en ${this.tableName}:`,
                err,
            );
            throw err;
        }
    }

    /**
     * Obtener registros por condición
     * @param {string} whereClause - Cláusula WHERE
     * @param {Array} params - Parámetros para la query
     * @returns {Promise<Array>} Array de registros
     */
    async getWhere(whereClause, params = []) {
        try {
            const [rows] = await this.pool.query(
                `SELECT * FROM ${this.tableName} WHERE ${whereClause}`,
                params,
            );
            return rows;
        } catch (err) {
            console.error(`Error en getWhere para ${this.tableName}:`, err);
            throw err;
        }
    }

    /**
     * Contar registros
     * @param {string} whereClause - Cláusula WHERE (opcional)
     * @param {Array} params - Parámetros para la query
     * @returns {Promise<number>} Total de registros
     */
    async count(whereClause = "", params = []) {
        try {
            let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
            if (whereClause) {
                query += ` WHERE ${whereClause}`;
            }
            const [rows] = await this.pool.query(query, params);
            return rows[0].total;
        } catch (err) {
            console.error(
                `Error contando registros en ${this.tableName}:`,
                err,
            );
            throw err;
        }
    }

    /**
     * Crear nuevo registro
     * @param {Object} data - Datos del registro {campo: valor}
     * @returns {Promise<Object>} Registro creado con insertId
     */
    async create(data) {
        try {
            const fields = Object.keys(data);
            const values = Object.values(data);
            const placeholders = fields.map(() => "?").join(", ");

            const query = `
                INSERT INTO ${this.tableName} (${fields.join(", ")})
                VALUES (${placeholders})
            `;

            const [result] = await this.pool.query(query, values);
            return { ...data, [this.idField]: result.insertId };
        } catch (err) {
            console.error(`Error creando registro en ${this.tableName}:`, err);
            throw err;
        }
    }

    /**
     * Actualizar registro
     * @param {any} id - ID del registro
     * @param {Object} data - Datos a actualizar
     * @returns {Promise<Object>} Resultado de la actualización
     */
    async update(id, data) {
        try {
            const fields = Object.keys(data);
            const values = Object.values(data);
            const setClause = fields.map((f) => `${f} = ?`).join(", ");

            const query = `
                UPDATE ${this.tableName}
                SET ${setClause}
                WHERE ${this.idField} = ?
            `;

            const [result] = await this.pool.query(query, [...values, id]);
            return { affectedRows: result.affectedRows };
        } catch (err) {
            console.error(
                `Error actualizando registro en ${this.tableName}:`,
                err,
            );
            throw err;
        }
    }

    /**
     * Eliminar registro
     * @param {any} id - ID del registro
     * @returns {Promise<Object>} Resultado de la eliminación
     */
    async delete(id) {
        try {
            const [result] = await this.pool.query(
                `DELETE FROM ${this.tableName} WHERE ${this.idField} = ?`,
                [id],
            );
            return { affectedRows: result.affectedRows };
        } catch (err) {
            console.error(
                `Error eliminando registro en ${this.tableName}:`,
                err,
            );
            throw err;
        }
    }

    /**
     * Obtener registros con paginación
     * @param {number} page - Número de página (1-indexed)
     * @param {number} limit - Registros por página
     * @param {string} orderBy - Campo para ordenar
     * @param {string} direction - ASC o DESC
     * @returns {Promise<Object>} {data, total, page, limit, pages}
     */
    async paginate(
        page = 1,
        limit = 20,
        orderBy = this.idField,
        direction = "ASC",
    ) {
        try {
            const offset = (page - 1) * limit;
            const [rows] = await this.pool.query(
                `SELECT * FROM ${this.tableName} 
                 ORDER BY ${orderBy} ${direction}
                 LIMIT ? OFFSET ?`,
                [limit, offset],
            );
            const total = await this.count();
            const pages = Math.ceil(total / limit);

            return {
                data: rows,
                total,
                page,
                limit,
                pages,
            };
        } catch (err) {
            console.error(`Error en paginación de ${this.tableName}:`, err);
            throw err;
        }
    }

    /**
     * Ejecutar query personalizada
     * @param {string} query - Query SQL
     * @param {Array} params - Parámetros
     * @returns {Promise<Array>} Resultados
     */
    async executeRaw(query, params = []) {
        try {
            const [rows] = await this.pool.query(query, params);
            return rows;
        } catch (err) {
            console.error(
                `Error ejecutando query personalizada en ${this.tableName}:`,
                err,
            );
            throw err;
        }
    }

    /**
     * Ejecutar múltiples queries en una transacción
     * @param {Function} callback - Función que ejecuta las queries
     * @returns {Promise<any>} Resultado del callback
     */
    async transaction(callback) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (err) {
            await connection.rollback();
            console.error(`Error en transacción de ${this.tableName}:`, err);
            throw err;
        } finally {
            connection.release();
        }
    }
}

export default BaseDAO;
