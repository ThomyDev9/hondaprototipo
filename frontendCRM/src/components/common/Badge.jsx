import "./Badge.css";

/**
 * Componente Badge reutilizable para estados y etiquetas
 * @param {string} variant - Tipo: "primary", "success", "danger", "warning", "info", "secondary"
 * @param {string} children - Contenido del badge
 * @param {string} className - Clases adicionales
 */
export default function Badge({
    variant = "primary",
    children,
    className = "",
    ...props
}) {
    return (
        <span className={`badge badge-${variant} ${className}`} {...props}>
            {children}
        </span>
    );
}
