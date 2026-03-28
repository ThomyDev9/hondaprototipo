CREATE OR REPLACE VIEW vw_subcampaign_scripts AS
SELECT
    mi.id AS menu_item_id,
    mi.nombre_item AS campaign_id,
    p.id AS parent_menu_item_id,
    p.nombre_item AS parent_campaign_name,
    scs.script_json,
    scs.updated_by,
    scs.updated_at
FROM menu_items mi
LEFT JOIN menu_items p
    ON p.id = mi.id_padre
LEFT JOIN sub_campaign_scripts scs
    ON scs.menu_item_id = mi.id
WHERE mi.estado = 'activo';
