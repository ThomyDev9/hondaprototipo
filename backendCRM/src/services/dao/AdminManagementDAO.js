import pool from "../db.js";

export class AdminManagementDAO {
    constructor(dbPool = pool, outboundCategoryId) {
        this.pool = dbPool;
        this.outboundCategoryId = outboundCategoryId;
    }

    async isActiveOutboundSubcampaign(campaignId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT s.id
            FROM menu_items s
            INNER JOIN menu_items p ON p.id = s.id_padre
            WHERE s.id_categoria = ?
              AND p.id_categoria = ?
              AND s.id_padre IS NOT NULL
              AND s.estado = 'activo'
              AND p.estado = 'activo'
              AND TRIM(s.nombre_item) = ?
            LIMIT 1
            `,
            [this.outboundCategoryId, this.outboundCategoryId, campaignId],
        );
        return rows.length > 0;
    }

    async getCodeByLevel1Map(level1List, executor = this.pool) {
        const placeholders = level1List.map(() => "?").join(",");
        const [rows] = await executor.query(
            `
            SELECT TRIM(Level1) AS level1, MIN(Code) AS code
            FROM campaignresultmanagement
            WHERE COALESCE(State, '1') = '1'
              AND TRIM(Level1) IN (${placeholders})
            GROUP BY TRIM(Level1)
            `,
            level1List,
        );

        return new Map(
            (rows || []).map((row) => [
                String(row?.level1 || "").trim(),
                Number(row?.code || 0),
            ]),
        );
    }

    async getExistingPairSet(
        campaignId,
        level1List,
        level2List,
        executor = this.pool,
    ) {
        const level1Placeholders = level1List.map(() => "?").join(",");
        const level2Placeholders = level2List.map(() => "?").join(",");
        const [rows] = await executor.query(
            `
            SELECT TRIM(Level1) AS level1, TRIM(Level2) AS level2
            FROM campaignresultmanagement
            WHERE CampaignId = ?
              AND TRIM(Level1) IN (${level1Placeholders})
              AND TRIM(Level2) IN (${level2Placeholders})
            `,
            [campaignId, ...level1List, ...level2List],
        );

        return new Set(
            (rows || []).map(
                (row) =>
                    `${String(row?.level1 || "").trim()}|||${String(
                        row?.level2 || "",
                    ).trim()}`,
            ),
        );
    }

    async getManagementLevelSuggestions(executor = this.pool) {
        const [level1Rows] = await executor.query(`
            SELECT
                TRIM(Level1) AS level1,
                MIN(Code) AS code
            FROM campaignresultmanagement
            WHERE COALESCE(State, '1') = '1'
              AND TRIM(Level1) <> ''
            GROUP BY TRIM(Level1)
            ORDER BY TRIM(Level1) ASC
        `);

        const [level2Rows] = await executor.query(`
            SELECT
                TRIM(Level2) AS level2,
                Code AS code
            FROM campaignresultmanagement
            WHERE COALESCE(State, '1') = '1'
              AND TRIM(Level2) <> ''
            GROUP BY TRIM(Level2), Code
            ORDER BY TRIM(Level2) ASC
        `);

        return { level1: level1Rows, level2: level2Rows };
    }

    async getManagementLevelCampaigns(executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT
                src.campaign_id,
                MIN(src.parent_name) AS parent_name
            FROM (
                SELECT
                    TRIM(s.nombre_item) AS campaign_id,
                    TRIM(p.nombre_item) AS parent_name
                FROM menu_items s
                INNER JOIN menu_items p ON p.id = s.id_padre
                WHERE s.id_categoria = ?
                  AND p.id_categoria = ?
                  AND s.id_padre IS NOT NULL
                  AND s.estado = 'activo'
                  AND p.estado = 'activo'
                  AND TRIM(s.nombre_item) <> ''
            ) src
            GROUP BY src.campaign_id
            ORDER BY MIN(src.parent_name) ASC, src.campaign_id ASC
            `,
            [this.outboundCategoryId, this.outboundCategoryId],
        );

