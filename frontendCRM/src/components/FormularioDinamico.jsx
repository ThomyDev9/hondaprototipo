import React from "react";
import "./FormularioDinamico.css";

export default function FormularioDinamico({
    template,
    onGuardar,
    onActualizar,
    onCancelar,
    initialValues,
    esUpdate = false,
    onChangeCampo,
    quickActions = [],
}) {
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
    }, [initialValues]);

    const handleChange = (e, customOnChange) => {
        const { name, value, type, checked } = e.target;
        const resolvedValue = type === "checkbox" ? checked : value;
        setForm((f) => ({ ...f, [name]: resolvedValue }));
        if (typeof customOnChange === "function") {
            customOnChange(e);
        }
        if (typeof onChangeCampo === "function") {
            onChangeCampo(name, resolvedValue);
        }
    };

    const handleGuardar = (e) => {
        e.preventDefault();
        onGuardar?.(form);
    };
    const handleActualizar = (e) => {
        e.preventDefault();
        onActualizar?.(form);
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

    return (
        <form className="formulario-dinamico">
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
            {template.map((field) => (
                <div key={field.name} className="formulario-dinamico__field">
                    <label className="formulario-dinamico__label">
                        {field.label}
                        {field.required && (
                            <span style={{ color: "red" }}> *</span>
                        )}
                    </label>
                    {field.type === "text" && (
                        <input
                            type="text"
                            name={field.name}
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="formulario-dinamico__input"
                            readOnly={field.readOnly}
                        />
                    )}
                    {field.type === "number" && (
                        <input
                            type="number"
                            name={field.name}
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="formulario-dinamico__input"
                        />
                    )}
                    {field.type === "date" && (
                        <input
                            type="date"
                            name={field.name}
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="formulario-dinamico__input"
                        />
                    )}
                    {field.type === "select" && (
                        <select
                            name={field.name}
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
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
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="formulario-dinamico__textarea"
                            readOnly={field.readOnly}
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
                </div>
            ))}
            <div className="formulario-dinamico__actions">
                <button
                    type="button"
                    className="formulario-dinamico__submit"
                    onClick={esUpdate ? handleActualizar : handleGuardar}
                >
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
