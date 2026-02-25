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
 * Devuelve resumen por campaña/base usando tablas de cck_dev
 */
router.get("/dashboard/bases", ...adminMiddlewares, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT
                    c.Campaign AS base_id,
                    COALESCE(cab.ImportId, MAX(c.LastUpdate)) AS base,
                    CONCAT('Campaña: ', c.Campaign) AS description,
                    COUNT(*) AS registros,
                    SUM(
                        CASE
                            WHEN COALESCE(c.LastAgent, '') IN ('', 'Pendiente')
                             AND (c.Action IS NULL OR c.Action = '' OR c.Action IN ('Asignar Base', 'Reciclar Base'))
                            THEN 1 ELSE 0
                        END
                    ) AS sin_gestionar,
                    SUM(CASE WHEN c.Action = 'ub_exito_agendo_cita' THEN 1 ELSE 0 END) AS citas,
                    SUM(CASE WHEN c.Action = 'no_desea' THEN 1 ELSE 0 END) AS no_desea,
                    SUM(CASE WHEN c.Action = 're_llamada' THEN 1 ELSE 0 END) AS rellamadas,
                    SUM(CASE WHEN c.Action IN ('re_gestionable', 'sin_contacto', 'numero_incorrecto') THEN 1 ELSE 0 END) AS re_gestionables,
                    SUM(CASE WHEN c.Action = 'inubicable' THEN 1 ELSE 0 END) AS inubicables
                FROM contactimportcontact c
                LEFT JOIN campaign_active_base cab
                    ON cab.CampaignId = c.Campaign
                   AND UPPER(cab.State) IN ('1', 'ACTIVO', 'ACTIVE', 'A')
                WHERE c.Campaign IS NOT NULL
                  AND c.Campaign <> ''
                GROUP BY c.Campaign, cab.ImportId
                ORDER BY c.Campaign ASC
            `,
        );

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
 * Devuelve resumen por agente usando tablas reales
 */
router.get("/dashboard/agentes", ...adminMiddlewares, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT
                    u.IdUser AS agente_id,
                    TRIM(CONCAT_WS(' ', u.Name1, u.Name2, u.Surname1, u.Surname2)) AS full_name,
                    u.Email AS email,
                    LOWER(
                        CASE
                            WHEN UPPER(COALESCE(u.LastResult, '')) IN ('DISPONIBLE', 'BAÑO', 'CONSULTA', 'LUNCH', 'REUNION')
                                THEN u.LastResult
                            ELSE 'disponible'
                        END
                    ) AS estado_operativo,
                    CASE
                        WHEN UPPER(COALESCE(u.State, '')) IN ('0', 'BLOQUEADO', 'INACTIVO') THEN 1
                        ELSE 0
                    END AS bloqueado,
                    COALESCE(g.registros_gestionados_hoy, 0) AS registros_gestionados_hoy,
                    COALESCE(g.citas_agendadas_hoy, 0) AS citas_agendadas_hoy,
                    0 AS minutos_pausa_hoy,
                    0 AS exceso_pausa
                FROM user u
                LEFT JOIN workgroup w ON w.Id = u.UserGroup
                LEFT JOIN (
                    SELECT
                        LastAgent,
                        COUNT(*) AS registros_gestionados_hoy,
                        SUM(CASE WHEN Action = 'ub_exito_agendo_cita' THEN 1 ELSE 0 END) AS citas_agendadas_hoy
                    FROM contactimportcontact
                    WHERE DATE(TmStmpShift) = CURDATE()
                      AND LastAgent IS NOT NULL
                      AND LastAgent <> ''
                      AND LastAgent <> 'Pendiente'
                    GROUP BY LastAgent
                ) g ON g.LastAgent = u.Email OR g.LastAgent = CAST(u.IdUser AS CHAR)
                WHERE UPPER(COALESCE(w.Description, '')) LIKE '%ASESOR%'
                   OR UPPER(COALESCE(w.Description, '')) LIKE '%AGENTE%'
                ORDER BY full_name ASC
            `,
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
