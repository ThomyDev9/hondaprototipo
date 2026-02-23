// backend/src/routes/admin.dashboard.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

const adminMiddlewares = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

/**
 * GET /admin/dashboard/bases
 * Devuelve resumen por base desde la vista vw_admin_resumen_bases
 */
router.get("/dashboard/bases", ...adminMiddlewares, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM vw_admin_resumen_bases ORDER BY base ASC`,
        );
        console.log("Datos de vw_admin_resumen_bases:");
        rows.forEach((row, idx) => {
            console.log(`Fila ${idx + 1}:`, row);
        });
        return res.json({ bases: rows });
    } catch (err) {
        console.error("Error en /admin/dashboard/bases:", err);
        return res
            .status(500)
            .json({ error: "Error interno en dashboard bases" });
    }
});

/**
 * GET /admin/dashboard/agentes
 * Devuelve resumen por agente desde la vista vw_admin_resumen_agentes
 */
router.get("/dashboard/agentes", ...adminMiddlewares, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM vw_admin_resumen_agentes ORDER BY full_name ASC`,
        );
        return res.json({ agentes: rows });
    } catch (err) {
        console.error("Error en /admin/dashboard/agentes:", err);
        return res
            .status(500)
            .json({ error: "Error interno en dashboard agentes" });
    }
});

/**
 * GET /admin/parametros/pausa-max
 * Lee el parámetro PAUSA_MAX_MIN_DIA
 */
router.get("/parametros/pausa-max", ...adminMiddlewares, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT valor_num FROM admin_parametros WHERE codigo = ? LIMIT 1`,
            ["PAUSA_MAX_MIN_DIA"],
        );

        const valor = rows.length > 0 ? rows[0].valor_num : 30;
        return res.json({ pausaMaxMinDia: valor });
    } catch (err) {
        console.error("Error en /admin/parametros/pausa-max:", err);
        return res
            .status(500)
            .json({ error: "Error interno leyendo parámetro" });
    }
});

/**
 * PUT /admin/parametros/pausa-max
 * Actualiza el parámetro PAUSA_MAX_MIN_DIA
 */
router.put("/parametros/pausa-max", ...adminMiddlewares, async (req, res) => {
    try {
        const { valor } = req.body;

        if (valor === undefined || Number.isNaN(Number(valor))) {
            return res
                .status(400)
                .json({ error: 'Debe enviar un número en el campo "valor"' });
        }

        await pool.query(
            `INSERT INTO admin_parametros (codigo, descripcion, valor_num, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE valor_num = VALUES(valor_num), updated_at = NOW()`,
            [
                "PAUSA_MAX_MIN_DIA",
                "Minutos máximos de pausa (baño / consulta / lunch / reunión) permitidos por día",
                Number(valor),
            ],
        );

        return res.json({ pausaMaxMinDia: Number(valor) });
    } catch (err) {
        console.error("Error en PUT /admin/parametros/pausa-max:", err);
        return res
            .status(500)
            .json({ error: "Error interno actualizando parámetro" });
    }
});

export default router;
