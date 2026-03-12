// backend/src/routes/admin.routes.js
import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const OUTBOUND_CATEGORY_ID = "544fb0a6-1345-11f1-b790-000c2904c92f";

// Middlewares compartidos para rutas de admin
const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

const middlewaresAdminStrict = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
];

function normalizeBulkPairItems(items) {
    const normalizedItems = [];
    const dedupe = new Set();

    for (const rawItem of items) {
        const level1 = String(rawItem?.level1 || "").trim();
        const level2 = String(rawItem?.level2 || "").trim();
        if (!level1 || !level2) {
            continue;
        }

        const key = `${level1}|||${level2}`;
        if (dedupe.has(key)) {
            continue;
        }

        dedupe.add(key);
        normalizedItems.push({ level1, level2 });
    }

    return normalizedItems;
}

async function isActiveOutboundSubcampaign(campaignId) {
    const [campaignRows] = await pool.query(
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
        [OUTBOUND_CATEGORY_ID, OUTBOUND_CATEGORY_ID, campaignId],
    );

    return campaignRows.length > 0;
}

async function getCodeByLevel1Map(level1List) {
    const level1Placeholders = level1List.map(() => "?").join(",");
    const [codeRows] = await pool.query(
        `
        SELECT TRIM(Level1) AS level1, MIN(Code) AS code
        FROM campaignresultmanagement
        WHERE COALESCE(State, '1') = '1'
          AND TRIM(Level1) IN (${level1Placeholders})
        GROUP BY TRIM(Level1)
        `,
        level1List,
    );

    return new Map(
        (codeRows || []).map((row) => [
            String(row?.level1 || "").trim(),
            Number(row?.code || 0),
        ]),
    );
}

async function getExistingPairSet(campaignId, level1List, level2List) {
    const level1Placeholders = level1List.map(() => "?").join(",");
    const level2Placeholders = level2List.map(() => "?").join(",");

    const [existingRows] = await pool.query(
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
        (existingRows || []).map(
            (row) =>
                `${String(row?.level1 || "").trim()}|||${String(
                    row?.level2 || "",
                ).trim()}`,
        ),
    );
}

function splitItemsByDuplicate(items, existingSet) {
    const toInsert = [];
    const skippedDuplicate = [];

    for (const item of items) {
        const key = `${item.level1}|||${item.level2}`;
        if (existingSet.has(key)) {
            skippedDuplicate.push(item);
            continue;
        }
        toInsert.push(item);
    }

    return { toInsert, skippedDuplicate };
}

function createHttpError(status, message, data) {
    const error = new Error(message);
    error.status = status;
    error.payload = data;
    return error;
}

