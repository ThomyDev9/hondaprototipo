import pool from "./db.js";
import {
    GET_OUTBOUND_MENU_TREE,
    GET_OUTBOUND_PARENT_CAMPAIGNS,
    CHECK_OUTBOUND_CAMPAIGN_EXISTS,
    INSERT_OUTBOUND_CAMPAIGN,
    CHECK_OUTBOUND_SUBCAMPAIGN_EXISTS,
    INSERT_OUTBOUND_SUBCAMPAIGN,
    GET_OUTBOUND_MENU_TREE_WITH_STATUS,
    UPDATE_OUTBOUND_MENU_ITEM_STATUS,
    GET_OUTBOUND_MENU_ITEM_BY_ID,
    UPDATE_OUTBOUND_CHILDREN_STATUS_BY_PARENT,
} from "./queries/menu.queries.js";

const OUTBOUND_MENU_CACHE_TTL_MS = 60_000;
let outboundMenuTreeCache = null;
let outboundMenuTreeCacheAt = 0;

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

    // Usa la consulta del sistema de queries
    const [rows] = await pool.query(GET_OUTBOUND_MENU_TREE);

    // Agrupa en árbol
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
    const [rows] = await pool.query(GET_OUTBOUND_PARENT_CAMPAIGNS);
    return rows;
}

export async function createOutboundCampaign(nombre) {
    const nombreLimpio = String(nombre || "").trim();
    if (!nombreLimpio) {
        throw new Error("El nombre de la campaña es requerido");
    }

    const [existing] = await pool.query(CHECK_OUTBOUND_CAMPAIGN_EXISTS, [
        nombreLimpio,
    ]);
    if (existing.length > 0) {
        throw new Error("La campaña ya existe");
    }

    await pool.query(INSERT_OUTBOUND_CAMPAIGN, [nombreLimpio]);
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
        throw new Error("El nombre de la subcampaña es requerido");
    }

    const [existing] = await pool.query(CHECK_OUTBOUND_SUBCAMPAIGN_EXISTS, [
        parentIdLimpio,
        nombreLimpio,
    ]);
    if (existing.length > 0) {
        throw new Error("La subcampaña ya existe para la campaña seleccionada");
    }

    await pool.query(INSERT_OUTBOUND_SUBCAMPAIGN, [
        nombreLimpio,
        parentIdLimpio,
    ]);
    invalidateOutboundMenuTreeCache();
    return { parentId: parentIdLimpio, nombre: nombreLimpio };
}

export async function getOutboundMenuTreeWithStatus() {
    const [rows] = await pool.query(GET_OUTBOUND_MENU_TREE_WITH_STATUS);

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
        throw new Error("estado inválido");
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [itemRows] = await connection.query(
            GET_OUTBOUND_MENU_ITEM_BY_ID,
            [idLimpio],
        );
        if (itemRows.length === 0) {
            throw new Error("No se encontró el ítem a actualizar");
        }

        const [result] = await connection.query(
            UPDATE_OUTBOUND_MENU_ITEM_STATUS,
            [estadoLimpio, idLimpio],
        );

        if (!result.affectedRows) {
            throw new Error("No se encontró el ítem a actualizar");
        }

        const isParentCampaign = itemRows[0].id_padre === null;
        if (isParentCampaign && estadoLimpio === "inactivo") {
            await connection.query(UPDATE_OUTBOUND_CHILDREN_STATUS_BY_PARENT, [
                "inactivo",
                idLimpio,
            ]);
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
