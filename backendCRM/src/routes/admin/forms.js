import express from "express";
import pool from "../../services/db.js";
import AdminFormsDAO from "../../services/dao/AdminFormsDAO.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const OUTBOUND_CATEGORY_ID = "544fb0a6-1345-11f1-b790-000c2904c92f";
const MAX_TEMPLATE_FIELDS = 30;
const adminFormsDAO = new AdminFormsDAO(pool, OUTBOUND_CATEGORY_ID);

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
        ? new Set(["text", "number", "select", "date", "textarea", "checkbox"])
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
        const fieldId = await adminFormsDAO.upsertTemplateField(
            templateId,
            field,
            connection,
        );
        await adminFormsDAO.deactivateFieldOptions(fieldId, connection);

        if (field.type === "select" && field.options.length > 0) {
            for (let index = 0; index < field.options.length; index += 1) {
                const option = field.options[index];
                await adminFormsDAO.upsertFieldOption(
                    fieldId,
                    option,
                    index + 1,
                    connection,
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
        if (!["F2", "F3", "F4"].includes(formType)) {
            return res
                .status(400)
                .json({ error: "formType (F2/F3/F4) es requerido" });
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

        // Solo permitir subcampañas bajo campaña padre 'Gestión Outbound' para F4
        let categoriaFilter = "";
        if (formType === "F4") {
            categoriaFilter = `AND p.nombre_item = 'Gestión Outbound'`;
        } else {
            categoriaFilter = ""; // Sin filtro extra para F2/F3
        }

        const rows = await adminFormsDAO.getSubcampaignRows(formType, scope);

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

        const template = await adminFormsDAO.getAssignedTemplate(
            menuItemId,
            formType,
        );
        if (!template) {
            return res.json({ data: null });
        }
        const fieldRows = await adminFormsDAO.getTemplateFieldRows(template.id);

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

        const subcampaign = await adminFormsDAO.getActiveSubcampaignName(
            menuItemId,
            connection,
        );
        if (!subcampaign) {
            return res.status(400).json({
                error: "La subcampaña seleccionada no es válida o no está activa",
            });
        }

        const templateName = String(
            subcampaign?.nombre_item || "",
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
            const hasActiveF2 = await adminFormsDAO.hasActiveF2Assignment(
                menuItemId,
                connection,
            );
            if (!hasActiveF2) {
                return res.status(400).json({
                    error: "No se puede crear Formulario 3 sin tener Formulario 2 activo en la subcampaña",
                });
            }
        }

        await connection.beginTransaction();

        const activeAssignment = await adminFormsDAO.getActiveAssignment(
            menuItemId,
            formType,
            connection,
        );

        let templateId = null;
        let resolvedVersion = 1;

        if (activeAssignment) {
            templateId = Number(activeAssignment.template_id || 0);
            resolvedVersion = await adminFormsDAO.getTemplateVersion(
                templateId,
                connection,
            );
            await adminFormsDAO.updateTemplatePublishedName(
                templateId,
                templateName,
                connection,
            );
            await adminFormsDAO.deactivateTemplateOptions(templateId, connection);
            await adminFormsDAO.deactivateTemplateFields(templateId, connection);

            await insertTemplateFields(
                connection,
                templateId,
                normalizedFields,
            );

            await adminFormsDAO.refreshActiveAssignment(
                menuItemId,
                formType,
                templateId,
                assignedBy,
                connection,
            );
        } else {
            resolvedVersion = await adminFormsDAO.getNextTemplateVersion(
                templateName,
                formType,
                connection,
            );
            templateId = await adminFormsDAO.insertTemplate(
                templateName,
                formType,
                resolvedVersion,
                assignedBy,
                connection,
            );

            await insertTemplateFields(
                connection,
                templateId,
                normalizedFields,
            );

            await adminFormsDAO.upsertTemplateAssignment(
                menuItemId,
                formType,
                templateId,
                assignedBy,
                connection,
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
