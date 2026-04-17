import PropTypes from "prop-types";
import { chunkArray, getDynamicWidth } from "./agentGestionForm.helpers";
import {
    getFieldBehavior,
    transformFieldValue,
} from "../../../utils/formFieldBehavior";

function getStandardFieldSpan({ field, label, textValue, editable }) {
    const normalizedType = String(field?.type || "text").trim().toLowerCase();
    const normalizedLabel = String(label || "").trim().toLowerCase();

    if (normalizedType === "textarea") {
        return 10;
    }

    if (
        !editable &&
        /nombre|apellidos|cliente|razon social/.test(normalizedLabel)
    ) {
        return 8;
    }

    if (editable && normalizedType === "select") {
        return 4;
    }

    const estimatedWidth = Math.max(
        Math.min(Math.max(textValue.length * 7 + 34, 78), 320),
        Math.min(Math.max(label.length * 7 + 34, 78), 260),
    );

    if (estimatedWidth >= 300) return 8;
    if (estimatedWidth >= 240) return 6;
    if (estimatedWidth >= 180) return 5;
    if (estimatedWidth >= 130) return 4;
    if (estimatedWidth >= 95) return 3;
    return 2;
}

function getStandardFieldWidth({ field, label, textValue, editable }) {
    const normalizedType = String(field?.type || "text").trim().toLowerCase();
    const normalizedLabel = String(label || "").trim().toLowerCase();
    const labelWidth = Math.min(
        Math.max(label.length * 7 + 28, 86),
        220,
    );
    const valueWidth = Math.min(
        Math.max(textValue.length * 7 + 42, 96),
        560,
    );

    if (normalizedType === "textarea") {
        return 360;
    }

    if (
        !editable &&
        /nombre|apellidos|cliente|razon social/.test(normalizedLabel)
    ) {
        return 320;
    }

    if (editable && normalizedType === "select") {
        return Math.max(labelWidth, 180);
    }

    return Math.max(labelWidth, valueWidth, 132);
}

function renderEditableInput(
    field,
    value,
    onFieldChange,
    readOnly = false,
    variant = "standard",
) {
    const normalizedType = String(field?.type || "text").trim().toLowerCase();
    const normalizedKey = String(field?.key || "").trim().toLowerCase();
    const normalizedLabel = String(field?.label || "").trim().toLowerCase();
    const behavior = getFieldBehavior(field);
    const isRequired = Boolean(field?.required);
    const isDisabled = Boolean(field?.disabled);
    const isRedesIdentificationField =
        variant === "redes" &&
        (normalizedKey === "identificacion" ||
            normalizedLabel === "identificacion");
    const suggestions = isRedesIdentificationField
        ? [...new Set(["0999999999", ...(behavior.suggestions || [])])]
        : behavior.suggestions;
    const resolvedMaxLength = isRedesIdentificationField
        ? 10
        : field.maxLength || undefined;
    const datalistId =
        suggestions.length > 0
            ? `agent-dynamic-list-${String(field.key || field.name || "field")}`
            : null;

    if (readOnly) {
        if (normalizedType === "textarea") {
            return (
                <textarea
                    className="agent-input agent-survey-input"
                    value={value}
                    readOnly
                />
            );
        }

        return (
            <input
                type="text"
                className="agent-input agent-survey-input"
                value={value}
                readOnly
            />
        );
    }

    if (normalizedType === "select") {
        return (
            <select
                className="agent-input agent-survey-input"
                value={value}
                required={isRequired}
                disabled={isDisabled}
                onChange={(event) => onFieldChange(event.target.value)}
            >
                <option value="">Selecciona...</option>
                {(field.options || []).map((option) => {
                    const optionValue =
                        typeof option === "string"
                            ? option
                            : option?.value || option?.label || "";
                    const optionLabel =
                        typeof option === "string"
                            ? option
                            : option?.label || option?.value || "";

                    return (
                        <option key={optionValue} value={optionValue}>
                            {optionLabel}
                        </option>
                    );
                })}
            </select>
        );
    }

    if (normalizedType === "radio") {
        return (
            <div className="agent-radio-group">
                {(field.options || []).map((option) => {
                    const optionValue =
                        typeof option === "string"
                            ? option
                            : option?.value || option?.label || "";
                    const optionLabel =
                        typeof option === "string"
                            ? option
                            : option?.label || option?.value || "";

                    return (
                        <label key={optionValue} className="agent-radio-option">
                            <input
                                type="radio"
                                name={field.key}
                                value={optionValue}
                                required={isRequired}
                                disabled={isDisabled}
                                checked={String(value) === String(optionValue)}
                                onChange={(event) =>
                                    onFieldChange(event.target.value)
                                }
                            />
                            <span>{optionLabel}</span>
                        </label>
                    );
                })}
            </div>
        );
    }

    if (normalizedType === "textarea") {
        return (
            <>
                <textarea
                    className="agent-input agent-survey-input"
                    maxLength={resolvedMaxLength}
                value={value}
                required={isRequired}
                disabled={isDisabled}
                onChange={(event) =>
                    onFieldChange(
                        transformFieldValue(
                                field,
                                event.target.value,
                                "textarea",
                            ),
                        )
                    }
                />
                {datalistId && (
                    <datalist id={datalistId}>
                        {suggestions.map((suggestion) => (
                            <option key={suggestion} value={suggestion} />
                        ))}
                    </datalist>
                )}
            </>
        );
    }

    const inputType =
        normalizedType === "number"
            ? "number"
            : normalizedType === "date"
              ? "date"
              : "text";

    return (
        <>
            <input
                type={inputType}
                className="agent-input agent-survey-input"
                maxLength={resolvedMaxLength}
                value={value}
                required={isRequired}
                disabled={isDisabled}
                onChange={(event) =>
                    onFieldChange(
                        transformFieldValue(field, event.target.value, inputType),
                    )
                }
                inputMode={behavior.inputMode}
                list={datalistId || undefined}
            />
            {datalistId && (
                <datalist id={datalistId}>
                    {suggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                    ))}
                </datalist>
            )}
        </>
    );
}

