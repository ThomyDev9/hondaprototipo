import express from "express";
import pool from "../../services/db.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";
import recordingSftpRouter from "./recording.sftp.js";
import { getRecordingsByPhone } from "./recordings-linked.controller.js";
import { getInboundRecordings } from "./recordings-inbound.controller.js";
import {
    buildOutboundReportWorkbook,
    listOutboundReportCampaigns,
} from "../../services/supervisorReports.service.js";

const router = express.Router();

function parseMysqlDateTime(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getDayStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getNextDayStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function formatDateTimeForSql(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

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
        CASE
          WHEN COALESCE(latest_state.EstadoFin, NOW()) < CURDATE() THEN 0
          ELSE TIMESTAMPDIFF(
            MINUTE,
            GREATEST(latest_state.EstadoInicio, CURDATE()),
            COALESCE(latest_state.EstadoFin, NOW())
          )
        END AS minutosEnEstadoHoy
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
        minutosEnEstadoHoy: Number(row.minutosEnEstadoHoy || 0),
    }));
}

async function getAgentStateAccumulation(
    { startDate, endDate, agent = "", estado = "" },
    connection = pool,
) {
    const normalizedStartDate = String(startDate || "").trim();
    const normalizedEndDate = String(endDate || "").trim();
    const normalizedAgent = String(agent || "").trim();
    const normalizedEstado = String(estado || "").trim();

    const rangeStart = parseMysqlDateTime(`${normalizedStartDate} 00:00:00`);
    const rangeEndExclusive = parseMysqlDateTime(`${normalizedEndDate} 00:00:00`);

    if (!rangeStart || !rangeEndExclusive) {
        return [];
    }

    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

    const [rows] = await connection.query(
        `
        SELECT
          id,
          Agent AS agent,
          AgentNumber AS agentNumber,
          COALESCE(NULLIF(TRIM(Estado), ''), 'Sin estado') AS estado,
          EstadoInicio AS estadoInicio,
          COALESCE(EstadoFin, NOW()) AS estadoFin
        FROM session_estado_log
        WHERE Agent IS NOT NULL
          AND TRIM(Agent) <> ''
          AND EstadoInicio < ?
          AND COALESCE(EstadoFin, NOW()) > ?
          AND (
            ? = ''
            OR LOWER(TRIM(Agent)) = LOWER(TRIM(?))
          )
          AND (
            ? = ''
            OR LOWER(TRIM(Estado)) = LOWER(TRIM(?))
          )
        ORDER BY EstadoInicio ASC, id ASC
        `,
        [
            formatDateTimeForSql(rangeEndExclusive),
            formatDateTimeForSql(rangeStart),
            normalizedAgent,
            normalizedAgent,
            normalizedEstado,
            normalizedEstado,
        ],
    );

    const aggregation = new Map();

    for (const row of rows) {
        const rawStart = parseMysqlDateTime(row.estadoInicio);
        const rawEnd = parseMysqlDateTime(row.estadoFin);

        if (!rawStart || !rawEnd) continue;

        let segmentStart = rawStart > rangeStart ? rawStart : rangeStart;
        const segmentEnd = rawEnd < rangeEndExclusive ? rawEnd : rangeEndExclusive;

        while (segmentStart < segmentEnd) {
            const dayStart = getDayStart(segmentStart);
            const nextDayStart = getNextDayStart(segmentStart);
            const sliceEnd = nextDayStart < segmentEnd ? nextDayStart : segmentEnd;
            const minutes = Math.max(
                0,
                Math.round((sliceEnd.getTime() - segmentStart.getTime()) / 60000),
            );

            if (minutes > 0) {
                const fecha = formatDateKey(dayStart);
                const key = [
                    fecha,
                    String(row.agent || "").trim(),
                    String(row.agentNumber || "").trim(),
                    String(row.estado || "").trim(),
                ].join("|");

                const existing = aggregation.get(key) || {
                    fecha,
                    agent: String(row.agent || "").trim(),
                    agentNumber: String(row.agentNumber || "").trim(),
                    estado: String(row.estado || "").trim() || "Sin estado",
                    registros: 0,
                    intervals: [],
                };

                existing.registros += 1;
                existing.intervals.push({
                    start: new Date(segmentStart.getTime()),
                    end: new Date(sliceEnd.getTime()),
                });
                aggregation.set(key, existing);
            }

            segmentStart = sliceEnd;
        }
    }

    const mergedRows = Array.from(aggregation.values()).map((item) => {
        const sortedIntervals = [...item.intervals].sort(
            (a, b) => a.start.getTime() - b.start.getTime(),
        );
        const merged = [];

        for (const interval of sortedIntervals) {
            const last = merged[merged.length - 1];

            if (!last || interval.start.getTime() > last.end.getTime()) {
                merged.push({
                    start: new Date(interval.start.getTime()),
                    end: new Date(interval.end.getTime()),
                });
                continue;
            }

            if (interval.end.getTime() > last.end.getTime()) {
                last.end = new Date(interval.end.getTime());
            }
        }

        const minutos = merged.reduce((acc, interval) => {
            return (
                acc +
                Math.max(
                    0,
                    Math.round(
                        (interval.end.getTime() - interval.start.getTime()) / 60000,
                    ),
                )
            );
        }, 0);

        return {
            fecha: item.fecha,
            agent: item.agent,
            agentNumber: item.agentNumber,
            estado: item.estado,
            minutos,
            registros: item.registros,
        };
    });

    return mergedRows.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        if (a.agent !== b.agent) return a.agent.localeCompare(b.agent);
        return a.estado.localeCompare(b.estado);
    });
}

