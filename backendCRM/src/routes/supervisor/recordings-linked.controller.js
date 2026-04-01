import { pool, isabelPool } from "../../services/db.multi.js";
import {
    buildRecordingPath,
    getLinkedRecordingsForManagements,
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
        SELECT ContactAddress, ContactName, NOMBRE_CLIENTE, ContactId, CampaignId, TmStmp
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
        const { phone } = req.query;

        let query1 = `SELECT '${OUTBOUND_SCHEMA}' AS schema_name, Id, ContactId, InteractionId, TmStmp, CampaignId, ContactName, ContactAddress, ImportId, Agent, ResultLevel1
                        FROM ${OUTBOUND_SCHEMA}.gestionfinal_outbound
                        WHERE ContactAddress IS NOT null and ContactAddress !=''
                        and TmStmp >= ? and TmStmp < ?
                        and ResultLevel1 !='' `;
        let params1 = [TARGET_YEAR_START, TARGET_YEAR_END];
        if (phone) {
            query1 += ` AND ContactAddress = ?`;
            params1.push(phone);
        }
        query1 += ` ORDER BY TmStmp DESC, Id DESC LIMIT 1000`;
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

        const placeholders = phones.map(() => "?").join(",");
        const cdrQuery = `
            SELECT calldate, src, dst, disposition, duration, recordingfile
            FROM cdr
            WHERE recordingfile IS NOT NULL
              AND calldate >= ?
              AND calldate < ?
              AND (
                (dst IN (${placeholders}) and dst != '' and dst != 'null')
                OR
                (src IN (${placeholders}) and src != '' and src != 'null')
              )
            ORDER BY calldate DESC
        `;
        const [cdrRows] = await isabelPool.query(cdrQuery, [
            TARGET_YEAR_START,
            TARGET_YEAR_END,
            ...phones,
            ...phones,
        ]);
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
                const linked = isFromTargetYear(linkedCandidate?.cdr_calldate)
                    ? linkedCandidate
                    : null;

                const cdr = findClosestCdrForManagement(cdrRows, g);
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
                    CampaignId:
                        isFallbackAmbiguous
                            ? g.CampaignId
                            : fallbackClient?.CampaignId || g.CampaignId,
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
                        linked?.recording_path || fallbackRecordingfile || null,
                    recordingLinked: Boolean(linked?.recording_path),
                    fallbackAmbiguous: isFallbackAmbiguous,
                    calldateLocal:
                        toLocalDateString(
                            linked?.cdr_calldate || cdr?.calldate || null,
                        ) || null,
                };
            })
            .filter(
                (recording) =>
                    recording.recordingfile &&
                    isFromTargetYear(recording.calldate),
            );

        return res.json(recordings);
    } catch (err) {
        console.error("Error al obtener grabaciones:", err);
        return res.status(500).json({ error: "Error al obtener grabaciones" });
    }
}
