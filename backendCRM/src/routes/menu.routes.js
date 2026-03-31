import express from "express";
import {
    DEFAULT_MENU_CATEGORY_ID,
    getMenuCategories,
    getMenuTree,
    getMenuTreeDetailed,
    getParentCampaigns,
    createCampaign,
    createSubcampaign,
    getMenuTreeWithStatus,
    updateMenuItemStatus,
    getOutboundMenuTree,
    getOutboundParentCampaigns,
    createOutboundCampaign,
    createOutboundSubcampaign,
    getOutboundMenuTreeWithStatus,
    updateOutboundMenuItemStatus,
} from "../services/menu.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/categories", requireAuth, async (_req, res) => {
    try {
        const rows = await getMenuCategories();
        res.json({ data: rows });
    } catch (err) {
        console.error("Error en GET /api/menu/categories:", err);
        res.status(500).json({ error: "Error al obtener categorias" });
    }
});

router.get("/categories/:categoryId/tree", async (req, res) => {
    try {
        const categoryId = String(req.params?.categoryId || "").trim();
        const tree = await getMenuTree(categoryId || DEFAULT_MENU_CATEGORY_ID);
        res.json(tree);
    } catch (err) {
        console.error("Error en GET /api/menu/categories/:categoryId/tree:", err);
        res.status(500).json({ error: "Error al obtener el menu de campanas" });
    }
});

router.get("/categories/:categoryId/tree-detailed", requireAuth, async (req, res) => {
    try {
        const categoryId = String(req.params?.categoryId || "").trim();
        const tree = await getMenuTreeDetailed(
            categoryId || DEFAULT_MENU_CATEGORY_ID,
        );
        res.json({ data: tree });
    } catch (err) {
        console.error(
            "Error en GET /api/menu/categories/:categoryId/tree-detailed:",
            err,
        );
        res.status(500).json({ error: "Error al obtener el menu detallado" });
    }
});

router.get("/categories/:categoryId/parents", requireAuth, async (req, res) => {
    try {
        const categoryId = String(req.params?.categoryId || "").trim();
        const rows = await getParentCampaigns(
            categoryId || DEFAULT_MENU_CATEGORY_ID,
        );
        res.json({ data: rows });
    } catch (err) {
        console.error(
            "Error en GET /api/menu/categories/:categoryId/parents:",
            err,
        );
        res.status(500).json({ error: "Error al obtener campanas padre" });
    }
});

router.post(
    "/categories/:categoryId/campaigns",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const categoryId = String(req.params?.categoryId || "").trim();
            const { nombre } = req.body;
            const result = await createCampaign(
                categoryId || DEFAULT_MENU_CATEGORY_ID,
                nombre,
            );
            res.status(201).json({
                success: true,
                message: "Campana creada correctamente",
                data: result,
            });
        } catch (err) {
            res.status(400).json({
                error: err.message || "Error creando campana",
            });
        }
    },
);

router.post(
    "/categories/:categoryId/subcampaigns",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const categoryId = String(req.params?.categoryId || "").trim();
            const { parentId, nombre } = req.body;
            const result = await createSubcampaign(
                categoryId || DEFAULT_MENU_CATEGORY_ID,
                parentId,
                nombre,
            );
            res.status(201).json({
                success: true,
                message: "Subcampana creada correctamente",
                data: result,
            });
        } catch (err) {
            res.status(400).json({
                error: err.message || "Error creando subcampana",
            });
        }
    },
);

router.get(
    "/categories/:categoryId/admin-tree",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const categoryId = String(req.params?.categoryId || "").trim();
            const tree = await getMenuTreeWithStatus(
                categoryId || DEFAULT_MENU_CATEGORY_ID,
            );
            res.json({ data: tree });
        } catch (err) {
            console.error(
                "Error en GET /api/menu/categories/:categoryId/admin-tree:",
                err,
            );
            res.status(500).json({ error: "Error obteniendo campanas" });
        }
    },
);

router.patch(
    "/categories/:categoryId/items/:id/status",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const categoryId = String(req.params?.categoryId || "").trim();
            const { id } = req.params;
            const { estado } = req.body;
            const data = await updateMenuItemStatus(
                categoryId || DEFAULT_MENU_CATEGORY_ID,
                id,
                estado,
            );
            res.json({
                success: true,
                message: "Estado actualizado correctamente",
                data,
            });
        } catch (err) {
            res.status(400).json({
                error: err.message || "Error actualizando estado",
            });
        }
    },
);

router.get("/outbound", async (req, res) => {
    try {
        const tree = await getOutboundMenuTree();
        res.json(tree);
    } catch (err) {
        console.error("Error en GET /api/menu/outbound:", err);
        res.status(500).json({ error: "Error al obtener el menú outbound" });
    }
});

router.get("/outbound/parents", requireAuth, async (req, res) => {
    try {
        const rows = await getOutboundParentCampaigns();
        res.json({ data: rows });
    } catch (err) {
        console.error("Error en GET /api/menu/outbound/parents:", err);
        res.status(500).json({ error: "Error al obtener campañas padre" });
    }
});

router.post(
    "/outbound/campaigns",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { nombre } = req.body;
            const result = await createOutboundCampaign(nombre);
            res.status(201).json({
                success: true,
                message: "Campaña creada correctamente",
                data: result,
            });
        } catch (err) {
            res.status(400).json({
                error: err.message || "Error creando campaña",
            });
        }
    },
);

router.post(
    "/outbound/subcampaigns",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { parentId, nombre } = req.body;
            const result = await createOutboundSubcampaign(parentId, nombre);
            res.status(201).json({
                success: true,
                message: "Subcampaña creada correctamente",
                data: result,
            });
        } catch (err) {
            res.status(400).json({
                error: err.message || "Error creando subcampaña",
            });
        }
    },
);

router.get(
    "/outbound/admin-tree",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const tree = await getOutboundMenuTreeWithStatus();
            res.json({ data: tree });
        } catch (err) {
            console.error("Error en GET /api/menu/outbound/admin-tree:", err);
            res.status(500).json({ error: "Error obteniendo campañas" });
        }
    },
);

router.patch(
    "/outbound/items/:id/status",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { estado } = req.body;
            const data = await updateOutboundMenuItemStatus(id, estado);
            res.json({
                success: true,
                message: "Estado actualizado correctamente",
                data,
            });
        } catch (err) {
            res.status(400).json({
                error: err.message || "Error actualizando estado",
            });
        }
    },
);

export default router;
