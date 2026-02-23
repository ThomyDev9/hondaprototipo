// backend/src/routes/admin.routes.js
import express from "express";
import pool from "../services/db.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { loadUserRoles, requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

// Middlewares compartidos para rutas de admin
const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

/**
 * GET /admin/bases-resumen
 * Ejemplo adaptado a MySQL
 */
router.get("/bases-resumen", ...middlewaresAdmin, async (req, res) => {
    try {
        // ⚠️ CAMBIA esta consulta por la tabla real que tengas en MySQL
        const [rows] = await pool.query(`
            SELECT 
                id,
                nombre,
                estado
            FROM bases
        `);

        return res.json({ bases: rows });
    } catch (err) {
        console.error("Error en /admin/bases-resumen:", err);
        return res.status(500).json({
            error: "Error inesperado en /admin/bases-resumen",
        });
    }
});

/**
 * GET /admin/users
 * Listado simple de usuarios (MySQL)
 */
router.get("/users", ...middlewaresAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                IdUser,
                Email,
                Name1,
                Name2,
                Surname1,
                Surname2
            FROM user
        `);

        return res.json({ users: rows });
    } catch (err) {
        console.error("Error en /admin/users:", err);
        return res.status(500).json({
            error: "Error inesperado en /admin/users",
        });
    }
});

export default router;