async function createManagementLevelsFromPairs({
    campaignId,
    isgoal,
    state,
    actor,
    items,
}) {
    const normalizedItems = normalizeBulkPairItems(items);
    if (normalizedItems.length === 0) {
        throw createHttpError(400, "No hay pares Level1/Level2 válidos");
    }

    const campaignIsValid = await isActiveOutboundSubcampaign(campaignId);
    if (!campaignIsValid) {
        throw createHttpError(
            400,
            "CampaignId no pertenece a una subcampaña outbound activa",
        );
    }

    const level1List = [...new Set(normalizedItems.map((item) => item.level1))];
    const level2List = [...new Set(normalizedItems.map((item) => item.level2))];
    const codeByLevel1 = await getCodeByLevel1Map(level1List);

    const missingCodeItems = normalizedItems.filter(
        (item) => !codeByLevel1.has(item.level1),
    );
    const validItems = normalizedItems.filter((item) =>
        codeByLevel1.has(item.level1),
    );

    if (validItems.length === 0) {
        throw createHttpError(
            400,
            "Ningún Level1 del pool tiene Code conocido en catálogo activo",
            {
                createdCount: 0,
                skippedMissingCode: missingCodeItems,
            },
        );
    }

    const existingSet = await getExistingPairSet(
        campaignId,
        level1List,
        level2List,
    );
    const { toInsert, skippedDuplicate } = splitItemsByDuplicate(
        validItems,
        existingSet,
    );

    if (toInsert.length === 0) {
        throw createHttpError(
            409,
            "Todos los pares ya existen o no tienen code válido",
            {
                createdCount: 0,
                skippedMissingCode: missingCodeItems,
                skippedDuplicate,
            },
        );
    }

    const valuesSql = toInsert
        .map(() => `( '', ?, ?, '', ?, ?, ?, NULL, NULL, ?, NOW(), ?, ? )`)
        .join(",");

    const params = [];
    for (const item of toInsert) {
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

    await pool.query(
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

    return {
        createdCount: toInsert.length,
        skippedMissingCode: missingCodeItems,
        skippedDuplicate,
        createdItems: toInsert,
    };
}

/**
 * GET /admin/users
 * Listado simple de usuarios (MySQL)
 */
router.get("/users", ...middlewaresAdmin, async (req, res) => {
    try {
        const users = await userService.obtenerUsuarios();
        return res.json({ users });
    } catch (err) {
        console.error("Error en /admin/users:", err);
        return res.status(500).json({
            error: "Error inesperado en /admin/users",
        });
    }
});

/**
 * GET /admin/management-levels/suggestions
 * Obtiene sugerencias de niveles de gestión
 */
router.get(
    "/management-levels/suggestions",
    ...middlewaresAdminStrict,
    async (_req, res) => {
        try {
            const [level1Rows] = await pool.query(`
                SELECT
                    TRIM(Level1) AS level1,
                    MIN(Code) AS code
                FROM campaignresultmanagement
                WHERE COALESCE(State, '1') = '1'
                  AND TRIM(Level1) <> ''
                GROUP BY TRIM(Level1)
                ORDER BY TRIM(Level1) ASC
            `);

            const [level2Rows] = await pool.query(`
                SELECT
                    TRIM(Level2) AS level2,
                    Code AS code
                FROM campaignresultmanagement
                WHERE COALESCE(State, '1') = '1'
                  AND TRIM(Level2) <> ''
                GROUP BY TRIM(Level2), Code
                ORDER BY TRIM(Level2) ASC
            `);

            return res.json({
                data: {
                    level1: level1Rows,
                    level2: level2Rows,
                },
            });
        } catch (err) {
            console.error(
                "Error GET /admin/management-levels/suggestions:",
                err,
            );
            return res.status(500).json({
                error: "Error obteniendo sugerencias de niveles",
            });
        }
    },
);

router.get(
    "/management-levels/campaigns",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const [rows] = await pool.query(
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
                [OUTBOUND_CATEGORY_ID, OUTBOUND_CATEGORY_ID],
            );

            return res.json({
                data: rows.map((row) => ({
                    id: row.campaign_id,
                    label: `${row.parent_name} > ${row.campaign_id}`,
                })),
            });
        } catch (err) {
            console.error("Error GET /admin/management-levels/campaigns:", err);
            return res.status(500).json({
                error: "Error obteniendo campañas para niveles de gestión",
            });
        }
    },
);

router.get(
    "/management-levels",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const campaignId = String(req.query?.campaignId || "").trim();
            const state = String(req.query?.state || "1").trim();

            if (!campaignId) {
                return res
                    .status(400)
                    .json({ error: "campaignId es requerido" });
            }

            const params = [campaignId];
            let stateFilter = "";
            if (state === "0" || state === "1") {
                stateFilter = " AND COALESCE(State, '1') = ?";
                params.push(state);
            }

            const [rows] = await pool.query(
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

            return res.json({ data: rows });
        } catch (err) {
            console.error("Error GET /admin/management-levels:", err);
            return res.status(500).json({
                error: "Error obteniendo niveles de gestión",
            });
        }
    },
);

