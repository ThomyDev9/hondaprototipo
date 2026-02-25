// src/routes/agente.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import { agenteQueries } from "../../services/queries/index.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

// Estados operativos válidos del agente
const ESTADOS_OPERATIVOS = new Set([
    "disponible",
    "baño",
    "consulta",
    "lunch",
    "reunion",
]);

/**
 * Middleware: verifica que el agente NO esté bloqueado
 */
async function requireNotBlocked(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Usuario no autenticado" });
        }

        const [rows] = await pool.query(agenteQueries.getUserStateByIdUser, [
            userId,
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const userState = String(rows[0].State || "").toUpperCase();
        const bloqueado =
            userState === "0" ||
            userState === "BLOQUEADO" ||
            userState === "INACTIVO";

        if (bloqueado) {
            return res.status(403).json({
                error: "Usuario bloqueado por inactividad. Comunícate con un administrador.",
            });
        }

        return next();
    } catch (err) {
        console.error("Error en requireNotBlocked:", err);
        return res
            .status(500)
            .json({ error: "Error verificando estado del agente" });
    }
}

// Middlewares comunes para todas las rutas del agente
const agenteMiddlewares = [
    requireAuth,
    loadUserRoles,
    requireRole(["ASESOR", "SUPERVISOR", "ADMINISTRADOR"]),
    requireNotBlocked,
];

function getAgentActor(req) {
    return req.user?.username || req.user?.email || String(req.user?.id);
}

/* ============================================================================
   1. TOMAR SIGUIENTE REGISTRO (auto-asignación)
============================================================================ */
router.post("/siguiente", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);
        const campaignFromBody = req.body?.campaignId;

        if (!campaignFromBody) {
            return res.status(400).json({
                error: "Debes seleccionar una campaña para tomar registros",
            });
        }

        let registroTomado = null;

        const [latestImportRows] = await pool.query(
            agenteQueries.getActiveImportByCampaign,
            [campaignFromBody],
        );

        let latestImportId = latestImportRows[0]?.ImportId || null;

        if (!latestImportId) {
            const [fallbackImportRows] = await pool.query(
                agenteQueries.getLatestImportWithPendingByCampaign,
                [campaignFromBody],
            );

            latestImportId = fallbackImportRows[0]?.ImportId || null;

            if (!latestImportId) {
                return res.status(404).json({
                    error: "No hay registros pendientes para esta campaña",
                });
            }

            await pool.query(agenteQueries.upsertCampaignActiveBase, [
                campaignFromBody,
                latestImportId,
                agenteActor,
            ]);
        }

        for (let intento = 0; intento < 5; intento++) {
            const [candidatos] = await pool.query(
                agenteQueries.getNextCandidateByCampaignAndImport,
                [campaignFromBody, latestImportId],
            );

            if (candidatos.length === 0) {
                break;
            }

            const candidato = candidatos[0];
            const assignAction = candidato.LastManagementResult
                ? "Reciclar Base"
                : "Asignar Base";

            const [updResult] = await pool.query(
                agenteQueries.takeCandidateForAgent,
                [
                    agenteActor,
                    assignAction,
                    agenteActor,
                    candidato.Id,
                    candidato.Campaign,
                ],
            );

            if (updResult.affectedRows > 0) {
                registroTomado = {
                    id: candidato.Id,
                    nombre_completo: candidato.Name,
                    placa: null,
                    telefono1: null,
                    telefono2: null,
                    modelo: null,
                    intentos_totales:
                        Number(candidato.intentos_totales || 0) + 1,
                    base_nombre: candidato.LastUpdate || "Base activa",
                    campaign_id: candidato.Campaign,
                    identification: candidato.Identification || null,
                };
                break;
            }
        }

        if (!registroTomado) {
            return res
                .status(404)
                .json({ error: "No hay registros disponibles en tu cola" });
        }

        const [phones] = await pool.query(agenteQueries.getPhonesByContactId, [
            registroTomado.id,
        ]);

        const numeros = phones
            .map((row) => row.NumeroMarcado)
            .filter(Boolean)
            .slice(0, 2);

        registroTomado.telefono1 = numeros[0] || null;
        registroTomado.telefono2 = numeros[1] || null;

        return res.json({ registro: registroTomado });
    } catch (err) {
        console.error("Error en /agente/siguiente:", err);
        return res
            .status(500)
            .json({ error: "Error tomando siguiente registro" });
    }
});

