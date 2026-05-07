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
        preferredPeerIp = "",
    }) {
        const normalizedPhoneDigits = String(phoneNumber || "").replace(/\D/g, "");
        const phoneRight10 =
            normalizedPhoneDigits.length > 10
                ? normalizedPhoneDigits.slice(-10)
                : normalizedPhoneDigits;
        const normalizedIp = String(preferredPeerIp || "").trim();
        const hasPreferredIp = Boolean(normalizedIp);
        const ipLike = `%${normalizedIp}%`;
        const runNormalizedFallback = async () => {
            // Fallback robusto: comparar por ultimos 10 digitos, para cubrir prefijos (+593, 0, espacios, guiones).
            if (!phoneRight10) {
                return null;
            }

            const [fallbackRows] = await this.isabelPool.query(
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
                  AND calldate BETWEEN DATE_SUB(?, INTERVAL 12 HOUR)
                                  AND DATE_ADD(?, INTERVAL 6 HOUR)
                  AND (
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(dst, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), 10) = ?
                    OR
                    RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(src, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''), 10) = ?
                  )
                ORDER BY ABS(TIMESTAMPDIFF(SECOND, calldate, ?)) ASC,
                         calldate DESC
                LIMIT 1
                `,
                [
                    managementTimestamp,
                    managementTimestamp,
                    phoneRight10,
                    phoneRight10,
                    managementTimestamp,
                ],
            );

            return fallbackRows[0] || null;
        };

        try {
            const [rows] = await this.isabelPool.query(
                `
                SELECT
                    uniqueid,
                    calldate,
                    src,
                    dst,
                    disposition,
                    duration,
                    recordingfile,
                    channel,
                    dstchannel
                FROM cdr
                WHERE recordingfile IS NOT NULL
                  AND recordingfile <> ''
                  AND (dst = ? OR src = ?)
                  AND calldate BETWEEN DATE_SUB(?, INTERVAL 12 HOUR)
                                  AND DATE_ADD(?, INTERVAL 6 HOUR)
                ORDER BY
                    ${
                        hasPreferredIp
                            ? "CASE WHEN (channel LIKE ? OR dstchannel LIKE ?) THEN 0 ELSE 1 END ASC,"
                            : ""
                    }
                    ABS(TIMESTAMPDIFF(SECOND, calldate, ?)) ASC,
                    calldate DESC
                LIMIT 1
                `,
                hasPreferredIp
                    ? [
                          phoneNumber,
                          phoneNumber,
                          managementTimestamp,
                          managementTimestamp,
                          ipLike,
                          ipLike,
                          managementTimestamp,
                      ]
                    : [
                          phoneNumber,
                          phoneNumber,
                          managementTimestamp,
                          managementTimestamp,
                          managementTimestamp,
                      ],
            );

            if (rows[0]) {
                return rows[0];
            }

            return runNormalizedFallback();
        } catch (err) {
            // Compatibilidad: algunos CDR no incluyen channel/dstchannel.
            if (err?.code !== "ER_BAD_FIELD_ERROR") {
                throw err;
            }

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
                  AND (dst = ? OR src = ?)
                  AND calldate BETWEEN DATE_SUB(?, INTERVAL 12 HOUR)
                                  AND DATE_ADD(?, INTERVAL 6 HOUR)
                ORDER BY ABS(TIMESTAMPDIFF(SECOND, calldate, ?)) ASC,
                         calldate DESC
                LIMIT 1
                `,
                [
                    phoneNumber,
                    phoneNumber,
                    managementTimestamp,
                    managementTimestamp,
                    managementTimestamp,
                ],
            );

            if (rows[0]) {
                return rows[0];
            }

            return runNormalizedFallback();
        }
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
