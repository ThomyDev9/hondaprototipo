import { useState, useEffect, useRef } from "react";
import "./AutoComplete.css";

/**
 * Componente AutoComplete reutilizable
 * @param {Object} props
 * @param {string} props.label - Etiqueta del campo
 * @param {string} props.value - Valor actual
 * @param {function} props.onChange - Callback cuando cambia el valor
 * @param {function} props.onSearch - Callback para buscar opciones, retorna Promise<Array>
 * @param {Array} props.suggestions - Array de sugerencias [{value, label}]
 * @param {string} props.placeholder - Placeholder inicial
 * @param {boolean} props.required - Si es requerido
 * @param {string} props.error - Mensaje de error
 * @param {number} props.debounceMs - Milisegundos de delay para búsqueda (default: 300)
 */
export function AutoComplete({
    label,
    value = "",
    onChange,
    onSearch,
    suggestions = [],
    placeholder = "Escribe para buscar...",
    required = false,
    error = "",
    debounceMs = 300,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState(suggestions);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);
    const debounceTimer = useRef(null);

    // Manejar cambios en el input
    const handleInputChange = (e) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (inputValue.trim().length === 0) {
            setFilteredSuggestions([]);
            setIsOpen(false);
            return;
        }

        setIsOpen(true);
        setLoading(true);

        debounceTimer.current = setTimeout(() => {
            if (onSearch) {
                onSearch(inputValue)
                    .then((results) => {
                        setFilteredSuggestions(results);
                        setLoading(false);
                    })
                    .catch((err) => {
                        console.error("Error en búsqueda:", err);
                        setLoading(false);
                    });
            }
        }, debounceMs);
    };

    // Manejar selección de sugerencia
    const handleSelectSuggestion = (suggestionValue) => {
        onChange(suggestionValue);
        setIsOpen(false);
        setFilteredSuggestions([]);
    };

    // Cerrar cuando se clickea afuera
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                inputRef.current &&
                !inputRef.current.contains(event.target) &&
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="autocomplete-wrapper">
            {label && (
                <label className="autocomplete-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}
            <div className="autocomplete-input-container">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    className={`autocomplete-input ${error ? "error" : ""}`}
                    required={required}
                    autoComplete="off"
                />
            </div>

            {isOpen && (
                <div ref={suggestionsRef} className="autocomplete-suggestions">
                    {loading ? (
                        <div className="autocomplete-loading">Buscando...</div>
                    ) : filteredSuggestions.length > 0 ? (
                        <ul className="autocomplete-list">
                            {filteredSuggestions.map((suggestion, idx) => (
                                <li key={idx}>
                                    <button
                                        type="button"
                                        className="autocomplete-item"
                                        onClick={() =>
                                            handleSelectSuggestion(
                                                suggestion.value || suggestion,
                                            )
                                        }
                                    >
                                        {suggestion.label ||
                                            suggestion.value ||
                                            suggestion}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="autocomplete-empty">
                            No hay resultados
                        </div>
                    )}
                </div>
            )}

            {error && <span className="autocomplete-error">{error}</span>}
        </div>
    );
}

export default AutoComplete;
