import express from "express";
import pool from "../../services/db.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
];

function parseScriptJson(rawValue) {
    if (!rawValue) return null;
    if (typeof rawValue === "object") return rawValue;

    try {
        return JSON.parse(rawValue);
    } catch {
        return null;
    }
}

function isValidScriptObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

router.get("/subcampaigns", ...middlewaresAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(
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

        return res.json({
            data: rows.map((row) => ({
                id: row.id,
                label: `${row.campania} > ${row.subcampania}`,
                campania: row.campania,
                subcampania: row.subcampania,
            })),
        });
    } catch (error) {
        console.error("Error GET /admin/scripts/subcampaigns:", error);
        return res.status(500).json({
            error: "Error cargando subcampañas para scripts",
        });
    }
});

router.get("/:menuItemId", ...middlewaresAdmin, async (req, res) => {
    try {
        const menuItemId = String(req.params?.menuItemId || "").trim();
        if (!menuItemId) {
            return res.status(400).json({ error: "menuItemId es requerido" });
        }

        const [rows] = await pool.query(
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

        if (rows.length === 0) {
            return res.json({ data: null });
        }

        const row = rows[0];
        return res.json({
            data: {
                menuItemId: row.menu_item_id,
                campaignName: row.campania || "",
                subcampaignName: row.subcampania || "",
                script: parseScriptJson(row.script_json),
                updatedBy: row.updated_by || "",
                updatedAt: row.updated_at || null,
            },
        });
    } catch (error) {
        console.error("Error GET /admin/scripts/:menuItemId:", error);
        return res.status(500).json({ error: "Error cargando script" });
    }
});

router.post("/:menuItemId", ...middlewaresAdmin, async (req, res) => {
    try {
        const menuItemId = String(req.params?.menuItemId || "").trim();
        const script = req.body?.script;
        const updatedBy =
            req.user?.username ||
            req.user?.email ||
            String(req.user?.id || "admin");

        if (!menuItemId) {
            return res.status(400).json({ error: "menuItemId es requerido" });
        }

        if (!isValidScriptObject(script)) {
            return res.status(400).json({
                error: "El script debe ser un objeto JSON válido",
            });
        }

        const [menuRows] = await pool.query(
            `
            SELECT id
            FROM menu_items
            WHERE id = ?
              AND id_padre IS NOT NULL
            LIMIT 1
            `,
            [menuItemId],
        );

        if (menuRows.length === 0) {
            return res.status(400).json({
                error: "La subcampaña seleccionada no es válida",
            });
        }

        await pool.query(
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
            [
                menuItemId,
                JSON.stringify(script),
                updatedBy,
                JSON.stringify(script),
                updatedBy,
            ],
        );

        return res.status(201).json({
            success: true,
            message: "Script guardado correctamente",
        });
    } catch (error) {
        console.error("Error POST /admin/scripts/:menuItemId:", error);
        return res.status(500).json({
            error: "Error guardando script",
            detail: error?.sqlMessage || error?.message || "",
        });
    }
});

export default router;