function summarizeAccumulationByState(rows = []) {
    const summary = new Map();

    for (const row of rows) {
        const estado = String(row.estado || "").trim() || "Sin estado";
        const key = estado;
        const existing = summary.get(key) || {
            estado,
            minutos: 0,
            registros: 0,
            dias: new Set(),
            agentes: new Set(),
        };

        existing.minutos += Number(row.minutos || 0);
        existing.registros += Number(row.registros || 0);
        if (row.fecha) existing.dias.add(String(row.fecha));
        if (row.agent) existing.agentes.add(String(row.agent));
        summary.set(key, existing);
    }

    return Array.from(summary.values())
        .map((item) => ({
            estado: item.estado,
            minutos: item.minutos,
            registros: item.registros,
            dias: item.dias.size,
            agentes: item.agentes.size,
        }))
        .sort((a, b) => {
            if (b.minutos !== a.minutos) return b.minutos - a.minutos;
            return a.estado.localeCompare(b.estado);
        });
}

router.use(requireAuth);
router.use(loadUserRoles);
router.use(requireRole(["SUPERVISOR"]));

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

router.get("/dashboard", async (_req, res) => {
    try {
        const estados = await getAgentStateSummary(pool);
        const agentes = await getAgentCurrentActivity(pool);
        const pausa = estados
            .filter((item) => {
                const estado = String(item.estado || "").trim().toLowerCase();
                return estado.includes("pausa") || estado.includes("break");
            })
            .reduce((acc, item) => acc + Number(item.total || 0), 0);
        const disponibles = estados
            .filter(
                (item) =>
                    String(item.estado || "").trim().toLowerCase() ===
                    "disponible",
            )
            .reduce((acc, item) => acc + Number(item.total || 0), 0);
        const estadoMasLargo = agentes.reduce((currentMax, item) => {
            if (!currentMax) return item;
            return item.minutosEnEstadoHoy > currentMax.minutosEnEstadoHoy
                ? item
                : currentMax;
        }, null);

        res.json({
            totalAgentes: agentes.length,
            totalEstados: estados.length,
            disponibles,
            pausa,
            estados,
            estadoMasLargo,
        });
    } catch (err) {
        console.error("Error en dashboard supervisor:", err);
        res.status(500).json({
            error: "Error interno en dashboard supervisor",
        });
    }
});

router.get("/agentes", async (_req, res) => {
    try {
        res.json(await getAgentCurrentActivity(pool));
    } catch (err) {
        console.error("Error al obtener agentes:", err);
        res.status(500).json({ error: "Error al obtener agentes" });
    }
});

router.get("/agentes-estados", async (_req, res) => {
    try {
        res.json({
            data: await getAgentStateSummary(pool),
        });
    } catch (err) {
        console.error("Error al obtener estadisticas de estados:", err);
        res.status(500).json({
            error: "Error al obtener estadisticas de estados de agentes",
        });
    }
});

router.get("/agentes-acumulado", async (req, res) => {
    try {
        const startDate = String(req.query?.startDate || "").trim();
        const endDate = String(req.query?.endDate || "").trim();
        const agent = String(req.query?.agent || "").trim();
        const estado = String(req.query?.estado || "").trim();

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: "startDate y endDate son requeridos",
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                error: "La fecha inicial no puede ser mayor a la fecha final",
            });
        }

        const detail = await getAgentStateAccumulation(
            { startDate, endDate, agent, estado },
            pool,
        );
        const summary = summarizeAccumulationByState(detail);

        res.json({
            filters: {
                startDate,
                endDate,
                agent,
                estado,
            },
            summary,
            detail,
        });
    } catch (err) {
        console.error("Error al obtener acumulado de estados:", err);
        res.status(500).json({
            error: "Error al obtener acumulado de estados",
        });
    }
});

export default router;
