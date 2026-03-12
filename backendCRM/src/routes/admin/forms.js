import express from "express";
import pool from "../../services/db.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const OUTBOUND_CATEGORY_ID = "544fb0a6-1345-11f1-b790-000c2904c92f";
const MAX_TEMPLATE_FIELDS = 30;

const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
];

function normalizeFieldType(type, formType = "F2") {
    let normalized = String(type || "text")
        .trim()
        .toLowerCase();

    if (normalized === "combo") {
        normalized = "select";
    }

    const isF2 =
        String(formType || "")
            .trim()
            .toUpperCase() === "F2";
    const isF3 =
        String(formType || "")
            .trim()
            .toUpperCase() === "F3";
    if (isF2) {
        return "text";
    }
    const allowed = isF3
        ? new Set(["text", "select"])
        : new Set(["text", "number", "select", "date", "textarea", "checkbox"]);
    return allowed.has(normalized) ? normalized : "text";
}

function buildFieldKey(label, index) {
    const normalized = String(label || "")
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "_")
        .replace(/^_+/, "")
        .replace(/_+$/, "");

    if (!normalized) {
        return `pregunta_${index + 1}`;
    }

    return normalized.slice(0, 64);
}

function buildUniqueFieldKey(label, index, usedKeys) {
    const baseKey = buildFieldKey(label, index);
    let candidate = baseKey;
    let suffix = 2;

    while (usedKeys.has(candidate)) {
        candidate = `${baseKey}_${suffix}`.slice(0, 64);
        suffix += 1;
    }

    usedKeys.add(candidate);
    return candidate;
}

function normalizeIncomingFields(rawFields, formType = "F2") {
    const isF2 =
        String(formType || "")
            .trim()
            .toUpperCase() === "F2";
    const isF3 =
        String(formType || "")
            .trim()
            .toUpperCase() === "F3";
    const usedAutoKeys = new Set();

    return rawFields
        .map((field, index) => {
            const label = String(field?.label || "").trim();
            const normalizedType = normalizeFieldType(field?.type, formType);
            const key = isF3
                ? buildUniqueFieldKey(label, index, usedAutoKeys)
                : String(field?.key || "").trim();
            const required = isF3 ? false : Boolean(field?.required);
            const maxLength =
                !isF2 &&
                !isF3 &&
                field?.maxLength !== undefined &&
                field?.maxLength !== null
                    ? Number(field.maxLength)
                    : null;
            const options = Array.isArray(field?.options)
                ? field.options
                      .map((option) => String(option || "").trim())
                      .filter(Boolean)
                : [];
            const type =
                isF3 && normalizedType === "text" && options.length > 0
                    ? "select"
                    : normalizedType;

            return {
                key,
                label,
                type,
                required,
                maxLength: Number.isFinite(maxLength) ? maxLength : null,
                displayOrder: index + 1,
                options,
            };
        })
        .filter((field) => field.key && field.label);
}

function findDuplicatedKey(fields) {
    const keys = fields.map((field) => field.key.toLowerCase());
    return keys.find((key, index) => keys.indexOf(key) !== index) || "";
}

