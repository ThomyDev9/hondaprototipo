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
        const { phone = "" } = req.query;
        let query = `
            SELECT
                '${MAIN_SCHEMA}' AS schema_name,
                id,
                contact_id AS ContactId,
                interaction_id AS InteractionId,
                tmstmp AS TmStmp,
                campaign_id AS CampaignId,
                category_id AS CategoryId,
                menu_item_id AS MenuItemId,
                agent AS Agent,
                full_name AS ContactName,
                celular AS ContactAddress,
                ticket_id AS TicketId,
                categorizacion AS Categorizacion,
                result_level1 AS ResultLevel1,
                result_level2 AS ResultLevel2,
                payload_json AS PayloadJson
            FROM gestionfinal_inbound
            WHERE tmstmp >= ?
              AND tmstmp < ?
        `;
        const params = [TARGET_YEAR_START, TARGET_YEAR_END];

        if (String(phone || "").trim()) {
            query += " AND celular = ? ";
            params.push(String(phone).trim());
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

