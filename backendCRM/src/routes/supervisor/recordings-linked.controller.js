import { pool, isabelPool } from "../../services/db.multi.js";
import {
    buildRecordingPath,
    getLinkedRecordingsForManagements,
    linkManagementToRecording,
} from "../../services/recording-link.service.js";
import * as userService from "../../services/user.service.js";
import { desencriptar } from "../../utils/crypto.js";

const TARGET_YEAR = 2026;
const TARGET_YEAR_START = `${TARGET_YEAR}-01-01 00:00:00`;
const TARGET_YEAR_END = `${TARGET_YEAR + 1}-01-01 00:00:00`;
const OUTBOUND_SCHEMA =
    process.env.MYSQL_DB ||
    process.env.MYSQL_DB_ENCUESTA ||
    "cck_dev_pruebas";

function buildLinkKey(schemaName, contactId, interactionId = "") {
    return [
        String(schemaName || "").trim(),
        String(contactId || "").trim(),
        String(interactionId || "").trim(),
    ].join("::");
}

function isFromTargetYear(value) {
    if (!value) {
        return false;
    }

    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === TARGET_YEAR;
}

function parseDateValue(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateString(value) {
    const date = parseDateValue(value);
    if (!date) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function resolveDateRange(startDateValue = "", endDateValue = "", dateValue = "") {
    const normalizedStart = String(startDateValue || "").trim();
    const normalizedEnd = String(endDateValue || "").trim();
    const normalizedSingle = String(dateValue || "").trim();
    const normalized =
        normalizedStart || normalizedEnd || normalizedSingle || "";

    if (!normalizedStart && !normalizedEnd && !normalizedSingle) {
        return {
            start: TARGET_YEAR_START,
            end: TARGET_YEAR_END,
        };
    }
    const toSqlDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
            date.getDate(),
        ).padStart(2, "0")} 00:00:00`;

    const parsedStart = new Date(`${(normalizedStart || normalized)}T00:00:00`);
    const parsedEndBase = new Date(`${(normalizedEnd || normalizedStart || normalized)}T00:00:00`);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEndBase.getTime())) {
        return {
            start: TARGET_YEAR_START,
            end: TARGET_YEAR_END,
        };
    }

    const parsedEndExclusive = new Date(parsedEndBase);
    parsedEndExclusive.setDate(parsedEndExclusive.getDate() + 1);

    return {
        start: toSqlDate(parsedStart),
        end: toSqlDate(parsedEndExclusive),
    };
}

function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
}

function findClosestCdrForManagement(cdrRows, management) {
    const phone = normalizePhone(management?.ContactAddress);
    if (!phone) {
        return null;
    }

    const managementDate = parseDateValue(management?.TmStmp);
    const candidates = cdrRows.filter((cdr) => {
        const src = normalizePhone(cdr?.src);
        const dst = normalizePhone(cdr?.dst);
        return src === phone || dst === phone;
    });

    if (!candidates.length) {
        return null;
    }

    if (!managementDate) {
        return candidates[0];
    }

    return candidates.reduce((closest, candidate) => {
        const candidateDate = parseDateValue(candidate?.calldate);
        if (!candidateDate) {
            return closest;
        }

        if (!closest) {
            return candidate;
        }

        const closestDate = parseDateValue(closest?.calldate);
        if (!closestDate) {
            return candidate;
        }

        const candidateDiff = Math.abs(
            candidateDate.getTime() - managementDate.getTime(),
        );
        const closestDiff = Math.abs(
            closestDate.getTime() - managementDate.getTime(),
        );

        return candidateDiff < closestDiff ? candidate : closest;
    }, null);
}

async function fetchCdrRowsByPhonesInBatches({
    start,
    end,
    phones = [],
    batchSize = 250,
}) {
    const dedupedPhones = Array.from(
        new Set(
            phones
                .map((value) => {
                    const digits = normalizePhone(value);
                    if (!digits) return "";
                    return digits.length > 10 ? digits.slice(-10) : digits;
                })
                .filter(Boolean),
        ),
    );

    if (!dedupedPhones.length) {
        return [];
    }

    const allRows = [];
    for (let i = 0; i < dedupedPhones.length; i += batchSize) {
        const batch = dedupedPhones.slice(i, i + batchSize);
        const placeholders = batch.map(() => "?").join(",");
        const cdrQuery = `
            SELECT calldate, src, dst, disposition, duration, recordingfile
            FROM cdr
            WHERE recordingfile IS NOT NULL
              AND calldate >= ?
              AND calldate < ?
              AND (
                (
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(dst, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), 10)
                    IN (${placeholders})
                )
                OR
                (
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(src, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), 10)
                    IN (${placeholders})
                )
              )
            ORDER BY calldate DESC
        `;

        const [rows] = await isabelPool.query(cdrQuery, [
            start,
            end,
            ...batch,
            ...batch,
        ]);
        allRows.push(...rows);
    }

    return allRows;
}

async function buildAgentNameMap() {
    const users = await userService.obtenerUsuarios();
    const agentNameMap = new Map();

    for (const user of users || []) {
        let username = "";
        try {
            username = user?.Id ? desencriptar(user.Id) : "";
        } catch (err) {
            username = "";
        }

        const normalizedUsername = String(username || "").trim();
        if (!normalizedUsername) {
            continue;
        }

        const fullName = `${user?.Name1 || ""} ${user?.Name2 || ""} ${user?.Surname1 || ""} ${user?.Surname2 || ""}`
            .replace(/\s+/g, " ")
            .trim();

        agentNameMap.set(normalizedUsername, fullName || normalizedUsername);
    }

    return agentNameMap;
}

async function buildClientByPhoneMap(phones = []) {
    const normalizedPhones = Array.from(
        new Set(phones.map((phone) => normalizePhone(phone)).filter(Boolean)),
    );

    if (!normalizedPhones.length) {
        return new Map();
    }

    const placeholders = normalizedPhones.map(() => "?").join(",");
    const [rows] = await pool.query(
        `
        SELECT ContactAddress, ContactName, NOMBRE_CLIENTE, ContactId, CampaignId, TmStmp, IDENTIFICACION
        FROM ${OUTBOUND_SCHEMA}.clientes_outbound
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(ContactAddress, ' ', ''), '-', ''), '(', ''), ')', '') IN (${placeholders})
        ORDER BY TmStmp DESC, Id DESC
        `,
        normalizedPhones,
    );

    const clientMap = new Map();
    for (const row of rows) {
        const phoneKey = normalizePhone(row?.ContactAddress);
        if (!phoneKey || clientMap.has(phoneKey)) {
            continue;
        }

        clientMap.set(phoneKey, row);
    }

    return clientMap;
}

export async function getRecordingsByPhone(req, res) {
    try {
        const {
            phone,
            date,
            startDate,
            endDate,
            campaignId,
            importId,
        } = req.query;
        const { start, end } = resolveDateRange(startDate, endDate, date);

        let query1 = `SELECT '${OUTBOUND_SCHEMA}' AS schema_name, Id, ContactId, InteractionId, TmStmp, CampaignId, ContactName, ContactAddress, ImportId, Agent, ResultLevel1, IDENTIFICACION
                        FROM ${OUTBOUND_SCHEMA}.gestionfinal_outbound
                        WHERE ContactAddress IS NOT null and ContactAddress !=''
                        and TmStmp >= ? and TmStmp < ?
                        and ResultLevel1 !='' `;
        let params1 = [start, end];
        if (phone) {
            query1 += ` AND ContactAddress = ?`;
            params1.push(phone);
        }
        if (String(campaignId || "").trim()) {
            query1 += ` AND TRIM(CampaignId) = TRIM(?)`;
            params1.push(String(campaignId).trim());
        }
        if (String(importId || "").trim()) {
            query1 += ` AND (TRIM(COALESCE(ImportId, '')) = TRIM(?) OR TRIM(COALESCE(Importid, '')) = TRIM(?) OR TRIM(COALESCE(ImportID, '')) = TRIM(?))`;
            params1.push(
                String(importId).trim(),
                String(importId).trim(),
                String(importId).trim(),
            );
        }
        query1 += ` ORDER BY TmStmp DESC, Id DESC`;
        const [gestionRows] = await pool.query(query1, params1);
        if (!gestionRows.length) {
            return res.json([]);
        }

        const linkedRecordings = await getLinkedRecordingsForManagements(
            gestionRows,
        );
        const agentNameMap = await buildAgentNameMap();

        const phones = gestionRows.map((g) => g.ContactAddress).filter(Boolean);
        if (!phones.length) {
            return res.json([]);
        }

        const cdrRows = await fetchCdrRowsByPhonesInBatches({
            start,
            end,
            phones,
        });
        const clientByPhoneMap = await buildClientByPhoneMap(
            cdrRows.flatMap((cdr) => [cdr?.src, cdr?.dst]),
        );

        const recordings = gestionRows
            .map((g) => {
                const linkedCandidate =
                linkedRecordings.get(
                    buildLinkKey(g.schema_name, g.ContactId, g.InteractionId),
                ) ||
                linkedRecordings.get(buildLinkKey(g.schema_name, g.ContactId)) ||
                null;
                const linkedHasRecordingData = Boolean(
                    linkedCandidate?.recording_path ||
                        linkedCandidate?.recordingfile,
                );
                const linked = isFromTargetYear(linkedCandidate?.cdr_calldate) ||
                    linkedHasRecordingData
                    ? linkedCandidate
                    : null;

                const cdr = findClosestCdrForManagement(cdrRows, g);
                const linkedRecordingfileFromCdr =
                    linked?.recordingfile && linked?.cdr_calldate
                        ? buildRecordingPath(
                              linked.recordingfile,
                              linked.cdr_calldate,
                          )
                        : null;
                const fallbackRecordingfile =
                    cdr?.recordingfile && cdr?.calldate
                        ? buildRecordingPath(cdr.recordingfile, cdr.calldate)
                        : null;
                const fallbackClient =
                    !linked && cdr
                        ? clientByPhoneMap.get(normalizePhone(cdr?.dst)) ||
                          clientByPhoneMap.get(normalizePhone(cdr?.src)) ||
                          null
                        : null;
                const fallbackPhone = normalizePhone(cdr?.dst || cdr?.src);
                const basePhone = normalizePhone(g?.ContactAddress);
                const isFallbackAmbiguous =
                    !linked && Boolean(cdr) && fallbackPhone !== basePhone;

                return {
                    ...g,
                    ContactName:
                        isFallbackAmbiguous
                            ? "Cliente no confirmado"
                            : fallbackClient?.ContactName ||
                              fallbackClient?.NOMBRE_CLIENTE ||
                              g.ContactName,
                    ContactId:
                        isFallbackAmbiguous
                            ? g.ContactId
                            : fallbackClient?.ContactId || g.ContactId,
                    Cedula:
                        g.IDENTIFICACION ||
                        (isFallbackAmbiguous
                            ? g.ContactId
                            : fallbackClient?.IDENTIFICACION || g.ContactId),
                    // Keep original management campaign to avoid cross-campaign
                    // contamination when fallback client lookup matches by phone.
                    CampaignId: g.CampaignId,
                    AgentName:
                        agentNameMap.get(String(g.Agent || "").trim()) ||
                        String(g.Agent || "").trim(),
                    calldate: linked?.cdr_calldate || cdr?.calldate || null,
                    src: linked?.cdr_src || cdr?.src || null,
                    dst: linked?.cdr_dst || cdr?.dst || null,
                    disposition:
                        linked?.cdr_disposition || cdr?.disposition || null,
                    duration: linked?.cdr_duration || cdr?.duration || null,
                    recordingfile:
                        linked?.recording_path ||
                        linkedRecordingfileFromCdr ||
                        linked?.recordingfile ||
                        fallbackRecordingfile ||
                        null,
                    recordingLinked: Boolean(
                        linked?.recording_path || linked?.recordingfile,
                    ),
                    fallbackAmbiguous: isFallbackAmbiguous,
                    calldateLocal:
                        toLocalDateString(
                            linked?.cdr_calldate || cdr?.calldate || null,
                        ) || null,
                };
            })
            .filter((recording) => {
                // Keep managements visible even when there is no linked recording yet.
                // If calldate is present but invalid (e.g. "0000-00-00 00:00:00"),
                // fall back to management timestamp.
                if (isFromTargetYear(recording.calldate)) {
                    return true;
                }
                return isFromTargetYear(recording.TmStmp);
            });

        return res.json(recordings);
    } catch (err) {
        console.error("Error al obtener grabaciones:", err);
        return res.status(500).json({ error: "Error al obtener grabaciones" });
    }
}

export async function getOutboundRecordingFilterOptions(req, res) {
    try {
        const { date, startDate, endDate } = req.query;
        const { start, end } = resolveDateRange(startDate, endDate, date);

        const [rows] = await pool.query(
            `
            SELECT CampaignId, ImportId, Importid, ImportID
            FROM ${OUTBOUND_SCHEMA}.gestionfinal_outbound
            WHERE ContactAddress IS NOT NULL
              AND ContactAddress <> ''
              AND ResultLevel1 <> ''
              AND TmStmp >= ?
              AND TmStmp < ?
            ORDER BY TmStmp DESC, Id DESC
            `,
            [start, end],
        );

        const campaigns = new Set();
        const basesByCampaign = new Map();

        for (const row of rows || []) {
            const campaign = String(row?.CampaignId || "").trim();
            const base = String(
                row?.ImportId || row?.Importid || row?.ImportID || "",
            ).trim();
            if (!campaign) continue;
            campaigns.add(campaign);
            if (!basesByCampaign.has(campaign)) {
                basesByCampaign.set(campaign, new Set());
            }
            if (base) {
                basesByCampaign.get(campaign).add(base);
            }
        }

        return res.json({
            campaigns: Array.from(campaigns).sort((a, b) => a.localeCompare(b)),
            basesByCampaign: Array.from(basesByCampaign.entries()).reduce(
                (acc, [campaign, bases]) => {
                    acc[campaign] = Array.from(bases).sort((a, b) =>
                        a.localeCompare(b),
                    );
                    return acc;
                },
                {},
            ),
        });
    } catch (err) {
        console.error("Error al obtener filtros de grabaciones outbound:", err);
        return res.status(500).json({
            error: "Error al obtener filtros de grabaciones outbound",
        });
    }
}

export async function runOutboundRecordingDepuration(req, res) {
    try {
        const startDate = String(req.body?.startDate || req.query?.startDate || "").trim();
        const endDate = String(req.body?.endDate || req.query?.endDate || "").trim();
        const campaignId = String(req.body?.campaignId || req.query?.campaignId || "").trim();
        const limitRaw = Number(req.body?.limit ?? req.query?.limit ?? 3000);
        const limit = Number.isFinite(limitRaw)
            ? Math.max(1, Math.min(10000, Math.floor(limitRaw)))
            : 3000;
        const onlyMissing = String(
            req.body?.onlyMissing ?? req.query?.onlyMissing ?? "1",
        ).trim() !== "0";
        const { start, end } = resolveDateRange(startDate, endDate, "");

        const params = [start, end];
        let sql = `
            SELECT
                Id, ContactId, InteractionId, CampaignId, Agent, ContactAddress, TmStmp
            FROM ${OUTBOUND_SCHEMA}.gestionfinal_outbound g
            WHERE g.ContactAddress IS NOT NULL
              AND g.ContactAddress <> ''
              AND g.TmStmp >= ?
              AND g.TmStmp < ?
        `;

        if (campaignId) {
            sql += " AND TRIM(g.CampaignId) = TRIM(?)";
            params.push(campaignId);
        }

        if (onlyMissing) {
            sql += `
              AND NOT EXISTS (
                  SELECT 1
                  FROM management_recording_link m
                  WHERE m.schema_name = ?
                    AND TRIM(COALESCE(m.gestion_contact_id, '')) = TRIM(COALESCE(g.ContactId, ''))
                    AND (
                        TRIM(COALESCE(m.interaction_id, '')) = TRIM(COALESCE(g.InteractionId, ''))
                        OR TRIM(COALESCE(m.interaction_id, '')) = ''
                    )
              )
            `;
            params.push(OUTBOUND_SCHEMA);
        }

        sql += " ORDER BY g.TmStmp DESC, g.Id DESC LIMIT ?";
        params.push(limit);

        const [rows] = await pool.query(sql, params);
        let processed = 0;
        let linked = 0;
        let noMatch = 0;
        let errors = 0;

        for (const row of rows || []) {
            processed += 1;
            try {
                const match = await linkManagementToRecording({
                    schemaName: OUTBOUND_SCHEMA,
                    contactId: String(row?.ContactId || "").trim(),
                    gestionRowId: String(row?.Id || "").trim(),
                    interactionId: String(row?.InteractionId || "").trim(),
                    campaignId: String(row?.CampaignId || "").trim(),
                    agent: String(row?.Agent || "").trim(),
                    contactAddress: String(row?.ContactAddress || "").trim(),
                    managementTimestamp: row?.TmStmp || null,
                });
                if (match?.recordingfile) {
                    linked += 1;
                } else {
                    noMatch += 1;
                }
            } catch {
                errors += 1;
            }
        }

        return res.json({
            ok: true,
            message: "Depuracion outbound ejecutada",
            data: {
                start,
                end,
                campaignId: campaignId || null,
                onlyMissing,
                limit,
                processed,
                linked,
                noMatch,
                errors,
            },
        });
    } catch (err) {
        console.error("Error en depuracion outbound manual:", err);
        return res.status(500).json({
            error: "Error ejecutando depuracion outbound",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
}
