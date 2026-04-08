import recordingSftpRouter from "./recording.sftp.js";
import express from "express";
import pool from "../../services/db.js";
import { getRecordingsByPhone } from "./recordings-linked.controller.js";
import { getInboundRecordings } from "./recordings-inbound.controller.js";
import {
    buildOutboundReportWorkbook,
    listOutboundReportCampaigns,
} from "../../services/supervisorReports.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

async function getAgentStateSummary(connection = pool) {
    const [rows] = await connection.query(`
      SELECT estado, COUNT(*) AS total
      FROM (
        SELECT
          s.Agent,
          COALESCE(NULLIF(TRIM(s.Estado), ''), 'Sin estado') AS estado
        FROM session_estado_log s
        INNER JOIN (
          SELECT Agent, MAX(id) AS max_id
          FROM session_estado_log
          WHERE Agent IS NOT NULL
            AND TRIM(Agent) <> ''
          GROUP BY Agent
        ) latest
          ON latest.Agent = s.Agent
         AND latest.max_id = s.id
      ) estados_actuales
      GROUP BY estado
      ORDER BY total DESC, estado ASC
    `);

    return rows.map((row) => ({
        estado: String(row.estado || "").trim() || "Sin estado",
        total: Number(row.total || 0),
    }));
}

async function getAgentCurrentActivity(connection = pool) {
    const [rows] = await connection.query(`
      SELECT
        latest_state.id,
        latest_state.Agent AS agent,
        latest_state.AgentNumber AS agentNumber,
        COALESCE(NULLIF(TRIM(latest_state.Estado), ''), 'Sin estado') AS estado,
        latest_state.EstadoInicio AS estadoInicio,
        latest_state.EstadoFin AS estadoFin,
        TIMESTAMPDIFF(
          MINUTE,
          latest_state.EstadoInicio,
          COALESCE(latest_state.EstadoFin, NOW())
        ) AS minutosEnEstado
      FROM session_estado_log latest_state
      INNER JOIN (
        SELECT Agent, MAX(id) AS max_id
        FROM session_estado_log
        WHERE Agent IS NOT NULL
          AND TRIM(Agent) <> ''
        GROUP BY Agent
      ) latest
        ON latest.Agent = latest_state.Agent
       AND latest.max_id = latest_state.id
      ORDER BY latest_state.EstadoInicio DESC, latest_state.Agent ASC
    `);

    return rows.map((row) => ({
        id: Number(row.id || 0),
        agent: String(row.agent || "").trim(),
        agentNumber: String(row.agentNumber || "").trim(),
        estado: String(row.estado || "").trim() || "Sin estado",
        estadoInicio: row.estadoInicio || null,
        estadoFin: row.estadoFin || null,
        minutosEnEstado: Number(row.minutosEnEstado || 0),
    }));
}

router.use(requireAuth);
router.use(loadUserRoles);
router.use(requireRole(["SUPERVISOR"]));

// Endpoint: grabaciones por número de teléfono
router.get("/grabaciones", getRecordingsByPhone);
router.get("/grabaciones-inbound", getInboundRecordings);
router.use("/grabacion-sftp", recordingSftpRouter);

router.get("/reportes/outbound/campanias", async (_req, res) => {
    try {
        const campaigns = await listOutboundReportCampaigns(pool);
        res.json({ data: campaigns });
    } catch (err) {
        console.error("Error listando campanias outbound para reportes:", err);
        res.status(500).json({
            error: "Error obteniendo campanias para reportes",
        });
    }
});

router.get("/reportes/outbound/export", async (req, res) => {
    try {
        const campaignId = String(req.query?.campaignId || "").trim();
        const startDate = String(req.query?.startDate || "").trim();
        const endDate = String(req.query?.endDate || "").trim();

        if (!campaignId || !startDate || !endDate) {
            return res.status(400).json({
                error: "campaignId, startDate y endDate son requeridos",
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                error: "La fecha inicial no puede ser mayor a la fecha final",
            });
        }

        const report = await buildOutboundReportWorkbook({
            campaignId,
            startDate,
            endDate,
            executor: pool,
        });

        if (!report.buffer) {
            return res.status(404).json({
                error: "No hay datos para exportar con los filtros seleccionados",
            });
        }

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${report.filename}"`,
        );

        return res.send(report.buffer);
    } catch (err) {
        console.error("Error exportando reporte outbound supervisor:", err);
        return res.status(500).json({
            error: "Error exportando reporte outbound",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

// Dashboard supervisor: métricas globales
router.get("/dashboard", async (req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_agentes,
        SUM(IF(bloqueado = 1, 1, 0)) AS agentes_bloqueados,
        SUM(IF(exceso_pausa = 1, 1, 0)) AS agentes_con_exceso,
        MAX(minutos_pausa_hoy) AS pausa_max
      FROM vw_admin_resumen_agentes
    `);

        const row = rows[0];
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
        const [rows] = await pool.query(`
      SELECT agente_id AS id,
             full_name AS nombre,
             CASE 
               WHEN bloqueado = 1 THEN 'Bloqueado'
               WHEN estado_operativo = 'activo' THEN 'Activo'
               ELSE 'Inactivo'
             END AS estado,
             minutos_pausa_hoy AS minutosPausa,
             exceso_pausa
      FROM vw_admin_resumen_agentes
      ORDER BY nombre ASC
    `);

        res.json(rows);
    } catch (err) {
        console.error("Error al obtener agentes:", err);
        res.status(500).json({ error: "Error al obtener agentes" });
    }
});

router.get("/agentes-estados", async (_req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT estado, COUNT(*) AS total
      FROM (
        SELECT
          s.Agent,
          COALESCE(NULLIF(TRIM(s.Estado), ''), 'Sin estado') AS estado
        FROM session_estado_log s
        INNER JOIN (
          SELECT Agent, MAX(id) AS max_id
          FROM session_estado_log
          WHERE Agent IS NOT NULL
            AND TRIM(Agent) <> ''
          GROUP BY Agent
        ) latest
          ON latest.Agent = s.Agent
         AND latest.max_id = s.id
      ) estados_actuales
      GROUP BY estado
      ORDER BY total DESC, estado ASC
    `);

        res.json({
            data: rows.map((row) => ({
                estado: String(row.estado || "").trim() || "Sin estado",
                total: Number(row.total || 0),
            })),
        });
    } catch (err) {
        console.error("Error al obtener estadisticas de estados:", err);
        res.status(500).json({
            error: "Error al obtener estadisticas de estados de agentes",
        });
    }
});

export default router;
