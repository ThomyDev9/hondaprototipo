import "./Modal.css";

/**
 * Componente Modal reutilizable para diálogos y formularios
 * @param {boolean} isOpen - Mostrar/ocultar modal
 * @param {function} onClose - Callback al cerrar
 * @param {string} title - Título del modal
 * @param {ReactNode} children - Contenido del modal
 * @param {string} size - Tamaño: "sm", "md" (default), "lg", "xl"
 * @param {boolean} showCloseButton - Mostrar botón cerrar (default: true)
 */
export default function Modal({
    isOpen = false,
    onClose,
    title,
    children,
    size = "md",
    showCloseButton = true,
}) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className={`modal-card modal-${size}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="modal-header">
                    <h2>{title}</h2>
                    {showCloseButton && (
                        <button onClick={onClose} className="modal-close-btn">
                            ×
                        </button>
                    )}
                </div>

                {/* CONTENT */}
                <div className="modal-content">{children}</div>
            </div>
        </div>
    );
}
