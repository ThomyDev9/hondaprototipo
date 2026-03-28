CREATE OR REPLACE VIEW vw_campaign_types AS
SELECT
    mi.id AS menu_item_id,
    mi.nombre_item AS campaign_id,
    tc.id AS tipo_id,
    tc.nombre AS tipo_nombre,
    tc.estado AS tipo_estado
FROM menu_item_campania_tipo mct
INNER JOIN menu_items mi
    ON mi.id = mct.menu_item_id
INNER JOIN tipos_campania tc
    ON tc.id = mct.tipo_id;
