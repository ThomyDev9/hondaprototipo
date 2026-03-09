import React from "react";

export default function FormularioDinamico({
    template,
    onSubmit,
    initialValues,
}) {
    const [form, setForm] = React.useState(() => {
        const initial = {};
        template.forEach(
            (f) => (initial[f.name] = initialValues?.[f.name] || ""),
        );
        return initial;
    });

    const handleChange = (e, customOnChange) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        if (typeof customOnChange === "function") {
            customOnChange(e);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.(form);
    };

    return (
        <form onSubmit={handleSubmit} className="outmaquita-form">
            {template.map((field) => (
                <div key={field.name} className="outmaquita-form-field">
                    <label className="outmaquita-form-label">
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
                            className="outmaquita-form-input"
                        />
                    )}
                    {field.type === "select" && (
                        <select
                            name={field.name}
                            value={form[field.name]}
                            onChange={(e) => handleChange(e, field.onChange)}
                            required={field.required}
                            className="outmaquita-form-select"
                        >
                            <option value="">Seleccione...</option>
                            {field.options.map((opt) => (
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
                            className="outmaquita-form-textarea"
                        />
                    )}
                </div>
            ))}
            <button type="submit" className="outmaquita-form-submit">
                Guardar
            </button>
        </form>
    );
}
