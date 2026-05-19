import pool from "../db.js";

export class ServiceResourcesDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async listResources({ campaignId = "", includeInactive = false }, executor = this.pool) {
        const params = [];
        let whereSql = "WHERE 1=1";

        if (String(campaignId || "").trim()) {
            whereSql +=
                " AND (LOWER(TRIM(r.campaign_id)) = LOWER(TRIM(?)) OR r.access_scope = 'all_advisors')";
            params.push(campaignId);
        }

        if (!includeInactive) {
            whereSql += " AND r.activo = 1";
        }

        const [rows] = await executor.query(
            `
            SELECT
                r.id,
                r.campaign_id,
                r.access_scope,
                r.nombre_servicio,
                r.url,
                r.notas,
                r.orden,
                r.activo,
                r.home_shortcut,
                r.requires_virtual_machine,
                r.virtual_machine_notes,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM coop_service_credentials t
                        WHERE t.resource_id = r.id
                          AND t.activo = 1
                          AND t.scope_type = 'advisor'
                    ) THEN 1
                    ELSE 0
                END AS requires_advisor_credential,
                c.id AS credential_id,
                c.alias,
                c.priority,
                c.activo AS credential_activo,
                c.scope_type,
                c.owner_user_id,
                c.owner_username,
                c.credential_kind
            FROM coop_service_resources r
            LEFT JOIN coop_service_credentials c
              ON c.resource_id = r.id
            ${whereSql}
            ORDER BY r.home_shortcut DESC, r.orden ASC, r.nombre_servicio ASC, c.priority ASC, c.alias ASC
            `,
            params,
        );

