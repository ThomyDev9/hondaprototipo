import PropTypes from "prop-types";

export default function AgentGestionForm({
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
    dynamicFormConfig,
    dynamicFormDetail,
    dynamicSurveyConfig,
    surveyFieldsToRender,
    surveyAnswers,
    onSurveyFieldChange,
}) {
    if (!registro) return null;

    return (
        <form onSubmit={onSubmit} className="agent-form-grid">
            <div className="agent-form-block agent-form-block-primary">
                <p className="agent-form-block-title">
                    Formulario 1 · Gestión principal
                </p>
                <div
                    className="agent-form-actions"
                    style={{ marginBottom: "0.5rem" }}
                >
                    <button
                        type="button"
                        className="agent-primary-button"
                        onClick={onNoContestaClick}
                    >
                        No contesta
                    </button>
                </div>
                <div className="agent-form-block-grid">
                    <div className="agent-form-field">
                        <label className="agent-label">
                            <span>Resultado gestión - Nivel 1</span>
                            <select
                                value={level1Seleccionado}
                                onChange={(e) => onLevel1Change(e.target.value)}
                                className="agent-input"
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
                                value={level2Seleccionado}
                                onChange={(e) => onLevel2Change(e.target.value)}
                                className="agent-input"
                            >
                                <option value="">Selecciona...</option>
                                {levels
                                    .filter(
                                        (item) =>
                                            item.level1 === level1Seleccionado,
                                    )
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
                            <span>Teléfonos a marcar</span>
                            <select
                                value={telefonoSeleccionado}
                                onChange={(e) =>
                                    onTelefonoChange(e.target.value)
                                }
                                className="agent-input"
                            >
                                <option value="">Selecciona...</option>
                                {telefonos.map((fono) => (
                                    <option key={fono} value={fono}>
                                        {fono}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="agent-form-field">
                        <label className="agent-label">
                            <span>Estados teléfonos</span>
                            <select
                                value={estadoTelefonoSeleccionado}
                                onChange={(e) =>
                                    onEstadoTelefonoChange(e.target.value)
                                }
                                className="agent-input"
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
                                value={observacion}
                                onChange={(e) =>
                                    onObservacionChange(e.target.value)
                                }
                                className="agent-input"
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
            </div>

            {dynamicFormConfig && (
                <div className="agent-form-block agent-form-block-secondary">
                    <p className="agent-form-block-title">
                        Formulario 2 · {dynamicFormConfig.title}
                    </p>
                    <div className="agent-dynamic-section">
                        {dynamicFormConfig.rows.map((rowFields) => (
                            <div
                                key={`row-${rowFields.map((field) => field.key).join("-")}`}
                                className="agent-dynamic-row"
                                style={{
                                    gridTemplateColumns: `repeat(${rowFields.length}, minmax(140px, 1fr))`,
                                }}
                            >
                                {rowFields.map((field) => (
                                    <div
                                        key={field.key}
                                        className="agent-form-field"
                                    >
                                        <label className="agent-label">
                                            <span>{field.label}</span>
                                            <input
                                                type="text"
                                                value={String(
                                                    dynamicFormDetail?.[
                                                        field.key
                                                    ] || "",
                                                )}
                                                className="agent-input"
                                                readOnly
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {dynamicSurveyConfig && (
                <div className="agent-form-block agent-form-block-tertiary">
                    <p className="agent-form-block-title">
                        Formulario 3 · {dynamicSurveyConfig.title}
                    </p>

                    <div className="agent-survey-grid">
                        {surveyFieldsToRender.map((field) => (
                            <div key={field.key} className="agent-survey-item">
                                <label className="agent-label">
                                    <span>{field.label}</span>

                                    {field.type === "select" ? (
                                        <select
                                            className="agent-input agent-survey-input"
                                            value={
                                                surveyAnswers[field.key] || ""
                                            }
                                            onChange={(e) =>
                                                onSurveyFieldChange(
                                                    field.key,
                                                    e.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Selecciona...
                                            </option>
                                            {field.options?.map((option) => (
                                                <option
                                                    key={option}
                                                    value={option}
                                                >
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type}
                                            className="agent-input agent-survey-input"
                                            maxLength={
                                                field.maxLength || undefined
                                            }
                                            value={
                                                surveyAnswers[field.key] || ""
                                            }
                                            onChange={(e) =>
                                                onSurveyFieldChange(
                                                    field.key,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    )}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="agent-form-actions">
                <button type="submit" className="agent-primary-button">
                    Guardar gestión
                </button>
            </div>
        </form>
    );
}

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
    dynamicFormDetail: PropTypes.object,
    dynamicSurveyConfig: PropTypes.shape({
        title: PropTypes.string,
        fields: PropTypes.arrayOf(PropTypes.object),
    }),
    surveyFieldsToRender: PropTypes.arrayOf(PropTypes.object).isRequired,
    surveyAnswers: PropTypes.object.isRequired,
    onSurveyFieldChange: PropTypes.func.isRequired,
};
