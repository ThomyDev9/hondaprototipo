import express from "express";
import { getOutboundMenuTree } from "../services/menu.service.js";

const router = express.Router();

router.get("/outbound", async (req, res) => {
    try {
        const tree = await getOutboundMenuTree();
        res.json(tree);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener el menú outbound" });
    }
});

export default router;
