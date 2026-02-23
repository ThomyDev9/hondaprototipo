// src/routes/admin.bases.routes.js
import express from "express";
import pool from "../../services/db.js";
import * as basesService from "../../services/bases.service.js";

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

// POST /admin/bases/:baseId/reciclar
// Recicla registros de una base que aún no superan el máximo de intentos.
router.post(
    "/bases/:baseId/reciclar",
    ...adminMiddlewares,
    async (req, res) => {
        try {
            const { baseId } = req.params;
            const MAX_INTENTOS = 6; // regla de negocio: hasta 6 intentos

            if (!baseId) {
                return res.status(400).json({ error: "Falta baseId" });
            }

            // Estados que consideramos reciclables
            // (no tocamos 'ub_exito_agendo_cita' ni 'no_desea')
            const ESTADOS_RECICLABLES = [
                "rellamada",
                "regestionable",
                "inubicable",
                "en_gestion", // por si quedó algo atrapado
                "sin_contacto",
                "numero_incorrecto", // si lo sigues usando
            ];

            const [result] = await pool.query(
                `
                    UPDATE base_registros
                    SET estado = 'pendiente',
                        pool = 'activo',
                        agente_id = NULL,
                        intentos_totales = 0
                    WHERE base_id = ?
                        AND estado IN (?, ?, ?, ?, ?, ?)
                        AND intentos_totales < ?
                    `,
                [
                    baseId,
                    "rellamada",
                    "regestionable",
                    "inubicable",
                    "en_gestion",
                    "sin_contacto",
                    "numero_incorrecto",
                    MAX_INTENTOS,
                ],
            );

            return res.json({
                ok: true,
                base_id: baseId,
                registros_reciclados: result.affectedRows,
            });
        } catch (err) {
            console.error("Error en /admin/bases/:baseId/reciclar:", err);
            return res
                .status(500)
                .json({ error: "Error en /admin/bases/:baseId/reciclar" });
        }
    },
);

export default router;
