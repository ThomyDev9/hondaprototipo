import { useState, useEffect } from "react";
import "./Select.css";

/**
 * Componente Select reutilizable
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
    return (
        <div className="select-wrapper">
            {label && (
                <label className="select-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={`select-input ${error ? "error" : ""}`}
                required={required}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <span className="select-error">{error}</span>}
        </div>
    );
}

export default Select;
