import express from "express";
import {
    obtenerCampanasDistintas,
    buscarCampanas,
} from "../../services/campaign.service.js";

const router = express.Router();

/**
 * GET /campaigns
 * Obtener todas las campañas distintas
 */
router.get("/", async (req, res) => {
    try {
        const campanas = await obtenerCampanasDistintas();
        return res.json({ data: campanas });
    } catch (err) {
        console.error("Error en GET /campaigns:", err);
        return res.status(500).json({ error: "Error obteniendo campañas" });
    }
});

/**
 * GET /campaigns/search?q=searchTerm
 * Buscar campañas por término de búsqueda
 */
router.get("/search", async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === "") {
            // Si no hay búsqueda, retornar todas
            const campanas = await obtenerCampanasDistintas();
            return res.json({ data: campanas });
        }

        const campanas = await buscarCampanas(q);
        return res.json({ data: campanas });
    } catch (err) {
        console.error("Error en GET /campaigns/search:", err);
        return res.status(500).json({ error: "Error buscando campañas" });
    }
});

export default router;