/* ============================================================================
    3. GUARDAR GESTIÓN (cck_dev)
============================================================================ */
router.post("/guardar-gestion", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);
        const { registro_id, estado_final, fecha_cita, agencia_cita } =
            req.body;

        if (!registro_id || !estado_final) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const [contactRows] = await pool.query(
            `SELECT Id
             FROM contactimportcontact
             WHERE Id = ?
             LIMIT 1`,
            [registro_id],
        );

        if (contactRows.length === 0) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }

        await pool.query(
            `UPDATE contactimportcontact
             SET Action = ?,
                 LastAgent = ?,
                 UserShift = ?,
                 TmStmpShift = NOW()
             WHERE Id = ?`,
            [estado_final, agenteActor, agenteActor, registro_id],
        );

        const citaCreada =
            estado_final === "ub_exito_agendo_cita" &&
            Boolean(fecha_cita) &&
            Boolean(agencia_cita);

        const [rows] = await pool.query(
            `SELECT Action
             FROM contactimportcontact
             WHERE LastAgent = ?
               AND DATE(TmStmpShift) = CURDATE()
               AND Action IS NOT NULL
               AND Action <> ''`,
            [agenteActor],
        );

        const total_gestionados = rows.length;
        const total_citas = rows.filter(
            (g) => g.Action === "ub_exito_agendo_cita",
        ).length;
        const total_rellamadas = rows.filter(
            (g) => g.Action === "re_llamada",
        ).length;

        return res.json({
            message: "Gestión guardada",
            cita_creada: citaCreada,
            resumenHoy: { total_gestionados, total_citas, total_rellamadas },
        });
    } catch (err) {
        console.error("Error en /agente/guardar-gestion:", err);
        return res
            .status(500)
            .json({ error: "Error en /agente/guardar-gestion" });
    }
});

/* ============================================================================
   4. CAMBIO DE ESTADO DEL AGENTE (disponible, baño, lunch, etc.)
============================================================================ */
router.post("/estado", ...agenteMiddlewares, async (req, res) => {
    try {
        const { estado, registro_id } = req.body;
        const agenteActor = getAgentActor(req);

        if (!estado || !ESTADOS_OPERATIVOS.has(estado)) {
            return res
                .status(400)
                .json({ error: "Estado de agente no válido" });
        }

        const esPausa = ["baño", "consulta", "lunch", "reunion"].includes(
            estado,
        );

        // Si el agente estaba gestionando un registro y entra en pausa, liberamos el registro
        if (esPausa && registro_id) {
            await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?
                   AND LastAgent = ?`,
                [agenteActor, registro_id, agenteActor],
            );
        }

        return res.json({ estado });
    } catch (err) {
        console.error("Error en /agente/estado:", err);
        return res
            .status(500)
            .json({ error: "Error cambiando estado del agente" });
    }
});

/* ============================================================================
   5. LISTADO DE CITAS DEL AGENTE (no persistidas en cck_dev)
============================================================================ */
router.get("/citas", ...agenteMiddlewares, async (req, res) => {
    try {
        return res.json({ citas: [] });
    } catch (err) {
        console.error("Error en /agente/citas:", err);
        return res.status(500).json({ error: "Error consultando citas" });
    }
});

/* ============================================================================
   6. Bloquear agente (lo llama el front por inactividad)
      → LIBERA el registro en_gestion si viene registro_id
============================================================================ */
router.post("/bloquearme", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const actor = getAgentActor(req);
        const { registro_id } = req.body || {};

        // Si hay un registro en gestión, lo liberamos
        if (registro_id) {
            await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?
                   AND LastAgent = ?`,
                [actor, registro_id, actor],
            );
        }

        // Marcar al agente como bloqueado
        const [updResult] = await pool.query(
            `UPDATE user
             SET State = '0',
                 UserShift = ?,
                 TmStmpShift = NOW()
             WHERE IdUser = ?`,
            [actor, userId],
        );

        if (updResult.affectedRows === 0) {
            const [fallbackUpdate] = await pool.query(
                `UPDATE user
                 SET State = '0',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?`,
                [actor, actor],
            );

            if (fallbackUpdate.affectedRows === 0) {
                return res
                    .status(500)
                    .json({ error: "No se pudo bloquear al usuario" });
            }
        }

        return res.json({ message: "Usuario bloqueado por inactividad" });
    } catch (err) {
        console.error("Error en /agente/bloquearme:", err);
        return res.status(500).json({ error: "Error bloqueando usuario" });
    }
});

/* ============================================================================
   7. LIMPIAR REGISTROS COLGADOS (ADMIN)
    Todos los contactos asignados más antiguos que X minutos
    se devuelven a 'Pendiente'.
============================================================================ */
router.post(
    "/limpiar-colgados",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const LIMITE_MINUTOS = 30;

            const [result] = await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = 'system',
                     TmStmpShift = NOW()
                 WHERE LastAgent IS NOT NULL
                   AND LastAgent <> ''
                   AND LastAgent <> 'Pendiente'
                   AND TmStmpShift IS NOT NULL
                   AND TmStmpShift < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
                [LIMITE_MINUTOS],
            );

            return res.json({
                message: "Registros colgados limpiados correctamente",
                count: result.affectedRows || 0,
            });
        } catch (err) {
            console.error("Error en /agente/limpiar-colgados:", err);
            return res
                .status(500)
                .json({ error: "Error limpiando registros colgados" });
        }
    },
);

export default router;
