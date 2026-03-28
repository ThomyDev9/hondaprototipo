import pool from "../db.js";

const GET_DISTINCT_CAMPAIGNS = `
    SELECT DISTINCT
        CampaignId
    FROM campaignresultmanagement
    ORDER BY CampaignId ASC
`;

const SEARCH_CAMPAIGNS = `
    SELECT DISTINCT
        CampaignId
    FROM campaignresultmanagement
    WHERE CampaignId LIKE ?
    ORDER BY CampaignId ASC
`;

const GET_ACTIVE_CAMPAIGNS = `
    SELECT Id
    FROM campaign
    WHERE State = '1'
    ORDER BY Id
`;

const VALIDATE_CAMPAIGN_EXISTS = `
    SELECT COUNT(*) as existe
    FROM campaignresultmanagement
    WHERE CampaignId = ?
    LIMIT 1
`;

export class CampaignDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    // Catálogo simple de campañas distintas visibles para selects y búsquedas.
    async getDistinct(executor = this.pool) {
        const [rows] = await executor.query(GET_DISTINCT_CAMPAIGNS);
        return rows;
    }

    // Búsqueda por texto para autocompletes o filtros administrativos.
    async search(searchTerm, executor = this.pool) {
        const searchPattern = `%${String(searchTerm || "").trim()}%`;
        const [rows] = await executor.query(SEARCH_CAMPAIGNS, [searchPattern]);
        return rows;
    }

    // Campañas activas desde la tabla campaign.
    async getActive(executor = this.pool) {
        const [rows] = await executor.query(GET_ACTIVE_CAMPAIGNS);
        return rows;
    }

    // Validación ligera de existencia para flujo de negocio.
    async exists(campaignId, executor = this.pool) {
        const [rows] = await executor.query(VALIDATE_CAMPAIGN_EXISTS, [campaignId]);
        return Number(rows[0]?.existe || 0) > 0;
    }
}

export default CampaignDAO;
