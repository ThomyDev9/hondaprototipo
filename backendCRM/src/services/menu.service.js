import pool from "./db.js";
import MenuDAO from "./dao/MenuDAO.js";

export const DEFAULT_MENU_CATEGORY_ID =
    "544fb0a6-1345-11f1-b790-000c2904c92f";
const OUTBOUND_MENU_CACHE_TTL_MS = 60_000;
const menuTreeCache = new Map();
const menuDAO = new MenuDAO(pool);

function resolveCategoryId(categoryId) {
    return String(categoryId || DEFAULT_MENU_CATEGORY_ID).trim();
}

function invalidateMenuTreeCache(categoryId) {
    if (categoryId) {
        menuTreeCache.delete(resolveCategoryId(categoryId));
        return;
    }
    menuTreeCache.clear();
}

export async function getMenuCategories() {
    return menuDAO.getMenuCategories();
}

export async function getMenuTree(categoryId) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const cached = menuTreeCache.get(resolvedCategoryId);
    if (cached && Date.now() - cached.savedAt < OUTBOUND_MENU_CACHE_TTL_MS) {
        return cached.data;
    }

    const rows = await menuDAO.getMenuTreeRowsByCategory(resolvedCategoryId);

    const tree = [];
    const map = {};
    for (const row of rows) {
        if (!map[row.campania_id]) {
            map[row.campania_id] = { campania: row.campania, subcampanias: [] };
            tree.push(map[row.campania_id]);
        }
        if (row.subcampania) {
            map[row.campania_id].subcampanias.push(row.subcampania);
        }
    }

    menuTreeCache.set(resolvedCategoryId, {
        data: tree,
        savedAt: Date.now(),
    });

    return tree;
}

export async function getMenuTreeDetailed(categoryId) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const rows = await menuDAO.getMenuTreeRowsByCategory(resolvedCategoryId);

    const tree = [];
    const map = {};

    for (const row of rows) {
        if (!map[row.campania_id]) {
            map[row.campania_id] = {
                id: row.campania_id,
                campania: row.campania,
                categoryId: resolvedCategoryId,
                subcampanias: [],
            };
            tree.push(map[row.campania_id]);
        }

        if (row.subcampania_id && row.subcampania) {
            map[row.campania_id].subcampanias.push({
                id: row.subcampania_id,
                nombre: row.subcampania,
                categoryId: resolvedCategoryId,
                inboundQueue: String(
                    row.subcampania_inbound_queue || "",
                ).trim(),
            });
        }
    }

    return tree;
}

export async function getParentCampaigns(categoryId) {
    return menuDAO.getParentCampaignsByCategory(resolveCategoryId(categoryId));
}

export async function createCampaign(categoryId, nombre) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const nombreLimpio = String(nombre || "").trim();
    if (!nombreLimpio) {
        throw new Error("El nombre de la campana es requerido");
    }

    const existing = await menuDAO.findActiveCampaignByName(
        resolvedCategoryId,
        nombreLimpio,
    );
    if (existing) {
        throw new Error("La campana ya existe");
    }

    await menuDAO.insertCampaign(resolvedCategoryId, nombreLimpio);
    invalidateMenuTreeCache(resolvedCategoryId);
    return { nombre: nombreLimpio, categoryId: resolvedCategoryId };
}

export async function createSubcampaign(categoryId, parentId, nombre) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const parentIdLimpio = String(parentId || "").trim();
    const nombreLimpio = String(nombre || "").trim();

    if (!parentIdLimpio) {
        throw new Error("parentId es requerido");
    }
    if (!nombreLimpio) {
        throw new Error("El nombre de la subcampana es requerido");
    }

    const parentItem = await menuDAO.getMenuItemById(parentIdLimpio);
    if (!parentItem) {
        throw new Error("No se encontro la campana padre");
    }
    if (parentItem.id_padre !== null) {
        throw new Error("La campana padre seleccionada no es valida");
    }
    if (String(parentItem.id_categoria || "").trim() !== resolvedCategoryId) {
        throw new Error("La campana padre no pertenece a la categoria seleccionada");
    }

    const existing = await menuDAO.findActiveSubcampaign(
        resolvedCategoryId,
        parentIdLimpio,
        nombreLimpio,
    );
    if (existing) {
        throw new Error("La subcampana ya existe para la campana seleccionada");
    }

    await menuDAO.insertSubcampaign(
        resolvedCategoryId,
        nombreLimpio,
        parentIdLimpio,
    );
    invalidateMenuTreeCache(resolvedCategoryId);
    return {
        parentId: parentIdLimpio,
        nombre: nombreLimpio,
        categoryId: resolvedCategoryId,
    };
}

export async function getMenuTreeWithStatus(categoryId) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const rows = await menuDAO.getMenuTreeWithStatusRowsByCategory(
        resolvedCategoryId,
    );

    const tree = [];
    const map = {};

    for (const row of rows) {
        if (!map[row.campania_id]) {
            map[row.campania_id] = {
                id: row.campania_id,
                campania: row.campania,
                estado: row.campania_estado,
                subcampanias: [],
            };
            tree.push(map[row.campania_id]);
        }

        if (row.subcampania_id) {
            map[row.campania_id].subcampanias.push({
                id: row.subcampania_id,
                nombre: row.subcampania,
                estado: row.subcampania_estado,
            });
        }
    }

    return tree;
}

export async function updateMenuItemStatus(categoryId, id, estado) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const idLimpio = String(id || "").trim();
    const estadoLimpio = String(estado || "")
        .trim()
        .toLowerCase();

    if (!idLimpio) {
        throw new Error("id es requerido");
    }
    if (!["activo", "inactivo"].includes(estadoLimpio)) {
        throw new Error("estado invalido");
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const item = await menuDAO.getMenuItemByIdAndCategory(
            idLimpio,
            resolvedCategoryId,
            connection,
        );
        if (!item) {
            throw new Error("No se encontro el item a actualizar");
        }

        const [result] = await menuDAO.updateMenuItemStatus(
            idLimpio,
            resolvedCategoryId,
            estadoLimpio,
            connection,
        );

        if (!result.affectedRows) {
            throw new Error("No se encontro el item a actualizar");
        }

        const isParentCampaign = item.id_padre === null;
        if (isParentCampaign && estadoLimpio === "inactivo") {
            await menuDAO.updateChildrenStatus(
                idLimpio,
                resolvedCategoryId,
                "inactivo",
                connection,
            );
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    invalidateMenuTreeCache(resolvedCategoryId);

    return { id: idLimpio, estado: estadoLimpio, categoryId: resolvedCategoryId };
}

export async function getOutboundMenuTree() {
    return getMenuTree(DEFAULT_MENU_CATEGORY_ID);
}

export async function getOutboundParentCampaigns() {
    return getParentCampaigns(DEFAULT_MENU_CATEGORY_ID);
}

export async function createOutboundCampaign(nombre) {
    return createCampaign(DEFAULT_MENU_CATEGORY_ID, nombre);
}

export async function createOutboundSubcampaign(parentId, nombre) {
    return createSubcampaign(DEFAULT_MENU_CATEGORY_ID, parentId, nombre);
}

export async function getOutboundMenuTreeWithStatus() {
    return getMenuTreeWithStatus(DEFAULT_MENU_CATEGORY_ID);
}

export async function updateOutboundMenuItemStatus(id, estado) {
    return updateMenuItemStatus(DEFAULT_MENU_CATEGORY_ID, id, estado);
}