function DynamicField({ field, value, editable, onFieldChange, variant }) {
    const textValue = String(value ?? "");
    const label = String(field?.label || "");
    const normalizedLabel = label.trim().toLowerCase();
    const normalizedKey = String(field?.key || "").trim().toLowerCase();
    const explicitReadOnly = field?.readOnly === true;
    const isTicketField =
        variant === "inbound" &&
        (normalizedKey === "campo5" ||
            normalizedKey === "ticketid" ||
            normalizedKey === "idllamada" ||
            /ticket|id llamada|nro\. ticket/.test(normalizedLabel));
    const isReadOnlyField = explicitReadOnly || isTicketField;
    const isLong = textValue.length > 28 || label.length > 28;
    const shouldUseStandardTextarea =
        variant === "standard" &&
        !editable &&
        (/nombre|apellidos|cliente|razon social/.test(normalizedLabel) ||
            textValue.length > 42);
    const fieldClassName = [
        "agent-form-field",
        variant === "standard" ? "agent-form-field--standard" : "",
    ]
        .filter(Boolean)
        .join(" ");
    const fieldStyle =
        variant === "standard"
            ? {
                  "--agent-standard-span": getStandardFieldSpan({
                      field,
                      label,
                      textValue,
                      editable,
                  }),
                  "--agent-standard-width": `${getStandardFieldWidth({
                      field,
                      label,
                      textValue,
                      editable,
                  })}px`,
              }
            : undefined;

    return (
        <div className={fieldClassName} style={fieldStyle}>
            <span className="agent-dynamic-label">
                {label}
                {field?.required ? (
                    <span style={{ color: "red" }}> *</span>
                ) : null}
            </span>
            {editable ? (
                renderEditableInput(
                    field,
                    textValue,
                    onFieldChange,
                    isReadOnlyField,
                    variant,
                )
            ) : shouldUseStandardTextarea || isLong ? (
                <textarea
                    className="agent-input agent-auto-textarea"
                    value={textValue}
                    readOnly
                    rows={Math.min(
                        8,
                        Math.max(
                            shouldUseStandardTextarea ? 3 : 2,
                            Math.ceil(textValue.length / 60),
                        ),
                    )}
                    style={
                        variant === "standard" || variant === "redes"
                            ? undefined
                            : { width: `${getDynamicWidth(textValue)}px` }
                    }
                />
            ) : (
                <input
                    type="text"
                    value={textValue}
                    className="agent-input agent-auto-input"
                    readOnly
                    style={
                        variant === "standard" || variant === "redes"
                            ? undefined
                            : { width: `${getDynamicWidth(textValue)}px` }
                    }
                />
            )}
        </div>
    );
}

