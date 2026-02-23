// src/routes/agente.routes.js
import express from "express";
import pool from "../services/db.js"; // conexión a Postgres
import { requireAuth } from "../middleware/auth.middleware.js";
import { loadUserRoles, requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

// Estados operativos válidos del agente
const ESTADOS_OPERATIVOS = [
    "disponible",
    "baño",
    "consulta",
    "lunch",
    "reunion",
];

/**
 * Middleware: verifica que el agente NO esté bloqueado
 */
async function requireNotBlocked(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Usuario no autenticado" });
        }

        const result = await pool.query(
            `SELECT bloqueado
       FROM user_profiles
       WHERE id = $1`,
            [userId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const bloqueado = result.rows[0].bloqueado;

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
    requireRole(["AGENTE", "SUPERVISOR", "ADMINISTRADOR"]),
    requireNotBlocked,
];

/* ============================================================================
   1. RESUMEN DEL DÍA (persistente, desde agente_gestiones_log)
============================================================================ */
router.get("/resumen-hoy", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteId = req.user.id;

        const hoy = new Date();
        const inicio = new Date(
            hoy.getFullYear(),
            hoy.getMonth(),
            hoy.getDate(),
        );
        const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000); // +1 día

        const result = await pool.query(
            `SELECT estado_final
             FROM agente_gestiones_log
             WHERE agente_id = $1
               AND created_at >= $2
               AND created_at < $3`,
            [agenteId, inicio.toISOString(), fin.toISOString()],
        );

        const gestiones = result.rows;

        const total_gestionados = gestiones.length;
        const total_citas = gestiones.filter(
            (g) => g.estado_final === "ub_exito_agendo_cita",
        ).length;
        const total_rellamadas = gestiones.filter(
            (g) => g.estado_final === "re_llamada",
        ).length;

        return res.json({
            resumen: {
                total_gestionados,
                total_citas,
                total_rellamadas,
            },
        });
    } catch (err) {
        console.error("Error en /agente/resumen-hoy:", err);
        return res.status(500).json({ error: "Error en resumen del día" });
    }
});

/* ============================================================================
   2. TOMAR SIGUIENTE REGISTRO (auto-asignación)
============================================================================ */
router.post("/siguiente", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteId = req.user.id;
        const estadosElegibles = ["pendiente", "re_llamada", "sin_contacto"];

        // Buscar siguiente registro
        const result = await pool.query(
            `SELECT id, base_id, nombre_completo, placa, telefono1, telefono2, modelo, intentos_totales, pool, estado
       FROM base_registros
       WHERE pool = $1
         AND estado = ANY($2)
         AND (intentos_totales IS NULL OR intentos_totales < 6)
       ORDER BY intentos_totales ASC NULLS FIRST
       LIMIT 1`,
            ["activo", estadosElegibles],
        );

        const registros = result.rows;
        if (registros.length === 0) {
            return res
                .status(404)
                .json({ error: "No hay registros disponibles en tu cola" });
        }

        const reg = registros[0];
        const nuevosIntentos = (reg.intentos_totales || 0) + 1;

        // Actualizar registro a "en_gestion"
        const updResult = await pool.query(
            `UPDATE base_registros
       SET estado = $1,
           agente_id = $2,
           updated_at = $3,
           intentos_totales = $4
       WHERE id = $5
       RETURNING *`,
            [
                "en_gestion",
                agenteId,
                new Date().toISOString(),
                nuevosIntentos,
                reg.id,
            ],
        );

        if (updResult.rowCount === 0) {
            return res
                .status(500)
                .json({ error: "Error tomando el registro para gestión" });
        }

        // Obtener nombre de la base
        const baseResult = await pool.query(
            `SELECT name FROM bases WHERE id = $1`,
            [reg.base_id],
        );
        const baseInfo = baseResult.rows[0];

        return res.json({
            registro: {
                ...reg,
                base_nombre: baseInfo ? baseInfo.name : "Base desconocida",
                intentos_totales: nuevosIntentos,
            },
        });
    } catch (err) {
        console.error("Error en /agente/siguiente:", err);
        return res
            .status(500)
            .json({ error: "Error tomando siguiente registro" });
    }
});

