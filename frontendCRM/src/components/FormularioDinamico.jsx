import React from "react";
import "./FormularioDinamico.css";
import {
    getFieldBehavior,
    transformFieldValue,
} from "../utils/formFieldBehavior";

export default function FormularioDinamico({
    template,
    onGuardar,
    onActualizar,
    onCancelar,
    initialValues,
    esUpdate = false,
    onChangeCampo,
    quickActions = [],
    formAutoComplete,
    variant = "default",
    className = "",
    requireAllFields = false,
}) {
    const initialValuesKey = JSON.stringify(initialValues || {});
    const templateFieldsKey = JSON.stringify(
        Array.isArray(template)
            ? template.map((field) => ({
                  name: field?.name || "",
                  type: field?.type || "text",
              }))
            : [],
    );
    const [form, setForm] = React.useState(() => {
        const initial = {};
        template.forEach((f) => {
            if (f.type === "checkbox") {
                initial[f.name] = Boolean(initialValues?.[f.name]);
                return;
            }
            initial[f.name] = initialValues?.[f.name] ?? "";
        });
        return initial;
    });

    React.useEffect(() => {
        const initial = {};
        template.forEach((f) => {
            if (f.type === "checkbox") {
                initial[f.name] = Boolean(initialValues?.[f.name]);
                return;
            }
            initial[f.name] = initialValues?.[f.name] ?? "";
        });
        setForm(initial);
    }, [initialValuesKey]);

    React.useEffect(() => {
        setForm((prev) => {
            const next = {};
            template.forEach((f) => {
                if (Object.prototype.hasOwnProperty.call(prev, f.name)) {
                    next[f.name] = prev[f.name];
                    return;
                }

                if (f.type === "checkbox") {
                    next[f.name] = Boolean(initialValues?.[f.name]);
                    return;
                }

                next[f.name] = initialValues?.[f.name] ?? "";
            });
            return next;
        });
    }, [templateFieldsKey, initialValuesKey, template]);

    const handleChange = (e, customOnChange) => {
        const { name, value, type, checked } = e.target;
        const field = template.find((item) => item.name === name);
        const rawValue = type === "checkbox" ? checked : value;
        const resolvedValue = transformFieldValue(field, rawValue, type);
        setForm((f) => ({ ...f, [name]: resolvedValue }));
        if (typeof customOnChange === "function") {
            customOnChange(e);
        }
        if (typeof onChangeCampo === "function") {
            onChangeCampo(name, resolvedValue);
        }
    };

    const isFieldRequired = (field) =>
        Boolean(requireAllFields || field?.required);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (esUpdate) {
            onActualizar?.(form);
            return;
        }

        onGuardar?.(form);
    };
    const handleCancelar = (e) => {
        e.preventDefault();
        onCancelar?.();
    };
    const handleQuickAction = (action) => {
        if (typeof action?.apply !== "function") return;

        setForm((prev) => {
            const nextValues = action.apply({ ...prev }) || prev;

            if (typeof onChangeCampo === "function") {
                Object.entries(nextValues).forEach(([name, value]) => {
                    if (prev[name] !== value) {
                        onChangeCampo(name, value);
                    }
                });
            }

            return nextValues;
        });
    };

    const formClassName = [
        "formulario-dinamico",
        `formulario-dinamico--${variant}`,
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const shouldRenderField = (field) => {
        if (typeof field?.visibleWhen !== "function") {
            return true;
        }

        try {
            return Boolean(field.visibleWhen(form));
        } catch {
            return true;
        }
    };

    return (
        <form
            className={formClassName}
            autoComplete={formAutoComplete}
            onSubmit={handleSubmit}
        >
            {quickActions.length > 0 && (
                <div className="formulario-dinamico__quick-actions">
                    {quickActions.map((action) => (
                        <button
                            key={action.id}
                            type="button"
                            className="formulario-dinamico__quick-button"
                            onClick={() => handleQuickAction(action)}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
            {template.filter(shouldRenderField).map((field) => (
                <div key={field.name} className="formulario-dinamico__field">
                    {(() => {
                        const behavior = getFieldBehavior(field);
                        const datalistId =
                            behavior.suggestions.length > 0
                                ? `formulario-dinamico-list-${field.name}`
                                : null;

                        return (
                            <>
                    <label className="formulario-dinamico__label">
                        {field.label}
                        {isFieldRequired(field) && (
                            <span style={{ color: "red" }}> *</span>
                        )}
                    </label>
                    {field.type === "text" && (
                        <input
                            type="text"
                            name={field.name}
                            value={form[field.name] ?? ""}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={isFieldRequired(field)}
                            className="formulario-dinamico__input"
                            readOnly={field.readOnly}
                            inputMode={behavior.inputMode}
                            maxLength={field.maxLength || undefined}
                            list={datalistId || undefined}
                        />
                    )}
                    {field.type === "number" && (
                        <input
                            type="number"
                            name={field.name}
                            value={form[field.name] ?? ""}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={isFieldRequired(field)}
                            className="formulario-dinamico__input"
                            inputMode={behavior.inputMode}
                            maxLength={field.maxLength || undefined}
                        />
                    )}
                    {field.type === "date" && (
                        <input
                            type="date"
                            name={field.name}
                            value={form[field.name] ?? ""}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={isFieldRequired(field)}
                            className="formulario-dinamico__input"
                        />
                    )}
                    {field.type === "select" && (
                        <select
                            name={field.name}
                            value={form[field.name] ?? ""}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={isFieldRequired(field)}
                            className="formulario-dinamico__select"
                        >
                            <option value="">Seleccione...</option>
                            {field.options.map((opt) => (
                                <option
                                    key={opt.value ?? opt}
                                    value={opt.value ?? opt}
                                >
                                    {opt.label ?? opt}
                                </option>
                            ))}
                        </select>
                    )}
                    {field.type === "textarea" && (
                        <textarea
                            name={field.name}
                            value={form[field.name] ?? ""}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={isFieldRequired(field)}
                            className="formulario-dinamico__textarea"
                            readOnly={field.readOnly}
                            maxLength={field.maxLength || undefined}
                        />
                    )}
                    {field.type === "checkbox" && (
                        <label className="formulario-dinamico__checkbox">
                            <input
                                type="checkbox"
                                name={field.name}
                                checked={Boolean(form[field.name])}
                                onChange={(e) => handleChange(e, field.onChange)}
                            />
                            <span style={{ marginLeft: 8 }}>
                                {field.helpText || "Marcar"}
                            </span>
                        </label>
                    )}
                    {datalistId && (
                        <datalist id={datalistId}>
                            {behavior.suggestions.map((suggestion) => (
                                <option key={suggestion} value={suggestion} />
                            ))}
                        </datalist>
                    )}
                            </>
                        );
                    })()}
                </div>
            ))}
            <div className="formulario-dinamico__actions">
                <button type="submit" className="formulario-dinamico__submit">
                    Guardar gestión
                </button>
                <button
                    type="button"
                    className="formulario-dinamico__cancel"
                    onClick={handleCancelar}
                >
                    Cancelar gestión
                </button>
            </div>
        </form>
    );
}
