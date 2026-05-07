import dotenv from "dotenv";
import { pool, isabelPool } from "../src/services/db.multi.js";
import { linkManagementToRecording } from "../src/services/recording-link.service.js";

dotenv.config();

const OUTBOUND_SCHEMA =
    process.env.MYSQL_DB || process.env.MYSQL_DB_ENCUESTA || "cck_dev";

function parseArgs(argv = []) {
    const args = {};
    for (const arg of argv) {
        if (!arg.startsWith("--")) continue;
        const [key, ...rest] = arg.slice(2).split("=");
        args[key] = rest.length ? rest.join("=").trim() : "1";
    }
    return args;
}

function asSqlBounds({
    startDateRaw = "",
    endDateRaw = "",
    startDateTimeRaw = "",
    endDateTimeRaw = "",
} = {}) {
    const startDateTime = String(startDateTimeRaw || "").trim();
    const endDateTime = String(endDateTimeRaw || "").trim();

    if (startDateTime || endDateTime) {
        if (!startDateTime || !endDateTime) {
            throw new Error(
                "Si usas hora debes enviar ambos: --start-dt y --end-dt",
            );
        }
        return {
            start: startDateTime,
            end: endDateTime,
        };
    }

    const startDate = String(startDateRaw || "").trim();
    const endDate = String(endDateRaw || "").trim() || startDate;
    if (!startDate) {
        throw new Error("Debes enviar --start=YYYY-MM-DD");
    }
    return {
        start: `${startDate} 00:00:00`,
        end: `${endDate} 23:59:59`,
    };
}

function asBool(value, defaultValue = true) {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase();
    if (!normalized) return defaultValue;
    if (["1", "true", "yes", "si", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return defaultValue;
}

async function getOutboundRows({
    start,
    end,
    campaign = "",
    limit = 10000,
    onlyMissing = true,
}) {
    const params = [start, end];
    let sql = `
        SELECT
            g.Id,
            g.ContactId,
            g.InteractionId,
            g.CampaignId,
            g.Agent,
            g.ContactAddress,
            g.TmStmp
        FROM ${OUTBOUND_SCHEMA}.gestionfinal_outbound g
        WHERE g.ContactAddress IS NOT NULL
          AND TRIM(g.ContactAddress) <> ''
          AND g.TmStmp >= ?
          AND g.TmStmp <= ?
    `;

    if (campaign) {
        sql += " AND g.CampaignId LIKE ?";
        params.push(`%${campaign}%`);
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
    return Array.isArray(rows) ? rows : [];
}

async function run() {
    const args = parseArgs(process.argv.slice(2));
    const { start, end } = asSqlBounds({
        startDateRaw: args.start,
        endDateRaw: args.end,
        startDateTimeRaw: args["start-dt"],
        endDateTimeRaw: args["end-dt"],
    });
    const campaign = String(args.campaign || "").trim();
    const limit = Number.isFinite(Number(args.limit))
        ? Math.max(1, Math.min(20000, Math.floor(Number(args.limit))))
        : 10000;
    const onlyMissing = asBool(args["only-missing"], true);

    console.log(
        `[backfill-outbound-recordings] schema=${OUTBOUND_SCHEMA} start=${start} end=${end} campaign=${campaign || "(todas)"} limit=${limit} onlyMissing=${onlyMissing}`,
    );

    const rows = await getOutboundRows({
        start,
        end,
        campaign,
        limit,
        onlyMissing,
    });

    let processed = 0;
    let linked = 0;
    let noMatch = 0;
    let errors = 0;

    for (const row of rows) {
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
        } catch (err) {
            errors += 1;
            console.error(
                `[backfill-outbound-recordings] error row Id=${row?.Id} ContactId=${row?.ContactId} InteractionId=${row?.InteractionId}: ${err?.message || err}`,
            );
        }
    }

    console.log("[backfill-outbound-recordings] resultado", {
        processed,
        linked,
        noMatch,
        errors,
    });
}

run()
    .catch((err) => {
        console.error(
            "[backfill-outbound-recordings] fatal:",
            err?.message || err,
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await Promise.allSettled([pool.end(), isabelPool.end()]);
    });
