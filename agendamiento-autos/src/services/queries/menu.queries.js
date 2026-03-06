export const GET_OUTBOUND_MENU_TREE = `
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

export const GET_OUTBOUND_PARENT_CAMPAIGNS = `
  SELECT
    id,
    nombre_item AS nombre
  FROM menu_items
  WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND id_padre IS NULL
    AND estado = 'activo'
  ORDER BY nombre_item
`;

export const CHECK_OUTBOUND_CAMPAIGN_EXISTS = `
  SELECT id
  FROM menu_items
  WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND id_padre IS NULL
    AND estado = 'activo'
    AND nombre_item = ?
  LIMIT 1
`;

export const INSERT_OUTBOUND_CAMPAIGN = `
  INSERT INTO menu_items (id, nombre_item, id_categoria, id_padre, estado)
  VALUES (UUID(), ?, '544fb0a6-1345-11f1-b790-000c2904c92f', NULL, 'activo')
`;

export const CHECK_OUTBOUND_SUBCAMPAIGN_EXISTS = `
  SELECT id
  FROM menu_items
  WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND id_padre = ?
    AND estado = 'activo'
    AND nombre_item = ?
  LIMIT 1
`;

export const INSERT_OUTBOUND_SUBCAMPAIGN = `
  INSERT INTO menu_items (id, nombre_item, id_categoria, id_padre, estado)
  VALUES (UUID(), ?, '544fb0a6-1345-11f1-b790-000c2904c92f', ?, 'activo')
`;

export const GET_OUTBOUND_MENU_TREE_WITH_STATUS = `
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

export const UPDATE_OUTBOUND_MENU_ITEM_STATUS = `
  UPDATE menu_items
  SET estado = ?
  WHERE id = ?
    AND id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
`;

export const GET_OUTBOUND_MENU_ITEM_BY_ID = `
  SELECT id, id_padre
  FROM menu_items
  WHERE id = ?
    AND id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
  LIMIT 1
`;

export const UPDATE_OUTBOUND_CHILDREN_STATUS_BY_PARENT = `
  UPDATE menu_items
  SET estado = ?
  WHERE id_padre = ?
    AND id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
`;
