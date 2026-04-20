// backend/src/routes/admin.routes.js
import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import AdminManagementDAO from "../../services/dao/AdminManagementDAO.js";
import { DEFAULT_MENU_CATEGORY_ID } from "../../services/menu.service.js";
import {
    createManagementLevel,
    createManagementLevelsBulk,
    createManagementLevelsFromPairs,
    normalizeManagementPayload,
    resolveManagementActor,
    updateManagementLevel,
} from "../../services/adminManagement.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const adminManagementDAO = new AdminManagementDAO(pool);

const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

const middlewaresAdminStrict = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
];

function getFlexibleCategoryCodeRange(categoryName = "") {
    const normalized = String(categoryName || "").trim().toLowerCase();
    if (normalized.includes("inbound")) {
        return { minCode: 1000, maxCode: 1999 };
    }
    if (normalized.includes("redes")) {
        return { minCode: 2000, maxCode: 2099 };
    }
    return null;
}

router.get("/users", ...middlewaresAdmin, async (_req, res) => {
    try {
        const users = await userService.obtenerUsuarios();
        return res.json({ users });
    } catch (err) {
        console.error("Error en /admin/users:", err);
        return res.status(500).json({
            error: "Error inesperado en /admin/users",
        });
    }
});

router.get(
    "/management-levels/suggestions",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const data = await adminManagementDAO.getManagementLevelSuggestions();
            const categoryId = String(
                req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const categoryName =
                await adminManagementDAO.getCategoryNameById(categoryId);
            const flexibleRange = getFlexibleCategoryCodeRange(categoryName);

            let descriptions = [];
            let nextCode = null;
            if (flexibleRange) {
                descriptions =
                    await adminManagementDAO.getFlexibleDescriptionSuggestions(
                        flexibleRange.minCode,
                        flexibleRange.maxCode,
                    );
                nextCode = await adminManagementDAO.getNextCodeInRange(
                    flexibleRange.minCode,
                    flexibleRange.maxCode,
                );
            }

            return res.json({
                data: {
                    ...data,
                    descriptions,
                    nextCode,
                },
            });
        } catch (err) {
            console.error(
                "Error GET /admin/management-levels/suggestions:",
                err,
            );
            return res.status(500).json({
                error: "Error obteniendo sugerencias de niveles",
            });
        }
    },
);

router.get(
    "/management-levels/campaigns",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const categoryId = String(
                req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const rows =
                await adminManagementDAO.getManagementLevelCampaigns(categoryId);

            return res.json({
                data: rows.map((row) => ({
                    id: row.campaign_id,
                    label: `${row.parent_name} > ${row.campaign_id}`,
                })),
            });
        } catch (err) {
            console.error("Error GET /admin/management-levels/campaigns:", err);
            return res.status(500).json({
                error: "Error obteniendo campanas para niveles de gestion",
            });
        }
    },
);

router.get(
    "/management-levels",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const categoryId = String(
                req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const campaignId = String(req.query?.campaignId || "").trim();
            const state = String(req.query?.state || "1").trim();

            if (!campaignId) {
                return res
                    .status(400)
                    .json({ error: "campaignId es requerido" });
            }

            const rows = await adminManagementDAO.getManagementLevels(
                campaignId,
                state,
            );

            return res.json({ data: rows });
        } catch (err) {
            console.error("Error GET /admin/management-levels:", err);
            return res.status(500).json({
                error: "Error obteniendo niveles de gestion",
            });
        }
    },
);

router.post(
    "/management-levels",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const result = await createManagementLevel(adminManagementDAO, {
                ...normalizeManagementPayload(req.body),
                actor: resolveManagementActor(req.user),
            });

            return res.status(201).json({
                message: "Nivel de gestion creado correctamente",
                data: { id: result.insertId },
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({ error: err.message });
            }

            console.error("Error POST /admin/management-levels:", err);
            return res.status(500).json({
                error: "Error creando nivel de gestion",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/management-levels/bulk",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const result = await createManagementLevelsBulk(adminManagementDAO, {
                ...normalizeManagementPayload(req.body),
                actor: resolveManagementActor(req.user),
                level2List: req.body?.level2List,
            });

            return res.status(201).json({
                message: `Niveles creados: ${result.createdCount}. Omitidos por duplicado: ${result.skippedCount}`,
                data: result,
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({ error: err.message });
            }

            console.error("Error POST /admin/management-levels/bulk:", err);
            return res.status(500).json({
                error: "Error creando niveles de gestion en bloque",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/management-levels/bulk-pairs",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const categoryId = String(
                req.body?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const campaignId = String(req.body?.campaignId || "").trim();
            const code = Number(req.body?.code || 0);
            const description = String(req.body?.description || "").trim();
            const isgoal = Number(req.body?.isgoal || 1) === 1 ? 1 : 0;
            const state = Number(req.body?.state || 1) === 0 ? "0" : "1";
            const actor = resolveManagementActor(req.user);
            const items = Array.isArray(req.body?.items) ? req.body.items : [];

            if (!campaignId) {
                return res.status(400).json({
                    error: "campaignId es requerido",
                });
            }

            if (items.length === 0) {
                return res.status(400).json({
                    error: "Debes enviar al menos un par Level1/Level2",
                });
            }

            const result = await createManagementLevelsFromPairs(
                adminManagementDAO,
                {
                    categoryId,
                    campaignId,
                    code,
                    description,
                    isgoal,
                    state,
                    actor,
                    items,
                },
            );

            return res.status(201).json({
                message: `Niveles creados: ${result.createdCount}`,
                data: result,
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({
                    error: err.message,
                    data: err.payload,
                });
            }

            console.error(
                "Error POST /admin/management-levels/bulk-pairs:",
                err,
            );
            return res.status(500).json({
                error: "Error creando niveles por pares",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.put(
    "/management-levels/:id",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            await updateManagementLevel(adminManagementDAO, {
                id: Number(req.params?.id || 0),
                ...normalizeManagementPayload(req.body),
                actor: resolveManagementActor(req.user),
            });

            return res.json({
                message: "Nivel de gestion actualizado correctamente",
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({ error: err.message });
            }

            console.error("Error PUT /admin/management-levels/:id:", err);
            return res.status(500).json({
                error: "Error actualizando nivel de gestion",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

export default router;
