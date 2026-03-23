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

function buildLinkKey(schemaName, contactId, interactionId = "") {
    return [
        String(schemaName || "").trim(),
        String(contactId || "").trim(),
        String(interactionId || "").trim(),
    ].join("::");
}

function isFromTargetYear(value) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === TARGET_YEAR;
}

function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
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
        if (!normalizedUsername) continue;

        const fullName = `${user?.Name1 || ""} ${user?.Name2 || ""} ${user?.Surname1 || ""} ${user?.Surname2 || ""}`
            .replace(/\s+/g, " ")
            .trim();

        agentNameMap.set(normalizedUsername, fullName || normalizedUsername);
    }

    return agentNameMap;
}

// Obtener grabaciones por número de teléfono (panel supervisor)
export async function getRecordingsByPhone(req, res) {
    try {
        const { phone } = req.query;
        // --- Consulta 1: Base principal (pool)
        let query1 = `SELECT 'bancopichinchaencuesta_dev' AS schema_name, Id, ContactId, InteractionId, TmStmp, CampaignId, ContactName, ContactAddress, ImportId, Agent, ResultLevel1
                        FROM bancopichinchaencuesta_dev.gestionfinal
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

        // Unir resultados (puedes limitar el total si quieres)
        if (!gestionRows.length) return res.json([]);

        const linkedRecordings = await getLinkedRecordingsForManagements(
            gestionRows,
        );
        const agentNameMap = await buildAgentNameMap();

        // Obtener grabaciones de cdr para los teléfonos encontrados (igual que antes)
        const phones = gestionRows.map((g) => g.ContactAddress).filter(Boolean);
        let recordings = [];
        if (phones.length) {
            const placeholders = phones.map(() => "?").join(",");
            const cdrQuery = `
        SELECT calldate, src, dst, disposition, recordingfile
        FROM cdr
        WHERE recordingfile IS NOT NULL
          AND calldate >= ?
          AND calldate < ?
          AND dst IN (${placeholders}) and dst != '' and dst != 'null'
        ORDER BY calldate DESC
      `;
            const [cdrRows] = await isabelPool.query(cdrQuery, [
                TARGET_YEAR_START,
                TARGET_YEAR_END,
                ...phones,
            ]);
            recordings = gestionRows.map((g) => {
                const linkedCandidate =
                    linkedRecordings.get(
                        buildLinkKey(g.schema_name, g.ContactId, g.InteractionId),
                    ) ||
                    linkedRecordings.get(buildLinkKey(g.schema_name, g.ContactId)) ||
                    null;
                const linked = isFromTargetYear(linkedCandidate?.cdr_calldate)
                    ? linkedCandidate
                    : null;
                const cdr = cdrRows.find((c) => c.dst === g.ContactAddress);
                const recordingfile =
                    linked?.recording_path ||
                    (cdr?.recordingfile && cdr?.calldate
                        ? buildRecordingPath(cdr.recordingfile, cdr.calldate)
                        : null);
                return {
                    ...g,
                    AgentName:
                        agentNameMap.get(String(g.Agent || "").trim()) ||
                        String(g.Agent || "").trim(),
                    calldate: linked?.cdr_calldate || cdr?.calldate || null,
                    src: linked?.cdr_src || cdr?.src || null,
                    dst: linked?.cdr_dst || cdr?.dst || null,
                    disposition: linked?.cdr_disposition || cdr?.disposition || null,
                    duration: linked?.cdr_duration || cdr?.duration || null,
                    recordingfile,
                    recordingLinked: Boolean(linked?.recording_path),
                };
            }).filter(
                (recording) =>
                    recording.recordingfile &&
                    isFromTargetYear(recording.calldate),
            );
        } else {
            recordings = [];
        }
        res.json(recordings);
    } catch (err) {
        console.error("Error al obtener grabaciones:", err);
        res.status(500).json({ error: "Error al obtener grabaciones" });
    }
}
