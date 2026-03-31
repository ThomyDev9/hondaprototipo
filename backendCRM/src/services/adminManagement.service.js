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

const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";

function isInboundCategoryId(categoryId) {
    return String(categoryId || "").trim() === INBOUND_MENU_CATEGORY_ID;
}

export async function createManagementLevelsFromPairs(
    adminManagementDAO,
    {
        categoryId,
        campaignId,
        code,
        description,
        isgoal,
        state,
        actor,
        items,
    },
) {
    const normalizedItems = normalizeBulkPairItems(items);
    if (normalizedItems.length === 0) {
        throw createHttpError(400, "No hay pares Level1/Level2 validos");
    }

    const campaignIsValid =
        await adminManagementDAO.isActiveSubcampaignByCategory(
            categoryId,
            campaignId,
        );
    if (!campaignIsValid) {
        throw createHttpError(
            400,
            "CampaignId no pertenece a una subcampana activa de la categoria",
        );
    }

    const level1List = [...new Set(normalizedItems.map((item) => item.level1))];
    const level2List = [...new Set(normalizedItems.map((item) => item.level2))];
    const allowCustomLevel1 = isInboundCategoryId(categoryId);
    const fallbackCode = Number.isFinite(Number(code)) ? Number(code) : 0;

    const codeByLevel1 = allowCustomLevel1
        ? new Map(level1List.map((level1) => [level1, fallbackCode]))
        : await adminManagementDAO.getCodeByLevel1Map(level1List);

    const missingCodeItems = allowCustomLevel1
        ? []
        : normalizedItems.filter((item) => !codeByLevel1.has(item.level1));
    const validItems = allowCustomLevel1
        ? normalizedItems
        : normalizedItems.filter((item) => codeByLevel1.has(item.level1));

    if (validItems.length === 0) {
        throw createHttpError(
            400,
            "Ningun Level1 del pool tiene Code conocido en catalogo activo",
            {
                createdCount: 0,
                skippedMissingCode: missingCodeItems,
            },
        );
    }

    const existingSet = await adminManagementDAO.getExistingPairSet(
        campaignId,
        description,
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
            "Todos los pares ya existen o no tienen code valido",
            {
                createdCount: 0,
                skippedMissingCode: missingCodeItems,
                skippedDuplicate,
            },
        );
    }

    await adminManagementDAO.insertManagementLevelPairsBulk(
        toInsert,
        codeByLevel1,
        campaignId,
        isgoal,
        description,
        state,
        actor,
    );

    return {
        createdCount: toInsert.length,
        skippedMissingCode: missingCodeItems,
        skippedDuplicate,
        createdItems: toInsert,
    };
}

export function resolveManagementActor(user) {
    return (
        user?.username ||
        user?.email ||
        String(user?.id || "admin")
    );
}

export function normalizeManagementPayload(raw = {}) {
    return {
        categoryId: String(raw?.categoryId || "").trim(),
        campaignId: String(raw?.campaignId || "").trim(),
        code: Number(raw?.code || 0),
        isgoal: Number(raw?.isgoal || 0) === 1 ? 1 : 0,
        description: String(raw?.description || "").trim(),
        level1: String(raw?.level1 || "").trim(),
        level2: String(raw?.level2 || "").trim(),
        state: Number(raw?.state || 1) === 0 ? "0" : "1",
    };
}

export function normalizeBulkLevel2List(level2List) {
    return [
        ...new Set(
            (Array.isArray(level2List) ? level2List : [])
                .map((item) => String(item || "").trim())
                .filter(Boolean),
        ),
    ];
}

export async function validateManagementCampaignAndCode(
    adminManagementDAO,
    { categoryId, campaignId, level1, code },
) {
    if (!campaignId) {
        throw createHttpError(400, "campaignId es requerido");
    }

    if (!Number.isFinite(code) || code < 0) {
        throw createHttpError(
            400,
            "code debe ser un numero valido mayor o igual a 0",
        );
    }

    const isValidCampaign =
        await adminManagementDAO.isActiveSubcampaignByCategory(
            categoryId,
            campaignId,
        );
    if (!isValidCampaign) {
        throw createHttpError(
            400,
            "CampaignId no pertenece a una subcampana activa de la categoria",
        );
    }

    if (!level1 || isInboundCategoryId(categoryId)) {
        return;
    }

    const level1Exists = await adminManagementDAO.level1Exists(level1);
    if (!level1Exists) {
        return;
    }

    const isValidCode = await adminManagementDAO.isValidCodeForLevel1(
        level1,
        code,
    );
    if (!isValidCode) {
        throw createHttpError(
            400,
            "El code no corresponde al Level1 seleccionado",
        );
    }
}

