import mysql from "mysql2/promise";

const dbConfig = {
    host: "127.0.0.1",
    port: 13306,
    user: "kimobill",
    password: "sIst2m1s2020",
    database: "cck_dev",
    multipleStatements: true,
};

const visionFundSeeds = [
    {
        campaignMatchNames: ["BVF PRE APROBADOS"],
        f2: {
            name: "BVF PRE APROBADOS",
            fields: [
                ["IDENTIFICACION", "IDENTIFICACION", "text"],
                ["NOMBRE_CLIENTE", "NOMBRE CLIENTE", "text"],
                ["CAMPO1", "Tasa", "text"],
                ["CAMPO2", "Número crédito", "text"],
                ["CAMPO3", "Tipo crédito", "text"],
                ["CAMPO4", "Opción #1", "text"],
                ["CAMPO5", "Opción #2", "text"],
                ["CAMPO6", "Opción #3", "text"],
                ["CAMPO7", "Opción #4", "text"],
                ["CAMPO8", "Agencia", "text"],
                ["CAMPO9", "Nombre Asesor", "text"],
                ["CAMPO10", "Número de contacto Asesor", "text"],
            ],
        },
        f3: {
            name: "BVF PRE APROBADOS",
            fields: [
                {
                    key: "respuesta1",
                    label: "Fecha y hora de visita",
                    type: "text",
                    options: [],
                },
                {
                    key: "respuesta2",
                    label: "Lugar visita",
                    type: "select",
                    options: ["Domicilio", "Trabajo"],
                },
                {
                    key: "respuesta3",
                    label: "Provincia",
                    type: "select",
                    options: [
                        "Azuay",
                        "Bolivar",
                        "Cañar",
                        "Carchi",
                        "Chimborazo",
                        "Cotopaxi",
                        "El Oro",
                        "Esmeraldas",
                        "Galápagos",
                        "Guayanas",
                        "Imbabura",
                        "Loja",
                        "Los Ríos",
                        "Manabí",
                        "Morona Santiago",
                        "Napo",
                        "Sucumbíos",
                        "Pastaza",
                        "Pinchincha",
                        "Santa Elena",
                        "Santo Domingo",
                        "Francisco De Orellana",
                        "Tungurahua",
                        "Zamora Chinchipe",
                    ],
                },
                {
                    key: "respuesta4",
                    label: "Ciudad",
                    type: "text",
                    options: [],
                },
                {
                    key: "respuesta10",
                    label: "Opción de crédito seleccionada",
                    type: "select",
                    options: ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
                },
            ],
        },
    },
    {
        campaignMatchNames: [
            "BVF ENCUESTAS DE SATISFACCION",
            "BVF ENCUESTAS DE SATISFACCIÓN",
        ],
        f2: {
            name: "BVF ENCUESTAS DE SATISFACCION",
            fields: [
                ["IDENTIFICACION", "IDENTIFICACION", "text"],
                ["NOMBRE_CLIENTE", "NOMBRE CLIENTE", "text"],
                ["CAMPO1", "Fecha", "text"],
                ["CAMPO2", "Número socio", "text"],
                ["CAMPO3", "Agencia", "text"],
                ["CAMPO4", "Oficial", "text"],
                ["CAMPO5", "CAMPO 5", "text"],
                ["CAMPO6", "CAMPO 6", "text"],
                ["CAMPO7", "CAMPO 7", "text"],
                ["CAMPO8", "CAMPO 8", "text"],
                ["CAMPO9", "CAMPO 9", "text"],
                ["CAMPO10", "CAMPO 10", "text"],
            ],
        },
        f3: {
            name: "BVF ENCUESTAS DE SATISFACCION",
            fields: [
                {
                    key: "respuesta1",
                    label: "1. ¿Cómo calificarías la atención recibida por parte de nuestros funcionarios?",
                    type: "select",
                    options: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                    ],
                },
                {
                    key: "respuesta2",
                    label: "1.1. ¿Cuál es el motivo de la calificación?",
                    type: "text",
                    maxLength: 500,
                    options: [],
                },
                {
                    key: "respuesta3",
                    label: "2. ¿El producto (créditos, banca, tarjeta o seguros) entregado cumplió con sus expectativas?",
                    type: "select",
                    options: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                    ],
                },
                {
                    key: "respuesta4",
                    label: "2.1. ¿Cuál es el motivo de la calificación?",
                    type: "text",
                    maxLength: 500,
                    options: [],
                },
                {
                    key: "respuesta5",
                    label: "3. ¿Como fue el tiempo de espera para ser atendido?",
                    type: "select",
                    options: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                    ],
                },
                {
                    key: "respuesta6",
                    label: "4. ¿Cuál fue el principal medio por el cual conoció a Banco VisionFund y que más influyó en su decisión de contactarnos o solicitar información?",
                    type: "select",
                    options: [
                        "Radio",
                        "Televisión",
                        "Redes sociales (Facebook , Instagram, Twitter, TikTok)",
                        "Recomendación de un familiar o amigo -Publicidad digital",
                        "Ferias o eventos públicos",
                        "Otros",
                    ],
                },
            ],
        },
    },
    {
        campaignMatchNames: ["BVF ENCUESTAS POSTVENTA"],
        f2: {
            name: "BVF ENCUESTAS POSTVENTA",
            fields: [
                ["IDENTIFICACION", "IDENTIFICACION", "text"],
                ["NOMBRE_CLIENTE", "NOMBRE CLIENTE", "text"],
                ["CAMPO1", "Fecha", "text"],
                ["CAMPO2", "Número socio", "text"],
                ["CAMPO3", "Agencia", "text"],
                ["CAMPO4", "Oficial", "text"],
                ["CAMPO5", "CAMPO 5", "text"],
                ["CAMPO6", "CAMPO 6", "text"],
                ["CAMPO7", "CAMPO 7", "text"],
                ["CAMPO8", "CAMPO 8", "text"],
                ["CAMPO9", "CAMPO 9", "text"],
                ["CAMPO10", "CAMPO 10", "text"],
            ],
        },
        f3: {
            name: "BVF ENCUESTAS POSTVENTA",
            fields: [
                {
                    key: "respuesta1",
                    label: "1. ¿Cómo calificarías la atención recibida por parte de nuestros funcionarios?",
                    type: "select",
                    options: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                    ],
                },
                {
                    key: "respuesta2",
                    label: "1.1. ¿Cuál es el motivo de la calificación?",
                    type: "text",
                    maxLength: 500,
                    options: [],
                },
                {
                    key: "respuesta3",
                    label: "2. ¿Como calificarías la calidad del producto/servicio recibido?",
                    type: "select",
                    options: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                    ],
                },
                {
                    key: "respuesta4",
                    label: "2.1. ¿Cuál es el motivo de la calificación?",
                    type: "text",
                    maxLength: 500,
                    options: [],
                },
                {
                    key: "respuesta5",
                    label: "3. ¿Como fue el tiempo de espera para ser atendido?",
                    type: "select",
                    options: [
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                    ],
                },
                {
                    key: "respuesta6",
                    label: "4. ¿Cuál sería su método preferido de comunicación con nosotros?",
                    type: "select",
                    options: [
                        "Correo Electrónico",
                        "Llamada Telefónica",
                        "Agencias",
                        "WhatsApp",
                    ],
                },
            ],
        },
    },
];