async function insertTemplateFields(connection, templateId, fields) {
    for (const field of fields) {
        const [fieldInsert] = await connection.query(
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

        const fieldId = Number(fieldInsert.insertId);

        await connection.query(
            `
            UPDATE form_template_field_options
            SET is_active = 0
            WHERE field_id = ?
            `,
            [fieldId],
        );

        if (field.type === "select" && field.options.length > 0) {
            for (let index = 0; index < field.options.length; index += 1) {
                const option = field.options[index];
                await connection.query(
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
                    [fieldId, option, option, index + 1],
                );
            }
        }
    }
}

function mapTemplateFields(rows) {
    const fieldsById = new Map();

    for (const row of rows) {
        if (!fieldsById.has(row.field_id)) {
            fieldsById.set(row.field_id, {
                id: row.field_id,
                key: row.field_key,
                label: row.label,
                type: row.field_type,
                required: Number(row.is_required || 0) === 1,
                displayOrder: Number(row.display_order || 0),
                placeholder: row.placeholder || "",
                maxLength: row.max_length || null,
                options: [],
            });
        }

        if (row.option_value !== null && row.option_value !== undefined) {
            const field = fieldsById.get(row.field_id);
            field.options.push({
                value: String(row.option_value || "").trim(),
                label: String(
                    row.option_label || row.option_value || "",
                ).trim(),
            });
        }
    }

    return Array.from(fieldsById.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder,
    );
}

router.get("/subcampaigns", ...middlewaresAdmin, async (req, res) => {
    try {
        const formType = String(req.query?.formType || "")
            .trim()
            .toUpperCase();
        const scope = String(req.query?.scope || "without-template")
            .trim()
            .toLowerCase();
        if (!["F2", "F3"].includes(formType)) {
            return res
                .status(400)
                .json({ error: "formType (F2/F3) es requerido" });
        }

        if (!["without-template", "with-template", "all"].includes(scope)) {
            return res.status(400).json({
                error: "scope inválido. Usa without-template, with-template o all",
            });
        }

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

        const [rows] = await pool.query(
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
                        WHERE s.id_categoria = ?
                            AND p.id_categoria = ?
                            AND s.id_padre IS NOT NULL
                            AND s.estado = 'activo'
                            AND p.estado = 'activo'
                            ${assignmentFilter}
                        ORDER BY p.nombre_item ASC, s.nombre_item ASC
                        `,
            [formType, OUTBOUND_CATEGORY_ID, OUTBOUND_CATEGORY_ID],
        );

        const data = rows.map((row) => ({
            id: row.id,
            label: `${row.campania} > ${row.subcampania}`,
            campania: row.campania,
            subcampania: row.subcampania,
        }));

        return res.json({ data });
    } catch (error) {
        console.error("Error GET /admin/forms/subcampaigns:", error);
        return res.status(500).json({ error: "Error cargando subcampañas" });
    }
});

router.get("/template", ...middlewaresAdmin, async (req, res) => {
    try {
        const menuItemId = String(req.query?.menuItemId || "").trim();
        const formType = String(req.query?.formType || "")
            .trim()
            .toUpperCase();

        if (!menuItemId || !["F2", "F3"].includes(formType)) {
            return res.status(400).json({
                error: "menuItemId y formType (F2/F3) son requeridos",
            });
        }

        const [templateRows] = await pool.query(
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

        if (templateRows.length === 0) {
            return res.json({ data: null });
        }

        const template = templateRows[0];
        const [fieldRows] = await pool.query(
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
            [template.id],
        );

        return res.json({
            data: {
                id: template.id,
                name: template.name,
                formType: template.form_type,
                version: template.version,
                status: template.status,
                assignedAt: template.assigned_at,
                fields: mapTemplateFields(fieldRows),
            },
        });
    } catch (error) {
        console.error("Error GET /admin/forms/template:", error);
        return res.status(500).json({ error: "Error cargando plantilla" });
    }
});

router.post("/template", ...middlewaresAdmin, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const menuItemId = String(req.body?.menuItemId || "").trim();
        const formType = String(req.body?.formType || "")
            .trim()
            .toUpperCase();
        const rawFields = Array.isArray(req.body?.fields)
            ? req.body.fields
            : [];
        const assignedBy =
            req.user?.username ||
            req.user?.email ||
            String(req.user?.id || "admin");

        if (!menuItemId || !["F2", "F3"].includes(formType)) {
            return res.status(400).json({
                error: "menuItemId y formType (F2/F3) son requeridos",
            });
        }

        if (!rawFields.length) {
            return res
                .status(400)
                .json({ error: "Debes enviar al menos un campo" });
        }

        if (rawFields.length > MAX_TEMPLATE_FIELDS) {
            return res.status(400).json({
                error: `El máximo de preguntas por cuestionario es ${MAX_TEMPLATE_FIELDS}`,
            });
        }

        const [subcampaignRows] = await connection.query(
            `
            SELECT nombre_item
            FROM menu_items
            WHERE id = ?
              AND id_categoria = ?
              AND id_padre IS NOT NULL
              AND estado = 'activo'
            LIMIT 1
            `,
            [menuItemId, OUTBOUND_CATEGORY_ID],
        );

        if (subcampaignRows.length === 0) {
            return res.status(400).json({
                error: "La subcampaña seleccionada no es válida o no está activa",
            });
        }

        const templateName = String(
            subcampaignRows[0]?.nombre_item || "",
        ).trim();
        if (!templateName) {
            return res.status(400).json({
                error: "No se pudo resolver el nombre de la subcampaña",
            });
        }

        const normalizedFields = normalizeIncomingFields(rawFields, formType);

        if (!normalizedFields.length) {
            return res
                .status(400)
                .json({ error: "Los campos deben tener key y label" });
        }

        if (normalizedFields.length > MAX_TEMPLATE_FIELDS) {
            return res.status(400).json({
                error: `El máximo de preguntas por cuestionario es ${MAX_TEMPLATE_FIELDS}`,
            });
        }

        const invalidF3Options =
            formType === "F3"
                ? normalizedFields.find(
                      (field) =>
                          field.type === "select" && field.options.length === 0,
                  )
                : null;

        if (invalidF3Options) {
            return res.status(400).json({
                error: "En F3, los campos tipo Combo deben tener opciones",
            });
        }

        const duplicated = findDuplicatedKey(normalizedFields);
        if (duplicated) {
            return res.status(400).json({
                error: `Campo duplicado: ${duplicated}`,
            });
        }

        if (formType === "F3") {
            const [f2AssignmentRows] = await connection.query(
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

            if (f2AssignmentRows.length === 0) {
                return res.status(400).json({
                    error: "No se puede crear Formulario 3 sin tener Formulario 2 activo en la subcampaña",
                });
            }
        }

        await connection.beginTransaction();

        const [activeAssignmentRows] = await connection.query(
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

        let templateId = null;
        let resolvedVersion = 1;

        if (activeAssignmentRows.length > 0) {
            templateId = Number(activeAssignmentRows[0].template_id || 0);

            const [templateRows] = await connection.query(
                `
                SELECT version
                FROM form_templates
                WHERE id = ?
                LIMIT 1
                `,
                [templateId],
            );

            resolvedVersion = Number(templateRows[0]?.version || 1);

            await connection.query(
                `
                UPDATE form_templates
                SET name = ?,
                    status = 'published',
                    updated_at = NOW()
                WHERE id = ?
                `,
                [templateName, templateId],
            );

            await connection.query(
                `
                UPDATE form_template_field_options o
                INNER JOIN form_template_fields f ON f.id = o.field_id
                SET o.is_active = 0
                WHERE f.template_id = ?
                  AND o.is_active = 1
                `,
                [templateId],
            );

            await connection.query(
                `
                UPDATE form_template_fields
                SET is_active = 0,
                    updated_at = NOW()
                WHERE template_id = ?
                  AND is_active = 1
                `,
                [templateId],
            );

            await insertTemplateFields(
                connection,
                templateId,
                normalizedFields,
            );

            await connection.query(
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
        } else {
            const [versionRows] = await connection.query(
                `
                SELECT COALESCE(MAX(version), 0) AS maxVersion
                FROM form_templates
                WHERE name = ?
                  AND form_type = ?
                `,
                [templateName, formType],
            );
            resolvedVersion = Number(versionRows[0]?.maxVersion || 0) + 1;

            const [templateInsert] = await connection.query(
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
                [templateName, formType, resolvedVersion, assignedBy],
            );

            templateId = templateInsert.insertId;

            await insertTemplateFields(
                connection,
                templateId,
                normalizedFields,
            );

            await connection.query(
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

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Plantilla guardada y asignada correctamente",
            data: {
                templateId,
                formType,
                version: resolvedVersion,
                assignedMenuItemId: menuItemId,
            },
        });
    } catch (error) {
        await connection.rollback();
        console.error("Error POST /admin/forms/template:", error);
        return res.status(500).json({
            error: "Error guardando plantilla dinámica",
            detail: error?.sqlMessage || error?.message || "",
        });
    } finally {
        connection.release();
    }
});

export default router;
