import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
    PageContainer,
    Alert,
    Button,
    Select,
    Tabs,
    TwoSelectRow,
} from "../../components/common";
import {
    listarSubcampaniasActivas,
    obtenerPlantillaAsignada,
    guardarPlantillaDinamica,
} from "../../services/adminForms.service";
import {
    DEFAULT_MENU_CATEGORY_ID,
    listarCategoriasMenu,
} from "../../services/campaign.service";
import "./ConfiguracionAdmin.css";

const FIELD_TYPE_OPTIONS = [
    { id: "text", label: "Texto" },
    { id: "number", label: "Número" },
    { id: "date", label: "Fecha" },
    { id: "textarea", label: "Texto largo" },
    { id: "select", label: "Lista (select)" },
    { id: "checkbox", label: "Checkbox" },
];
const F3_FIELD_TYPE_OPTIONS = [
    { id: "text", label: "Texto" },
    { id: "number", label: "Número" },
    { id: "date", label: "Fecha" },
    { id: "textarea", label: "Texto largo" },
    { id: "select", label: "Combo" },
];
const FORM_TYPE_OPTIONS = [
    { id: "F2", label: "Formulario 2" },
    { id: "F3", label: "Formulario 3" },
    { id: "F4", label: "Formulario 4 (Gestión rápida)" },
];

const F2_DEFAULT_KEYS = [
    "IDENTIFICACION",
    "NOMBRE_CLIENTE",
    "CAMPO1",
    "CAMPO2",
    "CAMPO3",
    "CAMPO4",
    "CAMPO5",
    "CAMPO6",
    "CAMPO7",
    "CAMPO8",
    "CAMPO9",
    "CAMPO10",
];

function createDefaultF2Fields() {
    return F2_DEFAULT_KEYS.map((key, index) => ({
        id: `${Date.now()}-${index}`,
        key,
        label: "", // ← vacío para que el admin lo escriba
        type: "text",
        required: false,
        maxLength: "",
        optionsText: "",
    }));
}

const MAX_FIELDS = 30;

