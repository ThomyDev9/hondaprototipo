import pool from "../db.js";
import { isabelPool } from "../db.multi.js";

export class RecordingLinkDAO {
    constructor(mainPool = pool, pbxPool = isabelPool) {
        this.pool = mainPool;
        this.isabelPool = pbxPool;
    }

    async findNearestCdrByPhoneAndDate({
        phoneNumber,
        managementTimestamp,
    }) {
        const [rows] = await this.isabelPool.query(
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
            [phoneNumber, managementTimestamp, managementTimestamp, managementTimestamp],
        );

        return rows[0] || null;
    }

    async insertManagementRecordingLink(payload) {
        const {
            schemaName,
            contactId,
            gestionRowId,
            interactionId,
            campaignId,
            agent,
            contactAddress,
            managementTimestamp,
            cdr,
            recordingPath,
        } = payload;

        await this.pool.query(
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
                schemaName,
                contactId,
                gestionRowId,
                interactionId,
                campaignId,
                agent,
                contactAddress,
                managementTimestamp,
                cdr.uniqueid,
                cdr.calldate || null,
                cdr.src,
                cdr.dst,
                cdr.disposition,
                Number(cdr.duration) || 0,
                cdr.recordingfile,
                recordingPath,
            ],
        );
    }

    async getLinkedRecordingsByConditions(conditionsSql, params) {
        const [rows] = await this.pool.query(
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
            WHERE ${conditionsSql}
            ORDER BY linked_at DESC, id DESC
            `,
            params,
        );

        return rows;
    }
}

export default RecordingLinkDAO;
