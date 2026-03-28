import PropTypes from "prop-types";
import { getDynamicWidth } from "./agentGestionForm.helpers";

function DynamicField({ label, value }) {
    const textValue = String(value ?? "");
    const isLong = textValue.length > 28 || label.length > 28;

    return (
        <div className="agent-form-field">
            <span className="agent-dynamic-label">{label}</span>
            {isLong ? (
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
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default function AgentGestionDynamicSection({
    title,
    rows,
    extraFields,
    getFieldValue,
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
                                label={field.label}
                                value={getFieldValue(field.key)}
                            />
                        ))}
                    </div>
                ))}

                {extraFields.map((row, index) => (
                    <div key={`extra-row-${index}`} className="agent-dynamic-row">
                        {row.map((field) => (
                            <DynamicField
                                key={field.key}
                                label={field.label}
                                value={field.value}
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
};
