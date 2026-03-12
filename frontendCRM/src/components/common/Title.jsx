import "./Title.css";

/**
 * Componente Title/Heading reutilizable
 * @param {string} level - Nivel del título: "h1", "h2", "h3", "h4", "h5", "h6"
 * @param {string} children - Contenido del título
 * @param {string} className - Clases adicionales
 * @param {string} variant - Variante de estilo: "default", "primary", "section"
 */
export default function Title({
    level = "h2",
    children,
    className = "",
    variant = "default",
    ...props
}) {
    const HeadingTag = level;

    return (
        <HeadingTag
            className={`title title-${level} title-${variant} ${className}`}
            {...props}
        >
            {children}
        </HeadingTag>
    );
}
