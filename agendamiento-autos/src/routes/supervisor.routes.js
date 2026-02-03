import express from "express";
import pool from "../services/db.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { loadUserRoles, requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(loadUserRoles);
router.use(requireRole(["SUPERVISOR"]));

// Dashboard supervisor: métricas globales
router.get("/dashboard", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        COUNT(*) AS total_agentes,
        COUNT(*) FILTER (WHERE bloqueado = true) AS agentes_bloqueados,
        COUNT(*) FILTER (WHERE exceso_pausa = true) AS agentes_con_exceso,
        MAX(minutos_pausa_hoy) AS pausa_max
      FROM vw_admin_resumen_agentes
    `);

        const row = result.rows[0];
        res.json({
            totalAgentes: parseInt(row.total_agentes, 10),
            agentesBloqueados: parseInt(row.agentes_bloqueados, 10),
            agentesConExceso: parseInt(row.agentes_con_exceso, 10),
            pausaMax: parseInt(row.pausa_max, 10),
        });
    } catch (err) {
        console.error("Error en dashboard supervisor:", err);
        res.status(500).json({
            error: "Error interno en dashboard supervisor",
        });
    }
});

// Listado de agentes supervisados
router.get("/agentes", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT agente_id AS id,
             full_name AS nombre,
             CASE 
               WHEN bloqueado = true THEN 'Bloqueado'
               WHEN estado_operativo = 'activo' THEN 'Activo'
               ELSE 'Inactivo'
             END AS estado,
             minutos_pausa_hoy AS minutosPausa,
             exceso_pausa
      FROM vw_admin_resumen_agentes
      ORDER BY nombre ASC
    `);

        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener agentes:", err);
        res.status(500).json({ error: "Error al obtener agentes" });
    }
});

export default router;
