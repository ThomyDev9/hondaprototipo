import "./Button.css";

/**
 * Componente Button reutilizable
 * @param {string} variant - Tipo de botón: "primary", "secondary", "danger", "success", "edit", "create"
 * @param {string} size - Tamaño: "sm" (pequeño), "md" (mediano por defecto), "lg" (grande)
 * @param {boolean} disabled - Deshabilitado
 * @param {function} onClick - Función al hacer click
 * @param {string} children - Contenido del botón
 * @param {string} className - Clases adicionales
 * @param {string} type - Tipo HTML: "button", "submit", "reset"
 */
export default function Button({
    variant = "primary",
    size = "md",
    disabled = false,
    onClick,
    children,
    className = "",
    type = "button",
    ...props
}) {
    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`btn btn-${variant} btn-${size} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
