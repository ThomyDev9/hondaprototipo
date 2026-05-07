import { pool } from "../../services/db.multi.js";
import { getLinkedRecordingsForManagements } from "../../services/recording-link.service.js";
import * as userService from "../../services/user.service.js";
import { desencriptar } from "../../utils/crypto.js";

const TARGET_YEAR = 2026;
const TARGET_YEAR_START = `${TARGET_YEAR}-01-01 00:00:00`;
const TARGET_YEAR_END = `${TARGET_YEAR + 1}-01-01 00:00:00`;
const MAIN_SCHEMA =
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

function toLocalDateString(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function resolveDateRange(startDateValue = "", endDateValue = "") {
    const normalizedStart = String(startDateValue || "").trim();
    const normalizedEnd = String(endDateValue || "").trim();

    if (!normalizedStart && !normalizedEnd) {
        return {
            start: TARGET_YEAR_START,
            end: TARGET_YEAR_END,
        };
    }

    const startBase = normalizedStart || normalizedEnd;
    const endBase = normalizedEnd || normalizedStart;
    const parsedStart = new Date(`${startBase}T00:00:00`);
    const parsedEnd = new Date(`${endBase}T00:00:00`);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
        return {
            start: TARGET_YEAR_START,
            end: TARGET_YEAR_END,
        };
    }

    const nextDay = new Date(parsedEnd);
    nextDay.setDate(nextDay.getDate() + 1);

    const toSql = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
            date.getDate(),
        ).padStart(2, "0")} 00:00:00`;

    return {
        start: toSql(parsedStart),
        end: toSql(nextDay),
    };
}

async function buildAgentNameMap() {
    const users = await userService.obtenerUsuarios();
    const agentNameMap = new Map();

    for (const user of users || []) {
        let username = "";
        try {
            username = user?.Id ? desencriptar(user.Id) : "";
        } catch {
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

export async function getInboundRecordings(req, res) {
    try {
        const {
            phone = "",
            identification = "",
            search = "",
            campaignId = "",
            startDate = "",
            endDate = "",
        } = req.query;
        const { start, end } = resolveDateRange(startDate, endDate);
        const searchValue = String(search || "").trim();
        let query = `
            SELECT
                '${MAIN_SCHEMA}' AS schema_name,
                id,
                contact_id AS ContactId,
                interaction_id AS InteractionId,
                DATE_FORMAT(tmstmp, '%Y-%m-%d %H:%i:%s') AS TmStmp,
                campaign_id AS CampaignId,
                category_id AS CategoryId,
                menu_item_id AS MenuItemId,
                agent AS Agent,
                full_name AS ContactName,
                identification AS Identification,
                celular AS ContactAddress,
                ticket_id AS TicketId,
                categorizacion AS Categorizacion,
                result_level1 AS ResultLevel1,
                result_level2 AS ResultLevel2,
                payload_json AS PayloadJson
            FROM gestionfinal_inbound
            WHERE tmstmp >= ?
              AND tmstmp < ?
              AND LOWER(TRIM(COALESCE(categorizacion, ''))) <> 'llamada fantasma'
        `;
        const params = [start, end];

        if (String(phone || "").trim()) {
            query += " AND celular LIKE ? ";
            params.push(`%${String(phone).trim()}%`);
        }

        if (String(identification || "").trim()) {
            query += " AND identification LIKE ? ";
            params.push(`%${String(identification).trim()}%`);
        }
        if (String(campaignId || "").trim()) {
            query += " AND campaign_id = ? ";
            params.push(String(campaignId).trim());
        }
        if (searchValue) {
            query += " AND (celular LIKE ? OR identification LIKE ?) ";
            params.push(`%${searchValue}%`, `%${searchValue}%`);
        }

        query += " ORDER BY tmstmp DESC, id DESC LIMIT 1000";

        const [gestionRows] = await pool.query(query, params);
        if (!gestionRows.length) {
            return res.json([]);
        }

        const linkedRecordings = await getLinkedRecordingsForManagements(
            gestionRows,
        );
        const agentNameMap = await buildAgentNameMap();

        const recordings = gestionRows
            .map((row) => {
                const linked =
                    linkedRecordings.get(
                        buildLinkKey(
                            row.schema_name,
                            row.ContactId,
                            row.InteractionId,
                        ),
                    ) ||
                    linkedRecordings.get(
                        buildLinkKey(row.schema_name, row.ContactId),
                    ) ||
                    null;

                let payload = {};
                try {
                    payload = row.PayloadJson ? JSON.parse(row.PayloadJson) : {};
                } catch {
                    payload = {};
                }

                return {
                    ...row,
                    AgentName:
                        agentNameMap.get(String(row.Agent || "").trim()) ||
                        String(row.Agent || "").trim(),
                    Motivo:
                        String(payload?.__inbound_motivo || "").trim() ||
                        String(payload?.motivo || "").trim() ||
                        "",
                    Submotivo:
                        String(payload?.__inbound_submotivo || "").trim() ||
                        String(payload?.submotivo || "").trim() ||
                        "",
                    calldate: linked?.cdr_calldate || row.TmStmp || null,
                    calldateLocal: toLocalDateString(
                        linked?.cdr_calldate || row.TmStmp || null,
                    ),
                    src: linked?.cdr_src || null,
                    dst:
                        linked?.cdr_dst ||
                        String(row.ContactAddress || "").trim() ||
                        null,
                    disposition: linked?.cdr_disposition || null,
                    duration: linked?.cdr_duration || null,
                    recordingfile: linked?.recording_path || null,
                    recordingLinked: Boolean(linked?.recording_path),
                };
            })
            .filter((row) => row.recordingfile);

        return res.json(recordings);
    } catch (err) {
        console.error("Error al obtener grabaciones inbound:", err);
        return res.status(500).json({
            error: "Error al obtener grabaciones inbound",
        });
    }
}

export async function getInboundRecordingFilterOptions(req, res) {
    try {
        const { startDate = "", endDate = "" } = req.query;
        const { start, end } = resolveDateRange(startDate, endDate);

        const [rows] = await pool.query(
            `
            SELECT campaign_id AS CampaignId,
                   categorizacion AS Categorizacion,
                   agent AS Agent
            FROM gestionfinal_inbound
            WHERE tmstmp >= ?
              AND tmstmp < ?
              AND LOWER(TRIM(COALESCE(categorizacion, ''))) <> 'llamada fantasma'
            ORDER BY tmstmp DESC, id DESC
            `,
            [start, end],
        );

        const campaigns = Array.from(
            new Set((rows || []).map((r) => String(r?.CampaignId || "").trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b));
        const categorizaciones = Array.from(
            new Set((rows || []).map((r) => String(r?.Categorizacion || "").trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b));
        const agentes = Array.from(
            new Set((rows || []).map((r) => String(r?.Agent || "").trim()).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b));

        return res.json({ campaigns, categorizaciones, agentes });
    } catch (err) {
        console.error("Error al obtener filtros inbound:", err);
        return res.status(500).json({ error: "Error al obtener filtros inbound" });
    }
}