        return rows;
    }

    async createResource(payload = {}, executor = this.pool) {
        const [result] = await executor.query(
            `
            INSERT INTO coop_service_resources (
                campaign_id,
                access_scope,
                nombre_servicio,
                url,
                notas,
                orden,
                activo,
                home_shortcut,
                requires_virtual_machine,
                virtual_machine_notes,
                created_by,
                updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                payload.campaignId,
                payload.accessScope || "campaign",
                payload.nombreServicio,
                payload.url,
                payload.notas,
                payload.orden,
                payload.activo,
                Number(payload.homeShortcut || 0) === 1 ? 1 : 0,
                payload.requiresVirtualMachine,
                payload.virtualMachineNotes,
                payload.actor,
                payload.actor,
            ],
        );

        return result.insertId;
    }

    async updateResource(resourceId, payload = {}, executor = this.pool) {
        await executor.query(
            `
            UPDATE coop_service_resources
            SET campaign_id = ?,
                access_scope = ?,
                nombre_servicio = ?,
                url = ?,
                notas = ?,
                orden = ?,
                activo = ?,
                home_shortcut = ?,
                requires_virtual_machine = ?,
                virtual_machine_notes = ?,
                updated_by = ?,
                updated_at = NOW()
            WHERE id = ?
            `,
            [
                payload.campaignId,
                payload.accessScope || "campaign",
                payload.nombreServicio,
                payload.url,
                payload.notas,
                payload.orden,
                payload.activo,
                Number(payload.homeShortcut || 0) === 1 ? 1 : 0,
                payload.requiresVirtualMachine,
                payload.virtualMachineNotes,
                payload.actor,
                resourceId,
            ],
        );
    }

    async createCredential(payload = {}, executor = this.pool) {
        const [result] = await executor.query(
            `
            INSERT INTO coop_service_credentials (
                resource_id,
                alias,
                username_encrypted,
                username_iv,
                username_tag,
                password_encrypted,
                password_iv,
                password_tag,
                extra_encrypted,
                extra_iv,
                extra_tag,
                priority,
                activo,
                scope_type,
                owner_user_id,
                owner_username,
                credential_kind,
                created_by,
                updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                payload.resourceId,
                payload.alias,
                payload.username.encrypted,
                payload.username.iv,
                payload.username.tag,
                payload.password.encrypted,
                payload.password.iv,
                payload.password.tag,
                payload.extra?.encrypted || null,
                payload.extra?.iv || null,
                payload.extra?.tag || null,
                payload.priority,
                payload.activo,
                payload.scopeType || "global",
                payload.ownerUserId || null,
                payload.ownerUsername || null,
                payload.credentialKind || "app",
                payload.actor,
                payload.actor,
            ],
        );

        return result.insertId;
    }

    async updateCredential(credentialId, payload = {}, executor = this.pool) {
        await executor.query(
            `
            UPDATE coop_service_credentials
            SET alias = ?,
                username_encrypted = ?,
                username_iv = ?,
                username_tag = ?,
                password_encrypted = ?,
                password_iv = ?,
                password_tag = ?,
                extra_encrypted = ?,
                extra_iv = ?,
                extra_tag = ?,
                priority = ?,
                activo = ?,
                scope_type = ?,
                owner_user_id = ?,
                owner_username = ?,
                credential_kind = ?,
                updated_by = ?,
                updated_at = NOW()
            WHERE id = ?
            `,
            [
                payload.alias,
                payload.username.encrypted,
                payload.username.iv,
                payload.username.tag,
                payload.password.encrypted,
                payload.password.iv,
                payload.password.tag,
                payload.extra?.encrypted || null,
                payload.extra?.iv || null,
                payload.extra?.tag || null,
                payload.priority,
                payload.activo,
                payload.scopeType || "global",
                payload.ownerUserId || null,
                payload.ownerUsername || null,
                payload.credentialKind || "app",
                payload.actor,
                credentialId,
            ],
        );
    }

    async getCredentialById(credentialId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT
                c.id,
                c.resource_id,
                c.alias,
                c.username_encrypted,
                c.username_iv,
                c.username_tag,
                c.password_encrypted,
                c.password_iv,
                c.password_tag,
                c.extra_encrypted,
                c.extra_iv,
                c.extra_tag,
                c.scope_type,
                c.owner_user_id,
                c.owner_username,
                c.credential_kind,
                c.activo,
                r.campaign_id,
                r.nombre_servicio,
                r.activo AS resource_activo
            FROM coop_service_credentials c
            INNER JOIN coop_service_resources r ON r.id = c.resource_id
            WHERE c.id = ?
            LIMIT 1
            `,
            [credentialId],
        );

        return rows[0] || null;
    }

    async listResourcesWithResolvedCredentials(
        { campaignId = "", includeInactive = false, ownerUserId = 0 },
        executor = this.pool,
    ) {
        const params = [Number(ownerUserId || 0), Number(ownerUserId || 0)];
        let whereSql = "WHERE 1=1";

        if (String(campaignId || "").trim()) {
            whereSql +=
                " AND (LOWER(TRIM(r.campaign_id)) = LOWER(TRIM(?)) OR r.access_scope = 'all_advisors')";
            params.push(campaignId);
        }

        if (!includeInactive) {
            whereSql += " AND r.activo = 1";
        }

        const [rows] = await executor.query(
            `
            SELECT
                r.id,
                r.campaign_id,
                r.access_scope,
                r.nombre_servicio,
                r.url,
                r.notas,
                r.orden,
                r.activo,
                r.home_shortcut,
                r.requires_virtual_machine,
                r.virtual_machine_notes,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM coop_service_credentials t
                        WHERE t.resource_id = r.id
                          AND t.activo = 1
                          AND t.scope_type = 'advisor'
                    ) THEN 1
                    ELSE 0
                END AS requires_advisor_credential,
                appc.id AS app_credential_id,
                appc.alias AS app_alias,
                appc.priority AS app_priority,
                appc.scope_type AS app_scope_type,
                appc.owner_user_id AS app_owner_user_id,
                vmc.id AS vm_credential_id,
                vmc.alias AS vm_alias
            FROM coop_service_resources r
            LEFT JOIN (
                SELECT
                    rc.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY rc.resource_id
                        ORDER BY
                            CASE
                                WHEN rc.scope_type = 'advisor' AND rc.owner_user_id = ? THEN 0
                                WHEN rc.scope_type = 'global' THEN 1
                                ELSE 2
                            END,
                            rc.priority ASC,
                            rc.id ASC
                    ) AS rn
                FROM coop_service_credentials rc
                WHERE rc.activo = 1
                  AND rc.credential_kind = 'app'
                  AND (
                      rc.scope_type = 'global'
                      OR (rc.scope_type = 'advisor' AND rc.owner_user_id = ?)
                  )
            ) appc
              ON appc.resource_id = r.id
             AND appc.rn = 1
            LEFT JOIN (
                SELECT
                    rc.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY rc.resource_id
                        ORDER BY rc.priority ASC, rc.id ASC
                    ) AS rn
                FROM coop_service_credentials rc
                WHERE rc.activo = 1
                  AND rc.credential_kind = 'vm'
                  AND rc.scope_type = 'global'
            ) vmc
              ON vmc.resource_id = r.id
             AND vmc.rn = 1
            ${whereSql}
            ORDER BY r.home_shortcut DESC, r.orden ASC, r.nombre_servicio ASC
            `,
            params,
        );

        return rows;
    }

    async getResourceById(resourceId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT id, campaign_id, access_scope, nombre_servicio, activo
            FROM coop_service_resources
            WHERE id = ?
            LIMIT 1
            `,
            [resourceId],
        );
        return rows[0] || null;
    }

    async getCredentialForAdvisor({
        credentialId,
        advisorUserId = 0,
        requireActive = true,
    }, executor = this.pool) {
        const params = [credentialId, Number(advisorUserId || 0)];
        let activeSql = "";
        if (requireActive) {
            activeSql = " AND c.activo = 1 AND r.activo = 1";
        }

        const [rows] = await executor.query(
            `
            SELECT
                c.id,
                c.resource_id,
                c.alias,
                c.username_encrypted,
                c.username_iv,
                c.username_tag,
                c.password_encrypted,
                c.password_iv,
                c.password_tag,
                c.extra_encrypted,
                c.extra_iv,
                c.extra_tag,
                c.scope_type,
                c.owner_user_id,
                c.owner_username,
                c.activo,
                r.campaign_id,
                r.nombre_servicio,
                r.activo AS resource_activo
            FROM coop_service_credentials c
            INNER JOIN coop_service_resources r ON r.id = c.resource_id
            WHERE c.id = ?
              AND (
                  c.scope_type = 'global'
                  OR (c.scope_type = 'advisor' AND c.owner_user_id = ?)
              )
              ${activeSql}
            LIMIT 1
            `,
            params,
        );

        return rows[0] || null;
    }

    async upsertAdvisorCredential(payload = {}, executor = this.pool) {
        const [result] = await executor.query(
            `
            INSERT INTO coop_service_credentials (
                resource_id,
                alias,
                username_encrypted,
                username_iv,
                username_tag,
                password_encrypted,
                password_iv,
                password_tag,
                extra_encrypted,
                extra_iv,
                extra_tag,
                priority,
                activo,
                scope_type,
                owner_user_id,
                owner_username,
                created_by,
                updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'advisor', ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                alias = VALUES(alias),
                username_encrypted = VALUES(username_encrypted),
                username_iv = VALUES(username_iv),
                username_tag = VALUES(username_tag),
                password_encrypted = VALUES(password_encrypted),
                password_iv = VALUES(password_iv),
                password_tag = VALUES(password_tag),
                extra_encrypted = VALUES(extra_encrypted),
                extra_iv = VALUES(extra_iv),
                extra_tag = VALUES(extra_tag),
                priority = VALUES(priority),
                activo = VALUES(activo),
                updated_by = VALUES(updated_by),
                updated_at = NOW()
            `,
            [
                payload.resourceId,
                payload.alias,
                payload.username.encrypted,
                payload.username.iv,
                payload.username.tag,
                payload.password.encrypted,
                payload.password.iv,
                payload.password.tag,
                payload.extra?.encrypted || null,
                payload.extra?.iv || null,
                payload.extra?.tag || null,
                payload.priority,
                payload.activo,
                payload.ownerUserId,
                payload.ownerUsername,
                payload.actor,
                payload.actor,
            ],
        );

        return result.insertId || 0;
    }

    async insertAccessLog(payload = {}, executor = this.pool) {
        await executor.query(
            `
            INSERT INTO coop_service_access_logs (
                credential_id,
                resource_id,
                user_id,
                username,
                action,
                ip_address
            ) VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                payload.credentialId,
                payload.resourceId,
                payload.userId,
                payload.username,
                payload.action,
                payload.ipAddress,
            ],
        );
    }
}

export default ServiceResourcesDAO;
