import express from "express";
import pool from "../../services/db.js";
import AdminScriptsDAO from "../../services/dao/AdminScriptsDAO.js";
import { DEFAULT_MENU_CATEGORY_ID } from "../../services/menu.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const adminScriptsDAO = new AdminScriptsDAO(pool);

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

router.get("/subcampaigns", ...middlewaresAdmin, async (req, res) => {
    try {
        const categoryId = String(
            req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
        ).trim();
        const rows = await adminScriptsDAO.getActiveSubcampaignRows(categoryId);

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

        const row = await adminScriptsDAO.getSubcampaignScript(menuItemId);
        if (!row) {
            return res.json({ data: null });
        }
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
        const categoryId = String(
            req.body?.categoryId || DEFAULT_MENU_CATEGORY_ID,
        ).trim();
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

        const isValidSubcampaign =
            await adminScriptsDAO.isValidSubcampaign(menuItemId, categoryId);
        if (!isValidSubcampaign) {
            return res.status(400).json({
                error: "La subcampaña seleccionada no es válida",
            });
        }

        await adminScriptsDAO.upsertSubcampaignScript(
            menuItemId,
            JSON.stringify(script),
            updatedBy,
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
