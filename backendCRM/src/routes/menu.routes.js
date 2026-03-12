import express from "express";
import {
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
