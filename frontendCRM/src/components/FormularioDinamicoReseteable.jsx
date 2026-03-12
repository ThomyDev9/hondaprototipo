import React from "react";

export default function FormularioDinamicoReseteable({
    template,
    onGuardar,
    onActualizar,
    initialValues,
    esUpdate = false,
}) {
    const [form, setForm] = React.useState(() => {
        const initial = {};
        template.forEach(
            (f) => (initial[f.name] = initialValues?.[f.name] || ""),
        );
        return initial;
    });

    React.useEffect(() => {
        const initial = {};
        template.forEach(
            (f) => (initial[f.name] = initialValues?.[f.name] || ""),
        );
        setForm(initial);
        // eslint-disable-next-line
    }, [JSON.stringify(initialValues), template]);

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
            {template.map((field) => (
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
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="outhonda-form-input"
                        />
                    )}
                    {field.type === "select" && (
                        <select
                            name={field.name}
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="outhonda-form-input"
                        >
                            <option value="">Seleccione...</option>
                            {field.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
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
                            className="outhonda-form-input"
                        />
                    )}
                </div>
            ))}
            <div style={{ marginTop: 16 }}>
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
