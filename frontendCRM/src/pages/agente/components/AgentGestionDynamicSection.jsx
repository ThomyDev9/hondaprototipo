import PropTypes from "prop-types";
import { getDynamicWidth } from "./agentGestionForm.helpers";

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

function renderEditableInput(field, value, onFieldChange) {
    const normalizedType = String(field?.type || "text").trim().toLowerCase();

    if (normalizedType === "select") {
        return (
            <select
                className="agent-input agent-survey-input"
                value={value}
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
            <textarea
                className="agent-input agent-survey-input"
                maxLength={field.maxLength || undefined}
                value={value}
                onChange={(event) => onFieldChange(event.target.value)}
            />
        );
    }

    const inputType =
        normalizedType === "number"
            ? "number"
            : normalizedType === "date"
              ? "date"
              : "text";

    return (
        <input
            type={inputType}
            className="agent-input agent-survey-input"
            maxLength={field.maxLength || undefined}
            value={value}
            onChange={(event) => onFieldChange(event.target.value)}
        />
    );
}

function DynamicField({ field, value, editable, onFieldChange, variant }) {
    const textValue = String(value ?? "");
    const label = String(field?.label || "");
    const normalizedLabel = label.trim().toLowerCase();
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
            <span className="agent-dynamic-label">{label}</span>
            {editable ? (
                renderEditableInput(field, textValue, onFieldChange)
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
                        variant === "standard"
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
                        variant === "standard"
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
    variant: PropTypes.oneOf(["standard", "inbound"]),
};

export default function AgentGestionDynamicSection({
    title,
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

    return (
        <section className={sectionClassName}>
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">Formulario 2 - {title}</p>
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
                                        ? values?.[field.key] || ""
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
                                                ? values?.[field.key] || ""
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

                        {extraFields.map((row, index) => (
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
    rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    extraFields: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    getFieldValue: PropTypes.func.isRequired,
    editable: PropTypes.bool,
    values: PropTypes.object,
    onFieldChange: PropTypes.func,
    variant: PropTypes.oneOf(["standard", "inbound"]),
};
