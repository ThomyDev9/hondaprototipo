/**
 * CAMPAIGN QUERIES
 *
 * Todas las sentencias SQL relacionadas con campañas.
 * Organizadas por operación (SELECT, INSERT, UPDATE, DELETE)
 */

const campaignQueries = {
    // ============= SELECT QUERIES =============

    /**
     * Obtener todas las campañas distintas
     * Usado en: AutoComplete para seleccionar campaña
     */
    getDistinct: `
        SELECT DISTINCT 
            CampaignId
        FROM campaignresultmanagement
        ORDER BY CampaignId ASC
    `,

    /**
     * Obtener campañas con paginación
     * Usado en: Listados paginados
     */
    getAll: `
        SELECT DISTINCT
            CampaignId
        FROM campaignresultmanagement
        ORDER BY CampaignId ASC
        LIMIT ? OFFSET ?
    `,

    /**
     * Buscar campañas por CampaignId
     * Usado en: Búsqueda con LIKE, autoComplete
     */
    search: `
        SELECT DISTINCT 
            CampaignId
        FROM campaignresultmanagement
        WHERE CampaignId LIKE ?
        ORDER BY CampaignId ASC
    `,

    /**
     * Obtener campañas activas/vigentes (State = '1')
     * Usado en: Administrar bases - selector de campañas
     */
    getActive: `
        SELECT Id
        FROM campaign
        WHERE State = '1'
        ORDER BY Id
    `,

    /**
     * Obtener detalles de una campaña
     * Usado en: Ver estadísticas de campaña
     */
    getByIdWithStats: `
        SELECT 
            CampaignId,
            COUNT(*) as totalRegistros,
            COUNT(DISTINCT ClientId) as clientsUnicos
        FROM campaignresultmanagement
        WHERE CampaignId = ?
        GROUP BY CampaignId
    `,

    /**
     * Obtener campañas por base
     * Usado en: Ver campañas de una base específica
     */
    getByBase: `
        SELECT DISTINCT
            c.CampaignId
        FROM campaignresultmanagement c
        WHERE c.BaseId = ?
        ORDER BY c.CampaignId ASC
    `,

    /**
     * Búsqueda avanzada de campañas
     * Usado en: Filtros complejos
     */
    searchAdvanced: `
        SELECT DISTINCT
            CampaignId,
            COUNT(*) as registros
        FROM campaignresultmanagement
        WHERE CampaignId LIKE ?
        AND CreatedDate >= ?
        GROUP BY CampaignId
        ORDER BY registros DESC
    `,

    /**
     * Validar que una campaña existe
     * Usado en: Validaciones antes de usar
     */
    validate: `
        SELECT COUNT(*) as existe
        FROM campaignresultmanagement
        WHERE CampaignId = ?
        LIMIT 1
    `,

    // ============= SELECT con FILTROS =============

    /**
     * Obtener campañas por rango de fechas
     */
    getByDateRange: `
        SELECT DISTINCT
            CampaignId
        FROM campaignresultmanagement
        WHERE CreatedDate BETWEEN ? AND ?
        ORDER BY CampaignId ASC
    `,

    /**
     * Obtener campañas usando INNER JOIN (podrías usarlo si tienes tabla base_campaigns)
     * Ejemplo si hay relación entre bases y campaigns
     */
    getWithBaseInfo: `
        SELECT DISTINCT
            c.CampaignId,
            b.nombre as baseName
        FROM campaignresultmanagement c
        LEFT JOIN bases b ON b.id = c.BaseId
        WHERE c.CampaignId LIKE ?
        ORDER BY c.CampaignId ASC
    `,

    // ============= INSERT QUERIES =============

    /**
     * Insertar nueva entrada de campaign
     * Nota: Este es un registro, generalmente insertado por bulk uploads
     */
    create: `
        INSERT INTO campaignresultmanagement (
            CampaignId,
            ClientId,
            BaseId,
            CreatedDate
        ) VALUES (?, ?, ?, NOW())
    `,

    /**
     * Insert bulk de campañas desde archivo
     */
    createBulk: `
        INSERT INTO campaignresultmanagement (
            CampaignId,
            ClientId,
            BaseId,
            CreatedDate
        ) VALUES ?
    `,

    // ============= UPDATE QUERIES =============

    /**
     * Actualizar campaña (raro, generalmente read-only)
     */
    update: `
        UPDATE campaignresultmanagement
        SET 
            BaseId = ?,
            updatedAt = NOW()
        WHERE CampaignId = ?
    `,

    // ============= DELETE QUERIES =============

    /**
     * Eliminar registros de campaña
     * ⚠️ Tener cuidado con lo que se elimina
     */
    deleteByIdAndBase: `
        DELETE FROM campaignresultmanagement
        WHERE CampaignId = ? AND BaseId = ?
    `,

    /**
     * Eliminar ALL registros de una campaña
     * ⚠️ MUCHO CUIDADO
     */
    deleteById: `
        DELETE FROM campaignresultmanagement
        WHERE CampaignId = ?
    `,

    // ============= ANALÍTICA QUERIES =============

    /**
     * Obtener campañas más usadas
     */
    getTopCampaigns: `
        SELECT 
            CampaignId,
            COUNT(*) as uses
        FROM campaignresultmanagement
        GROUP BY CampaignId
        ORDER BY uses DESC
        LIMIT ?
    `,

    /**
     * Obtener estadísticas generales de campaigns
     */
    getStats: `
        SELECT 
            COUNT(DISTINCT CampaignId) as totalCampaigns,
            COUNT(*) as totalRegistros,
            COUNT(DISTINCT ClientId) as clientsUnicos
        FROM campaignresultmanagement
    `,
};

export default campaignQueries;
