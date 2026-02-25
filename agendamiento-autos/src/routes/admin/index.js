// backend/src/routes/admin.routes.js
import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

// Middlewares compartidos para rutas de admin
const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

/**
 * GET /admin/bases-resumen
 * Resumen real por campaña/base desde cck_dev
 */
router.get("/bases-resumen", ...middlewaresAdmin, async (req, res) => {
    try {
        const campaignId = String(req.query?.campaignId || "").trim();
        const baseName = String(req.query?.baseName || "").trim();

        const [campaignRows] = await pool.query(`
            SELECT DISTINCT Campaign
            FROM contactimportcontact
            WHERE Campaign IS NOT NULL
              AND Campaign <> ''
            ORDER BY Campaign ASC
        `);
        const campaigns = campaignRows.map((row) => row.Campaign);

        let basesByCampaign = [];
        if (campaignId) {
            const [baseRows] = await pool.query(
                `
                    SELECT DISTINCT LastUpdate
                    FROM contactimportcontact
                    WHERE Campaign = ?
                      AND LastUpdate IS NOT NULL
                      AND LastUpdate <> ''
                    ORDER BY LastUpdate DESC
                `,
                [campaignId],
            );
            basesByCampaign = baseRows.map((row) => row.LastUpdate);
        }

        if (!campaignId && !baseName) {
            return res.json({
                totales: {
                    total_bases: 0,
                    total_registros: 0,
                    total_sin_gestionar: 0,
                    total_con_cita: 0,
                    total_no_desea: 0,
                    total_rel_llamada: 0,
                    total_re_gestionable: 0,
                    total_inubicable: 0,
                },
                bases: [],
                filtros: {
                    campaignId,
                    baseName,
                    campaigns,
                    basesByCampaign,
                },
            });
        }

        let query = `
            SELECT
                c.Campaign AS campaign_id,
                c.LastUpdate AS base,
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
            WHERE c.Campaign IS NOT NULL
              AND c.Campaign <> ''
              AND c.LastUpdate IS NOT NULL
              AND c.LastUpdate <> ''
        `;

        const params = [];
        if (campaignId) {
            query += " AND c.Campaign = ?";
            params.push(campaignId);
        }
        if (baseName) {
            query += " AND c.LastUpdate = ?";
            params.push(baseName);
        }

        query += `
            GROUP BY c.Campaign, c.LastUpdate
            ORDER BY c.Campaign ASC, c.LastUpdate DESC
        `;

        const [basesRaw] = await pool.query(query, params);

        const bases = basesRaw.map((row) => {
            const registros = Number(row.registros || 0);
            const sinGestionar = Number(row.sin_gestionar || 0);
            const avance =
                registros > 0
                    ? (((registros - sinGestionar) * 100) / registros).toFixed(
                          2,
                      )
                    : "0.00";

            return {
                base_id: `${row.campaign_id}::${row.base}`,
                campaign_id: row.campaign_id,
                base: row.base,
                description: row.description,
                registros,
                sin_gestionar: sinGestionar,
                citas: Number(row.citas || 0),
                no_desea: Number(row.no_desea || 0),
                rellamadas: Number(row.rellamadas || 0),
                re_gestionables: Number(row.re_gestionables || 0),
                inubicables: Number(row.inubicables || 0),
                avance,
            };
        });

        const totales = bases.reduce(
            (acc, row) => {
                acc.total_registros += row.registros;
                acc.total_sin_gestionar += row.sin_gestionar;
                acc.total_con_cita += row.citas;
                acc.total_no_desea += row.no_desea;
                acc.total_rel_llamada += row.rellamadas;
                acc.total_re_gestionable += row.re_gestionables;
                acc.total_inubicable += row.inubicables;
                return acc;
            },
            {
                total_bases: bases.length,
                total_registros: 0,
                total_sin_gestionar: 0,
                total_con_cita: 0,
                total_no_desea: 0,
                total_rel_llamada: 0,
                total_re_gestionable: 0,
                total_inubicable: 0,
            },
        );

        return res.json({
            totales,
            bases,
            filtros: {
                campaignId,
                baseName,
                campaigns,
                basesByCampaign,
            },
        });
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
        const users = await userService.obtenerUsuarios();
        return res.json({ users });
    } catch (err) {
        console.error("Error en /admin/users:", err);
        return res.status(500).json({
            error: "Error inesperado en /admin/users",
        });
    }
});

export default router;
