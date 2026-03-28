import pool from "./db.js";
import MenuDAO from "./dao/MenuDAO.js";

const OUTBOUND_MENU_CACHE_TTL_MS = 60_000;
let outboundMenuTreeCache = null;
let outboundMenuTreeCacheAt = 0;
const menuDAO = new MenuDAO(pool);

function invalidateOutboundMenuTreeCache() {
    outboundMenuTreeCache = null;
    outboundMenuTreeCacheAt = 0;
}

export async function getOutboundMenuTree() {
    if (
        outboundMenuTreeCache &&
        Date.now() - outboundMenuTreeCacheAt < OUTBOUND_MENU_CACHE_TTL_MS
    ) {
        return outboundMenuTreeCache;
    }

    const rows = await menuDAO.getOutboundMenuTreeRows();

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

    outboundMenuTreeCache = tree;
    outboundMenuTreeCacheAt = Date.now();

    return tree;
}

export async function getOutboundParentCampaigns() {
    return menuDAO.getOutboundParentCampaigns();
}

export async function createOutboundCampaign(nombre) {
    const nombreLimpio = String(nombre || "").trim();
    if (!nombreLimpio) {
        throw new Error("El nombre de la campana es requerido");
    }

    const existing = await menuDAO.findActiveCampaignByName(nombreLimpio);
    if (existing) {
        throw new Error("La campana ya existe");
    }

    await menuDAO.insertOutboundCampaign(nombreLimpio);
    invalidateOutboundMenuTreeCache();
    return { nombre: nombreLimpio };
}

export async function createOutboundSubcampaign(parentId, nombre) {
    const parentIdLimpio = String(parentId || "").trim();
    const nombreLimpio = String(nombre || "").trim();

    if (!parentIdLimpio) {
        throw new Error("parentId es requerido");
    }
    if (!nombreLimpio) {
        throw new Error("El nombre de la subcampana es requerido");
    }

    const existing = await menuDAO.findActiveSubcampaign(
        parentIdLimpio,
        nombreLimpio,
    );
    if (existing) {
        throw new Error("La subcampana ya existe para la campana seleccionada");
    }

    await menuDAO.insertOutboundSubcampaign(nombreLimpio, parentIdLimpio);
    invalidateOutboundMenuTreeCache();
    return { parentId: parentIdLimpio, nombre: nombreLimpio };
}

export async function getOutboundMenuTreeWithStatus() {
    const rows = await menuDAO.getOutboundMenuTreeWithStatusRows();

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

export async function updateOutboundMenuItemStatus(id, estado) {
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

        const item = await menuDAO.getOutboundMenuItemById(idLimpio, connection);
        if (!item) {
            throw new Error("No se encontro el item a actualizar");
        }

        const [result] = await menuDAO.updateOutboundMenuItemStatus(
            idLimpio,
            estadoLimpio,
            connection,
        );

        if (!result.affectedRows) {
            throw new Error("No se encontro el item a actualizar");
        }

        const isParentCampaign = item.id_padre === null;
        if (isParentCampaign && estadoLimpio === "inactivo") {
            await menuDAO.updateOutboundChildrenStatus(
                idLimpio,
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

    invalidateOutboundMenuTreeCache();

    return { id: idLimpio, estado: estadoLimpio };
}