DynamicField.propTypes = {
    field: PropTypes.shape({
        label: PropTypes.string,
        type: PropTypes.string,
        options: PropTypes.array,
        maxLength: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    editable: PropTypes.bool,
    onFieldChange: PropTypes.func,
    variant: PropTypes.oneOf([
        "standard",
        "inbound",
        "inbound-editable-ticket",
        "redes",
    ]),
};

export default function AgentGestionDynamicSection({
    title,
    headerTitle,
    rows,
    extraFields,
    getFieldValue,
    editable = false,
    values = {},
    onFieldChange,
    variant = "standard",
}) {
    const sectionClassName = [
        "agent-form-card",
        "agent-form-card--secondary",
        "agent-dynamic-card",
        `agent-dynamic-card--${variant}`,
    ].join(" ");
    const dynamicSectionClassName = [
        "agent-dynamic-section",
        `agent-dynamic-section--${variant}`,
    ].join(" ");
    const dynamicRowClassName = [
        "agent-dynamic-row",
        `agent-dynamic-row--${variant}`,
    ].join(" ");
    const standardFields = [...rows.flat(), ...extraFields.flat()];
    const normalizedExtraRows =
        variant === "redes" ? chunkArray(extraFields.flat(), 3) : extraFields;

    return (
        <section className={sectionClassName}>
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">
                    {headerTitle || `Formulario 2 - ${title}`}
                </p>
            </div>
            <div className={dynamicSectionClassName}>
                {variant === "standard" ? (
                    <div className={dynamicRowClassName}>
                        {standardFields.map((field) => (
                            <DynamicField
                                key={field.key}
                                field={field}
                                value={
                                    editable
                                        ? values?.[field.key] ||
                                          String(field?.value || "")
                                        : getFieldValue(field.key)
                                }
                                editable={editable}
                                variant={variant}
                                onFieldChange={(nextValue) =>
                                    onFieldChange?.(field.key, nextValue)
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        {rows.map((rowFields) => (
                            <div
                                key={`row-${rowFields.map((field) => field.key).join("-")}`}
                                className={dynamicRowClassName}
                            >
                                {rowFields.map((field) => (
                                    <DynamicField
                                        key={field.key}
                                        field={field}
                                        value={
                                            editable
                                                ? values?.[field.key] ||
                                                  String(field?.value || "")
                                                : getFieldValue(field.key)
                                        }
                                        editable={editable}
                                        variant={variant}
                                        onFieldChange={(nextValue) =>
                                            onFieldChange?.(field.key, nextValue)
                                        }
                                    />
                                ))}
                            </div>
                        ))}

                        {normalizedExtraRows.map((row, index) => (
                            <div
                                key={`extra-row-${index}`}
                                className={dynamicRowClassName}
                            >
                                {row.map((field) => (
                                    <DynamicField
                                        key={field.key}
                                        field={field}
                                        value={field.value}
                                        editable={false}
                                        variant={variant}
                                    />
                                ))}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </section>
    );
}

AgentGestionDynamicSection.propTypes = {
    title: PropTypes.string,
    headerTitle: PropTypes.string,
    rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    extraFields: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    getFieldValue: PropTypes.func.isRequired,
    editable: PropTypes.bool,
    values: PropTypes.object,
    onFieldChange: PropTypes.func,
    variant: PropTypes.oneOf([
        "standard",
        "inbound",
        "inbound-editable-ticket",
        "redes",
    ]),
};
