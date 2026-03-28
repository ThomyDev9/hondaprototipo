import PropTypes from "prop-types";

function SurveyInput({ field, value, onChange }) {
    if (field.type === "select") {
        return (
            <select
                className="agent-input agent-survey-input"
                value={value}
                onChange={onChange}
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
            <div className="agent-input agent-survey-input agent-survey-readonly">
                {field.label}
            </div>
        );
    }

    if (field.type === "textarea") {
        return (
            <textarea
                className="agent-input agent-survey-input"
                maxLength={field.maxLength || undefined}
                value={value}
                onChange={onChange}
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
            value={value}
            onChange={onChange}
        />
    );
}

SurveyInput.propTypes = {
    field: PropTypes.object.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    onChange: PropTypes.func.isRequired,
};

export default function AgentGestionSurveySection({
    title,
    fields,
    answers,
    onSurveyFieldChange,
}) {
    return (
        <section className="agent-form-card agent-form-card--tertiary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">Formulario 3 - {title}</p>
            </div>
            <div className="agent-survey-grid">
                {fields.map((field) => {
                    const currentValue = answers[field.key] || "";

                    return (
                        <div key={field.key} className="agent-survey-item">
                            <div className="agent-survey-field">
                                <span className="agent-survey-question">
                                    {field.label}
                                </span>
                                <SurveyInput
                                    field={field}
                                    value={currentValue}
                                    onChange={(event) =>
                                        onSurveyFieldChange(
                                            field.key,
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

AgentGestionSurveySection.propTypes = {
    title: PropTypes.string,
    fields: PropTypes.arrayOf(PropTypes.object).isRequired,
    answers: PropTypes.object.isRequired,
    onSurveyFieldChange: PropTypes.func.isRequired,
};
