import React from "react";

export default function FormularioDinamicoReseteable({
    template,
    onGuardar,
    onActualizar,
    initialValues,
    esUpdate = false,
    levels = [],
}) {
    const [form, setForm] = React.useState(() => {
        const initial = {};
        template.forEach(
            (f) => (initial[f.name] = initialValues?.[f.name] || ""),
        );
        return initial;
    });

    React.useEffect(() => {
        if (!initialValues?.identificacion) return;
        const initial = {};
        template.forEach(
            (f) => (initial[f.name] = initialValues?.[f.name] || ""),
        );
        setForm(initial);
        // eslint-disable-next-line
    }, [initialValues?.identificacion]);

    const [submotivos, setSubmotivos] = React.useState([]);

    React.useEffect(() => {
        const motivo = form.motivoInteraccion;
        if (!motivo || !levels) {
            setSubmotivos([]);
            return;
        }
        const normalizedMotivo = motivo.trim().toLowerCase();
        const filteredLevels = levels.filter(
            (n) =>
                n.level1 && n.level1.trim().toLowerCase() === normalizedMotivo,
        );
        const level2s = filteredLevels.map((n) => n.level2).filter(Boolean);
        setSubmotivos([...new Set(level2s)]);
    }, [form.motivoInteraccion, levels]);

    const handleChange = (e, customOnChange) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        if (typeof customOnChange === "function") {
            customOnChange(e);
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

    return (
        <form className="outhonda-form outhonda-form-3col">
            {template.map((field) => {
                if (typeof field.showIf === "function" && !field.showIf(form)) {
                    return null;
                }
                return (
                    <div key={field.name} className="outhonda-form-field">
                        <label className="outhonda-form-label">
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
                                onChange={(e) =>
                                    handleChange(e, field.onChange)
                                }
                                required={field.required}
                                className="outhonda-form-input"
                            />
                        )}
                        {field.type === "datetime-local" && (
                            <input
                                type="datetime-local"
                                name={field.name}
                                value={form[field.name]}
                                onChange={(e) =>
                                    handleChange(e, field.onChange)
                                }
                                required={field.required}
                                className="outhonda-form-input"
                            />
                        )}
                        {field.type === "select" &&
                        field.name === "submotivoInteraccion" ? (
                            <select
                                name={field.name}
                                value={form[field.name]}
                                onChange={(e) =>
                                    handleChange(e, field.onChange)
                                }
                                required={field.required}
                                className="outhonda-form-select"
                            >
                                <option value="">Seleccione...</option>
                                {submotivos.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                        ) : field.type === "select" ? (
                            <select
                                name={field.name}
                                value={form[field.name]}
                                onChange={(e) =>
                                    handleChange(e, field.onChange)
                                }
                                required={field.required}
                                className="outhonda-form-select"
                            >
                                <option value="">Seleccione...</option>
                                {field.options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                        {field.type === "textarea" && (
                            <textarea
                                name={field.name}
                                value={form[field.name]}
                                onChange={(e) =>
                                    handleChange(e, field.onChange)
                                }
                                required={field.required}
                                className="outhonda-form-textarea"
                            />
                        )}
                    </div>
                );
            })}
            <div>
                {esUpdate ? (
                    <button type="button" onClick={handleActualizar}>
                        Actualizar
                    </button>
                ) : (
                    <button type="button" onClick={handleGuardar}>
                        Guardar
                    </button>
                )}
            </div>
        </form>
    );
}
