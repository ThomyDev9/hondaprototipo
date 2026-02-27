export const GET_OUTBOUND_MENU_TREE = `
  SELECT
    p.id AS campania_id,
    p.nombre_item AS campania,
    s.id AS subcampania_id,
    s.nombre_item AS subcampania
  FROM menu_items p
  LEFT JOIN menu_items s ON s.id_padre = p.id AND s.estado = 'activo'
  WHERE p.id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
    AND p.id_padre IS NULL
    AND p.estado = 'activo'
  ORDER BY p.nombre_item, s.nombre_item
`;

export const GET_OUTBOUND_MENU_CATEGORY_NAME = `
  SELECT nombre_categoria FROM menu_categorias WHERE id_categoria = '544fb0a6-1345-11f1-b790-000c2904c92f'
`;
