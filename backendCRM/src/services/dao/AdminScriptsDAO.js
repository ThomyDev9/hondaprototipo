import pool from "../db.js";

export class AdminScriptsDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async getActiveSubcampaignRows(executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT
                s.id,
                s.nombre_item AS subcampania,
                p.nombre_item AS campania
            FROM menu_items s
            INNER JOIN menu_items p ON p.id = s.id_padre
            WHERE s.id_padre IS NOT NULL
              AND s.estado = 'activo'
              AND p.estado = 'activo'
            ORDER BY p.nombre_item ASC, s.nombre_item ASC
            `,
        );
        return rows;
    }

    async getSubcampaignScript(menuItemId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT
                scs.menu_item_id,
                scs.script_json,
                scs.updated_by,
                scs.updated_at,
                mi.nombre_item AS subcampania,
                p.nombre_item AS campania
            FROM sub_campaign_scripts scs
            INNER JOIN menu_items mi ON mi.id = scs.menu_item_id
            LEFT JOIN menu_items p ON p.id = mi.id_padre
            WHERE scs.menu_item_id = ?
            LIMIT 1
            `,
            [menuItemId],
        );
        return rows[0] || null;
    }

    async isValidSubcampaign(menuItemId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT id
            FROM menu_items
            WHERE id = ?
              AND id_padre IS NOT NULL
            LIMIT 1
            `,
            [menuItemId],
        );
        return rows.length > 0;
    }

    async upsertSubcampaignScript(
        menuItemId,
        scriptJson,
        updatedBy,
        executor = this.pool,
    ) {
        return executor.query(
            `
            INSERT INTO sub_campaign_scripts (
                menu_item_id,
                script_json,
                updated_by
            )
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                script_json = ?,
                updated_by = ?,
                updated_at = CURRENT_TIMESTAMP
            `,
            [menuItemId, scriptJson, updatedBy, scriptJson, updatedBy],
        );
    }
}

export default AdminScriptsDAO;
