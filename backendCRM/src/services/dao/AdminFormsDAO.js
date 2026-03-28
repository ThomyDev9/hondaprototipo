import pool from "../db.js";

export class AdminFormsDAO {
    constructor(dbPool = pool, outboundCategoryId) {
        this.pool = dbPool;
        this.outboundCategoryId = outboundCategoryId;
    }

    async getSubcampaignRows(formType, scope, executor = this.pool) {
        let assignmentFilter = "";
        if (scope === "without-template") {
            assignmentFilter = "AND a.id IS NULL";
        }
        if (scope === "with-template") {
            assignmentFilter = "AND a.id IS NOT NULL";
        }

        const requiresF2 = formType === "F3";
        const f2Join = requiresF2
            ? `
                INNER JOIN form_template_assignments a_f2
                    ON a_f2.menu_item_id = s.id
                   AND a_f2.form_type = 'F2'
                   AND a_f2.is_active = 1
              `
            : "";

        const categoriaFilter =
            formType === "F4" ? `AND p.nombre_item = 'Gestión Outbound'` : "";

        const [rows] = await executor.query(
            `
            SELECT
                s.id,
                s.nombre_item AS subcampania,
                p.nombre_item AS campania
            FROM menu_items s
            INNER JOIN menu_items p ON p.id = s.id_padre
            ${f2Join}
            LEFT JOIN form_template_assignments a
                ON a.menu_item_id = s.id
               AND a.form_type = ?
               AND a.is_active = 1
            WHERE s.id_padre IS NOT NULL
              AND s.estado = 'activo'
              AND p.estado = 'activo'
              ${assignmentFilter}
              ${categoriaFilter}
            ORDER BY p.nombre_item ASC, s.nombre_item ASC
            `,
            [formType],
        );

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

    async getActiveSubcampaignName(menuItemId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT nombre_item
            FROM menu_items
            WHERE id = ?
              AND id_categoria = ?
              AND id_padre IS NOT NULL
              AND estado = 'activo'
            LIMIT 1
            `,
            [menuItemId, this.outboundCategoryId],
        );
        return rows[0] || null;
    }

    async hasActiveF2Assignment(menuItemId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT id
            FROM form_template_assignments
            WHERE menu_item_id = ?
              AND form_type = 'F2'
              AND is_active = 1
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
            VALUES (?, ?, 'published', ?, 'Creada desde configuración admin', ?, NOW(), NOW())
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
