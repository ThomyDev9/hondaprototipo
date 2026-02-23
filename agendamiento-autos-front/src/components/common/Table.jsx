import "./Table.css";

/**
 * Componente Table reutilizable
 * @param {array} columns - Array de objetos con: { key, label, render?, width?, sortable? }
 * @param {array} data - Array de datos para las filas
 * @param {boolean} showCheckbox - Mostrar columna de checkboxes
 * @param {array} selectedRows - IDs de filas seleccionadas
 * @param {function} onSelectRow - Callback al seleccionar una fila
 * @param {function} onSelectAll - Callback al seleccionar todas
 * @param {array} actions - Array de acciones: { label, onClick, variant }
 * @param {string} keyField - Campo a usar como key (default: 'id')
 * @param {boolean} loading - Mostrar estado de carga
 * @param {string} noDataMessage - Mensaje si no hay datos
 */
export default function Table({
    columns = [],
    data = [],
    showCheckbox = false,
    selectedRows = [],
    onSelectRow,
    onSelectAll,
    actions = [],
    keyField = "id",
    loading = false,
    noDataMessage = "No hay datos disponibles",
}) {
    if (loading) {
        return <div className="table-loading">Cargando...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="table-no-data">{noDataMessage}</div>;
    }

    const isAllSelected =
        selectedRows.length === data.length && data.length > 0;

    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        {showCheckbox && (
                            <th style={{ width: "40px" }}>
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={onSelectAll}
                                />
                            </th>
                        )}
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                style={col.width ? { width: col.width } : {}}
                                className={col.sortable ? "sortable" : ""}
                            >
                                {col.label}
                            </th>
                        ))}
                        {actions.length > 0 && (
                            <th style={{ textAlign: "right" }}>Acciones</th>
                        )}
                    </tr>
                </thead>

                <tbody>
                    {data.map((row, idx) => (
                        <tr key={row[keyField] || idx}>
                            {showCheckbox && (
                                <td style={{ width: "40px" }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.includes(
                                            row[keyField],
                                        )}
                                        onChange={() =>
                                            onSelectRow(row[keyField])
                                        }
                                    />
                                </td>
                            )}
                            {columns.map((col) => (
                                <td key={col.key}>
                                    {col.render
                                        ? col.render(row[col.key], row)
                                        : row[col.key]}
                                </td>
                            ))}
                            {actions.length > 0 && (
                                <td style={{ textAlign: "right" }}>
                                    <div className="table-actions">
                                        {actions.map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={() =>
                                                    action.onClick(row)
                                                }
                                                className={`table-action-btn table-action-${action.variant || "default"}`}
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