router.post(
    "/management-levels",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const campaignId = String(req.body?.campaignId || "").trim();
            const code = Number(req.body?.code || 0);
            const isgoal = Number(req.body?.isgoal || 0) === 1 ? 1 : 0;
            const level1 = String(req.body?.level1 || "").trim();
            const level2 = String(req.body?.level2 || "").trim();
            const state = Number(req.body?.state || 1) === 0 ? "0" : "1";
            const actor =
                req.user?.username ||
                req.user?.email ||
                String(req.user?.id || "admin");

            if (!campaignId || !level1 || !level2) {
                return res.status(400).json({
                    error: "campaignId, level1 y level2 son requeridos",
                });
            }

            const [campaignRows] = await pool.query(
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
                [OUTBOUND_CATEGORY_ID, OUTBOUND_CATEGORY_ID, campaignId],
            );

            if (campaignRows.length === 0) {
                return res.status(400).json({
                    error: "CampaignId no pertenece a una subcampaña outbound activa",
                });
            }

            if (!Number.isFinite(code) || code < 0) {
                return res.status(400).json({
                    error: "code debe ser un número válido mayor o igual a 0",
                });
            }

            const [knownLevel1Rows] = await pool.query(
                `
                SELECT 1
                FROM campaignresultmanagement
                WHERE COALESCE(State, '1') = '1'
                  AND TRIM(Level1) = ?
                LIMIT 1
                `,
                [level1],
            );

            if (knownLevel1Rows.length > 0) {
                const [validCodeRows] = await pool.query(
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

                if (validCodeRows.length === 0) {
                    return res.status(400).json({
                        error: "El code no corresponde al Level1 seleccionado",
                    });
                }
            }

            const [duplicateRows] = await pool.query(
                `
                SELECT Id
                FROM campaignresultmanagement
                WHERE CampaignId = ?
                  AND Code = ?
                  AND Level1 = ?
                  AND Level2 = ?
                LIMIT 1
                `,
                [campaignId, code, level1, level2],
            );

            if (duplicateRows.length > 0) {
                return res.status(409).json({
                    error: "Ya existe un nivel de gestión con ese CampaignId/Code/Level1/Level2",
                });
            }

            const [result] = await pool.query(
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

            return res.status(201).json({
                message: "Nivel de gestión creado correctamente",
                data: { id: result.insertId },
            });
        } catch (err) {
            console.error("Error POST /admin/management-levels:", err);
            return res.status(500).json({
                error: "Error creando nivel de gestión",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/management-levels/bulk",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const campaignId = String(req.body?.campaignId || "").trim();
            const code = Number(req.body?.code || 0);
            const isgoal = Number(req.body?.isgoal || 1) === 1 ? 1 : 0;
            const level1 = String(req.body?.level1 || "").trim();
            const state = Number(req.body?.state || 1) === 0 ? "0" : "1";
            const actor =
                req.user?.username ||
                req.user?.email ||
                String(req.user?.id || "admin");

            const level2List = Array.isArray(req.body?.level2List)
                ? req.body.level2List
                : [];

            if (!campaignId || !level1) {
                return res.status(400).json({
                    error: "campaignId y level1 son requeridos",
                });
            }

            if (!Number.isFinite(code) || code < 0) {
                return res.status(400).json({
                    error: "code debe ser un número válido mayor o igual a 0",
                });
            }

            const normalizedLevel2List = [
                ...new Set(
                    level2List
                        .map((item) => String(item || "").trim())
                        .filter(Boolean),
                ),
            ];

            if (normalizedLevel2List.length === 0) {
                return res.status(400).json({
                    error: "Debes enviar al menos un Level2 válido",
                });
            }

            const [campaignRows] = await pool.query(
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
                [OUTBOUND_CATEGORY_ID, OUTBOUND_CATEGORY_ID, campaignId],
            );

            if (campaignRows.length === 0) {
                return res.status(400).json({
                    error: "CampaignId no pertenece a una subcampaña outbound activa",
                });
            }

            const [knownLevel1Rows] = await pool.query(
                `
                SELECT 1
                FROM campaignresultmanagement
                WHERE COALESCE(State, '1') = '1'
                  AND TRIM(Level1) = ?
                LIMIT 1
                `,
                [level1],
            );

            if (knownLevel1Rows.length > 0) {
                const [validCodeRows] = await pool.query(
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

                if (validCodeRows.length === 0) {
                    return res.status(400).json({
                        error: "El code no corresponde al Level1 seleccionado",
                    });
                }
            }

            const placeholders = normalizedLevel2List.map(() => "?").join(",");

            const [existingRows] = await pool.query(
                `
                SELECT Level2
                FROM campaignresultmanagement
                WHERE CampaignId = ?
                  AND Code = ?
                  AND Level1 = ?
                  AND Level2 IN (${placeholders})
                `,
                [campaignId, code, level1, ...normalizedLevel2List],
            );

            const existingLevel2Set = new Set(
                (existingRows || []).map((row) =>
                    String(row?.Level2 || "").trim(),
                ),
            );

            const toInsert = normalizedLevel2List.filter(
                (item) => !existingLevel2Set.has(item),
            );

            if (toInsert.length === 0) {
                return res.status(409).json({
                    error: "Todos los Level2 ya existen para ese CampaignId/Code/Level1",
                });
            }

            const valuesSql = toInsert
                .map(
                    () =>
                        `( '', ?, ?, '', ?, ?, ?, NULL, NULL, ?, NOW(), ?, ? )`,
                )
                .join(",");

            const params = [];
            for (const level2 of toInsert) {
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

            await pool.query(
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

            return res.status(201).json({
                message: `Niveles creados: ${toInsert.length}. Omitidos por duplicado: ${existingLevel2Set.size}`,
                data: {
                    createdCount: toInsert.length,
                    skippedCount: existingLevel2Set.size,
                    createdLevel2: toInsert,
                    skippedLevel2: [...existingLevel2Set],
                },
            });
        } catch (err) {
            console.error("Error POST /admin/management-levels/bulk:", err);
            return res.status(500).json({
                error: "Error creando niveles de gestión en bloque",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/management-levels/bulk-pairs",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const campaignId = String(req.body?.campaignId || "").trim();
            const isgoal = Number(req.body?.isgoal || 1) === 1 ? 1 : 0;
            const state = Number(req.body?.state || 1) === 0 ? "0" : "1";
            const actor =
                req.user?.username ||
                req.user?.email ||
                String(req.user?.id || "admin");

            const items = Array.isArray(req.body?.items) ? req.body.items : [];

            if (!campaignId) {
                return res.status(400).json({
                    error: "campaignId es requerido",
                });
            }

            if (items.length === 0) {
                return res.status(400).json({
                    error: "Debes enviar al menos un par Level1/Level2",
                });
            }

            const result = await createManagementLevelsFromPairs({
                campaignId,
                isgoal,
                state,
                actor,
                items,
            });

            return res.status(201).json({
                message: `Niveles creados: ${result.createdCount}`,
                data: result,
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({
                    error: err.message,
                    data: err.payload,
                });
            }

            console.error(
                "Error POST /admin/management-levels/bulk-pairs:",
                err,
            );
            return res.status(500).json({
                error: "Error creando niveles por pares",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.put(
    "/management-levels/:id",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const id = Number(req.params?.id || 0);
            const campaignId = String(req.body?.campaignId || "").trim();
            const code = Number(req.body?.code || 0);
            const isgoal = Number(req.body?.isgoal || 1) === 1 ? 1 : 0;
            const level1 = String(req.body?.level1 || "").trim();
            const level2 = String(req.body?.level2 || "").trim();
            const state = Number(req.body?.state || 1) === 0 ? "0" : "1";
            const actor =
                req.user?.username ||
                req.user?.email ||
                String(req.user?.id || "admin");

            if (!Number.isFinite(id) || id <= 0) {
                return res.status(400).json({ error: "id inválido" });
            }

            if (!campaignId || !level1 || !level2) {
                return res.status(400).json({
                    error: "campaignId, level1 y level2 son requeridos",
                });
            }

            if (!Number.isFinite(code) || code < 0) {
                return res.status(400).json({
                    error: "code debe ser un número válido mayor o igual a 0",
                });
            }

            const [knownLevel1Rows] = await pool.query(
                `
                SELECT 1
                FROM campaignresultmanagement
                WHERE COALESCE(State, '1') = '1'
                  AND TRIM(Level1) = ?
                LIMIT 1
                `,
                [level1],
            );

            if (knownLevel1Rows.length > 0) {
                const [validCodeRows] = await pool.query(
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

                if (validCodeRows.length === 0) {
                    return res.status(400).json({
                        error: "El code no corresponde al Level1 seleccionado",
                    });
                }
            }

            const [existingRows] = await pool.query(
                `
                SELECT Id
                FROM campaignresultmanagement
                WHERE Id = ?
                  AND CampaignId = ?
                LIMIT 1
                `,
                [id, campaignId],
            );

            if (existingRows.length === 0) {
                return res.status(404).json({
                    error: "No existe el nivel de gestión para la campaña indicada",
                });
            }

            const [duplicateRows] = await pool.query(
                `
                SELECT Id
                FROM campaignresultmanagement
                WHERE CampaignId = ?
                  AND Code = ?
                  AND Level1 = ?
                  AND Level2 = ?
                  AND Id <> ?
                LIMIT 1
                `,
                [campaignId, code, level1, level2, id],
            );

            if (duplicateRows.length > 0) {
                return res.status(409).json({
                    error: "Ya existe otro nivel con ese CampaignId/Code/Level1/Level2",
                });
            }

            const [result] = await pool.query(
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

            if ((result?.affectedRows || 0) === 0) {
                return res.status(404).json({
                    error: "No se pudo actualizar el nivel de gestión",
                });
            }

            return res.json({
                message: "Nivel de gestión actualizado correctamente",
            });
        } catch (err) {
            console.error("Error PUT /admin/management-levels/:id:", err);
            return res.status(500).json({
                error: "Error actualizando nivel de gestión",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

export default router;
