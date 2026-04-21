import express from "express";
import { pool, isabelPool, inboundIsabelPool } from "../../services/db.multi.js";
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
import { runInboundGhostDepuration } from "../../services/inboundGhostDepuration.service.js";

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

function toLocalDateString(value) {
    if (!value) return "";
    const parsed = parseMysqlDateTime(value);
    if (!parsed) return "";
    return parsed.toLocaleString("es-EC");
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
          SessionId AS sessionId,
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
    const sessionCutoffByAgentSession = new Map();
    const sessionsByAgent = new Map();

    for (const row of rows) {
        const rawStart = parseMysqlDateTime(row.estadoInicio);
        if (!rawStart) continue;

        const agentKey = String(row.agent || "")
            .trim()
            .toLowerCase();
        const sessionId = String(row.sessionId || "").trim();
        if (!agentKey || !sessionId) continue;

        let sessionMap = sessionsByAgent.get(agentKey);
        if (!sessionMap) {
            sessionMap = new Map();
            sessionsByAgent.set(agentKey, sessionMap);
        }

        const existingStart = sessionMap.get(sessionId);
        if (!existingStart || rawStart.getTime() < existingStart.getTime()) {
            sessionMap.set(sessionId, rawStart);
        }
    }

    for (const [agentKey, sessionMap] of sessionsByAgent.entries()) {
        const orderedSessions = Array.from(sessionMap.entries()).sort(
            (a, b) => a[1].getTime() - b[1].getTime(),
        );

        for (let index = 0; index < orderedSessions.length; index += 1) {
            const [sessionId] = orderedSessions[index];
            const next = orderedSessions[index + 1];
            const nextSessionStart = next ? next[1] : null;
            sessionCutoffByAgentSession.set(
                `${agentKey}|${sessionId}`,
                nextSessionStart,
            );
        }
    }

    for (const row of rows) {
        const rawStart = parseMysqlDateTime(row.estadoInicio);
        const rawEnd = parseMysqlDateTime(row.estadoFin);

        if (!rawStart || !rawEnd) continue;

        const agentKey = String(row.agent || "")
            .trim()
            .toLowerCase();
        const sessionId = String(row.sessionId || "").trim();
        const nextSessionStart =
            sessionCutoffByAgentSession.get(`${agentKey}|${sessionId}`) || null;
        const effectiveEnd =
            nextSessionStart && nextSessionStart < rawEnd
                ? nextSessionStart
                : rawEnd;
        if (effectiveEnd <= rawStart) continue;

        let segmentStart = rawStart > rangeStart ? rawStart : rangeStart;
        const segmentEnd =
            effectiveEnd < rangeEndExclusive ? effectiveEnd : rangeEndExclusive;

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
                const rawAgent = String(row.agent || "").trim();
                const rawEstado = String(row.estado || "").trim();
                const normalizedAgentKey = rawAgent.toLowerCase();
                const normalizedEstadoKey = rawEstado.toLowerCase();
                const rawAgentNumber = String(row.agentNumber || "").trim();
                const key = [
                    fecha,
                    normalizedAgentKey,
                    normalizedEstadoKey,
                ].join("|");

                const existing = aggregation.get(key) || {
                    fecha,
                    agent: rawAgent,
                    estado: rawEstado || "Sin estado",
                    registros: 0,
                    intervals: [],
                    agentNumbers: new Set(),
                };

                if (!existing.agent && rawAgent) {
                    existing.agent = rawAgent;
                }
                if (rawAgentNumber) {
                    existing.agentNumbers.add(rawAgentNumber);
                }
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
            agentNumber:
                item.agentNumbers.size > 0
                    ? Array.from(item.agentNumbers).join(" / ")
                    : "",
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

function normalizeRecordingValue(value = "") {
    const raw = String(value || "").trim().replace(/\\/g, "/");
    if (!raw) return "";
    const parts = raw.split("/").filter(Boolean);
    return String(parts[parts.length - 1] || "").trim().toLowerCase();
}

function normalizeRecordingPathForAccess(value = "") {
    const raw = String(value || "").trim().replace(/\\/g, "/");
    if (!raw) return "";

    const withoutRoot = raw.replace(
        /^\/?var\/spool\/asterisk\/monitor\/?/i,
        "",
    );

    if (withoutRoot !== raw && withoutRoot) {
        return withoutRoot;
    }

    const datedPathMatch = raw.match(
        /(\d{4}\/\d{2}\/\d{2}\/q-[^/]+?\.(?:wav|WAV|mp3|MP3))/,
    );
    if (datedPathMatch?.[1]) {
        return String(datedPathMatch[1]).trim();
    }

    return raw;
}

function extractInboundQueueFromRecordingFile(recordingfile = "") {
    const normalized = normalizeRecordingValue(recordingfile);
    const match = normalized.match(/^q-(\d+)-/i);
    return String(match?.[1] || "").trim();
}

function normalizeQueueToken(value = "") {
    return String(value || "")
        .trim()
        .replace(/\.0+$/, "")
        .replace(/[^\d]/g, "");
}

function buildInboundQueueCandidates(value = "") {
    return String(value || "")
        .split(/[;,|]/)
        .flatMap((entry) =>
            String(entry || "")
                .split(/\s+/)
                .map((token) => normalizeQueueToken(token)),
        )
        .filter(Boolean);
}

async function getInboundQueueToMenuMap(connection = pool) {
    const [rows] = await connection.query(`
        SELECT
            child.id AS menuItemId,
            TRIM(COALESCE(child.nombre_item, '')) AS subcampania,
            TRIM(COALESCE(parent.nombre_item, '')) AS campania,
            TRIM(COALESCE(child.inbound_queue, '')) AS inboundQueue
        FROM menu_items child
        LEFT JOIN menu_items parent
          ON parent.id = child.id_padre
        WHERE child.estado = 'activo'
          AND COALESCE(TRIM(child.inbound_queue), '') <> ''
        ORDER BY parent.nombre_item ASC, child.nombre_item ASC
    `);

    const queueMap = new Map();
    const catalog = [];
    for (const row of rows) {
        const tokens = buildInboundQueueCandidates(row?.inboundQueue || "");
        const entry = {
            menuItemId: String(row?.menuItemId || "").trim(),
            subcampania: String(row?.subcampania || "").trim(),
            campania: String(row?.campania || "").trim(),
            inboundQueue: String(row?.inboundQueue || "").trim(),
            queueTokens: tokens,
        };
        catalog.push(entry);
        for (const token of tokens) {
            if (!queueMap.has(token)) {
                queueMap.set(token, entry);
            }
        }
    }

    return { queueMap, catalog };
}

function isPreferredInboundCandidate(current = {}, next = {}) {
    const currentIsLinked = current.source === "management_recording_link";
    const nextIsLinked = next.source === "management_recording_link";
    if (currentIsLinked !== nextIsLinked) {
        return nextIsLinked;
    }

    const currentHasInteraction = Boolean(current.interactionId);
    const nextHasInteraction = Boolean(next.interactionId);
    if (currentHasInteraction !== nextHasInteraction) {
        return nextHasInteraction;
    }

    const currentDate = parseMysqlDateTime(current.calldate);
    const nextDate = parseMysqlDateTime(next.calldate);
    if (!currentDate && nextDate) return true;
    if (currentDate && nextDate) {
        return nextDate.getTime() > currentDate.getTime();
    }

    return false;
}

function mergeInboundCandidates(current = {}, next = {}) {
    if (!current || !Object.keys(current).length) return next;
    if (!next || !Object.keys(next).length) return current;

    const preferredNext = isPreferredInboundCandidate(current, next);
    const primary = preferredNext ? next : current;
    const secondary = preferredNext ? current : next;

    return {
        ...secondary,
        ...primary,
        uniqueid: String(primary.uniqueid || secondary.uniqueid || "").trim(),
        calldate: primary.calldate || secondary.calldate || null,
        src: String(primary.src || secondary.src || "").trim(),
        dst: String(primary.dst || secondary.dst || "").trim(),
        disposition: String(
            primary.disposition || secondary.disposition || "",
        ).trim(),
        duration: Number(primary.duration || secondary.duration || 0),
        recordingfile: String(
            primary.recordingfile || secondary.recordingfile || "",
        ).trim(),
        dstchannel: String(primary.dstchannel || secondary.dstchannel || "").trim(),
        agentNumberFromChannel: String(
            primary.agentNumberFromChannel ||
                secondary.agentNumberFromChannel ||
                "",
        ).trim(),
        recordingfileNormalized: String(
            primary.recordingfileNormalized ||
                secondary.recordingfileNormalized ||
                "",
        ).trim(),
        interactionId: String(
            primary.interactionId || secondary.interactionId || "",
        ).trim(),
        source: String(primary.source || secondary.source || "").trim(),
    };
}

async function queryInboundCdrRows(connection, { startDate, endDate, limit }) {
    const [rows] = await connection.query(
        `
        SELECT
            uniqueid,
            calldate,
            src,
            dst,
            dstchannel,
            disposition,
            billsec AS duration,
            recordingfile
        FROM cdr
        WHERE calldate >= ?
          AND calldate < DATE_ADD(?, INTERVAL 1 DAY)
          AND COALESCE(recordingfile, '') <> ''
          AND (
                LOWER(COALESCE(recordingfile, '')) LIKE 'q-%'
             OR LOWER(COALESCE(recordingfile, '')) LIKE '%/q-%'
             OR LOWER(COALESCE(recordingfile, '')) LIKE '%\\\\q-%'
          )
        ORDER BY calldate DESC, uniqueid DESC
        LIMIT ?
        `,
        [startDate, endDate, limit],
    );
    return Array.isArray(rows) ? rows : [];
}

function normalizeDigits(value = "") {
    return String(value || "").replace(/[^\d]/g, "");
}

function extractAgentNumberFromChannel(value = "") {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    const match = normalized.match(/Agent\/(\d{3,6})/i);
    return String(match?.[1] || "").trim();
}

function getAgentNumberCandidatesFromCall(row = {}) {
    const fromDstChannel = normalizeDigits(
        row?.agentNumberFromChannel || extractAgentNumberFromChannel(row?.dstchannel),
    );
    const src = normalizeDigits(row?.src);
    const dst = normalizeDigits(row?.dst);
    const candidates = [fromDstChannel, src, dst].filter(
        (value) => value && value.length >= 3 && value.length <= 6,
    );
    return Array.from(new Set(candidates));
}

async function buildInboundMissingCallsDataset({
    startDate = "",
    endDate = "",
    limit = 1200,
} = {}) {
    const today = new Date();
    const fallbackStart = new Date(today);
    fallbackStart.setDate(today.getDate() - 7);
    const resolvedStartDate = startDate || formatDateKey(fallbackStart);
    const resolvedEndDate = endDate || formatDateKey(today);

    if (resolvedStartDate > resolvedEndDate) {
        const error = new Error("La fecha inicial no puede ser mayor a la fecha final");
        error.statusCode = 400;
        throw error;
    }

    const [linkRows] = await pool.query(
        `
        SELECT
            id,
            schema_name,
            gestion_contact_id,
            interaction_id,
            campaign_id,
            agent,
            contact_address,
            cdr_uniqueid,
            cdr_calldate,
            cdr_src,
            cdr_dst,
            cdr_disposition,
            cdr_duration,
            recordingfile,
            recording_path,
            linked_at
        FROM management_recording_link
        WHERE (
                (cdr_calldate IS NOT NULL AND cdr_calldate >= ? AND cdr_calldate < DATE_ADD(?, INTERVAL 1 DAY))
             OR (cdr_calldate IS NULL AND linked_at >= ? AND linked_at < DATE_ADD(?, INTERVAL 1 DAY))
        )
          AND (
                LOWER(COALESCE(recordingfile, '')) LIKE 'q-%'
             OR LOWER(COALESCE(recordingfile, '')) LIKE '%/q-%'
             OR LOWER(COALESCE(recordingfile, '')) LIKE '%\\q-%'
             OR LOWER(COALESCE(recording_path, '')) LIKE 'q-%'
             OR LOWER(COALESCE(recording_path, '')) LIKE '%/q-%'
             OR LOWER(COALESCE(recording_path, '')) LIKE '%\\q-%'
          )
        ORDER BY COALESCE(cdr_calldate, linked_at) DESC, id DESC
        LIMIT ?
        `,
        [resolvedStartDate, resolvedEndDate, resolvedStartDate, resolvedEndDate, limit],
    );

    const { queueMap: queueToMenuMap, catalog } = await getInboundQueueToMenuMap(pool);

    const cdrQueryResults = await Promise.allSettled([
        queryInboundCdrRows(isabelPool, {
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            limit: limit * 3,
        }),
        queryInboundCdrRows(inboundIsabelPool, {
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            limit: limit * 3,
        }),
    ]);

    const cdrRows = cdrQueryResults
        .filter((result) => result.status === "fulfilled")
        .flatMap((result) => result.value || []);

    const unifiedByRecording = new Map();
    const ingestCandidate = (candidate) => {
        const normalized = String(candidate?.recordingfileNormalized || "").trim();
        if (!normalized) return;
        const existing = unifiedByRecording.get(normalized);
        unifiedByRecording.set(
            normalized,
            mergeInboundCandidates(existing || {}, candidate),
        );
    };

    for (const row of linkRows || []) {
        const recordingPath = normalizeRecordingPathForAccess(
            row?.recordingfile || row?.recording_path,
        );
        ingestCandidate({
            uniqueid: String(
                row?.cdr_uniqueid || row?.interaction_id || row?.id || "",
            ).trim(),
            calldate: row?.cdr_calldate || row?.linked_at || null,
            src: String(row?.cdr_src || "").trim(),
            dst: String(row?.cdr_dst || row?.contact_address || "").trim(),
            dstchannel: "",
            agentNumberFromChannel: "",
            disposition: String(row?.cdr_disposition || "").trim(),
            duration: Number(row?.cdr_duration || 0),
            recordingfile: recordingPath,
            recordingfileNormalized: normalizeRecordingValue(recordingPath),
            interactionId: String(row?.interaction_id || "").trim(),
            source: "management_recording_link",
        });
    }

    for (const row of cdrRows || []) {
        const recordingPath = normalizeRecordingPathForAccess(row?.recordingfile);
        ingestCandidate({
            uniqueid: String(row?.uniqueid || "").trim(),
            calldate: row?.calldate || null,
            src: String(row?.src || "").trim(),
            dst: String(row?.dst || "").trim(),
            dstchannel: String(row?.dstchannel || "").trim(),
            agentNumberFromChannel: extractAgentNumberFromChannel(
                row?.dstchannel,
            ),
            disposition: String(row?.disposition || "").trim(),
            duration: Number(row?.duration || 0),
            recordingfile: recordingPath,
            recordingfileNormalized: normalizeRecordingValue(recordingPath),
            interactionId: "",
            source: "cdr",
        });
    }

    const unifiedRows = Array.from(unifiedByRecording.values());
    if (unifiedRows.length === 0) {
        return {
            filters: {
                startDate: resolvedStartDate,
                endDate: resolvedEndDate,
                limit,
            },
            totals: { total: 0, missing: 0 },
            catalog,
            data: [],
        };
    }

    const candidateUniqueIds = Array.from(
        new Set(
            unifiedRows
                .map((row) => String(row?.uniqueid || "").trim())
                .filter(Boolean),
        ),
    );
    const candidateRecordingNames = Array.from(
        new Set(
            unifiedRows
                .map((row) =>
                    normalizeRecordingValue(row?.recordingfileNormalized || row?.recordingfile),
                )
                .filter(Boolean),
        ),
    );

    const linkLookupClauses = [];
    const linkLookupParams = [];
    if (candidateUniqueIds.length > 0) {
        linkLookupClauses.push(
            `TRIM(COALESCE(cdr_uniqueid, '')) IN (${candidateUniqueIds.map(() => "?").join(",")})`,
        );
        linkLookupParams.push(...candidateUniqueIds);
    }
    if (candidateRecordingNames.length > 0) {
        linkLookupClauses.push(
            `LOWER(TRIM(COALESCE(recordingfile, ''))) IN (${candidateRecordingNames.map(() => "?").join(",")})`,
        );
        linkLookupParams.push(...candidateRecordingNames);
        linkLookupClauses.push(
            `LOWER(TRIM(SUBSTRING_INDEX(COALESCE(recording_path, ''), '/', -1))) IN (${candidateRecordingNames.map(() => "?").join(",")})`,
        );
        linkLookupParams.push(...candidateRecordingNames);
    }

    let existingLinksAnyDateByUniqueId = new Set();
    let existingLinksAnyDateByRecording = new Set();
    if (linkLookupClauses.length > 0) {
        const [allLinkMatches] = await pool.query(
            `
            SELECT cdr_uniqueid, recordingfile, recording_path
            FROM management_recording_link
            WHERE ${linkLookupClauses.join(" OR ")}
            `,
            linkLookupParams,
        );

        existingLinksAnyDateByUniqueId = new Set(
            (allLinkMatches || [])
                .map((row) => String(row?.cdr_uniqueid || "").trim())
                .filter(Boolean),
        );
        existingLinksAnyDateByRecording = new Set(
            (allLinkMatches || [])
                .map((row) =>
                    normalizeRecordingValue(
                        row?.recordingfile || row?.recording_path,
                    ),
                )
                .filter(Boolean),
        );
    }

    const candidateInteractionIds = Array.from(
        new Set(
            unifiedRows
                .map((row) => String(row?.interactionId || "").trim())
                .filter(Boolean),
        ),
    );
    const candidateTicketIds = Array.from(
        new Set(
            unifiedRows
                .map((row) => String(row?.uniqueid || "").trim())
                .filter(Boolean),
        ),
    );

    const whereClauses = [];
    const queryParams = [];
    if (candidateInteractionIds.length > 0) {
        whereClauses.push(
            `interaction_id IN (${candidateInteractionIds.map(() => "?").join(",")})`,
        );
        queryParams.push(...candidateInteractionIds);
    }
    if (candidateTicketIds.length > 0) {
        whereClauses.push(
            `ticket_id IN (${candidateTicketIds.map(() => "?").join(",")})`,
        );
        queryParams.push(...candidateTicketIds);
    }

    // Fallback por rango para cubrir gestiones sin ticket/interaction completos.
    whereClauses.push(
        `(tmstmp >= ? AND tmstmp < DATE_ADD(?, INTERVAL 1 DAY))`,
    );
    queryParams.push(resolvedStartDate, resolvedEndDate);

    const [gestionRows] = await pool.query(
        `
        SELECT id, interaction_id, contact_id, ticket_id, payload_json
        FROM gestionfinal_inbound
        WHERE ${whereClauses.join(" OR ")}
        `,
        queryParams,
    );

    const gestionByInteractionId = new Set();
    const gestionByTicketId = new Set();
    const managedRecordings = new Set();
    for (const row of gestionRows || []) {
        const interactionId = String(row?.interaction_id || "").trim();
        if (interactionId) gestionByInteractionId.add(interactionId);
        const ticketId = String(row?.ticket_id || "").trim();
        if (ticketId) gestionByTicketId.add(ticketId);

        let payload = {};
        try {
            payload = row?.payload_json ? JSON.parse(row.payload_json) : {};
        } catch {
            payload = {};
        }

        const payloadRecordingCandidates = [
            payload?.__inbound_current_call_recordingfile,
            payload?.recordingfile,
            payload?.recordingFile,
        ];
        for (const candidate of payloadRecordingCandidates) {
            const normalized = normalizeRecordingValue(candidate);
            if (normalized) managedRecordings.add(normalized);
        }
    }

    const data = unifiedRows
        .map((row) => {
            const normalizedRecording = normalizeRecordingValue(row?.recordingfile);
            const interactionId = String(row?.interactionId || "").trim();
            const uniqueid = String(row?.uniqueid || "").trim();
            const queueCode = extractInboundQueueFromRecordingFile(row?.recordingfile);
            const queueNormalized = normalizeQueueToken(queueCode);
            const menuMatch = queueToMenuMap.get(queueNormalized) || null;
            const hasGestionByInteraction =
                interactionId && gestionByInteractionId.has(interactionId);
            const hasGestionByTicket =
                uniqueid && gestionByTicketId.has(uniqueid);
            const hasGestionByRecording =
                normalizedRecording && managedRecordings.has(normalizedRecording);
            const hasGestionByLinkUniqueId =
                uniqueid && existingLinksAnyDateByUniqueId.has(uniqueid);
            const hasGestionByLinkRecording =
                normalizedRecording &&
                existingLinksAnyDateByRecording.has(normalizedRecording);
            const hasGestionByRecordingLink =
                String(row?.source || "").trim() === "management_recording_link";
            const hasGestion = Boolean(
                hasGestionByRecordingLink ||
                hasGestionByLinkUniqueId ||
                hasGestionByLinkRecording ||
                hasGestionByInteraction ||
                    hasGestionByTicket ||
                    hasGestionByRecording,
            );

            return {
                uniqueid,
                calldate: row?.calldate || null,
                calldateLocal: toLocalDateString(row?.calldate || null),
                src: String(row?.src || "").trim(),
                dst: String(row?.dst || "").trim(),
                dstchannel: String(row?.dstchannel || "").trim(),
                agentNumberFromChannel: String(
                    row?.agentNumberFromChannel || "",
                ).trim(),
                disposition: String(row?.disposition || "").trim(),
                duration: Number(row?.duration || 0),
                recordingfile: String(row?.recordingfile || "").trim(),
                recordingfileNormalized: normalizedRecording,
                interactionId,
                queueCode: queueCode || "",
                queueResolved: queueNormalized || "",
                campania: String(menuMatch?.campania || "").trim(),
                subcampania: String(menuMatch?.subcampania || "").trim(),
                menuItemId: String(menuMatch?.menuItemId || "").trim(),
                inboundQueueLabel: String(menuMatch?.inboundQueue || "").trim(),
                source: String(row?.source || "").trim(),
                hasGestion,
                isMissingGestion: !hasGestion,
            };
        })
        .filter((row) => row.isMissingGestion);

    return {
        filters: {
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            limit,
        },
        totals: {
            total: unifiedRows.length,
            missing: data.length,
        },
        catalog,
        data,
    };
}

function normalizeAgentIdentity(value = "") {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function getUserAgentIdentityKeys(user = {}) {
    const username = String(user?.username || "").trim();
    const fullName = String(user?.full_name || user?.name || "").trim();
    const email = String(user?.email || "").trim();
    const emailUser = email.includes("@") ? email.split("@")[0] : "";

    return new Set(
        [username, fullName, email, emailUser]
            .map(normalizeAgentIdentity)
            .filter(Boolean),
    );
}

async function buildInboundUnregisteredByAdvisorDataset({
    startDate = "",
    endDate = "",
    limit = 1200,
}) {
    const base = await buildInboundMissingCallsDataset({
        startDate,
        endDate,
        limit,
    });

    const [sessionRows] = await pool.query(
        `
            SELECT
                Agent AS agent,
                AgentNumber AS agentNumber,
                EstadoInicio AS estadoInicio,
                COALESCE(EstadoFin, NOW()) AS estadoFin
            FROM session_estado_log
            WHERE AgentNumber IS NOT NULL
              AND TRIM(AgentNumber) <> ''
              AND EstadoInicio < DATE_ADD(?, INTERVAL 1 DAY)
              AND COALESCE(EstadoFin, NOW()) >= ?
            ORDER BY AgentNumber ASC, EstadoInicio ASC
        `,
        [base.filters.endDate, base.filters.startDate],
    );

    const sessionsByNumber = new Map();
    for (const row of sessionRows || []) {
        const agentNumber = normalizeDigits(row?.agentNumber);
        if (!agentNumber) continue;
        const current = sessionsByNumber.get(agentNumber) || [];
        current.push({
            agent: String(row?.agent || "").trim(),
            agentNumber,
            start: parseMysqlDateTime(row?.estadoInicio),
            end: parseMysqlDateTime(row?.estadoFin),
            estadoInicio: row?.estadoInicio || null,
            estadoFin: row?.estadoFin || null,
        });
        sessionsByNumber.set(agentNumber, current);
    }

    const data = (base.data || []).map((row) => {
        const callDate = parseMysqlDateTime(row?.calldate);
        const candidates = getAgentNumberCandidatesFromCall(row);
        let assigned = null;
        const timezoneAdjustedDates = callDate
            ? [
                  { label: "tz_0", date: callDate },
                  {
                      label: "tz_minus_5h",
                      date: new Date(callDate.getTime() - 5 * 60 * 60 * 1000),
                  },
                  {
                      label: "tz_plus_5h",
                      date: new Date(callDate.getTime() + 5 * 60 * 60 * 1000),
                  },
              ]
            : [];

        for (const code of candidates) {
            const sessions = sessionsByNumber.get(code) || [];
            for (const candidateDate of timezoneAdjustedDates) {
                const covering = sessions
                    .filter((item) => {
                        if (!candidateDate?.date || !item?.start) return false;
                        if (item.start > candidateDate.date) return false;
                        if (!item?.end) return true;
                        return item.end >= candidateDate.date;
                    })
                    .sort((a, b) => b.start.getTime() - a.start.getTime());

                if (covering.length > 0) {
                    assigned = {
                        agent: covering[0].agent,
                        agentNumber: code,
                        estadoInicio: covering[0].estadoInicio,
                        estadoFin: covering[0].estadoFin,
                        matchMethod: `intervalo_exacto_${candidateDate.label}`,
                    };
                    break;
                }
            }

            if (assigned) {
                break;
            }
        }

        if (!assigned && callDate) {
            const callDateKey = formatDateKey(callDate);
            for (const code of candidates) {
                const sessions = sessionsByNumber.get(code) || [];
                const firstOfDay = sessions.find(
                    (item) =>
                        item?.start && formatDateKey(item.start) === callDateKey,
                );
                if (firstOfDay) {
                    assigned = {
                        agent: firstOfDay.agent,
                        agentNumber: code,
                        estadoInicio: firstOfDay.estadoInicio,
                        estadoFin: firstOfDay.estadoFin,
                        matchMethod: "primer_estado_dia",
                    };
                    break;
                }
            }
        }

        if (!assigned && callDate) {
            const maxClosestDiffMinutes = 480;
            for (const code of candidates) {
                const sessions = sessionsByNumber.get(code) || [];
                const closest = sessions
                    .filter((item) => item?.start)
                    .map((item) => ({
                        ...item,
                        diffMinutes: Math.abs(
                            Math.round(
                                (item.start.getTime() - callDate.getTime()) /
                                    60000,
                            ),
                        ),
                    }))
                    .sort((a, b) => a.diffMinutes - b.diffMinutes)[0];

                if (closest && closest.diffMinutes <= maxClosestDiffMinutes) {
                    assigned = {
                        agent: closest.agent,
                        agentNumber: code,
                        estadoInicio: closest.estadoInicio,
                        estadoFin: closest.estadoFin,
                        matchMethod: `zoiper_mas_cercano_${closest.diffMinutes}m`,
                    };
                    break;
                }
            }
        }

        return {
            ...row,
            zoiperCandidate: candidates.join(" / "),
            asesorProbable: String(assigned?.agent || "").trim(),
            asesorZoiperCode: String(assigned?.agentNumber || "").trim(),
            asesorEstadoInicio: assigned?.estadoInicio || null,
            asesorEstadoFin: assigned?.estadoFin || null,
            asesorMatchMethod: String(assigned?.matchMethod || "").trim(),
        };
    });

    const summaryMap = new Map();
    for (const row of data) {
        const advisor = String(row?.asesorProbable || "").trim() || "SIN_ASIGNAR";
        const item = summaryMap.get(advisor) || {
            asesor: advisor,
            totalNoRegistradas: 0,
            zoiperCodes: new Set(),
        };
        item.totalNoRegistradas += 1;
        const code = String(row?.asesorZoiperCode || "").trim();
        if (code) item.zoiperCodes.add(code);
        summaryMap.set(advisor, item);
    }

    const summary = Array.from(summaryMap.values())
        .map((item) => ({
            asesor: item.asesor,
            totalNoRegistradas: item.totalNoRegistradas,
            zoiperCodes: Array.from(item.zoiperCodes).join(" / "),
        }))
        .sort((a, b) => b.totalNoRegistradas - a.totalNoRegistradas);

    return {
        ...base,
        totals: {
            ...base.totals,
            assigned: data.filter((item) => Boolean(item.asesorProbable)).length,
            unassigned: data.filter((item) => !item.asesorProbable).length,
        },
        summary,
        data,
    };
}

router.use(requireAuth);
router.use(loadUserRoles);
router.get(
    "/inbound-no-registradas-mias",
    requireRole(["ASESOR", "SUPERVISOR"]),
    async (req, res) => {
        try {
            const startDate = String(req.query?.startDate || "").trim();
            const endDate = String(req.query?.endDate || "").trim();
            const limitRaw = Number(req.query?.limit || 1200);
            const limit = Number.isFinite(limitRaw)
                ? Math.max(100, Math.min(5000, Math.floor(limitRaw)))
                : 1200;

            const dataset = await buildInboundUnregisteredByAdvisorDataset({
                startDate,
                endDate,
                limit,
            });

            const agentKeys = getUserAgentIdentityKeys(req.user);
            const data = (dataset.data || []).filter((row) =>
                agentKeys.has(normalizeAgentIdentity(row?.asesorProbable || "")),
            );

            const summaryMap = new Map();
            for (const row of data) {
                const advisor =
                    String(row?.asesorProbable || "").trim() || "SIN_ASIGNAR";
                const item = summaryMap.get(advisor) || {
                    asesor: advisor,
                    totalNoRegistradas: 0,
                    zoiperCodes: new Set(),
                };
                item.totalNoRegistradas += 1;
                const code = String(row?.asesorZoiperCode || "").trim();
                if (code) item.zoiperCodes.add(code);
                summaryMap.set(advisor, item);
            }

            const summary = Array.from(summaryMap.values())
                .map((item) => ({
                    asesor: item.asesor,
                    totalNoRegistradas: item.totalNoRegistradas,
                    zoiperCodes: Array.from(item.zoiperCodes).join(" / "),
                }))
                .sort((a, b) => b.totalNoRegistradas - a.totalNoRegistradas);

            return res.json({
                ...dataset,
                totals: {
                    ...dataset.totals,
                    missing: data.length,
                    assigned: data.filter((item) => Boolean(item.asesorProbable))
                        .length,
                    unassigned: data.filter((item) => !item.asesorProbable)
                        .length,
                },
                summary,
                data,
            });
        } catch (err) {
            if (Number(err?.statusCode || 0) === 400) {
                return res.status(400).json({ error: err?.message || "" });
            }
            console.error(
                "Error al obtener inbound no registradas del asesor:",
                err,
            );
            return res.status(500).json({
                error: "Error al obtener inbound no registradas del asesor",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);
router.use(requireRole(["SUPERVISOR"]));

router.get("/grabaciones", getRecordingsByPhone);
router.get("/grabaciones-inbound", getInboundRecordings);
router.post("/depuracion-inbound-fantasma/run", async (req, res) => {
    try {
        const startDate = String(req.body?.startDate || req.query?.startDate || "").trim();
        const endDate = String(req.body?.endDate || req.query?.endDate || "").trim();
        const thresholdSeconds = Number(
            req.body?.thresholdSeconds ?? req.query?.thresholdSeconds,
        );
        const limit = Number(req.body?.limit ?? req.query?.limit);

        const result = await runInboundGhostDepuration({
            startDate,
            endDate,
            thresholdSeconds: Number.isFinite(thresholdSeconds)
                ? thresholdSeconds
                : undefined,
            limit: Number.isFinite(limit) ? limit : undefined,
        });

        return res.json({
            ok: true,
            message: "Depuración inbound fantasma ejecutada",
            data: result,
        });
    } catch (err) {
        console.error("Error en depuracion inbound fantasma manual:", err);
        return res.status(500).json({
            error: "Error ejecutando depuracion inbound fantasma",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});
router.get("/llamadas-inbound-sin-gestion", async (req, res) => {
    try {
        const startDate = String(req.query?.startDate || "").trim();
        const endDate = String(req.query?.endDate || "").trim();
        const limitRaw = Number(req.query?.limit || 1200);
        const limit = Number.isFinite(limitRaw)
            ? Math.max(100, Math.min(5000, Math.floor(limitRaw)))
            : 1200;

        const result = await buildInboundMissingCallsDataset({
            startDate,
            endDate,
            limit,
        });

        return res.json(result);
    } catch (err) {
        if (Number(err?.statusCode || 0) === 400) {
            return res.status(400).json({ error: err?.message || "" });
        }
        console.error("Error al obtener llamadas inbound sin gesti�n:", err);
        return res.status(500).json({
            error: "Error al obtener llamadas inbound sin gesti�n",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/inbound-no-registradas", async (req, res) => {
    try {
        const startDate = String(req.query?.startDate || "").trim();
        const endDate = String(req.query?.endDate || "").trim();
        const limitRaw = Number(req.query?.limit || 1200);
        const limit = Number.isFinite(limitRaw)
            ? Math.max(100, Math.min(5000, Math.floor(limitRaw)))
            : 1200;

        const dataset = await buildInboundUnregisteredByAdvisorDataset({
            startDate,
            endDate,
            limit,
        });
        return res.json(dataset);
    } catch (err) {
        if (Number(err?.statusCode || 0) === 400) {
            return res.status(400).json({ error: err?.message || "" });
        }
        console.error("Error al obtener inbound no registradas por asesor:", err);
        return res.status(500).json({
            error: "Error al obtener inbound no registradas por asesor",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});
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