async function ensureTemplate(connection, name, formType) {
    const [existing] = await connection.query(
        `SELECT id FROM form_templates WHERE name = ? AND form_type = ? ORDER BY version DESC, id DESC LIMIT 1`,
        [name, formType],
    );

    if (existing.length > 0) return existing[0].id;

    const [insertResult] = await connection.query(
        `INSERT INTO form_templates (name, form_type, status, version, description, created_by)
     VALUES (?, ?, 'published', 1, 'Migración inicial hardcode', 'admin')`,
        [name, formType],
    );

    return insertResult.insertId;
}

async function ensureField(connection, templateId, field, order) {
    const [rows] = await connection.query(
        `SELECT id FROM form_template_fields WHERE template_id = ? AND field_key = ? LIMIT 1`,
        [templateId, field.key],
    );

    if (rows.length > 0) {
        const fieldId = rows[0].id;
        await connection.query(
            `UPDATE form_template_fields
       SET label = ?, field_type = ?, is_required = ?, display_order = ?, max_length = ?, is_active = 1
       WHERE id = ?`,
            [
                field.label,
                field.type,
                field.required ? 1 : 0,
                order,
                field.maxLength || null,
                fieldId,
            ],
        );
        return fieldId;
    }

    const [insert] = await connection.query(
        `INSERT INTO form_template_fields
      (template_id, field_key, label, field_type, is_required, display_order, max_length, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
            templateId,
            field.key,
            field.label,
            field.type,
            field.required ? 1 : 0,
            order,
            field.maxLength || null,
        ],
    );

    return insert.insertId;
}

async function ensureOptions(connection, fieldId, options) {
    for (let index = 0; index < options.length; index += 1) {
        const option = String(options[index]);
        const [exists] = await connection.query(
            `SELECT id FROM form_template_field_options WHERE field_id = ? AND option_value = ? LIMIT 1`,
            [fieldId, option],
        );

        if (exists.length > 0) {
            await connection.query(
                `UPDATE form_template_field_options SET option_label = ?, display_order = ?, is_active = 1 WHERE id = ?`,
                [option, index + 1, exists[0].id],
            );
        } else {
            await connection.query(
                `INSERT INTO form_template_field_options (field_id, option_value, option_label, display_order, is_active)
         VALUES (?, ?, ?, ?, 1)`,
                [fieldId, option, option, index + 1],
            );
        }
    }
}

async function assignTemplate(connection, campaignNames, formType, templateId) {
    const placeholders = campaignNames.map(() => "?").join(", ");
    const [menuRows] = await connection.query(
        `SELECT id, nombre_item
     FROM menu_items
     WHERE estado = 'activo' AND nombre_item IN (${placeholders})
     ORDER BY nombre_item ASC`,
        campaignNames,
    );

    if (menuRows.length === 0) {
        console.warn(
            "No se encontró subcampaña activa para:",
            campaignNames.join(" | "),
        );
        return;
    }

    const menuItemId = menuRows[0].id;

    await connection.query(
        `UPDATE form_template_assignments
     SET is_active = 0
     WHERE menu_item_id = ? AND form_type = ? AND is_active = 1`,
        [menuItemId, formType],
    );

    const [exists] = await connection.query(
        `SELECT id FROM form_template_assignments
     WHERE menu_item_id = ? AND form_type = ? AND template_id = ? AND is_active = 1 LIMIT 1`,
        [menuItemId, formType, templateId],
    );

    if (exists.length === 0) {
        await connection.query(
            `INSERT INTO form_template_assignments (menu_item_id, form_type, template_id, is_active, assigned_by, assigned_at)
       VALUES (?, ?, ?, 1, 'admin', NOW())`,
            [menuItemId, formType, templateId],
        );
    }
}

function normalizeFormFields(seedForm) {
    if (Array.isArray(seedForm.fields)) return seedForm.fields;

    const flat = [];
    for (const row of seedForm.fields || seedForm.rows || []) {
        for (const tupleOrObj of row) {
            if (Array.isArray(tupleOrObj)) {
                flat.push({
                    key: tupleOrObj[0],
                    label: tupleOrObj[1],
                    type: tupleOrObj[2] || "text",
                    options: [],
                });
            } else {
                flat.push({
                    key: tupleOrObj.key,
                    label: tupleOrObj.label,
                    type: tupleOrObj.type || "text",
                    options: tupleOrObj.options || [],
                    maxLength: tupleOrObj.maxLength,
                });
            }
        }
    }
    return flat;
}

async function main() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        const [columnTypeRows] = await connection.query(
            `SELECT DATA_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'form_template_assignments'
         AND COLUMN_NAME = 'menu_item_id'`,
        );

        if (!columnTypeRows.length) {
            throw new Error(
                "No existe columna form_template_assignments.menu_item_id",
            );
        }

        const menuItemIdType = String(
            columnTypeRows[0].DATA_TYPE || "",
        ).toLowerCase();
        if (
            [
                "bigint",
                "int",
                "integer",
                "smallint",
                "mediumint",
                "tinyint",
            ].includes(menuItemIdType)
        ) {
            throw new Error(
                "menu_item_id es numérico y menu_items.id es UUID. Cambia menu_item_id a CHAR(36)/VARCHAR(36) antes de asignar.",
            );
        }

        await connection.beginTransaction();

        for (const seed of visionFundSeeds) {
            const f2TemplateId = await ensureTemplate(
                connection,
                seed.f2.name,
                "F2",
            );
            const f3TemplateId = await ensureTemplate(
                connection,
                seed.f3.name,
                "F3",
            );

            const f2Fields = seed.f2.fields.map(([key, label, type]) => ({
                key,
                label,
                type,
                options: [],
            }));
            const f3Fields = normalizeFormFields(seed.f3);

            for (let index = 0; index < f2Fields.length; index += 1) {
                const field = f2Fields[index];
                const fieldId = await ensureField(
                    connection,
                    f2TemplateId,
                    field,
                    index + 1,
                );
                if (field.type === "select" && field.options?.length) {
                    await ensureOptions(connection, fieldId, field.options);
                }
            }

            for (let index = 0; index < f3Fields.length; index += 1) {
                const field = f3Fields[index];
                const fieldId = await ensureField(
                    connection,
                    f3TemplateId,
                    field,
                    index + 1,
                );
                if (field.type === "select" && field.options?.length) {
                    await ensureOptions(connection, fieldId, field.options);
                }
            }

            await assignTemplate(
                connection,
                seed.campaignMatchNames,
                "F2",
                f2TemplateId,
            );
            await assignTemplate(
                connection,
                seed.campaignMatchNames,
                "F3",
                f3TemplateId,
            );
        }

        await connection.commit();

        const [summary] = await connection.query(
            `SELECT m.nombre_item AS subcampania, a.form_type, t.name AS plantilla, t.version
       FROM form_template_assignments a
       JOIN menu_items m ON m.id = a.menu_item_id
       JOIN form_templates t ON t.id = a.template_id
       WHERE a.is_active = 1
         AND m.nombre_item LIKE 'BVF %'
       ORDER BY m.nombre_item, a.form_type`,
        );

        console.log(
            "Seeder ejecutado correctamente. Asignaciones activas BVF:",
        );
        console.table(summary);
    } catch (error) {
        await connection.rollback();
        console.error("Error en seeder:", error.message);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

main();
