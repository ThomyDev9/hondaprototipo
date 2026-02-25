// src/routes/admin.bases.routes.js
import express from "express";
import pool from "../../services/db.js";

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
// Recicla contactos de campaña en cck_dev.
router.post(
    "/bases/:baseId/reciclar",
    ...adminMiddlewares,
    async (req, res) => {
        try {
            const { baseId } = req.params;
            const MAX_INTENTOS = 6; // regla de negocio: hasta 6 intentos
            const campaignId = baseId;

            if (!campaignId) {
                return res.status(400).json({ error: "Falta baseId" });
            }

            const [result] = await pool.query(
                `
                    UPDATE contactimportcontact
                    SET LastAgent = 'Pendiente',
                        Action = 're_llamada',
                        UserShift = ?,
                        TmStmpShift = NOW()
                    WHERE Campaign = ?
                      AND COALESCE(Number, 0) < ?
                      AND Action IN ('re_llamada', 'sin_contacto', 'numero_incorrecto', 'inubicable')
                    `,
                [
                    req.user?.username || String(req.user?.id),
                    campaignId,
                    MAX_INTENTOS,
                ],
            );

            return res.json({
                ok: true,
                base_id: campaignId,
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
