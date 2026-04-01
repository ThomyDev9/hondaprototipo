import dotenv from "dotenv";
import RecordingLinkDAO from "./dao/RecordingLinkDAO.js";

dotenv.config();

let recordingLinkInfraReady = false;

const DEFAULT_OUTBOUND_SCHEMA =
    process.env.MYSQL_DB ||
    process.env.MYSQL_DB_ENCUESTA ||
    "cck_dev_pruebas";

const recordingLinkDAO = new RecordingLinkDAO();

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

export async function findBestCdrMatch({ phoneNumber, managementTimestamp }) {
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

    const cdr = await recordingLinkDAO.findNearestCdrByPhoneAndDate({
        phoneNumber: phone,
        managementTimestamp: timestamp,
    });

    if (!cdr) {
        return null;
    }

    return {
        ...cdr,
        recording_path: buildRecordingPath(cdr.recordingfile, cdr.calldate),
    };
}

export async function linkManagementToRecording({
    schemaName = DEFAULT_OUTBOUND_SCHEMA,
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

    await recordingLinkDAO.insertManagementRecordingLink({
        schemaName: normalizedSchema,
        contactId: normalizedContactId,
        gestionRowId: normalizeValue(gestionRowId),
        interactionId: normalizedInteractionId,
        campaignId: normalizeValue(campaignId),
        agent: normalizeValue(agent),
        contactAddress: normalizedPhone,
        managementTimestamp: normalizedTimestamp,
        cdr: {
            ...cdr,
            uniqueid: normalizeValue(cdr.uniqueid),
            src: normalizeValue(cdr.src),
            dst: normalizeValue(cdr.dst),
            disposition: normalizeValue(cdr.disposition),
            recordingfile: normalizeValue(cdr.recordingfile),
        },
        recordingPath: normalizeValue(cdr.recording_path),
    });

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

    const conditions = normalizedRows.map(
        () =>
            "(schema_name = ? AND gestion_contact_id = ? AND (interaction_id = ? OR interaction_id IS NULL OR interaction_id = ''))",
    );
    const params = normalizedRows.flatMap((row) => [
        row.schemaName,
        row.contactId,
        row.interactionId,
    ]);

    const rows = await recordingLinkDAO.getLinkedRecordingsByConditions(
        conditions.join(" OR "),
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

export async function ensureRecordingLinkInfrastructure() {
    if (recordingLinkInfraReady) {
        return;
    }

    recordingLinkInfraReady = true;
}
