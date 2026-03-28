import pool from "../db.js";

const encuestaSchema =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev";

const CHECK_CAMPAIGN_FOR_IMPORT = `
    SELECT Id
    FROM (
        SELECT DISTINCT TRIM(CampaignId) AS Id
        FROM campaignresultmanagement
        WHERE TRIM(CampaignId) = TRIM(?)

        UNION

        SELECT DISTINCT TRIM(nombre_item) AS Id
        FROM menu_items
        WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
          AND id_padre IS NOT NULL
          AND estado = 'activo'
          AND TRIM(nombre_item) = TRIM(?)
    ) campaigns
    LIMIT 1
`;

const CHECK_IMPORT_NAME_EXISTS = `
    SELECT DISTINCT LastUpdate
    FROM contactimportcontact
    WHERE LastUpdate = ?
    LIMIT 1
`;

const CHECK_IMPORT_NAME_EXISTS_IN_CONTROL = `
    SELECT ID
    FROM contactimport
    WHERE ID = ?
      AND Updates = '1'
    LIMIT 1
`;

const CHECK_CONTACT_DUPLICATE_BY_ID = `
    SELECT Id
    FROM contactimportcontact
    WHERE Id = ?
    LIMIT 1
`;

const INSERT_CONTACT_IMPORT_CONTACT = `
    INSERT INTO contactimportcontact
    (VCC, Id, Name, Identification, Campaign, LastManagementResult, LastUpdate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_CLIENTE_BANCO_PICHINCHA = `
    INSERT INTO ${encuestaSchema}.clientes
    (VCC, CampaignId, ContactId, ContactName, ContactAddress, InteractionId,
     ImportId, LastAgent, ResultLevel1, ResultLevel2, ResultLevel3, ManagementResultCode,
     ManagementResultDescription, TmStmp, Intentos,
     ID, CODIGO_CAMPANIA, NOMBRE_CAMPANIA, IDENTIFICACION, NOMBRE_CLIENTE,
     CAMPO1, CAMPO2, CAMPO3, CAMPO4, CAMPO5, CAMPO6, CAMPO7, CAMPO8, CAMPO9, CAMPO10,
     CamposAdicionalesJson,
     UserShift, Action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_CONTACT_PHONE = `
    INSERT INTO contactimportphone
    (ContactId, InteractionId, NumeroMarcado, Agente, Estado, FechaHora, FechaHoraFin, DescripcionTelefono, IdentificacionCliente)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_CONTACT_IMPORT_DETAIL = `
    INSERT INTO contactimportdetail
    (VCC, ImportId, UpdateNum, Date, ImportUser, ValidContacts, NewContacts, UpdatedContacts, InvalidContacts, DuplicatesContacts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_CONTACT_IMPORT = `
    INSERT INTO contactimport
    (VCC, ID, DBProvider, Updates, Status, ServiceId)
    VALUES (?, ?, ?, ?, ?, ?)
`;

const GET_IMPORTS_BY_CAMPAIGN_WITH_STATE = `
    SELECT
        id,
        CampaignId,
        ImportId AS LastUpdate,
        State AS BaseState,
        TotalRegistros,
        UserShift,
        UpdatedAt
    FROM campaign_active_base
    WHERE CampaignId = ?
    ORDER BY ImportId DESC
`;

const ACTIVATE_BASE = `
    UPDATE contactimportcontact
    SET Action = '',
        UserShift = ?,
        TmStmpShift = ?
    WHERE LastUpdate = ?
      AND Campaign = ?
`;

const DEACTIVATE_BASE = `
    UPDATE contactimportcontact
    SET Action = 'Cancelar base',
        UserShift = ?,
        TmStmpShift = ?
    WHERE LastUpdate = ?
      AND Campaign = ?
`;

const INSERT_CAMPAIGN_ACTIVE_BASE = `
    INSERT INTO campaign_active_base
        (CampaignId, ImportId, State, TotalRegistros, UserShift, UpdatedAt)
    VALUES
        (?, ?, '1', ?, ?, NOW())
`;

const CLEAR_CAMPAIGN_ACTIVE_BASE_BY_ID = `
    UPDATE campaign_active_base
    SET State = '0',
        UserShift = ?,
        UpdatedAt = ?
    WHERE id = ?
`;

const ENSURE_CAMPAIGN_IMPORT_STATS_TABLE = `
    CREATE TABLE IF NOT EXISTS campaign_import_stats (
        CampaignId VARCHAR(100) NOT NULL,
        ImportId VARCHAR(100) NOT NULL,
        TotalRegistros INT NOT NULL DEFAULT 0,
        PendientesReales INT NOT NULL DEFAULT 0,
        PendientesLibres INT NOT NULL DEFAULT 0,
        PendientesAsignadosSinGestion INT NOT NULL DEFAULT 0,
        UserShift VARCHAR(100) NOT NULL DEFAULT 'system',
        UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (CampaignId, ImportId),
        KEY idx_cis_campaign (CampaignId),
        KEY idx_cis_updated (UpdatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const UPSERT_CAMPAIGN_IMPORT_STATS_FROM_CONTACT = `
    INSERT INTO campaign_import_stats (
        CampaignId,
        ImportId,
        TotalRegistros,
        PendientesReales,
        PendientesLibres,
        PendientesAsignadosSinGestion,
        UserShift,
        UpdatedAt
    )
    SELECT
        ?,
        ?,
        COUNT(*) AS TotalRegistros,
        SUM(
            CASE
                WHEN COALESCE(NULLIF(TRIM(c.LastManagementResult), ''), '') = ''
                 AND (c.Action IS NULL OR c.Action <> 'Cancelar base')
                THEN 1
                ELSE 0
            END
        ) AS PendientesReales,
        SUM(
            CASE
                WHEN COALESCE(NULLIF(TRIM(c.LastManagementResult), ''), '') = ''
                 AND (c.Action IS NULL OR c.Action <> 'Cancelar base')
                 AND (c.LastAgent IS NULL OR c.LastAgent = '' OR c.LastAgent = 'Pendiente')
                THEN 1
                ELSE 0
            END
        ) AS PendientesLibres,
        SUM(
            CASE
                WHEN COALESCE(NULLIF(TRIM(c.LastManagementResult), ''), '') = ''
                 AND (c.Action IS NULL OR c.Action <> 'Cancelar base')
                 AND c.LastAgent IS NOT NULL
                 AND c.LastAgent <> ''
                 AND c.LastAgent <> 'Pendiente'
                THEN 1
                ELSE 0
            END
        ) AS PendientesAsignadosSinGestion,
        ?,
        NOW()
    FROM contactimportcontact c
    WHERE c.Campaign = ?
      AND c.LastUpdate = ?
    ON DUPLICATE KEY UPDATE
        TotalRegistros = VALUES(TotalRegistros),
        PendientesReales = VALUES(PendientesReales),
        PendientesLibres = VALUES(PendientesLibres),
        PendientesAsignadosSinGestion = VALUES(PendientesAsignadosSinGestion),
        UserShift = VALUES(UserShift),
        UpdatedAt = NOW()
`;

const GET_RECYCLABLES_COUNT = `
    SELECT COUNT(*) AS reciclables
    FROM contactimportcontact ci
    INNER JOIN campaign_import_stats cis
        ON ci.Campaign = cis.CampaignId
       AND ci.LastUpdate = cis.ImportId
    LEFT JOIN campaign_active_base cab
        ON cab.CampaignId = cis.CampaignId
       AND cab.ImportId = cis.ImportId
    WHERE ci.Campaign = ?
      AND ci.LastUpdate = ?
      AND ci.LastManagementResult IN (60, 61, 62, 63, 64, 34)
      AND cis.PendientesReales = 0
      AND cis.PendientesLibres = 0
      AND cab.State = 1
`;

const RECYCLE_BASE_CONTACTS = `
    UPDATE contactimportcontact
    SET LastAgent = 'Pendiente',
        Action = 'reciclable',
        UserShift = ?,
        TmStmpShift = NOW()
    WHERE Campaign = ?
      AND LastUpdate = ?
      AND COALESCE(Number, 0) < ?
      AND LastManagementResult IN (60, 61, 62, 63, 64, 34)
`;

export class BasesDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async ensureCampaignImportStatsTable(executor = this.pool) {
        return executor.query(ENSURE_CAMPAIGN_IMPORT_STATS_TABLE);
    }

    async ensureCampaignActiveBaseInfrastructure(executor = this.pool) {
        await executor.query(`
            CREATE TABLE IF NOT EXISTS campaign_active_base (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                CampaignId VARCHAR(100) NOT NULL,
                ImportId VARCHAR(100) NOT NULL,
                State VARCHAR(10) NOT NULL DEFAULT '1',
                TotalRegistros INT NOT NULL DEFAULT 0,
                UserShift VARCHAR(50) NOT NULL,
                UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_cab_campaign (CampaignId),
                KEY idx_cab_import (ImportId),
                KEY idx_cab_state (State)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await executor.query(`
            ALTER TABLE campaign_active_base
            ADD COLUMN IF NOT EXISTS TotalRegistros INT NOT NULL DEFAULT 0
        `);
    }

    async upsertCampaignImportStats(
        campaignId,
        importId,
        actor = "system",
        executor = this.pool,
    ) {
        return executor.query(UPSERT_CAMPAIGN_IMPORT_STATS_FROM_CONTACT, [
            campaignId,
            importId,
            String(actor || "system"),
            campaignId,
            importId,
        ]);
    }

    async getAllBasesSummary(
        { campaignId = "", importId = "" } = {},
        executor = this.pool,
    ) {
        let sql = `
            SELECT
                id,
                campaign_id,
                import_id,
                base_state,
                total_registros,
                pendientes,
                pendientes_libres,
                pendientes_asignados_sin_gestion
            FROM vw_admin_bases_summary
        `;
        const params = [];

        if (campaignId && importId) {
            sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ? AND import_id = ?`;
            params.push(campaignId, importId);
        } else if (campaignId) {
            sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ?`;
            params.push(campaignId);
        } else if (importId) {
            sql = `SELECT * FROM (${sql}) AS resumen WHERE import_id = ?`;
            params.push(importId);
        }

        sql = `${sql} ORDER BY campaign_id ASC, import_id DESC`;

        const [rows] = await executor.query(sql, params);
        return rows;
    }

    async getActiveAgentBasesSummary(executor = this.pool) {
        const [rows] = await executor.query(`
            SELECT
                campaign_id,
                import_id,
                total_registros,
                pendientes,
                pendientes_libres,
                pendientes_asignados_sin_gestion
            FROM vw_agent_active_bases_summary
            ORDER BY pendientes DESC, campaign_id ASC
        `);
        return rows;
    }

    async getAllInactiveBasesSummary(
        { campaignId = "", importId = "" } = {},
        executor = this.pool,
    ) {
        let sql = `
            SELECT
                id,
                campaign_id,
                import_id,
                base_state,
                total_registros,
                pendientes,
                pendientes_libres,
                pendientes_asignados_sin_gestion
            FROM vw_admin_bases_summary
            WHERE COALESCE(base_state, '0') = '0'
        `;
        const params = [];

        if (campaignId && importId) {
            sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ? AND import_id = ?`;
            params.push(campaignId, importId);
        } else if (campaignId) {
            sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ?`;
            params.push(campaignId);
        } else if (importId) {
            sql = `SELECT * FROM (${sql}) AS resumen WHERE import_id = ?`;
            params.push(importId);
        }

        sql = `${sql} ORDER BY campaign_id ASC, import_id DESC`;

        const [rows] = await executor.query(sql, params);
        return rows;
    }

    async getReciclablesCount(campaignId, importId, executor = this.pool) {
        const [rows] = await executor.query(GET_RECYCLABLES_COUNT, [
            campaignId,
            importId,
        ]);
        return Number(rows[0]?.reciclables || 0);
    }

    async recycleBaseContacts(
        actor,
        campaignId,
        importId,
        maxIntentos,
        executor = this.pool,
    ) {
        return executor.query(RECYCLE_BASE_CONTACTS, [
            actor,
            campaignId,
            importId,
            maxIntentos,
        ]);
    }

    async getImportsByCampaignWithState(campaignId, executor = this.pool) {
        const [rows] = await executor.query(GET_IMPORTS_BY_CAMPAIGN_WITH_STATE, [
            campaignId,
        ]);
        return rows;
    }

    async getCampaignActiveBaseRecord(
        campaignId,
        importId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            `SELECT id
             FROM campaign_active_base
             WHERE CampaignId = ?
               AND ImportId = ?
             LIMIT 1`,
            [campaignId, importId],
        );
        return rows[0] || null;
    }

    async countContactsByCampaignAndImport(
        campaignId,
        importId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            `SELECT COUNT(*) AS total
             FROM contactimportcontact
             WHERE Campaign = ?
               AND LastUpdate = ?`,
            [campaignId, importId],
        );
        return Number(rows[0]?.total || 0);
    }

    async reactivateCampaignActiveBaseRecord(
        id,
        username,
        dateNow,
        executor = this.pool,
    ) {
        return executor.query(
            `UPDATE campaign_active_base
             SET State = '1',
                 UserShift = ?,
                 UpdatedAt = ?
             WHERE id = ?`,
            [username, dateNow, id],
        );
    }

    async insertCampaignActiveBaseRecord(
        campaignId,
        importId,
        totalRegistros,
        username,
        executor = this.pool,
    ) {
        return executor.query(INSERT_CAMPAIGN_ACTIVE_BASE, [
            campaignId,
            importId,
            totalRegistros,
            username,
        ]);
    }

    async activateBaseContacts(
        username,
        dateNow,
        importId,
        campaignId,
        executor = this.pool,
    ) {
        return executor.query(ACTIVATE_BASE, [
            username,
            dateNow,
            importId,
            campaignId,
        ]);
    }

    async deactivateBaseContacts(
        username,
        dateNow,
        importId,
        campaignId,
        executor = this.pool,
    ) {
        return executor.query(DEACTIVATE_BASE, [
            username,
            dateNow,
            importId,
            campaignId,
        ]);
    }

    async clearCampaignActiveBaseById(
        username,
        dateNow,
        id,
        executor = this.pool,
    ) {
        return executor.query(CLEAR_CAMPAIGN_ACTIVE_BASE_BY_ID, [
            username,
            dateNow,
            id,
        ]);
    }

    async checkCampaignForImport(campaignId, executor = this.pool) {
        const [rows] = await executor.query(CHECK_CAMPAIGN_FOR_IMPORT, [
            campaignId,
            campaignId,
        ]);
        return rows;
    }

    async checkImportNameExists(importName, executor = this.pool) {
        const [rows] = await executor.query(CHECK_IMPORT_NAME_EXISTS, [
            importName,
        ]);
        return rows;
    }

    async checkImportNameExistsInControl(importName, executor = this.pool) {
        const [rows] = await executor.query(CHECK_IMPORT_NAME_EXISTS_IN_CONTROL, [
            importName,
        ]);
        return rows;
    }

    async checkContactDuplicateById(contactId, executor = this.pool) {
        const [rows] = await executor.query(CHECK_CONTACT_DUPLICATE_BY_ID, [
            contactId,
        ]);
        return rows;
    }

    async insertContactImportContact(params, executor = this.pool) {
        return executor.query(INSERT_CONTACT_IMPORT_CONTACT, params);
    }

    async insertClienteBancoPichincha(params, executor = this.pool) {
        return executor.query(INSERT_CLIENTE_BANCO_PICHINCHA, params);
    }

    async insertContactPhone(params, executor = this.pool) {
        return executor.query(INSERT_CONTACT_PHONE, params);
    }

    async insertContactImportDetail(params, executor = this.pool) {
        return executor.query(INSERT_CONTACT_IMPORT_DETAIL, params);
    }

    async insertContactImport(params, executor = this.pool) {
        return executor.query(INSERT_CONTACT_IMPORT, params);
    }
}

export default BasesDAO;
