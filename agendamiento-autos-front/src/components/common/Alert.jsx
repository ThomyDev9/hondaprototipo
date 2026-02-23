import "./Alert.css";

/**
 * Componente Alert para mostrar mensajes
 * @param {string} type - Tipo: "success", "error", "warning", "info"
 * @param {string} message - Mensaje a mostrar
 * @param {function} onClose - Callback al cerrar
 * @param {boolean} closable - Mostrar botón cerrar
 */
export default function Alert({
    type = "info",
    message,
    onClose,
    closable = true,
}) {
    if (!message) return null;

    return (
        <div className={`alert alert-${type}`}>
            <div className="alert-content">
                <span className="alert-icon">
                    {type === "success" && "✅"}
                    {type === "error" && "❌"}
                    {type === "warning" && "⚠️"}
                    {type === "info" && "ℹ️"}
                </span>
                <span className="alert-message">{message}</span>
            </div>
            {closable && (
                <button
                    onClick={onClose}
                    className="alert-close-btn"
                    type="button"
                >
                    ×
                </button>
            )}
        </div>
    );
}
