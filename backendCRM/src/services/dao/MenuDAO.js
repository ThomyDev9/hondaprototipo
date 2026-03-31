import pool from "../db.js";

const GET_MENU_CATEGORIES = `
  SELECT
    id,
    nombre_categoria AS nombre
  FROM menu_categorias
  ORDER BY nombre_categoria ASC
`;

const GET_MENU_TREE = `
  SELECT
    p.id AS campania_id,
    p.nombre_item AS campania,
    s.id AS subcampania_id,
    s.nombre_item AS subcampania
  FROM menu_items p
  LEFT JOIN menu_items s ON s.id_padre = p.id
    AND s.id_categoria = ?
    AND s.estado = 'activo'
  WHERE p.id_categoria = ?
    AND p.id_padre IS NULL
    AND p.estado = 'activo'
  ORDER BY p.nombre_item, s.nombre_item
`;

const GET_PARENT_CAMPAIGNS = `
  SELECT
    id,
    nombre_item AS nombre
  FROM menu_items
  WHERE id_categoria = ?
    AND id_padre IS NULL
    AND estado = 'activo'
  ORDER BY nombre_item
`;

const CHECK_CAMPAIGN_EXISTS = `
  SELECT id
  FROM menu_items
  WHERE id_categoria = ?
    AND id_padre IS NULL
    AND estado = 'activo'
    AND nombre_item = ?
  LIMIT 1
`;

const INSERT_CAMPAIGN = `
  INSERT INTO menu_items (id, nombre_item, id_categoria, id_padre, estado)
  VALUES (UUID(), ?, ?, NULL, 'activo')
`;

const GET_MENU_ITEM_BY_ID = `
  SELECT id, id_padre, id_categoria
  FROM menu_items
  WHERE id = ?
  LIMIT 1
`;

const CHECK_SUBCAMPAIGN_EXISTS = `
  SELECT id
  FROM menu_items
  WHERE id_categoria = ?
    AND id_padre = ?
    AND estado = 'activo'
    AND nombre_item = ?
  LIMIT 1
`;

const INSERT_SUBCAMPAIGN = `
  INSERT INTO menu_items (id, nombre_item, id_categoria, id_padre, estado)
  VALUES (UUID(), ?, ?, ?, 'activo')
`;

const GET_MENU_TREE_WITH_STATUS = `
  SELECT
    p.id AS campania_id,
    p.nombre_item AS campania,
    p.estado AS campania_estado,
    s.id AS subcampania_id,
    s.nombre_item AS subcampania,
    s.estado AS subcampania_estado
  FROM menu_items p
  LEFT JOIN menu_items s ON s.id_padre = p.id
    AND s.id_categoria = ?
  WHERE p.id_categoria = ?
    AND p.id_padre IS NULL
  ORDER BY p.nombre_item, s.nombre_item
`;

const UPDATE_MENU_ITEM_STATUS = `
  UPDATE menu_items
  SET estado = ?
  WHERE id = ?
    AND id_categoria = ?
`;

const GET_MENU_ITEM_BY_ID_AND_CATEGORY = `
  SELECT id, id_padre, id_categoria
  FROM menu_items
  WHERE id = ?
    AND id_categoria = ?
  LIMIT 1
`;

const UPDATE_CHILDREN_STATUS_BY_PARENT = `
  UPDATE menu_items
  SET estado = ?
  WHERE id_padre = ?
    AND id_categoria = ?
`;

export class MenuDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async getMenuCategories(executor = this.pool) {
        const [rows] = await executor.query(GET_MENU_CATEGORIES);
        return rows;
    }

    async getMenuTreeRowsByCategory(categoryId, executor = this.pool) {
        const [rows] = await executor.query(GET_MENU_TREE, [
            categoryId,
            categoryId,
        ]);
        return rows;
    }

    async getParentCampaignsByCategory(categoryId, executor = this.pool) {
        const [rows] = await executor.query(GET_PARENT_CAMPAIGNS, [categoryId]);
        return rows;
    }

    async findActiveCampaignByName(categoryId, name, executor = this.pool) {
        const [rows] = await executor.query(CHECK_CAMPAIGN_EXISTS, [
            categoryId,
            name,
        ]);
        return rows[0] || null;
    }

    async insertCampaign(categoryId, name, executor = this.pool) {
        return executor.query(INSERT_CAMPAIGN, [name, categoryId]);
    }

    async getMenuItemById(id, executor = this.pool) {
        const [rows] = await executor.query(GET_MENU_ITEM_BY_ID, [id]);
        return rows[0] || null;
    }

    async findActiveSubcampaign(
        categoryId,
        parentId,
        name,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(CHECK_SUBCAMPAIGN_EXISTS, [
            categoryId,
            parentId,
            name,
        ]);
        return rows[0] || null;
    }

    async insertSubcampaign(categoryId, name, parentId, executor = this.pool) {
        return executor.query(INSERT_SUBCAMPAIGN, [name, categoryId, parentId]);
    }

    async getMenuTreeWithStatusRowsByCategory(categoryId, executor = this.pool) {
        const [rows] = await executor.query(GET_MENU_TREE_WITH_STATUS, [
            categoryId,
            categoryId,
        ]);
        return rows;
    }

    async getMenuItemByIdAndCategory(id, categoryId, executor = this.pool) {
        const [rows] = await executor.query(GET_MENU_ITEM_BY_ID_AND_CATEGORY, [
            id,
            categoryId,
        ]);
        return rows[0] || null;
    }

    async updateMenuItemStatus(id, categoryId, state, executor = this.pool) {
        return executor.query(UPDATE_MENU_ITEM_STATUS, [state, id, categoryId]);
    }

    async updateChildrenStatus(parentId, categoryId, state, executor = this.pool) {
        return executor.query(UPDATE_CHILDREN_STATUS_BY_PARENT, [
            state,
            parentId,
            categoryId,
        ]);
    }
}

export default MenuDAO;
