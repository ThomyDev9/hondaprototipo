import pool from "../db.js";

const GET_OUTBOUND_MENU_TREE = `
  SELECT
    p.id AS campania_id,
    p.nombre_item AS campania,
    s.id AS subcampania_id,
    s.nombre_item AS subcampania
  FROM menu_items p
  LEFT JOIN menu_items s ON s.id_padre = p.id
    AND s.id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND s.estado = 'activo'
  WHERE p.id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND p.id_padre IS NULL
    AND p.estado = 'activo'
  ORDER BY p.nombre_item, s.nombre_item
`;

const GET_OUTBOUND_PARENT_CAMPAIGNS = `
  SELECT
    id,
    nombre_item AS nombre
  FROM menu_items
  WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND id_padre IS NULL
    AND estado = 'activo'
  ORDER BY nombre_item
`;

const CHECK_OUTBOUND_CAMPAIGN_EXISTS = `
  SELECT id
  FROM menu_items
  WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND id_padre IS NULL
    AND estado = 'activo'
    AND nombre_item = ?
  LIMIT 1
`;

const INSERT_OUTBOUND_CAMPAIGN = `
  INSERT INTO menu_items (id, nombre_item, id_categoria, id_padre, estado)
  VALUES (UUID(), ?, '544fb0a6-1345-11f1-b790-000c2904c92f', NULL, 'activo')
`;

const CHECK_OUTBOUND_SUBCAMPAIGN_EXISTS = `
  SELECT id
  FROM menu_items
  WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND id_padre = ?
    AND estado = 'activo'
    AND nombre_item = ?
  LIMIT 1
`;

const INSERT_OUTBOUND_SUBCAMPAIGN = `
  INSERT INTO menu_items (id, nombre_item, id_categoria, id_padre, estado)
  VALUES (UUID(), ?, '544fb0a6-1345-11f1-b790-000c2904c92f', ?, 'activo')
`;

const GET_OUTBOUND_MENU_TREE_WITH_STATUS = `
  SELECT
    p.id AS campania_id,
    p.nombre_item AS campania,
    p.estado AS campania_estado,
    s.id AS subcampania_id,
    s.nombre_item AS subcampania,
    s.estado AS subcampania_estado
  FROM menu_items p
  LEFT JOIN menu_items s ON s.id_padre = p.id
    AND s.id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
  WHERE p.id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND p.id_padre IS NULL
  ORDER BY p.nombre_item, s.nombre_item
`;

const UPDATE_OUTBOUND_MENU_ITEM_STATUS = `
  UPDATE menu_items
  SET estado = ?
  WHERE id = ?
    AND id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
`;

const GET_OUTBOUND_MENU_ITEM_BY_ID = `
  SELECT id, id_padre
  FROM menu_items
  WHERE id = ?
    AND id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
  LIMIT 1
`;

const UPDATE_OUTBOUND_CHILDREN_STATUS_BY_PARENT = `
  UPDATE menu_items
  SET estado = ?
  WHERE id_padre = ?
    AND id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
`;

export class MenuDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async getOutboundMenuTreeRows(executor = this.pool) {
        const [rows] = await executor.query(GET_OUTBOUND_MENU_TREE);
        return rows;
    }

    async getOutboundParentCampaigns(executor = this.pool) {
        const [rows] = await executor.query(GET_OUTBOUND_PARENT_CAMPAIGNS);
        return rows;
    }

    async findActiveCampaignByName(name, executor = this.pool) {
        const [rows] = await executor.query(CHECK_OUTBOUND_CAMPAIGN_EXISTS, [
            name,
        ]);
        return rows[0] || null;
    }

    async insertOutboundCampaign(name, executor = this.pool) {
        return executor.query(INSERT_OUTBOUND_CAMPAIGN, [name]);
    }

    async findActiveSubcampaign(parentId, name, executor = this.pool) {
        const [rows] = await executor.query(CHECK_OUTBOUND_SUBCAMPAIGN_EXISTS, [
            parentId,
            name,
        ]);
        return rows[0] || null;
    }

    async insertOutboundSubcampaign(name, parentId, executor = this.pool) {
        return executor.query(INSERT_OUTBOUND_SUBCAMPAIGN, [name, parentId]);
    }

    async getOutboundMenuTreeWithStatusRows(executor = this.pool) {
        const [rows] = await executor.query(GET_OUTBOUND_MENU_TREE_WITH_STATUS);
        return rows;
    }

    async getOutboundMenuItemById(id, executor = this.pool) {
        const [rows] = await executor.query(GET_OUTBOUND_MENU_ITEM_BY_ID, [id]);
        return rows[0] || null;
    }

    async updateOutboundMenuItemStatus(id, state, executor = this.pool) {
        return executor.query(UPDATE_OUTBOUND_MENU_ITEM_STATUS, [state, id]);
    }

    async updateOutboundChildrenStatus(parentId, state, executor = this.pool) {
        return executor.query(UPDATE_OUTBOUND_CHILDREN_STATUS_BY_PARENT, [
            state,
            parentId,
        ]);
    }
}

export default MenuDAO;
