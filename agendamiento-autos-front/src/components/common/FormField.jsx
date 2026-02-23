import "./FormField.css";

/**
 * Componente FormField reutilizable
 * @param {string} label - Etiqueta del campo
 * @param {string} type - Tipo: "text", "email", "password", "date", "number", "textarea", "select"
 * @param {string} placeholder - Placeholder del input
 * @param {string} name - Nombre del campo
 * @param {string} value - Valor actual
 * @param {function} onChange - Manejador de cambio
 * @param {boolean} required - Campo requerido
 * @param {string} error - Mensaje de error
 * @param {array} options - Opciones para select
 * @param {string} className - Clases adicionales
 */
export default function FormField({
    label,
    type = "text",
    placeholder,
    name,
    value,
    onChange,
    required = false,
    error,
    options = [],
    className = "",
    ...props
}) {
    return (
        <div className={`form-field ${error ? "error" : ""} ${className}`}>
            {label && (
                <label htmlFor={name}>
                    {label}
                    {required && <span className="required">*</span>}
                </label>
            )}

            {type === "textarea" ? (
                <textarea
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    {...props}
                />
            ) : type === "select" ? (
                <select
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    {...props}
                >
                    <option value="">
                        Seleccione {label?.toLowerCase() || "opción"}
                    </option>
                    {options.map((opt) => (
                        <option key={opt.value || opt} value={opt.value || opt}>
                            {opt.label || opt}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    id={name}
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    {...props}
                />
            )}

            {error && <span className="error-message">{error}</span>}
        </div>
    );
}
