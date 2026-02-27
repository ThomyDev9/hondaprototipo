import express from "express";
import { getOutboundMenuTree, getOutboundMenuCategoryName } from "../services/menu.service.js";

const router = express.Router();

router.get("/outbound", async (req, res) => {
    try {
        const tree = await getOutboundMenuTree();
        res.json(tree);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener el menú outbound" });
    }
});

// Nuevo endpoint para obtener el nombre de la categoría outbound
router.get("/outbound-category", async (req, res) => {
    try {
        const name = await getOutboundMenuCategoryName();
        res.json({ name });
    } catch (err) {
        res.status(500).json({ error: "Error al obtener el nombre de la categoría outbound" });
    }
});

export default router;