function createEmptyField() {
    return {
        id: `${Date.now()}-${Math.random()}`,
        key: "",
        label: "",
        type: "text",
        required: false,
        maxLength: "",
        optionsText: "",
    };
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

function buildOptionsText(field) {
    if (field.type !== "select" || !Array.isArray(field.options)) {
        return "";
    }

    return field.options
        .map((option) =>
            typeof option === "string"
                ? option
                : option?.label || option?.value || "",
        )
        .filter(Boolean)
        .join("\n");
}

function normalizeEditorFieldType(type, formType) {
    if (formType === "F2") {
        return "text";
    }

    const normalized = String(type || "text")
        .trim()
        .toLowerCase();

    if (formType === "F3") {
        if (normalized === "combo") {
            return "select";
        }
        const allowedTypes = new Set([
            "text",
            "number",
            "date",
            "textarea",
            "select",
        ]);
        return allowedTypes.has(normalized) ? normalized : "text";
    }

    return normalized || "text";
}

function mapTemplateFieldsToEditorState(template) {
    const normalizedFormType = String(template?.formType || "")
        .trim()
        .toUpperCase();

    return (template?.fields || []).map((field, index) => ({
        id: `${field.id || index}-${Date.now()}-${Math.random()}`,
        key: field.key || "",
        label: field.label || "",
        type: normalizeEditorFieldType(field.type, normalizedFormType),
        required: Boolean(field.required),
        maxLength:
            field.maxLength !== null && field.maxLength !== undefined
                ? String(field.maxLength)
                : "",
        optionsText: buildOptionsText(field),
    }));
}

function FormularioConfigTab({ formType, editorMode, menuItemId, categoryId }) {
    const isF2 = formType === "F2";
    const isF3 = formType === "F3";
    const fieldTypeOptions = isF3 ? F3_FIELD_TYPE_OPTIONS : FIELD_TYPE_OPTIONS;
    const [fields, setFields] = useState([createEmptyField()]);
    const [loading, setLoading] = useState(false);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [alert, setAlert] = useState(null);
    const [currentTemplateMeta, setCurrentTemplateMeta] = useState(null);

    useEffect(() => {
        setCurrentTemplateMeta(null);

        if (formType === "F2") {
            setFields(createDefaultF2Fields());
        } else {
            setFields([createEmptyField()]);
        }
    }, [editorMode, formType, menuItemId]);

    useEffect(() => {
        if (editorMode === "create") return;

        const loadCurrentTemplate = async () => {
            if (!menuItemId || !formType) {
                setCurrentTemplateMeta(null);
                setFields([createEmptyField()]);
                return;
            }

            try {
                setLoadingTemplate(true);

                const template = await obtenerPlantillaAsignada(
                    menuItemId,
                    formType,
                );

                if (!template) {
                    setCurrentTemplateMeta(null);
                    setFields([createEmptyField()]);
                    return;
                }

                setCurrentTemplateMeta({
                    name: template.name,
                    version: template.version,
                    fieldCount: template.fields?.length || 0,
                });

                setFields(mapTemplateFieldsToEditorState(template));
            } catch (error) {
                setAlert({
                    type: "error",
                    message:
                        error.message || "No se pudo cargar plantilla actual",
                });
            } finally {
                setLoadingTemplate(false);
            }
        };

        loadCurrentTemplate();
    }, [menuItemId, formType, editorMode]);

    const updateField = (id, key, value) => {
        setFields((prev) =>
            prev.map((field) =>
                field.id === id ? { ...field, [key]: value } : field,
            ),
        );
    };

    const removeField = (id) => {
        setFields((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((field) => field.id !== id);
        });
    };

    const addField = () => {
        if (fields.length >= MAX_FIELDS) {
            setAlert({
                type: "error",
                message: `El máximo de preguntas por cuestionario es ${MAX_FIELDS}`,
            });
            return;
        }

        if (formType === "F2") {
            const nextIndex = fields.length - 1;
            const newKey = `CAMPO${nextIndex}`;

            const newField = {
                id: `${Date.now()}-${Math.random()}`,
                key: newKey,
                label: newKey,
                type: "text",
                required: false,
                maxLength: "",
            };

            setFields((prev) => [...prev, newField]);
        } else {
            setFields((prev) => [...prev, createEmptyField()]);
        }
    };

    const handleCancel = async () => {
        setAlert(null);

        if (!menuItemId || !formType) {
            setCurrentTemplateMeta(null);
            setFields([createEmptyField()]);
            return;
        }

        try {
            setLoadingTemplate(true);
            const template = await obtenerPlantillaAsignada(
                menuItemId,
                formType,
            );

            if (!template) {
                setCurrentTemplateMeta(null);
                setFields([createEmptyField()]);
                return;
            }

            setCurrentTemplateMeta({
                name: template.name,
                version: template.version,
                fieldCount: template.fields?.length || 0,
            });
            setFields(mapTemplateFieldsToEditorState(template));
        } catch (error) {
            setAlert({
                type: "error",
                message:
                    error.message || "No se pudo restaurar la plantilla actual",
            });
        } finally {
            setLoadingTemplate(false);
        }
    };

    const handleSave = async () => {
        setAlert(null);

        if (!menuItemId) {
            setAlert({
                type: "error",
                message: "Selecciona una subcampaña",
            });
            return;
        }

        const usedAutoKeys = new Set();
        const cleanedFields = fields
            .map((field, index) => {
                const options =
                    field.type === "select"
                        ? String(field.optionsText || "")
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean)
                        : [];

                const label = String(field.label || "").trim();
                const providedKey = String(field.key || "").trim();
                const resolvedKey = isF3
                    ? buildUniqueFieldKey(label, index, usedAutoKeys)
                    : providedKey;
                const resolvedType = isF2
                    ? "text"
                    : normalizeEditorFieldType(field.type, formType);

                return {
                    key: resolvedKey,
                    label,
                    type: resolvedType,
                    required: isF3 ? false : Boolean(field.required),
                    maxLength:
                        !isF3 && !isF2 && field.maxLength
                            ? Number(field.maxLength)
                            : undefined,
                    options,
                };
            })
            .filter((field) => field.key && field.label);

        if (!cleanedFields.length) {
            setAlert({
                type: "error",
                message: "Debes definir al menos un campo válido",
            });
            return;
        }

        try {
            setLoading(true);
            const response = await guardarPlantillaDinamica({
                categoryId,
                menuItemId,
                formType,
                fields: cleanedFields,
            });

            setAlert({
                type: "success",
                message:
                    response.message ||
                    "Plantilla guardada y asignada correctamente",
            });

            const refreshedTemplate = await obtenerPlantillaAsignada(
                menuItemId,
                formType,
            );
            if (refreshedTemplate) {
                setCurrentTemplateMeta({
                    name: refreshedTemplate.name,
                    version: refreshedTemplate.version,
                    fieldCount: refreshedTemplate.fields?.length || 0,
                });
            }
        } catch (error) {
            setAlert({
                type: "error",
                message: error.message || "No se pudo guardar la plantilla",
            });
        } finally {
            setLoading(false);
        }
    };

    let saveButtonLabel = "Guardar y asignar";
    if (loading) {
        saveButtonLabel = "Guardando...";
    } else if (editorMode === "edit") {
        saveButtonLabel = "Guardar cambios";
    }

    return (
        <div className="">
            {alert && <Alert type={alert.type} message={alert.message} />}

            {currentTemplateMeta && (
                <div className="">
                    Actual: <strong>{currentTemplateMeta.name}</strong> · v
                    {currentTemplateMeta.version} · campos:{" "}
                    {currentTemplateMeta.fieldCount}
                </div>
            )}

            {/* creacion formularios */}
            <div className="config-fields-grid-f2">
                {fields.map((field, index) => (
                    <div key={field.id} className="config-field-card-f2">
                        {isF2 ? (
                            <div className="config-row-f2">
                                <label className="label">
                                    <span>Etiqueta {index + 1}</span>
                                    <input
                                        className="input"
                                        value={field.label}
                                        onChange={(e) =>
                                            updateField(
                                                field.id,
                                                "label",
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Texto a asignar"
                                    />
                                </label>

                                <Button
                                    variant="danger"
                                    type="button"
                                    onClick={() => removeField(field.id)}
                                    disabled={fields.length <= 1}
                                >
                                    Eliminar
                                </Button>
                            </div>
                        ) : (
                            <>
                                {isF3 ? (
                                    <div className="config-fields-grid-f3">
                                        <div
                                            key={field.id}
                                            className="config-field-card-f3"
                                        >
                                            <div className="config-row-f3-new">
                                                <label className="label">
                                                    <span>
                                                        Pregunta {index + 1}
                                                    </span>
                                                    <input
                                                        className="input"
                                                        value={field.label}
                                                        onChange={(e) =>
                                                            updateField(
                                                                field.id,
                                                                "label",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Texto pregunta"
                                                    />
                                                </label>

                                                <Select
                                                    label="Tipo"
                                                    options={fieldTypeOptions}
                                                    value={field.type}
                                                    onChange={(value) =>
                                                        updateField(
                                                            field.id,
                                                            "type",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            {field.type === "select" && (
                                                <label className="label config-options">
                                                    <span>
                                                        Opciones (una por línea)
                                                    </span>
                                                    <textarea
                                                        className="input config-options-textarea"
                                                        rows={4}
                                                        value={
                                                            field.optionsText
                                                        }
                                                        onChange={(e) =>
                                                            updateField(
                                                                field.id,
                                                                "optionsText",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder={`opcion 1
opcion 2
opcion 3`}
                                                    />
                                                </label>
                                            )}

                                            <Button
                                                variant="danger"
                                                type="button"
                                                onClick={() =>
                                                    removeField(field.id)
                                                }
                                                disabled={fields.length <= 1}
                                            >
                                                Eliminar campo
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                                {formType === "F4" ? (
                                    <div className="config-fields-grid-f3">
                                        <div
                                            key={field.id}
                                            className="config-field-card-f3"
                                        >
                                            <div className="config-row-f3-new">
                                                <label className="label">
                                                    <span>
                                                        Campo {index + 1}
                                                    </span>
                                                    <input
                                                        className="input"
                                                        value={field.label}
                                                        onChange={(e) =>
                                                            updateField(
                                                                field.id,
                                                                "label",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Texto campo"
                                                    />
                                                </label>

                                                <Select
                                                    label="Tipo"
                                                    options={FIELD_TYPE_OPTIONS}
                                                    value={field.type}
                                                    onChange={(value) =>
                                                        updateField(
                                                            field.id,
                                                            "type",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            {field.type === "select" && (
                                                <label className="label config-options">
                                                    <span>
                                                        Opciones (una por línea)
                                                    </span>
                                                    <textarea
                                                        className="input config-options-textarea"
                                                        rows={4}
                                                        value={
                                                            field.optionsText
                                                        }
                                                        onChange={(e) =>
                                                            updateField(
                                                                field.id,
                                                                "optionsText",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder={`opcion 1
opcion 2
opcion 3`}
                                                    />
                                                </label>
                                            )}

                                            <Button
                                                variant="danger"
                                                type="button"
                                                onClick={() =>
                                                    removeField(field.id)
                                                }
                                                disabled={fields.length <= 1}
                                            >
                                                Eliminar campo
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                ))}
            </div>
            <div className="config-footer-actions">
                <Button
                    type="button"
                    variant="default"
                    onClick={addField}
                    disabled={loading || fields.length >= MAX_FIELDS}
                >
                    Agregar campo
                </Button>

                <Button
                    type="button"
                    variant="default"
                    onClick={handleCancel}
                    disabled={loading || loadingTemplate}
                >
                    Cancelar
                </Button>

                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={loading || loadingTemplate}
                >
                    {saveButtonLabel}
                </Button>
            </div>
        </div>
    );
}

FormularioConfigTab.propTypes = {
    formType: PropTypes.oneOf(["F2", "F3", "F4"]).isRequired,
    editorMode: PropTypes.oneOf(["create", "edit"]).isRequired,
    menuItemId: PropTypes.string.isRequired,
    categoryId: PropTypes.string.isRequired,
};

export default function ConfiguracionAdmin() {
    const [activeTab, setActiveTab] = useState("create");
    const [formType, setFormType] = useState("F2");
    const [categoryId, setCategoryId] = useState(DEFAULT_MENU_CATEGORY_ID);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [menuItemId, setMenuItemId] = useState("");
    const [subcampaignOptions, setSubcampaignOptions] = useState([]);
    const [loadingSubcampaigns, setLoadingSubcampaigns] = useState(false);
    const [headerAlert, setHeaderAlert] = useState(null);
    const targetLabel =
        formType === "F2" ? "Campaña / subcampaña" : "Subcampaña";

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const rows = await listarCategoriasMenu();
                const options = rows
                    .filter((item) => item.id && item.nombre)
                    .map((item) => ({
                        id: item.id,
                        label: item.nombre,
                    }));
                setCategoryOptions(options);
                if (!options.some((item) => item.id === categoryId)) {
                    setCategoryId(
                        String(options[0]?.id || DEFAULT_MENU_CATEGORY_ID),
                    );
                }
            } catch (error) {
                setHeaderAlert({
                    type: "error",
                    message:
                        error.message || "No se pudieron cargar categorias",
                });
            }
        };

        loadCategories();
    }, []);

    useEffect(() => {
        const loadSubcampaigns = async () => {
            try {
                setLoadingSubcampaigns(true);
                setHeaderAlert(null);
                const scope =
                    activeTab === "edit" ? "with-template" : "without-template";
                const data = await listarSubcampaniasActivas(
                    formType,
                    categoryId,
                    scope,
                );
                const options = data.map((item) => ({
                    id: String(item.id || ""),
                    label: item.label,
                    subcampania: item.subcampania,
                }));

                setSubcampaignOptions(options);
                const currentStillAvailable = options.some(
                    (option) => String(option.id) === String(menuItemId),
                );
                if (!currentStillAvailable) {
                    setMenuItemId("");
                }
            } catch (error) {
                setSubcampaignOptions([]);
                setMenuItemId("");
                setHeaderAlert({
                    type: "error",
                    message:
                        error.message ||
                        "No se pudo cargar subcampañas activas",
                });
            } finally {
                setLoadingSubcampaigns(false);
            }
        };

        loadSubcampaigns();
    }, [activeTab, formType, categoryId, menuItemId]);

    const renderTabContent = (mode) => (
        <>
            {headerAlert && (
                <Alert type={headerAlert.type} message={headerAlert.message} />
            )}

            <Select
                label="Categoria"
                options={categoryOptions}
                value={categoryId}
                onChange={(value) => {
                    setCategoryId(value);
                    setMenuItemId("");
                }}
                disabled={loadingSubcampaigns}
            />

            <TwoSelectRow
                first={{
                    label: "Tipo de formulario",
                    options: FORM_TYPE_OPTIONS,
                    value: formType,
                    onChange: setFormType,
                }}
                second={{
                    label: "Subcampaña",
                    options: subcampaignOptions,
                    value: menuItemId,
                    onChange: setMenuItemId,
                    placeholder:
                        mode === "edit"
                            ? `Selecciona subcampaña con ${formType}`
                            : `Selecciona subcampaña sin ${formType}`,
                    disabled: loadingSubcampaigns,
                    required: true,
                }}
            />

            <FormularioConfigTab
                formType={formType}
                editorMode={mode}
                menuItemId={menuItemId}
                categoryId={categoryId}
            />
        </>
    );

    const tabs = [
        {
            id: "create",
            label: "Crear plantilla",
            content: renderTabContent("create"),
        },
        {
            id: "edit",
            label: "Editar plantilla",
            content: renderTabContent("edit"),
        },
    ];

    return (
        <PageContainer>
            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="default"
            />
        </PageContainer>
    );
}
