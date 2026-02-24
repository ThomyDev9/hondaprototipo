/**
 * BASES QUERIES
 *
 * Todas las sentencias SQL relacionadas con bases de datos de clientes.
 * Organizadas por operación (SELECT, INSERT, UPDATE, DELETE)
 */

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
        SELECT DISTINCT CampaignId AS Id
        FROM campaignresultmanagement
        WHERE CampaignId = ?
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
        INSERT INTO bancopichinchaencuesta_dev.clientes
        (VCC, CampaignId, ContactId, ContactName, ContactAddress, InteractionId,
         ImportId, LastAgent, ResultLevel1, ResultLevel2, ResultLevel3, ManagementResultCode,
         ManagementResultDescription, TmStmp, Intentos,
         ID, CODIGO_CAMPANIA, NOMBRE_CAMPANIA, IDENTIFICACION, NOMBRE_CLIENTE,
         CAMPO1, CAMPO2, CAMPO3, CAMPO4, CAMPO5, CAMPO6, CAMPO7, CAMPO8, CAMPO9, CAMPO10,
         UserShift, Action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
};

export default basesQueries;
