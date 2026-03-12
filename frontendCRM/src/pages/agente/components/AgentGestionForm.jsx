import "./AgentGestionForm.css";
import PropTypes from "prop-types";
// Para copiar al portapapeles
import { useEffect, useRef } from "react";

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
}) {
    // Referencia para saber si es la primera vez que se monta
    const firstRender = useRef(true);

    // Copiar automáticamente el teléfono seleccionado al portapapeles
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (telefonoSeleccionado) {
            // Intentar usar la API moderna
            if (
                navigator &&
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {
                navigator.clipboard.writeText(telefonoSeleccionado);
            } else {
                // Fallback para navegadores antiguos
                const tempInput = document.createElement("input");
                tempInput.value = telefonoSeleccionado;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand("copy");
                document.body.removeChild(tempInput);
            }
        }
    }, [telefonoSeleccionado]);
    // Derivar filas y función para F2
    let dynamicFormRowsWithValues = [];
    let getDynamicFormValue = () => "";
    if (dynamicFormConfig && dynamicFormConfig.rows && dynamicFormDetail) {
        // Aplanar todos los campos de la plantilla que tengan valor no vacío
        const allFields = dynamicFormConfig.rows.flat().filter((field) => {
            const val = dynamicFormDetail[field.key];
            return val !== undefined && val !== null && val !== "";
        });
        // Agrupar en filas de máximo 6 columnas
        const MAX_COLS = 6;
        dynamicFormRowsWithValues = [];
        for (let i = 0; i < allFields.length; i += MAX_COLS) {
            dynamicFormRowsWithValues.push(allFields.slice(i, i + MAX_COLS));
        }
        getDynamicFormValue = (key) => dynamicFormDetail[key] ?? "";
    }

    // Solo mostrar campos adicionales de CamposAdicionalesJson (ej: CAMPO11, CAMPO12, ...)
    let extraFields = [];
    if (dynamicFormDetail && dynamicFormDetail.CamposAdicionalesJson) {
        let adicionales = {};
        try {
            adicionales = JSON.parse(dynamicFormDetail.CamposAdicionalesJson);
        } catch {}
        const allFields = Object.entries(adicionales)
            .filter(
                ([key, val]) => val !== undefined && val !== null && val !== "",
            )
            .map(([key, val]) => ({ key, label: key, value: val }));
        // Agrupar en filas de máximo 6 columnas para aprovechar mejor el espacio
        const MAX_COLS = 6;
        extraFields = [];
        for (let i = 0; i < allFields.length; i += MAX_COLS) {
            extraFields.push(allFields.slice(i, i + MAX_COLS));
        }
    }
    return (
        <form onSubmit={onSubmit} style={{ width: "95%" }}>
            {/* Bloque F1 */}
            <div
                style={{
                    width: "100%",
                    background: "#aea7a7",
                    borderRadius: "10px",
                    boxShadow: "0 1px 4px 0 rgba(15,23,42,0.04)",
                    padding: "0.6rem 0.7rem 0.6rem 0.7rem",
                    border: "1px solid #e5e7eb",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.4rem",
                    }}
                >
                    <h4
                        className="agent-form-block-title"
                        style={{
                            fontSize: "1.02rem",
                            fontWeight: 600,
                            lineHeight: 1.2,
                        }}
                    >
                        Formulario 1
                    </h4>
                    <div style={{ display: "flex" }}>
                        <button
                            type="button"
                            className="agent-primary-button"
                            style={{
                                fontSize: "0.92em",

                                minWidth: 0,
                            }}
                            onClick={onNoContestaClick}
                        >
                            No contesta
                        </button>
                        <button
                            type="button"
                            className="agent-primary-button"
                            style={{
                                fontSize: "0.92em",
                                padding: "0.28em 0.8em",
                                minWidth: 0,
                            }}
                            onClick={onGrabadoraClick}
                        >
                            Grabadora
                        </button>
                        <button
                            type="button"
                            className="agent-primary-button"
                            style={{
                                fontSize: "0.92em",
                                padding: "0.28em 0.8em",
                                minWidth: 0,
                            }}
                            onClick={onContestaTerceroClick}
                        >
                            Contesta tercero
                        </button>
                    </div>
                </div>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "0.3rem",
                        alignItems: "center",
                    }}
                >
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
                            {telefonoSeleccionado && (
                                <span
                                    style={{
                                        color: "#16a34a",
                                        fontSize: "0.95em",
                                    }}
                                >
                                    Copiado al portapapeles
                                </span>
                            )}
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

            {/* Bloque F2 */}
            {dynamicFormConfig && dynamicFormRowsWithValues.length > 0 && (
                <div
                    className="agent-form-block agent-form-block-secondary"
                    style={{
                        width: "100%",
                        background: "#f3f4f6",
                        borderRadius: "10px",
                        boxShadow: "0 1px 4px 0 rgba(15,23,42,0.03)",
                        padding: "0.7rem 0.8rem 0.7rem 0.8rem",
                        border: "1px solid #d1d5db",
                    }}
                >
                    <p className="agent-form-block-title">
                        Formulario 2 · {dynamicFormConfig.title}
                    </p>
                    <div className="agent-dynamic-section">
                        {dynamicFormRowsWithValues.map((rowFields) => (
                            <div
                                key={`row-${rowFields.map((field) => field.key).join("-")}`}
                                className="agent-dynamic-row"
                                style={{
                                    gridTemplateColumns: `repeat(${rowFields.length}, minmax(100px, 1fr))`,
                                }}
                            >
                                {rowFields.map((field) => {
                                    const value = String(
                                        getDynamicFormValue(field.key),
                                    );
                                    // Si el texto es largo o el label es largo, usar textarea
                                    const isLong =
                                        value.length > 28 ||
                                        field.label.length > 28;
                                    return (
                                        <div
                                            key={field.key}
                                            className="agent-form-field"
                                        >
                                            <div className="agent-label">
                                                <span>{field.label}</span>
                                            </div>
                                            {isLong ? (
                                                <textarea
                                                    className="agent-input agent-auto-textarea"
                                                    value={value}
                                                    readOnly
                                                    rows={Math.min(
                                                        8,
                                                        Math.max(
                                                            2,
                                                            Math.ceil(
                                                                value.length /
                                                                    60,
                                                            ),
                                                        ),
                                                    )}
                                                    style={{
                                                        minWidth: 120,
                                                        maxWidth: 340,
                                                        resize: "vertical",
                                                    }}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={value}
                                                    className="agent-input agent-auto-input"
                                                    readOnly
                                                    style={{
                                                        width: `${Math.max(6, Math.min(28, value.length)) * 0.62 + 2}em`,
                                                        minWidth: "60px",
                                                        maxWidth: "100%",
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
                                <div
                                    key={`extra-row-${idx}`}
                                    className="agent-dynamic-row"
                                    style={{
                                        gridTemplateColumns: `repeat(${row.length}, minmax(110px, 1fr))`,
                                    }}
                                >
                                    {row.map((field) => {
                                        const value = String(field.value);
                                        const isLong = value.length > 80;
                                        return (
                                            <div
                                                key={field.key}
                                                className="agent-form-field"
                                            >
                                                <div className="agent-label">
                                                    <span>{field.label}</span>
                                                </div>
                                                {isLong ? (
                                                    <textarea
                                                        className="agent-input agent-auto-textarea"
                                                        value={value}
                                                        readOnly
                                                        rows={Math.min(
                                                            8,
                                                            Math.max(
                                                                2,
                                                                Math.ceil(
                                                                    value.length /
                                                                        60,
                                                                ),
                                                            ),
                                                        )}
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        className="agent-input agent-auto-input"
                                                        readOnly
                                                        style={{
                                                            width: `${Math.max(6, Math.min(28, value.length)) * 0.62 + 2}em`,
                                                            minWidth: "60px",
                                                            maxWidth: "100%",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Bloque F3 */}
            {dynamicSurveyConfig && (
                <div
                    className="agent-form-block agent-form-block-tertiary"
                    style={{
                        width: "100%",
                        background: "#e0f2fe",
                        borderRadius: "10px",
                        boxShadow: "0 1px 4px 0 rgba(15,23,42,0.03)",
                        padding: "0.7rem 0.8rem 0.7rem 0.8rem",
                        border: "1px solid #38bdf8",
                    }}
                >
                    <p className="agent-form-block-title">
                        Formulario 3 · {dynamicSurveyConfig.title}
                    </p>

                    <div className="agent-survey-grid">
                        {surveyFieldsToRender.map((field) => (
                            <div
                                key={field.key}
                                className="agent-survey-item"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.7em",
                                }}
                            >
                                <label
                                    className="agent-label"
                                    style={{
                                        flex: 1,
                                        fontWeight: 500,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.7em",
                                    }}
                                >
                                    <span
                                        style={{
                                            whiteSpace: "pre-line",
                                            minWidth: 120,
                                        }}
                                    >
                                        {field.label}
                                    </span>
                                    {(() => {
                                        const currentValue =
                                            surveyAnswers[field.key] || "";
                                        const handleChange = (e) =>
                                            onSurveyFieldChange(
                                                field.key,
                                                e.target.value,
                                            );
                                        if (field.type === "select") {
                                            return (
                                                <select
                                                    className="agent-input agent-survey-input"
                                                    value={currentValue}
                                                    onChange={handleChange}
                                                    style={{
                                                        minWidth: 120,
                                                        maxWidth: 220,
                                                    }}
                                                >
                                                    <option value="">
                                                        Selecciona...
                                                    </option>
                                                    {field.options?.map(
                                                        (option) => (
                                                            <option
                                                                key={option}
                                                                value={option}
                                                            >
                                                                {option}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            );
                                        }
                                        if (field.type === "label") {
                                            return (
                                                <div
                                                    className="agent-input agent-survey-input"
                                                    style={{
                                                        backgroundColor:
                                                            "#f8fafc",
                                                        color: "#475569",
                                                        minWidth: 120,
                                                    }}
                                                >
                                                    {field.label}
                                                </div>
                                            );
                                        }
                                        if (field.type === "textarea") {
                                            return (
                                                <textarea
                                                    className="agent-input agent-survey-input"
                                                    maxLength={
                                                        field.maxLength ||
                                                        undefined
                                                    }
                                                    value={currentValue}
                                                    onChange={handleChange}
                                                    style={{
                                                        minWidth: 120,
                                                        maxWidth: 220,
                                                    }}
                                                />
                                            );
                                        }
                                        let inputType = "text";
                                        if (field.type === "datetime-local")
                                            inputType = "datetime-local";
                                        else if (field.type === "date")
                                            inputType = "date";
                                        else if (field.type === "number")
                                            inputType = "number";
                                        return (
                                            <input
                                                type={inputType}
                                                className="agent-input agent-survey-input"
                                                maxLength={
                                                    field.maxLength || undefined
                                                }
                                                value={currentValue}
                                                onChange={handleChange}
                                                style={{
                                                    minWidth: 120,
                                                    maxWidth: 220,
                                                }}
                                            />
                                        );
                                    })()}
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
};