/* ============================================================================
   3. GUARDAR GESTIÓN + CREAR CITA (si aplica) + LOG DE GESTIONES
============================================================================ */
router.post("/guardar-gestion", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteId = req.user.id;
        const {
            registro_id,
            estado_final,
            fecha_cita,
            agencia_cita,
            comentarios,
        } = req.body;

        if (!registro_id || !estado_final) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        // 1) Leer registro
        const regResult = await pool.query(
            `SELECT id, base_id, nombre_completo, placa, intentos_totales, telefono1, telefono2
       FROM base_registros
       WHERE id = $1`,
            [registro_id],
        );
        const reg = regResult.rows[0];
        if (!reg) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }

        const ahora = new Date().toISOString();

        // 2) Actualizar estado del registro
        await pool.query(
            `UPDATE base_registros
       SET estado = $1,
           agente_id = $2,
           updated_at = $3
       WHERE id = $4`,
            [estado_final, agenteId, ahora, registro_id],
        );

        // 3) Insertar cita si aplica
        if (estado_final === "ub_exito_agendo_cita" && fecha_cita) {
            const fechaISO = new Date(fecha_cita).toISOString();
            await pool.query(
                `INSERT INTO citas
         (base_registro_id, base_id, agente_id, fecha_cita, agencia_cita, estado_cita, comentarios, nombre_cliente, placa)
         VALUES ($1,$2,$3,$4,$5,'programada',$6,$7,$8)`,
                [
                    registro_id,
                    reg.base_id,
                    agenteId,
                    fechaISO,
                    agencia_cita || null,
                    comentarios || null,
                    reg.nombre_completo || null,
                    reg.placa || null,
                ],
            );
        }

        // 4) Insertar gestión en tabla gestiones
        const telefonoContacto = reg.telefono1 || reg.telefono2 || null;
        await pool.query(
            `INSERT INTO gestiones
       (base_id, base_registro_id, agente_id, telefono_contacto, intento_n, comentario, estado_gestion, sub_estatus)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                reg.base_id,
                registro_id,
                agenteId,
                telefonoContacto,
                reg.intentos_totales || 1,
                comentarios || null,
                estado_final,
                null,
            ],
        );

        // 5) Insertar log de gestión
        await pool.query(
            `INSERT INTO agente_gestiones_log
       (agente_id, base_registro_id, estado_final, created_at)
       VALUES ($1,$2,$3,$4)`,
            [agenteId, registro_id, estado_final, ahora],
        );

        // 6) Resumen del día
        const hoy = new Date();
        const inicio = new Date(
            hoy.getFullYear(),
            hoy.getMonth(),
            hoy.getDate(),
        );
        const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

        const resumenResult = await pool.query(
            `SELECT estado_final
       FROM agente_gestiones_log
       WHERE agente_id = $1
         AND created_at >= $2
         AND created_at < $3`,
            [agenteId, inicio.toISOString(), fin.toISOString()],
        );

        const gestionesHoy = resumenResult.rows;
        const total_gestionados = gestionesHoy.length;
        const total_citas = gestionesHoy.filter(
            (g) => g.estado_final === "ub_exito_agendo_cita",
        ).length;
        const total_rellamadas = gestionesHoy.filter(
            (g) => g.estado_final === "re_llamada",
        ).length;

        return res.json({
            message: "Gestión guardada",
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
        const agenteId = req.user.id;
        const { estado, registro_id } = req.body;

        if (!estado || !ESTADOS_OPERATIVOS.includes(estado)) {
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
                `UPDATE base_registros
         SET estado = 'pendiente'
         WHERE id = $1 AND estado = 'en_gestion'`,
                [registro_id],
            );
        }

        // Actualizar estado operativo del agente
        const updResult = await pool.query(
            `UPDATE user_profiles
       SET estado_operativo = $1
       WHERE id = $2`,
            [estado, agenteId],
        );

        if (updResult.rowCount === 0) {
            return res
                .status(500)
                .json({ error: "No se pudo actualizar el estado del agente" });
        }

        // Insertar log de cambio de estado
        await pool.query(
            `INSERT INTO agente_estados_log (agente_id, estado, created_at)
       VALUES ($1, $2, $3)`,
            [agenteId, estado, new Date().toISOString()],
        );

        return res.json({ estado });
    } catch (err) {
        console.error("Error en /agente/estado:", err);
        return res
            .status(500)
            .json({ error: "Error cambiando estado del agente" });
    }
});

/* ============================================================================
   5. LISTADO DE CITAS DEL AGENTE (para calendario)
============================================================================ */
router.get("/citas", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteId = req.user.id;

        const result = await pool.query(
            `SELECT id, fecha_cita, estado_cita, nombre_cliente, placa, agencia_cita
       FROM citas
       WHERE agente_id = $1
       ORDER BY fecha_cita ASC`,
            [agenteId],
        );

        const citas = result.rows;

        return res.json({ citas });
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
        const { registro_id } = req.body || {};

        // Si hay un registro en gestión, lo liberamos
        if (registro_id) {
            await pool.query(
                `UPDATE base_registros
         SET estado = 'pendiente'
         WHERE id = $1 AND estado = 'en_gestion'`,
                [registro_id],
            );
        }

        // Marcar al agente como bloqueado
        const updResult = await pool.query(
            `UPDATE user_profiles
       SET bloqueado = true
       WHERE id = $1`,
            [userId],
        );

        if (updResult.rowCount === 0) {
            return res
                .status(500)
                .json({ error: "No se pudo bloquear al usuario" });
        }

        // Registrar log de bloqueo
        await pool.query(
            `INSERT INTO agente_estados_log (agente_id, estado, created_at)
       VALUES ($1, $2, $3)`,
            [userId, "bloqueado", new Date().toISOString()],
        );

        return res.json({ message: "Usuario bloqueado por inactividad" });
    } catch (err) {
        console.error("Error en /agente/bloquearme:", err);
        return res.status(500).json({ error: "Error bloqueando usuario" });
    }
});

/* ============================================================================
   7. LIMPIAR REGISTROS COLGADOS (ADMIN)
      Todos los base_registros en 'en_gestion' más antiguos que X minutos
      se devuelven a 'pendiente'.
============================================================================ */
router.post(
    "/limpiar-colgados",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMIN"]),
    async (req, res) => {
        try {
            const LIMITE_MINUTOS = 30; // puedes cambiarlo si quieres
            const ahora = Date.now();
            const limite = new Date(
                ahora - LIMITE_MINUTOS * 60 * 1000,
            ).toISOString();

            // Buscar registros en_gestion viejos
            const selResult = await pool.query(
                `SELECT id
         FROM base_registros
         WHERE estado = 'en_gestion'
           AND updated_at < $1`,
                [limite],
            );

            const colgados = selResult.rows;
            if (colgados.length === 0) {
                return res.json({
                    message: "No hay registros colgados para limpiar.",
                    count: 0,
                });
            }

            const ids = colgados.map((r) => r.id);

            // Actualizar registros colgados a pendiente
            await pool.query(
                `UPDATE base_registros
         SET estado = 'pendiente',
             agente_id = NULL,
             updated_at = $1
         WHERE id = ANY($2::uuid[])`,
                [new Date().toISOString(), ids],
            );

            return res.json({
                message: "Registros colgados limpiados correctamente",
                count: ids.length,
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