        return rows;
    }

    async getManagementLevels(campaignId, state, executor = this.pool) {
        const params = [campaignId];
        let stateFilter = "";
        if (state === "0" || state === "1") {
            stateFilter = " AND COALESCE(State, '1') = ?";
            params.push(state);
        }

        const [rows] = await executor.query(
            `
            SELECT
                Id,
                CampaignId,
                Code,
                Isgoal,
                Level1,
                Level2,
                State
            FROM campaignresultmanagement
            WHERE CampaignId = ?
            ${stateFilter}
            ORDER BY Level1 ASC, Level2 ASC, Code ASC, Id ASC
            `,
            params,
        );

        return rows;
    }

    async level1Exists(level1, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT 1
            FROM campaignresultmanagement
            WHERE COALESCE(State, '1') = '1'
              AND TRIM(Level1) = ?
            LIMIT 1
            `,
            [level1],
        );
        return rows.length > 0;
    }

    async isValidCodeForLevel1(level1, code, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT 1
            FROM campaignresultmanagement
            WHERE COALESCE(State, '1') = '1'
              AND TRIM(Level1) = ?
              AND Code = ?
            LIMIT 1
            `,
            [level1, code],
        );
        return rows.length > 0;
    }

    async findDuplicateManagementLevel(
        campaignId,
        code,
        level1,
        level2,
        excludeId = null,
        executor = this.pool,
    ) {
        const params = [campaignId, code, level1, level2];
        let excludeSql = "";
        if (excludeId !== null && excludeId !== undefined) {
            excludeSql = " AND Id <> ?";
            params.push(excludeId);
        }

        const [rows] = await executor.query(
            `
            SELECT Id
            FROM campaignresultmanagement
            WHERE CampaignId = ?
              AND Code = ?
              AND Level1 = ?
              AND Level2 = ?
              ${excludeSql}
            LIMIT 1
            `,
            params,
        );

        return rows[0] || null;
    }

    async findManagementLevelByIdAndCampaign(
        id,
        campaignId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            `
            SELECT Id
            FROM campaignresultmanagement
            WHERE Id = ?
              AND CampaignId = ?
            LIMIT 1
            `,
            [id, campaignId],
        );
        return rows[0] || null;
    }

    async findExistingLevel2Rows(
        campaignId,
        code,
        level1,
        level2List,
        executor = this.pool,
    ) {
        const placeholders = level2List.map(() => "?").join(",");
        const [rows] = await executor.query(
            `
            SELECT Level2
            FROM campaignresultmanagement
            WHERE CampaignId = ?
              AND Code = ?
              AND Level1 = ?
              AND Level2 IN (${placeholders})
            `,
            [campaignId, code, level1, ...level2List],
        );
        return rows;
    }

    async insertManagementLevel(
        campaignId,
        code,
        isgoal,
        level1,
        level2,
        state,
        actor,
        executor = this.pool,
    ) {
        const [result] = await executor.query(
            `
            INSERT INTO campaignresultmanagement (
                VCC,
                CampaignId,
                Code,
                Description,
                Isgoal,
                Level1,
                Level2,
                Level3,
                ManagementResultDescription,
                State,
                TmStmp,
                UserCreates,
                UserEdits
            )
            VALUES (
                '',
                ?,
                ?,
                '',
                ?,
                ?,
                ?,
                NULL,
                NULL,
                ?,
                NOW(),
                ?,
                ?
            )
            `,
            [campaignId, code, isgoal, level1, level2, state, actor, actor],
        );
        return result;
    }

    async insertManagementLevelsBulkByLevel2(
        level2List,
        campaignId,
        code,
        isgoal,
        level1,
        state,
        actor,
        executor = this.pool,
    ) {
        const valuesSql = level2List
            .map(
                () => `( '', ?, ?, '', ?, ?, ?, NULL, NULL, ?, NOW(), ?, ? )`,
            )
            .join(",");

        const params = [];
        for (const level2 of level2List) {
            params.push(
                campaignId,
                code,
                isgoal,
                level1,
                level2,
                state,
                actor,
                actor,
            );
        }

        return executor.query(
            `
            INSERT INTO campaignresultmanagement (
                VCC,
                CampaignId,
                Code,
                Description,
                Isgoal,
                Level1,
                Level2,
                Level3,
                ManagementResultDescription,
                State,
                TmStmp,
                UserCreates,
                UserEdits
            )
            VALUES ${valuesSql}
            `,
            params,
        );
    }

    async insertManagementLevelPairsBulk(
        items,
        codeByLevel1,
        campaignId,
        isgoal,
        state,
        actor,
        executor = this.pool,
    ) {
        const valuesSql = items
            .map(
                () => `( '', ?, ?, '', ?, ?, ?, NULL, NULL, ?, NOW(), ?, ? )`,
            )
            .join(",");

        const params = [];
        for (const item of items) {
            params.push(
                campaignId,
                Number(codeByLevel1.get(item.level1) || 0),
                isgoal,
                item.level1,
                item.level2,
                state,
                actor,
                actor,
            );
        }

        return executor.query(
            `
            INSERT INTO campaignresultmanagement (
                VCC,
                CampaignId,
                Code,
                Description,
                Isgoal,
                Level1,
                Level2,
                Level3,
                ManagementResultDescription,
                State,
                TmStmp,
                UserCreates,
                UserEdits
            )
            VALUES ${valuesSql}
            `,
            params,
        );
    }

    async updateManagementLevel(
        id,
        campaignId,
        code,
        isgoal,
        level1,
        level2,
        state,
        actor,
        executor = this.pool,
    ) {
        const [result] = await executor.query(
            `
            UPDATE campaignresultmanagement
            SET Code = ?,
                Isgoal = ?,
                Level1 = ?,
                Level2 = ?,
                State = ?,
                TmStmp = NOW(),
                UserEdits = ?
            WHERE Id = ?
              AND CampaignId = ?
            `,
            [code, isgoal, level1, level2, state, actor, id, campaignId],
        );
        return result;
    }
}

export default AdminManagementDAO;