export async function createManagementLevel(
    adminManagementDAO,
    payload,
) {
    const {
        categoryId,
        campaignId,
        code,
        isgoal,
        description,
        level1,
        level2,
        state,
        actor,
    } =
        payload;

    if (!campaignId || !level1 || !level2) {
        throw createHttpError(
            400,
            "campaignId, level1 y level2 son requeridos",
        );
    }

    await validateManagementCampaignAndCode(adminManagementDAO, {
        categoryId,
        campaignId,
        level1,
        code,
    });

    const duplicate = await adminManagementDAO.findDuplicateManagementLevel(
        campaignId,
        description,
        code,
        level1,
        level2,
    );
    if (duplicate) {
        throw createHttpError(
            409,
            "Ya existe un nivel de gestion con ese CampaignId/Code/Level1/Level2",
        );
    }

    return adminManagementDAO.insertManagementLevel(
        campaignId,
        code,
        isgoal,
        description,
        level1,
        level2,
        state,
        actor,
    );
}

export async function createManagementLevelsBulk(
    adminManagementDAO,
    payload,
) {
    const {
        categoryId,
        campaignId,
        code,
        isgoal,
        description,
        level1,
        state,
        actor,
        level2List,
    } = payload;

    if (!campaignId || !level1) {
        throw createHttpError(400, "campaignId y level1 son requeridos");
    }

    const normalizedLevel2List = normalizeBulkLevel2List(level2List);
    if (normalizedLevel2List.length === 0) {
        throw createHttpError(400, "Debes enviar al menos un Level2 valido");
    }

    await validateManagementCampaignAndCode(adminManagementDAO, {
        categoryId,
        campaignId,
        level1,
        code,
    });

    const existingRows = await adminManagementDAO.findExistingLevel2Rows(
        campaignId,
        description,
        code,
        level1,
        normalizedLevel2List,
    );

    const existingLevel2Set = new Set(
        (existingRows || []).map((row) => String(row?.Level2 || "").trim()),
    );

    const toInsert = normalizedLevel2List.filter(
        (item) => !existingLevel2Set.has(item),
    );

    if (toInsert.length === 0) {
        throw createHttpError(
            409,
            "Todos los Level2 ya existen para ese CampaignId/Code/Level1",
        );
    }

    await adminManagementDAO.insertManagementLevelsBulkByLevel2(
        toInsert,
        campaignId,
        code,
        isgoal,
        description,
        level1,
        state,
        actor,
    );

    return {
        createdCount: toInsert.length,
        skippedCount: existingLevel2Set.size,
        createdLevel2: toInsert,
        skippedLevel2: [...existingLevel2Set],
    };
}

export async function updateManagementLevel(
    adminManagementDAO,
    payload,
) {
    const {
        id,
        categoryId,
        campaignId,
        code,
        isgoal,
        description,
        level1,
        level2,
        state,
        actor,
    } = payload;

    if (!Number.isFinite(id) || id <= 0) {
        throw createHttpError(400, "id invalido");
    }

    if (!campaignId || !level1 || !level2) {
        throw createHttpError(
            400,
            "campaignId, level1 y level2 son requeridos",
        );
    }

    await validateManagementCampaignAndCode(adminManagementDAO, {
        categoryId,
        campaignId,
        level1,
        code,
    });

    const existing = await adminManagementDAO.findManagementLevelByIdAndCampaign(
        id,
        campaignId,
    );
    if (!existing) {
        throw createHttpError(
            404,
            "No existe el nivel de gestion para la campana indicada",
        );
    }

    const duplicate = await adminManagementDAO.findDuplicateManagementLevel(
        campaignId,
        description,
        code,
        level1,
        level2,
        id,
    );
    if (duplicate) {
        throw createHttpError(
            409,
            "Ya existe otro nivel con ese CampaignId/Code/Level1/Level2",
        );
    }

    const result = await adminManagementDAO.updateManagementLevel(
        id,
        campaignId,
        code,
        isgoal,
        description,
        level1,
        level2,
        state,
        actor,
    );

    if ((result?.affectedRows || 0) === 0) {
        throw createHttpError(404, "No se pudo actualizar el nivel de gestion");
    }

    return result;
}
