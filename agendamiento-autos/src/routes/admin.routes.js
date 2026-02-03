// backend/src/routes/admin.routes.js
import express from "express";
import pool from "../services/db.js"; // conexión a Postgres
import { requireAuth } from "../middleware/auth.middleware.js";
import { loadUserRoles, requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

/**
 * Función común que llama a la función SQL fn_bases_resumen
 * y devuelve el arreglo de bases resumen.
 */
async function obtenerResumenBases() {
    try {
        // Si fn_bases_resumen es una función SQL que devuelve SETOF registros:
        const result = await pool.query("SELECT * FROM fn_bases_resumen()");
        return result.rows || [];
    } catch (err) {
        console.error("Error ejecutando fn_bases_resumen:", err);
        throw err;
    }
}

// Middlewares compartidos para rutas de admin
const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMIN", "SUPERVISOR"]),
];

/**
 * GET /admin/bases-resumen
 * Resumen de bases para el módulo admin detalle por base
 */
router.get("/bases-resumen", ...middlewaresAdmin, async (req, res) => {
    try {
        const bases = await obtenerResumenBases();
        return res.json({ bases });
    } catch (err) {
        console.error("Error inesperado /admin/bases-resumen:", err);
        return res
            .status(500)
            .json({ error: "Error inesperado en /admin/bases-resumen" });
    }
});

/**
 * GET /bases
 * Alias para el front actual (ListadoBases.jsx)
 */
router.get("/bases", ...middlewaresAdmin, async (req, res) => {
    try {
        const bases = await obtenerResumenBases();
        return res.json({ bases });
    } catch (err) {
        console.error("Error inesperado /bases:", err);
        return res.status(500).json({ error: "Error inesperado en /bases" });
    }
});

export default router;
