import pool from "./db.js";
import { GET_OUTBOUND_MENU_TREE, GET_OUTBOUND_MENU_CATEGORY_NAME } from "./queries/menu.queries.js";

export async function getOutboundMenuTree() {
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
    return tree;
}

// Nuevo: obtener el nombre de la categoría dinámicamente
export async function getOutboundMenuCategoryName() {
    const [rows] = await pool.query(GET_OUTBOUND_MENU_CATEGORY_NAME);
    return rows[0]?.nombre_categoria || "Campañas Outbound";
}
