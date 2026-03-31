import pool from "../db.js";

export class AdminFormsDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async getSubcampaignRows(
        formType,
        scope,
        categoryId,
        executor = this.pool,
    ) {
        let assignmentFilter = "";
        if (scope === "without-template") {
            assignmentFilter = "AND a.id IS NULL";
        }
        if (scope === "with-template") {
            assignmentFilter = "AND a.id IS NOT NULL";
        }

        let rows = [];

        if (formType === "F2") {
            [rows] = await executor.query(
                `
                SELECT
                    mi.id,
                    CASE
                        WHEN mi.id_padre IS NULL THEN ''
                        ELSE mi.nombre_item
                    END AS subcampania,
                    CASE
                        WHEN mi.id_padre IS NULL THEN mi.nombre_item
                        ELSE p.nombre_item
                    END AS campania,
                    CASE
                        WHEN mi.id_padre IS NULL THEN 1
                        ELSE 0
                    END AS is_parent
                FROM menu_items mi
                LEFT JOIN menu_items p ON p.id = mi.id_padre
                LEFT JOIN menu_categorias mc ON mc.id = mi.id_categoria
                LEFT JOIN form_template_assignments a
                    ON a.menu_item_id = mi.id
                   AND a.form_type = 'F2'
                   AND a.is_active = 1
                WHERE mi.id_categoria = ?
                  AND mi.estado = 'activo'
                  AND (
                        mi.id_padre IS NOT NULL
                        OR (
                            mi.id_padre IS NULL
                            AND LOWER(COALESCE(mc.nombre_categoria, '')) LIKE '%inbound%'
                        )
                  )
                  AND (mi.id_padre IS NULL OR p.estado = 'activo')
                  ${assignmentFilter}
                ORDER BY campania ASC, is_parent DESC, subcampania ASC
                `,
                [categoryId],
            );
        } else if (formType === "F3") {
            [rows] = await executor.query(
                `
                SELECT
                    s.id,
                    s.nombre_item AS subcampania,
                    p.nombre_item AS campania,
                    0 AS is_parent
                FROM menu_items s
                INNER JOIN menu_items p ON p.id = s.id_padre
                LEFT JOIN menu_categorias mc ON mc.id = s.id_categoria
                LEFT JOIN form_template_assignments a
                    ON a.menu_item_id = s.id
                   AND a.form_type = 'F3'
                   AND a.is_active = 1
                WHERE s.id_padre IS NOT NULL
                  AND s.id_categoria = ?
                  AND p.id_categoria = ?
                  AND s.estado = 'activo'
                  AND p.estado = 'activo'
                  AND (
                        EXISTS (
                            SELECT 1
                            FROM form_template_assignments a_f2_self
                            WHERE a_f2_self.menu_item_id = s.id
                              AND a_f2_self.form_type = 'F2'
                              AND a_f2_self.is_active = 1
                        )
                        OR (
                            LOWER(COALESCE(mc.nombre_categoria, '')) LIKE '%inbound%'
                            AND EXISTS (
                                SELECT 1
                                FROM form_template_assignments a_f2_parent
                                WHERE a_f2_parent.menu_item_id = p.id
                                  AND a_f2_parent.form_type = 'F2'
                                  AND a_f2_parent.is_active = 1
                            )
                        )
                  )
                  ${assignmentFilter}
                ORDER BY p.nombre_item ASC, s.nombre_item ASC
                `,
                [categoryId, categoryId],
            );
        } else {
            [rows] = await executor.query(
                `
                SELECT
                    s.id,
                    s.nombre_item AS subcampania,
                    p.nombre_item AS campania,
                    0 AS is_parent
                FROM menu_items s
                INNER JOIN menu_items p ON p.id = s.id_padre
                LEFT JOIN form_template_assignments a
                    ON a.menu_item_id = s.id
                   AND a.form_type = ?
                   AND a.is_active = 1
                WHERE s.id_padre IS NOT NULL
                  AND s.id_categoria = ?
                  AND p.id_categoria = ?
                  AND s.estado = 'activo'
                  AND p.estado = 'activo'
                  AND p.nombre_item = 'GestiÃ³n Outbound'
                  ${assignmentFilter}
                ORDER BY p.nombre_item ASC, s.nombre_item ASC
                `,
                [formType, categoryId, categoryId],
            );
        }

        return rows;
    }

    async getAssignedTemplate(menuItemId, formType, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT
                t.id,
                t.name,
                t.form_type,
                t.version,
                t.status,
                a.assigned_at
            FROM form_template_assignments a
            INNER JOIN form_templates t ON t.id = a.template_id
            WHERE a.menu_item_id = ?
              AND a.form_type = ?
              AND a.is_active = 1
            ORDER BY a.assigned_at DESC, t.version DESC
            LIMIT 1
            `,
            [menuItemId, formType],
        );

        return rows[0] || null;
    }

    async getTemplateFieldRows(templateId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT
                f.id AS field_id,
                f.field_key,
                f.label,
                f.field_type,
                f.is_required,
                f.display_order,
                f.placeholder,
                f.max_length,
                o.option_value,
                o.option_label,
                o.display_order AS option_order
            FROM form_template_fields f
            LEFT JOIN form_template_field_options o
              ON o.field_id = f.id
             AND o.is_active = 1
            WHERE f.template_id = ?
              AND f.is_active = 1
            ORDER BY f.display_order ASC, o.display_order ASC
            `,
            [templateId],
        );
        return rows;
    }

    async getActiveFormTargetName(
        menuItemId,
        categoryId,
        formType,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            `
            SELECT
                mi.nombre_item,
                mi.id_padre
            FROM menu_items mi
            LEFT JOIN menu_categorias mc ON mc.id = mi.id_categoria
            WHERE mi.id = ?
              AND mi.id_categoria = ?
              AND mi.estado = 'activo'
              AND (
                    mi.id_padre IS NOT NULL
                    OR (
                        ? = 'F2'
                        AND mi.id_padre IS NULL
                        AND LOWER(COALESCE(mc.nombre_categoria, '')) LIKE '%inbound%'
                    )
              )
            LIMIT 1
            `,
            [menuItemId, categoryId, formType],
        );
        return rows[0] || null;
    }

    async hasActiveF2Assignment(menuItemId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT 1
            FROM menu_items mi
            LEFT JOIN menu_items p ON p.id = mi.id_padre
            LEFT JOIN menu_categorias mc ON mc.id = mi.id_categoria
            WHERE mi.id = ?
              AND (
                    EXISTS (
                        SELECT 1
                        FROM form_template_assignments a_self
                        WHERE a_self.menu_item_id = mi.id
                          AND a_self.form_type = 'F2'
                          AND a_self.is_active = 1
                    )
                    OR (
                        mi.id_padre IS NOT NULL
                        AND LOWER(COALESCE(mc.nombre_categoria, '')) LIKE '%inbound%'
                        AND EXISTS (
                            SELECT 1
                            FROM form_template_assignments a_parent
                            WHERE a_parent.menu_item_id = p.id
                              AND a_parent.form_type = 'F2'
                              AND a_parent.is_active = 1
                        )
                    )
              )
            LIMIT 1
            `,
            [menuItemId],
        );
        return rows.length > 0;
    }

    async getActiveAssignment(menuItemId, formType, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT template_id
            FROM form_template_assignments
            WHERE menu_item_id = ?
              AND form_type = ?
              AND is_active = 1
            LIMIT 1
            `,
            [menuItemId, formType],
        );
        return rows[0] || null;
    }

    async getTemplateVersion(templateId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT version
            FROM form_templates
            WHERE id = ?
            LIMIT 1
            `,
            [templateId],
        );
        return Number(rows[0]?.version || 1);
    }

    async updateTemplatePublishedName(
        templateId,
        templateName,
        executor = this.pool,
    ) {
        return executor.query(
            `
            UPDATE form_templates
            SET name = ?,
                status = 'published',
                updated_at = NOW()
            WHERE id = ?
            `,
            [templateName, templateId],
        );
    }

    async deactivateTemplateOptions(templateId, executor = this.pool) {
        return executor.query(
            `
            UPDATE form_template_field_options o
            INNER JOIN form_template_fields f ON f.id = o.field_id
            SET o.is_active = 0
            WHERE f.template_id = ?
              AND o.is_active = 1
            `,
            [templateId],
        );
    }

    async deactivateTemplateFields(templateId, executor = this.pool) {
        return executor.query(
            `
            UPDATE form_template_fields
            SET is_active = 0,
                updated_at = NOW()
            WHERE template_id = ?
              AND is_active = 1
            `,
            [templateId],
        );
    }

    async upsertTemplateField(templateId, field, executor = this.pool) {
        const [result] = await executor.query(
            `
            INSERT INTO form_template_fields (
                template_id,
                field_key,
                label,
                field_type,
                is_required,
                display_order,
                max_length,
                is_active,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id),
                label = VALUES(label),
                field_type = VALUES(field_type),
                is_required = VALUES(is_required),
                display_order = VALUES(display_order),
                max_length = VALUES(max_length),
                is_active = 1,
                updated_at = NOW()
            `,
            [
                templateId,
                field.key,
                field.label,
                field.type,
                field.required ? 1 : 0,
                field.displayOrder,
                field.maxLength,
            ],
        );

        return Number(result.insertId);
    }

    async deactivateFieldOptions(fieldId, executor = this.pool) {
        return executor.query(
            `
            UPDATE form_template_field_options
            SET is_active = 0
            WHERE field_id = ?
            `,
            [fieldId],
        );
    }

    async upsertFieldOption(fieldId, option, displayOrder, executor = this.pool) {
        return executor.query(
            `
            INSERT INTO form_template_field_options (
                field_id,
                option_value,
                option_label,
                display_order,
                is_active
            )
            VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                option_label = VALUES(option_label),
                display_order = VALUES(display_order),
                is_active = 1
            `,
            [fieldId, option, option, displayOrder],
        );
    }

    async getNextTemplateVersion(templateName, formType, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT COALESCE(MAX(version), 0) AS maxVersion
            FROM form_templates
            WHERE name = ?
              AND form_type = ?
            `,
            [templateName, formType],
        );
        return Number(rows[0]?.maxVersion || 0) + 1;
    }

    async insertTemplate(
        templateName,
        formType,
        version,
        assignedBy,
        executor = this.pool,
    ) {
        const [result] = await executor.query(
            `
            INSERT INTO form_templates (
                name,
                form_type,
                status,
                version,
                description,
                created_by,
                created_at,
                updated_at
            )
            VALUES (?, ?, 'published', ?, 'Creada desde configuraciÃ³n admin', ?, NOW(), NOW())
            `,
            [templateName, formType, version, assignedBy],
        );

        return Number(result.insertId);
    }

    async upsertTemplateAssignment(
        menuItemId,
        formType,
        templateId,
        assignedBy,
        executor = this.pool,
    ) {
        return executor.query(
            `
            INSERT INTO form_template_assignments (
                menu_item_id,
                form_type,
                template_id,
                is_active,
                assigned_by,
                assigned_at
            )
            VALUES (?, ?, ?, 1, ?, NOW())
            ON DUPLICATE KEY UPDATE
                template_id = VALUES(template_id),
                assigned_by = VALUES(assigned_by),
                assigned_at = NOW(),
                is_active = 1
            `,
            [menuItemId, formType, templateId, assignedBy],
        );
    }

    async refreshActiveAssignment(
        menuItemId,
        formType,
        templateId,
        assignedBy,
        executor = this.pool,
    ) {
        return executor.query(
            `
            UPDATE form_template_assignments
            SET template_id = ?,
                assigned_by = ?,
                assigned_at = NOW(),
                is_active = 1
            WHERE menu_item_id = ?
              AND form_type = ?
              AND is_active = 1
            `,
            [templateId, assignedBy, menuItemId, formType],
        );
    }
}

export default AdminFormsDAO;