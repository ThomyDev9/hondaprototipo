import PropTypes from "prop-types";
import { getDynamicWidth } from "./agentGestionForm.helpers";

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
            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                    minHeight: "40px",
                    alignItems: "center",
                }}
            >
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
                        <label
                            key={optionValue}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                color: "#0f172a",
                                fontSize: "0.9rem",
                            }}
                        >
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

function DynamicField({ field, value, editable, onFieldChange }) {
    const textValue = String(value ?? "");
    const label = String(field?.label || "");
    const isLong = textValue.length > 28 || label.length > 28;

    return (
        <div className="agent-form-field">
            <span className="agent-dynamic-label">{label}</span>
            {editable ? (
                renderEditableInput(field, textValue, onFieldChange)
            ) : isLong ? (
                <textarea
                    className="agent-input agent-auto-textarea"
                    value={textValue}
                    readOnly
                    rows={Math.min(8, Math.max(2, Math.ceil(textValue.length / 60)))}
                    style={{ width: `${getDynamicWidth(textValue)}px` }}
                />
            ) : (
                <input
                    type="text"
                    value={textValue}
                    className="agent-input agent-auto-input"
                    readOnly
                    style={{ width: `${getDynamicWidth(textValue)}px` }}
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
};

export default function AgentGestionDynamicSection({
    title,
    rows,
    extraFields,
    getFieldValue,
    editable = false,
    values = {},
    onFieldChange,
}) {
    return (
        <section className="agent-form-card agent-form-card--secondary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">Formulario 2 - {title}</p>
            </div>
            <div className="agent-dynamic-section">
                {rows.map((rowFields) => (
                    <div
                        key={`row-${rowFields.map((field) => field.key).join("-")}`}
                        className="agent-dynamic-row"
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
                                onFieldChange={(nextValue) =>
                                    onFieldChange?.(field.key, nextValue)
                                }
                            />
                        ))}
                    </div>
                ))}

                {extraFields.map((row, index) => (
                    <div key={`extra-row-${index}`} className="agent-dynamic-row">
                        {row.map((field) => (
                            <DynamicField
                                key={field.key}
                                field={field}
                                value={field.value}
                                editable={false}
                            />
                        ))}
                    </div>
                ))}
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
};
