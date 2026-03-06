/**
 * BASES QUERIES
 *
 * Todas las sentencias SQL relacionadas con bases de datos de clientes.
 * Organizadas por operación (SELECT, INSERT, UPDATE, DELETE)
 */

const encuestaSchema =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev";

const basesQueries = {
    // ============= SELECT QUERIES =============

    /**
     * Obtener todas las bases
     * Usado en: Listado general
     */
    getAll: `
        SELECT 
            id,
            nombre,
            estado,
            createdAt,
            updatedAt
        FROM bases
        ORDER BY createdAt DESC
    `,

    /**
     * Obtener base por ID
     * Usado en: Detalles, editar
     */
    getById: `
        SELECT 
            id,
            nombre,
            estado,
            mapeo,
            campania,
            createdAt,
            updatedAt
        FROM bases
        WHERE id = ?
    `,

    /**
     * Obtener bases activas
     * Usado en: Listados filtrados
     */
    getActive: `
        SELECT 
            id,
            nombre,
            estado,
            createdAt
        FROM bases
        WHERE estado = 1
        ORDER BY nombre ASC
    `,

    /**
     * Obtener bases por mapeo
     * Usado en: Filtrar bases por mapeo específico
     */
    getByMappeo: `
        SELECT 
            id,
            nombre,
            mapeo,
            createdAt
        FROM bases
        WHERE mapeo = ?
        ORDER BY nombre ASC
    `,

    /**
     * Obtener bases por campaña
     * Usado en: Filtrar bases por campaña
     */
    getByCampania: `
        SELECT 
            id,
            nombre,
            campania,
            createdAt
        FROM bases
        WHERE campania = ?
        ORDER BY nombre ASC
    `,

    /**
     * Buscar bases por nombre
     * Usado en: Búsqueda
     */
    search: `
        SELECT 
            id,
            nombre,
            estado,
            mapeo,
            campania,
            createdAt
        FROM bases
        WHERE nombre LIKE ?
        ORDER BY nombre ASC
    `,

    /**
     * Obtener resumen de bases (para dashboard)
     * Usado en: Dashboard admin
     */
    getResumen: `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN estado = 1 THEN 1 ELSE 0 END) as activas,
            SUM(CASE WHEN estado = 0 THEN 1 ELSE 0 END) as inactivas
        FROM bases
    `,

    // ============= INSERT QUERIES =============

    /**
     * Crear nueva base
     */
    create: `
        INSERT INTO bases (nombre, mapeo, campania, estado, createdAt)
        VALUES (?, ?, ?, 1, NOW())
    `,

    // ============= UPDATE QUERIES =============

    /**
     * Actualizar datos de base
     */
    update: `
        UPDATE bases
        SET 
            nombre = ?,
            mapeo = ?,
            campania = ?,
            estado = ?,
            updatedAt = NOW()
        WHERE id = ?
    `,

    /**
     * Cambiar estado de base (activar/desactivar)
     */
    updateState: `
        UPDATE bases
        SET 
            estado = ?,
            updatedAt = NOW()
        WHERE id = ?
    `,

    // ============= DELETE QUERIES =============

    /**
     * Eliminar base completamente
     * ⚠️ Usar con cuidado - considerar soft delete
     */
    delete: `
        DELETE FROM bases
        WHERE id = ?
    `,

    // ============= CSV IMPORT QUERIES =============

    /**
     * Validar campaña existente para importación (flujo PHP original)
     */
    checkCampaignForImport: `
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
    `,

    /**
     * Validar nombre de importación existente
     */
    checkImportNameExists: `
        SELECT DISTINCT LastUpdate
        FROM contactimportcontact
        WHERE LastUpdate = ?
        LIMIT 1
    `,

    checkImportNameExistsInControl: `
        SELECT ID
        FROM contactimport
        WHERE ID = ?
          AND Updates = '1'
        LIMIT 1
    `,

    /**
     * Validar contacto duplicado por identificación y campaña
     */
    checkContactDuplicate: `
        SELECT Id
        FROM contactimportcontact
        WHERE Identification = ? AND Campaign = ?
        LIMIT 1
    `,

    /**
     * Validar contacto duplicado por ID (comportamiento legado PHP)
     */
    checkContactDuplicateById: `
        SELECT Id
        FROM contactimportcontact
        WHERE Id = ?
        LIMIT 1
    `,

    /**
     * Insertar contacto importado en CCK
     */
    insertContactImportContact: `
        INSERT INTO contactimportcontact
        (VCC, Id, Name, Identification, Campaign, LastManagementResult, LastUpdate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `,

    /**
     * Insertar cliente en la base bancopichinchaencuesta_dev
     */
    insertClienteBancoPichincha: `
        INSERT INTO ${encuestaSchema}.clientes
        (VCC, CampaignId, ContactId, ContactName, ContactAddress, InteractionId,
         ImportId, LastAgent, ResultLevel1, ResultLevel2, ResultLevel3, ManagementResultCode,
         ManagementResultDescription, TmStmp, Intentos,
         ID, CODIGO_CAMPANIA, NOMBRE_CAMPANIA, IDENTIFICACION, NOMBRE_CLIENTE,
         CAMPO1, CAMPO2, CAMPO3, CAMPO4, CAMPO5, CAMPO6, CAMPO7, CAMPO8, CAMPO9, CAMPO10,
         CamposAdicionalesJson,
         UserShift, Action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    /**
     * Insertar teléfono importado
     */
    insertContactPhone: `
        INSERT INTO contactimportphone
        (ContactId, InteractionId, NumeroMarcado, Agente, Estado, FechaHora, FechaHoraFin, DescripcionTelefono, IdentificacionCliente)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    /**
     * Registrar detalle de importación
     */
    insertContactImportDetail: `
        INSERT INTO contactimportdetail
        (VCC, ImportId, UpdateNum, Date, ImportUser, ValidContacts, NewContacts, UpdatedContacts, InvalidContacts, DuplicatesContacts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,

    /**
     * Registrar cabecera de importación
     */
    insertContactImport: `
        INSERT INTO contactimport
        (VCC, ID, DBProvider, Updates, Status, ServiceId)
        VALUES (?, ?, ?, ?, ?, ?)
    `,

    getValidContactsByImport: `
        SELECT COALESCE(MAX(ValidContacts), 0) AS totalRegistros
        FROM contactimportdetail
        WHERE ImportId = ?
    `,

    // ============= ADMINISTRACIÓN DE BASES =============

    /**
     * Obtener importaciones distintas por campaña (excluye años 2019-2025)
     * Filtros:
     * - TmStmpShift: excluye años antiguos en fecha
     * - LastUpdate: excluye si contiene años 2019-2025 en el texto
     */
    getImportsByCampaign: `
                SELECT DISTINCT cic.LastUpdate
                FROM contactimportcontact cic
                LEFT JOIN campaign_active_base cab
                    ON cab.CampaignId = cic.Campaign
                   AND cab.ImportId = cic.LastUpdate
                   AND cab.State = '1'
                WHERE cic.Campaign = ?
                    AND (
                        (? = '1' AND cab.CampaignId IS NOT NULL)
                        OR (? = '0' AND cab.CampaignId IS NULL)
                    )
                    AND (cic.TmStmpShift IS NULL OR YEAR(cic.TmStmpShift) >= 2026)
                    AND cic.LastUpdate NOT LIKE '%2019%'
                    AND cic.LastUpdate NOT LIKE '%2020%'
                    AND cic.LastUpdate NOT LIKE '%2021%'
                    AND cic.LastUpdate NOT LIKE '%2022%'
                    AND cic.LastUpdate NOT LIKE '%2023%'
                    AND cic.LastUpdate NOT LIKE '%2024%'
                    AND cic.LastUpdate NOT LIKE '%2025%'
                ORDER BY cic.LastUpdate DESC
        `,

    getImportsByCampaignWithState: `
        SELECT
            MAX(cab.id) AS id,
            cic.LastUpdate,
            CASE
                WHEN MAX(CASE WHEN cab.CampaignId IS NOT NULL THEN 1 ELSE 0 END) = 1
                    THEN '1'
                ELSE '0'
            END AS BaseState,
            SUM(
                CASE
                    WHEN COALESCE(cic.Number, 0) < 6
                     AND cic.Action IN ('re_llamada', 'sin_contacto', 'numero_incorrecto', 'inubicable')
                    THEN 1
                    ELSE 0
                END
            ) AS RegistrosReciclables
        FROM contactimportcontact cic
        LEFT JOIN campaign_active_base cab
          ON cab.CampaignId = cic.Campaign
         AND cab.ImportId = cic.LastUpdate
        WHERE cic.Campaign = ?
          AND (cic.TmStmpShift IS NULL OR YEAR(cic.TmStmpShift) >= 2026)
          AND cic.LastUpdate NOT LIKE '%2019%'
          AND cic.LastUpdate NOT LIKE '%2020%'
          AND cic.LastUpdate NOT LIKE '%2021%'
          AND cic.LastUpdate NOT LIKE '%2022%'
          AND cic.LastUpdate NOT LIKE '%2023%'
          AND cic.LastUpdate NOT LIKE '%2024%'
          AND cic.LastUpdate NOT LIKE '%2025%'
        GROUP BY cic.LastUpdate
        ORDER BY cic.LastUpdate DESC
    `,

    /**
     * Activar base (asignar a agentes)
     */
    activateBase: `
        UPDATE contactimportcontact
        SET Action = '',
            UserShift = ?,
            TmStmpShift = ?
        WHERE LastUpdate = ?
          AND Campaign = ?
    `,

    /**
     * Desactivar base (cancelar base)
     */
    deactivateBase: `
        UPDATE contactimportcontact
        SET Action = 'Cancelar base',
            UserShift = ?,
            TmStmpShift = ?
        WHERE LastUpdate = ?
          AND Campaign = ?
    `,

    ensureCampaignActiveBaseTable: `
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
    `,

    ensureCampaignActiveBaseTotalRegistrosColumn: `
        ALTER TABLE campaign_active_base
        ADD COLUMN IF NOT EXISTS TotalRegistros INT NOT NULL DEFAULT 0
    `,

    insertCampaignActiveBase: `
        INSERT INTO campaign_active_base
            (CampaignId, ImportId, State, TotalRegistros, UserShift, UpdatedAt)
        VALUES
            (?, ?, '1', ?, ?, NOW())
    `,

    clearCampaignActiveBaseById: `
        UPDATE campaign_active_base
        SET State = '0',
            UserShift = ?,
            UpdatedAt = ?
        WHERE id = ?
    `,

    ensureCampaignImportStatsTable: `
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
    `,

    upsertCampaignImportStatsFromContact: `
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
    `,
};

export default basesQueries;
