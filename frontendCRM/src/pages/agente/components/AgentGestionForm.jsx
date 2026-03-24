import "./AgentGestionForm.css";
import PropTypes from "prop-types";
import Button from "../../../components/common/Button";
import Tabs from "../../../components/common/Tabs";
import scriptsByCampaign from "../config/scriptsByCampaign";
import { useEffect, useMemo, useRef, useState } from "react";

function AgentGestionForm({
    registro,
    onSubmit,
    levels,
    level1Seleccionado,
    level2Seleccionado,
    onLevel1Change,
    onLevel2Change,
    telefonos,
    telefonoSeleccionado,
    onTelefonoChange,
    estadoTelefonos,
    estadoTelefonoSeleccionado,
    onEstadoTelefonoChange,
    observacion,
    onObservacionChange,
    onNoContestaClick,
    onGrabadoraClick,
    onContestaTerceroClick,
    dynamicFormConfig,
    dynamicFormDetail,
    dynamicSurveyConfig,
    surveyFieldsToRender,
    surveyAnswers,
    onSurveyFieldChange,
    onCancelarGestion,
    user,
}) {
    const firstRender = useRef(true);
    const [activeTab, setActiveTab] = useState("gestion");

    const getDynamicWidth = (value) => {
        const text = String(value ?? "");
        const length = Math.max(text.length, 8);
        const estimated = Math.round(length * 8.5 + 56);
        return Math.min(Math.max(estimated, 140), 560);
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (telefonoSeleccionado) {
            if (
                navigator &&
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {
                navigator.clipboard.writeText(telefonoSeleccionado);
            } else {
                const tempInput = document.createElement("input");
                tempInput.value = telefonoSeleccionado;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand("copy");
                document.body.removeChild(tempInput);
            }
        }
    }, [telefonoSeleccionado]);

    let dynamicFormRowsWithValues = [];
    let getDynamicFormValue = () => "";
    if (dynamicFormConfig && dynamicFormConfig.rows && dynamicFormDetail) {
        const allFields = dynamicFormConfig.rows
            .flat()
            .filter((field) => {
                const val = dynamicFormDetail[field.key];
                return val !== undefined && val !== null && val !== "";
            });
        const MAX_COLS = 6;
        dynamicFormRowsWithValues = [];
        for (let i = 0; i < allFields.length; i += MAX_COLS) {
            dynamicFormRowsWithValues.push(allFields.slice(i, i + MAX_COLS));
        }
        getDynamicFormValue = (key) => dynamicFormDetail[key] ?? "";
    }

    let extraFields = [];
    if (dynamicFormDetail && dynamicFormDetail.CamposAdicionalesJson) {
        let adicionales = {};
        try {
            adicionales = JSON.parse(dynamicFormDetail.CamposAdicionalesJson);
        } catch {}
        const allFields = Object.entries(adicionales)
            .filter(([key, val]) => val !== undefined && val !== null && val !== "")
            .map(([key, val]) => ({ key, label: key, value: val }));
        const MAX_COLS = 6;
        extraFields = [];
        for (let i = 0; i < allFields.length; i += MAX_COLS) {
            extraFields.push(allFields.slice(i, i + MAX_COLS));
        }
    }

    const showDynamicForm =
        dynamicFormConfig && dynamicFormRowsWithValues.length > 0;
    const showSurvey =
        dynamicSurveyConfig &&
        typeof level1Seleccionado === "string" &&
        level1Seleccionado.trim().toUpperCase().startsWith("CU1");

    useEffect(() => {
        const availableTabs = ["gestion"];
        if (showSurvey) availableTabs.push("encuesta");
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [activeTab, showSurvey]);

    const renderFormulario1 = () => (
        <section className="agent-form-card agent-form-card--f1">
            <div className="agent-form-card__header">
                <h4 className="agent-form-card__title">Formulario 1</h4>
                <div className="agent-quick-actions">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onNoContestaClick}
                    >
                        No contesta
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onGrabadoraClick}
                    >
                        Grabadora
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onContestaTerceroClick}
                    >
                        Contesta tercero
                    </Button>
                </div>
            </div>
            <div className="agent-form-card__body">
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Teléfonos a marcar</span>
                        <select
                            value={telefonoSeleccionado || ""}
                            onChange={(e) => onTelefonoChange(e.target.value)}
                            className="agent-input"
                            required
                        >
                            <option value="">Selecciona...</option>
                            {telefonos.map((fono) => (
                                <option key={fono} value={fono}>
                                    {fono}
                                </option>
                            ))}
                        </select>
                        {telefonoSeleccionado && (
                            <span className="agent-copy-hint">Copiado al portapapeles</span>
                        )}
                    </label>
                </div>
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Resultado gestión - Nivel 1</span>
                        <select
                            value={level1Seleccionado || ""}
                            onChange={(e) => onLevel1Change(e.target.value)}
                            className="agent-input"
                            required
                        >
                            <option value="">Selecciona...</option>
                            {[
                                ...new Set(
                                    levels
                                        .map((item) => item.level1)
                                        .filter(Boolean),
                                ),
                            ].map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Resultado gestión - Nivel 2</span>
                        <select
                            value={level2Seleccionado || ""}
                            onChange={(e) => onLevel2Change(e.target.value)}
                            className="agent-input"
                            required
                        >
                            <option value="">Selecciona...</option>
                            {levels
                                .filter((item) => item.level1 === level1Seleccionado)
                                .map((item) => item.level2)
                                .filter(Boolean)
                                .map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                        </select>
                    </label>
                </div>
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Estados teléfonos</span>
                        <select
                            value={estadoTelefonoSeleccionado || ""}
                            onChange={(e) => onEstadoTelefonoChange(e.target.value)}
                            className="agent-input"
                            required
                        >
                            <option value="">Selecciona...</option>
                            {estadoTelefonos.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Observación</span>
                        <input
                            type="text"
                            placeholder="Ej: Cliente prefiere WhatsApp para confirmación."
                            value={observacion || ""}
                            onChange={(e) => onObservacionChange(e.target.value)}
                            className="agent-input"
                            required
                        />
                    </label>
                </div>
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Intentos</span>
                        <input
                            type="text"
                            value={String(registro?.intentos_totales ?? 0)}
                            className="agent-input"
                            readOnly
                        />
                    </label>
                </div>
            </div>
        </section>
    );

    const renderFormulario2 = () => (
        <section className="agent-form-card agent-form-card--secondary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">
                    Formulario 2 · {dynamicFormConfig?.title}
                </p>
            </div>
            <div className="agent-dynamic-section">
                {dynamicFormRowsWithValues.map((rowFields) => (
                    <div
                        key={`row-${rowFields.map((field) => field.key).join("-")}`}
                        className="agent-dynamic-row"
                    >
                        {rowFields.map((field) => {
                            const value = String(getDynamicFormValue(field.key));
                            const isLong =
                                value.length > 28 || field.label.length > 28;
                            return (
                                <div key={field.key} className="agent-form-field">
                                    <span className="agent-dynamic-label">
                                        {field.label}
                                    </span>
                                    {isLong ? (
                                        <textarea
                                            className="agent-input agent-auto-textarea"
                                            value={value}
                                            readOnly
                                            rows={Math.min(
                                                8,
                                                Math.max(
                                                    2,
                                                    Math.ceil(value.length / 60),
                                                ),
                                            )}
                                            style={{
                                                width: `${getDynamicWidth(value)}px`,
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={value}
                                            className="agent-input agent-auto-input"
                                            readOnly
                                            style={{
                                                width: `${getDynamicWidth(value)}px`,
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
                {extraFields.length > 0 &&
                    extraFields.map((row, idx) => (
                        <div key={`extra-row-${idx}`} className="agent-dynamic-row">
                            {row.map((field) => {
                                const value = String(field.value);
                                const isLong = value.length > 80;
                                return (
                                    <div key={field.key} className="agent-form-field">
                                        <span className="agent-dynamic-label">
                                            {field.label}
                                        </span>
                                        {isLong ? (
                                            <textarea
                                                className="agent-input agent-auto-textarea"
                                                value={value}
                                                readOnly
                                                rows={Math.min(
                                                    8,
                                                    Math.max(
                                                        2,
                                                        Math.ceil(value.length / 60),
                                                    ),
                                                )}
                                                style={{
                                                    width: `${getDynamicWidth(value)}px`,
                                                }}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={value}
                                                className="agent-input agent-auto-input"
                                                readOnly
                                                style={{
                                                    width: `${getDynamicWidth(value)}px`,
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
            </div>
        </section>
    );

    const renderFormulario3 = () => (
        <section className="agent-form-card agent-form-card--tertiary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">
                    Formulario 3 · {dynamicSurveyConfig?.title}
                </p>
            </div>
            <div className="agent-survey-grid">
                {surveyFieldsToRender.map((field) => (
                    <div key={field.key} className="agent-survey-item">
                        <div className="agent-survey-field">
                            <span className="agent-survey-question">{field.label}</span>
                            {(() => {
                                const currentValue = surveyAnswers[field.key] || "";
                                const handleChange = (e) =>
                                    onSurveyFieldChange(field.key, e.target.value);
                                if (field.type === "select") {
                                    return (
                                        <select
                                            className="agent-input agent-survey-input"
                                            value={currentValue}
                                            onChange={handleChange}
                                        >
                                            <option value="">Selecciona...</option>
                                            {field.options?.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    );
                                }
                                if (field.type === "label") {
                                    return (
                                        <div
                                            className="agent-input agent-survey-input agent-survey-readonly"
                                        >
                                            {field.label}
                                        </div>
                                    );
                                }
                                if (field.type === "textarea") {
                                    return (
                                        <textarea
                                            className="agent-input agent-survey-input"
                                            maxLength={field.maxLength || undefined}
                                            value={currentValue}
                                            onChange={handleChange}
                                        />
                                    );
                                }
                                let inputType = "text";
                                if (field.type === "datetime-local") inputType = "datetime-local";
                                else if (field.type === "date") inputType = "date";
                                else if (field.type === "number") inputType = "number";
                                return (
                                    <input
                                        type={inputType}
                                        className="agent-input agent-survey-input"
                                        maxLength={field.maxLength || undefined}
                                        value={currentValue}
                                        onChange={handleChange}
                                    />
                                );
                            })()}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );

    const renderGestionContent = () => (
        <div className="agent-form-stack">
            {renderFormulario1()}
            {showDynamicForm && (
                <>
                    <div className="agent-form-stack-divider" aria-hidden="true" />
                    {renderFormulario2()}
                </>
            )}
        </div>
    );

    const sanitizeCampaignKey = (value) =>
        value?.toString().trim().toLowerCase().replace(/\s+/g, "-");
    const fallbackKey = sanitizeCampaignKey(dynamicFormConfig?.title);
    const scriptKey =
        sanitizeCampaignKey(registro?.campaignId) || fallbackKey || "default";
    const scriptContent =
        scriptsByCampaign[scriptKey] || scriptsByCampaign.default;
    const normalizeForComparison = (value) =>
        value
            ?.toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .trim() || "";
    const findDynamicFieldValueByLabel = (labelPatterns = []) => {
        if (!dynamicFormConfig?.rows?.length || !dynamicFormDetail) return "";
        const fields = dynamicFormConfig.rows.reduce((acc, row) => {
            if (Array.isArray(row)) {
                return acc.concat(row);
            }
            if (row) {
                acc.push(row);
            }
            return acc;
        }, []);

        for (const pattern of labelPatterns) {
            const normalizedPattern = normalizeForComparison(pattern);
            for (const field of fields) {
                const label = field?.label || field?.key || "";
                const normalizedLabel = normalizeForComparison(label);
                if (
                    normalizedPattern &&
                    normalizedLabel.includes(normalizedPattern)
                ) {
                    const value = dynamicFormDetail[field.key];
                    if (
                        value !== undefined &&
                        value !== null &&
                        value !== ""
                    ) {
                        return String(value).trim();
                    }
                }
            }
        }

        return "";
    };
    const scriptLabels = {
        header: "Guía completa",
        greeting: "Saludo",
        security: "Seguridad",
        arcotel: "Arcotel",
        informative: "Informativo",
        farewell: "Despedida",
        objections: "Manejo de objeciones",
        additional: "Notas adicionales",
    };
    const dynamicClienteNombre = findDynamicFieldValueByLabel([
        "Nombre completo",
        "Nombre",
        "Cliente",
        "Titular",
        "Socio",
    ]);
    const clienteNombre =
        dynamicClienteNombre ||
        registro?.nombre ||
        registro?.nombreCompleto ||
        registro?.fullName ||
        registro?.cliente ||
        "titular";
    const asesorNombre =
        user?.full_name || user?.name || user?.username || "[Tu nombre]";
    const highlight = (value) =>
        `<strong class="agent-script-highlight">${value}</strong>`;
    const replacePlaceholders = (text) =>
        text
            .replace(/\{cliente\}/gi, highlight(clienteNombre))
            .replace(/\{asesor\}/gi, highlight(asesorNombre));
    const scriptEntries = useMemo(
        () =>
            Object.entries(scriptContent)
                .filter(
                    ([key, text]) =>
                        key !== "header" && Boolean(text?.toString().trim()),
                )
                .map(([key, text]) => ({
                    key,
                    label: scriptLabels[key] || key,
                    text: replacePlaceholders(text.toString()),
                })),
        [scriptContent, clienteNombre, asesorNombre],
    );
    const [activeScriptKey, setActiveScriptKey] = useState(
        () => scriptEntries[0]?.key ?? null,
    );

    useEffect(() => {
        setActiveScriptKey((current) =>
            scriptEntries.some((entry) => entry.key === current)
                ? current
                : scriptEntries[0]?.key ?? null,
        );
    }, [scriptEntries]);

    const tabDefinitions = [
        {
            id: "gestion",
            label: showDynamicForm
                ? `F1 · F2 · ${dynamicFormConfig?.title}`
                : "Formulario 1",
            content: renderGestionContent(),
        },
        showSurvey && {
            id: "encuesta",
            label: `Formulario 3 · ${dynamicSurveyConfig?.title}`,
            content: renderFormulario3(),
        },
    ].filter(Boolean);

    return (
        <form onSubmit={onSubmit} className="agent-gestion-form">
            {scriptEntries.length > 0 && (
                <section className="agent-script-tabs">
                    <div className="agent-script-tabs__header">
                        <h3>Guiones de campaña</h3>
                    </div>
                    <div className="agent-script-tabs__nav">
                        {scriptEntries.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                className={`agent-script-tabs__button ${
                                    activeScriptKey === key ? "is-active" : ""
                                }`}
                                onClick={() => setActiveScriptKey(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
            <div className="agent-script-tabs__content">
                {scriptEntries
                    .filter(({ key }) => key === activeScriptKey)
                    .map(({ key, text }) => (
                        <p
                            className="agent-script-card__text"
                            key={key}
                            dangerouslySetInnerHTML={{ __html: text }}
                        />
                    ))}
            </div>
                </section>
            )}

            <div className="agent-tabs-wrapper">
                <Tabs tabs={tabDefinitions} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            <div className="agent-form-actions">
                <Button variant="primary" type="submit">
                    Guardar gestión
                </Button>
                <Button
                    variant="secondary"
                    type="button"
                    onClick={onCancelarGestion}
                >
                    Cancelar gestión
                </Button>
            </div>
        </form>
    );
}

export default AgentGestionForm;

AgentGestionForm.propTypes = {
    registro: PropTypes.object,
    onSubmit: PropTypes.func.isRequired,
    levels: PropTypes.arrayOf(PropTypes.object).isRequired,
    level1Seleccionado: PropTypes.string.isRequired,
    level2Seleccionado: PropTypes.string.isRequired,
    onLevel1Change: PropTypes.func.isRequired,
    onLevel2Change: PropTypes.func.isRequired,
    telefonos: PropTypes.arrayOf(PropTypes.string).isRequired,
    telefonoSeleccionado: PropTypes.string.isRequired,
    onTelefonoChange: PropTypes.func.isRequired,
    estadoTelefonos: PropTypes.arrayOf(PropTypes.string).isRequired,
    estadoTelefonoSeleccionado: PropTypes.string.isRequired,
    onEstadoTelefonoChange: PropTypes.func.isRequired,
    observacion: PropTypes.string.isRequired,
    onObservacionChange: PropTypes.func.isRequired,
    onNoContestaClick: PropTypes.func.isRequired,
    onGrabadoraClick: PropTypes.func.isRequired,
    onContestaTerceroClick: PropTypes.func.isRequired,
    dynamicFormConfig: PropTypes.shape({
        title: PropTypes.string,
        rows: PropTypes.arrayOf(
            PropTypes.arrayOf(
                PropTypes.shape({
                    key: PropTypes.string,
                    label: PropTypes.string,
                }),
            ),
        ),
    }),
    dynamicSurveyConfig: PropTypes.shape({
        title: PropTypes.string,
        fields: PropTypes.arrayOf(PropTypes.object),
    }),
    surveyFieldsToRender: PropTypes.arrayOf(PropTypes.object).isRequired,
    surveyAnswers: PropTypes.object.isRequired,
    onSurveyFieldChange: PropTypes.func.isRequired,
    user: PropTypes.shape({
        full_name: PropTypes.string,
        name: PropTypes.string,
        username: PropTypes.string,
    }),
};
