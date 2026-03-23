import dotenv from "dotenv";
import pool from "./db.js";
import { isabelPool } from "./db.multi.js";

dotenv.config();

let recordingLinkInfraReady = false;

const DEFAULT_ENCUESTA_SCHEMA =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev";

function normalizeValue(value) {
    return String(value || "").trim();
}

function buildCompositeKey(schemaName, contactId, interactionId = "") {
    return [
        normalizeValue(schemaName),
        normalizeValue(contactId),
        normalizeValue(interactionId),
    ].join("::");
}

export function buildRecordingPath(recordingfile, calldate) {
    if (!recordingfile || !calldate) {
        return null;
    }

    const date = new Date(calldate);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd}/${recordingfile}`;
}

export async function ensureRecordingLinkTable(connectionOrPool = pool) {
    if (recordingLinkInfraReady) {
        return;
    }

    await connectionOrPool.query(`
        CREATE TABLE IF NOT EXISTS management_recording_link (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            schema_name VARCHAR(100) NOT NULL,
            gestion_contact_id VARCHAR(100) NOT NULL,
            gestion_row_id VARCHAR(100) NULL,
            interaction_id VARCHAR(128) NULL,
            campaign_id VARCHAR(150) NULL,
            agent VARCHAR(100) NULL,
            contact_address VARCHAR(50) NULL,
            management_timestamp DATETIME NULL,
            cdr_uniqueid VARCHAR(64) NULL,
            cdr_calldate DATETIME NULL,
            cdr_src VARCHAR(50) NULL,
            cdr_dst VARCHAR(50) NULL,
            cdr_disposition VARCHAR(50) NULL,
            cdr_duration INT NULL,
            recordingfile VARCHAR(255) NULL,
            recording_path VARCHAR(255) NULL,
            linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_mrl_contact (schema_name, gestion_contact_id),
            KEY idx_mrl_interaction (schema_name, interaction_id),
            KEY idx_mrl_linked_at (linked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    recordingLinkInfraReady = true;
}

export async function findBestCdrMatch({
    phoneNumber,
    managementTimestamp,
}) {
    const phone = normalizeValue(phoneNumber);
    if (!phone) {
        return null;
    }

    const timestamp =
        managementTimestamp instanceof Date
            ? managementTimestamp
            : new Date(managementTimestamp || Date.now());

    if (Number.isNaN(timestamp.getTime())) {
        return null;
    }

    const [rows] = await isabelPool.query(
        `
        SELECT
            uniqueid,
            calldate,
            src,
            dst,
            disposition,
            duration,
            recordingfile
        FROM cdr
        WHERE recordingfile IS NOT NULL
          AND recordingfile <> ''
          AND dst = ?
          AND calldate BETWEEN DATE_SUB(?, INTERVAL 6 HOUR)
                          AND DATE_ADD(?, INTERVAL 10 MINUTE)
        ORDER BY ABS(TIMESTAMPDIFF(SECOND, calldate, ?)) ASC,
                 calldate DESC
        LIMIT 1
        `,
        [phone, timestamp, timestamp, timestamp],
    );

    if (!rows.length) {
        return null;
    }

    const cdr = rows[0];
    return {
        ...cdr,
        recording_path: buildRecordingPath(cdr.recordingfile, cdr.calldate),
    };
}

export async function linkManagementToRecording({
    schemaName = DEFAULT_ENCUESTA_SCHEMA,
    contactId,
    gestionRowId = "",
    interactionId = "",
    campaignId = "",
    agent = "",
    contactAddress = "",
    managementTimestamp = new Date(),
}) {
    const normalizedContactId = normalizeValue(contactId);
    const normalizedPhone = normalizeValue(contactAddress);

    if (!normalizedContactId || !normalizedPhone) {
        return null;
    }

    await ensureRecordingLinkTable(pool);

    const cdr = await findBestCdrMatch({
        phoneNumber: normalizedPhone,
        managementTimestamp,
    });

    if (!cdr) {
        return null;
    }

    const normalizedSchema = normalizeValue(schemaName);
    const normalizedInteractionId = normalizeValue(interactionId);
    const normalizedTimestamp =
        managementTimestamp instanceof Date
            ? managementTimestamp
            : new Date(managementTimestamp);

    await pool.query(
        `
        INSERT INTO management_recording_link (
            schema_name,
            gestion_contact_id,
            gestion_row_id,
            interaction_id,
            campaign_id,
            agent,
            contact_address,
            management_timestamp,
            cdr_uniqueid,
            cdr_calldate,
            cdr_src,
            cdr_dst,
            cdr_disposition,
            cdr_duration,
            recordingfile,
            recording_path,
            linked_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
            normalizedSchema,
            normalizedContactId,
            normalizeValue(gestionRowId),
            normalizedInteractionId,
            normalizeValue(campaignId),
            normalizeValue(agent),
            normalizedPhone,
            normalizedTimestamp,
            normalizeValue(cdr.uniqueid),
            cdr.calldate || null,
            normalizeValue(cdr.src),
            normalizeValue(cdr.dst),
            normalizeValue(cdr.disposition),
            Number(cdr.duration) || 0,
            normalizeValue(cdr.recordingfile),
            normalizeValue(cdr.recording_path),
        ],
    );

    return cdr;
}

export async function getLinkedRecordingsForManagements(managementRows = []) {
    const normalizedRows = Array.isArray(managementRows)
        ? managementRows
              .map((row) => ({
                  schemaName: normalizeValue(row.schema_name),
                  contactId: normalizeValue(row.ContactId),
                  interactionId: normalizeValue(row.InteractionId),
              }))
              .filter((row) => row.schemaName && row.contactId)
        : [];

    if (!normalizedRows.length) {
        return new Map();
    }

    await ensureRecordingLinkTable(pool);

    const conditions = normalizedRows.map(
        () =>
            "(schema_name = ? AND gestion_contact_id = ? AND (interaction_id = ? OR interaction_id IS NULL OR interaction_id = ''))",
    );
    const params = normalizedRows.flatMap((row) => [
        row.schemaName,
        row.contactId,
        row.interactionId,
    ]);

    const [rows] = await pool.query(
        `
        SELECT
            schema_name,
            gestion_contact_id,
            interaction_id,
            cdr_calldate,
            cdr_src,
            cdr_dst,
            cdr_disposition,
            cdr_duration,
            recordingfile,
            recording_path,
            linked_at
        FROM management_recording_link
        WHERE ${conditions.join(" OR ")}
        ORDER BY linked_at DESC, id DESC
        `,
        params,
    );

    const byKey = new Map();
    const fallbackByContact = new Map();

    for (const row of rows) {
        const exactKey = buildCompositeKey(
            row.schema_name,
            row.gestion_contact_id,
            row.interaction_id,
        );
        if (!byKey.has(exactKey)) {
            byKey.set(exactKey, row);
        }

        const contactKey = buildCompositeKey(
            row.schema_name,
            row.gestion_contact_id,
            "",
        );
        if (!fallbackByContact.has(contactKey)) {
            fallbackByContact.set(contactKey, row);
        }
    }

    const resolved = new Map();
    for (const row of normalizedRows) {
        const exactKey = buildCompositeKey(
            row.schemaName,
            row.contactId,
            row.interactionId,
        );
        const contactKey = buildCompositeKey(row.schemaName, row.contactId, "");
        const match = byKey.get(exactKey) || fallbackByContact.get(contactKey);

        if (match) {
            resolved.set(exactKey, match);
            resolved.set(contactKey, match);
        }
    }

    return resolved;
}
