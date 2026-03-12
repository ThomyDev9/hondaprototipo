import { useState } from "react";
import "./SearchInput.css";

/**
 * Componente SearchInput reutilizable
 * @param {string} placeholder - Placeholder del input
 * @param {string} value - Valor del input
 * @param {function} onChange - Función al cambiar el valor
 * @param {function} onClear - Función al limpiar
 * @param {string} className - Clases adicionales
 */
export default function SearchInput({
    placeholder = "🔍 Buscar...",
    value,
    onChange,
    onClear,
    className = "",
}) {
    return (
        <div className={`search-input-wrapper ${className}`}>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className="search-input-field"
            />
            {value && (
                <button
                    onClick={onClear}
                    className="search-clear-btn"
                    type="button"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
