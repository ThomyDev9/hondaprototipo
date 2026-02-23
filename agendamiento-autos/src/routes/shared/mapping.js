import express from "express";
import {
    obtenerMapaeosActivos,
    obtenerMapaeoPorId,
} from "../../services/mapping.service.js";

const router = express.Router();

/**
 * GET /mapping
 * Obtener todos los mappeos activos
 */
router.get("/", async (req, res) => {
    try {
        const mappeos = await obtenerMapaeosActivos();
        return res.json({ data: mappeos });
    } catch (err) {
        console.error("Error en GET /mapping:", err);
        return res.status(500).json({ error: "Error obteniendo mappeos" });
    }
});

/**
 * GET /mapping/:id
 * Obtener un mappeo específico
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const mappeo = await obtenerMapaeoPorId(id);

        if (!mappeo) {
            return res
                .status(404)
                .json({ error: "Mappeo no encontrado o inactivo" });
        }

        return res.json({ data: mappeo });
    } catch (err) {
        console.error("Error en GET /mapping/:id:", err);
        return res.status(500).json({ error: "Error obteniendo mappeo" });
    }
});

export default router;
