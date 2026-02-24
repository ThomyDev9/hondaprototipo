import { useState, useEffect, useRef } from "react";
import "./Select.css";

/**
 * Componente Select reutilizable con dropdown customizado
 * @param {Object} props
 * @param {string} props.label - Etiqueta del select
 * @param {Array} props.options - Array de opciones [{id, label}]
 * @param {string} props.value - Valor seleccionado
 * @param {function} props.onChange - Callback cuando cambia el valor
 * @param {string} props.placeholder - Placeholder inicial
 * @param {boolean} props.required - Si es requerido
 * @param {boolean} props.disabled - Si está deshabilitado
 * @param {string} props.error - Mensaje de error
 */
export function Select({
    label,
    options = [],
    value = "",
    onChange,
    placeholder = "Seleccionar...",
    required = false,
    disabled = false,
    error = "",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);
    const dropdownRef = useRef(null);

    // Obtener el label de la opción seleccionada
    const selectedOption = options.find(
        (opt) => String(opt.id) === String(value),
    );
    const displayText = selectedOption ? selectedOption.label : placeholder;

    // Manejar click en una opción
    const handleSelectOption = (optionId) => {
        onChange(String(optionId));
        setIsOpen(false);
    };

    // Cerrar cuando se clickea afuera
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                selectRef.current &&
                !selectRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="select-wrapper">
            {label && (
                <label className="select-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}
            <div className="select-container">
                <button
                    ref={selectRef}
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`select-button ${error ? "error" : ""} ${isOpen ? "open" : ""}`}
                >
                    <span className={selectedOption ? "" : "placeholder"}>
                        {displayText}
                    </span>
                    <svg
                        className="select-arrow"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                    >
                        <path
                            d="M4 6l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>

                {isOpen && !disabled && (
                    <div ref={dropdownRef} className="select-dropdown">
                        {/* Opción placeholder */}
                        {placeholder && (
                            <button
                                type="button"
                                className={`select-option ${value ? "" : "selected"}`}
                                onClick={() => handleSelectOption("")}
                            >
                                {placeholder}
                            </button>
                        )}
                        {/* Opciones */}
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                className={`select-option ${
                                    String(opt.id) === String(value)
                                        ? "selected"
                                        : ""
                                }`}
                                onClick={() => handleSelectOption(opt.id)}
                            >
                                {opt.label}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <div className="select-empty">
                                No hay opciones disponibles
                            </div>
                        )}
                    </div>
                )}
            </div>
            {error && <span className="select-error">{error}</span>}
        </div>
    );
}

export default Select;
