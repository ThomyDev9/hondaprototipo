CREATE OR REPLACE VIEW vw_active_form_template_by_campaign AS
SELECT
    m.id AS menu_item_id,
    m.id_categoria AS category_id,
    m.nombre_item AS campaign_id,
    a.form_type,
    t.id AS template_id,
    t.name AS template_name,
    t.form_type AS template_form_type,
    t.version,
    t.status,
    a.assigned_at,
    a.assigned_by
FROM menu_items m
INNER JOIN form_template_assignments a
    ON a.menu_item_id = m.id
   AND a.is_active = 1
INNER JOIN form_templates t
    ON t.id = a.template_id
   AND t.status = 'published'
WHERE m.estado = 'activo';
