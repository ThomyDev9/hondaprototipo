import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
    fetchInboundHistorico,
    fetchInboundHistoricoClientes,
} from "../../../services/dashboard.service";
import Button from "../../../components/common/Button";
import Table from "../../../components/common/Table";

function formatDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace("T", " ").slice(0, 19);
}

export default function InboundHistoricoPanel({ campaignId }) {
    const [clientOptions, setClientOptions] = useState([]);
    const [clientName, setClientName] = useState("");
    const [searchText, setSearchText] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [rows, setRows] = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [loadingRows, setLoadingRows] = useState(false);
    const [error, setError] = useState("");
    const normalizedCampaignId = useMemo(
        () => String(campaignId || "").trim(),
        [campaignId],
    );

    useEffect(() => {
        let cancelled = false;

        const loadClientOptions = async () => {
            setLoadingClients(true);
            try {
                const { ok, json } = await fetchInboundHistoricoClientes({
                    campaignId: normalizedCampaignId,
                });

                if (cancelled) return;

                if (!ok) {
                    setClientOptions([]);
                    return;
                }

                setClientOptions(Array.isArray(json?.data) ? json.data : []);
            } finally {
                if (!cancelled) {
                    setLoadingClients(false);
                }
            }
        };

        loadClientOptions();
        handleSearch({
            clientName: "",
            searchText: "",
            startDate: "",
            endDate: "",
        });

        return () => {
            cancelled = true;
        };
    }, [normalizedCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleSearch({
                searchText,
            });
        }, 350);

        return () => clearTimeout(timeoutId);
    }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

    const canSearch = true;
    const tableColumns = useMemo(
        () => [
            { key: "nombre_cliente_ref", label: "Cliente" },
            { key: "agent", label: "Agente" },
            { key: "identification", label: "Identificacion" },
            { key: "full_name", label: "Nombre" },
            { key: "celular", label: "Celular" },
            { key: "categorizacion", label: "Categorizacion" },
            { key: "result_level1", label: "Level1" },
            { key: "result_level2", label: "Level2" },
            { key: "observaciones", label: "Observaciones" },
            {
                key: "tmstmp",
                label: "Fecha",
                render: (value) => formatDateTime(value),
            },
        ],
        [],
    );

    const handleSearch = async (filters = {}) => {
        if (!canSearch) return;

        const nextClientName =
            filters.clientName !== undefined ? filters.clientName : clientName;
        const nextSearchText =
            filters.searchText !== undefined ? filters.searchText : searchText;
        const nextStartDate =
            filters.startDate !== undefined ? filters.startDate : startDate;
        const nextEndDate =
            filters.endDate !== undefined ? filters.endDate : endDate;

        if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
            setRows([]);
            setError("La fecha inicio no puede ser mayor que la fecha fin.");
            return;
        }

        setLoadingRows(true);
        setError("");

        try {
            const { ok, json } = await fetchInboundHistorico({
                campaignId: normalizedCampaignId,
                clientName: nextClientName,
                searchText: nextSearchText,
                startDate: nextStartDate,
                endDate: nextEndDate,
            });

            if (!ok) {
                setRows([]);
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo consultar el histórico inbound.",
                );
                return;
            }

            setRows(Array.isArray(json?.data) ? json.data : []);
        } finally {
            setLoadingRows(false);
        }
    };

    const handleClearFilters = () => {
        setClientName("");
        setSearchText("");
        setStartDate("");
        setEndDate("");
        handleSearch({
            clientName: "",
            searchText: "",
            startDate: "",
            endDate: "",
        });
    };

    return (
        <section className="agent-form-card agent-form-card--secondary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">Histórico</p>
            </div>

            <div className="agent-dynamic-section agent-dynamic-section--standard">
                <div className="agent-dynamic-row agent-dynamic-row--standard">
                    <div className="agent-form-field agent-form-field--standard">
                        <span className="agent-dynamic-label">Cliente</span>
                        <select
                            className="agent-input agent-survey-input"
                            value={clientName}
                            onChange={(event) =>
                                setClientName(event.target.value)
                            }
                            disabled={loadingClients}
                        >
                            <option value="">Todos</option>
                            {clientOptions.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="agent-form-field agent-form-field--standard">
                        <span className="agent-dynamic-label">
                            Fecha inicio
                        </span>
                        <input
                            type="date"
                            className="agent-input agent-survey-input"
                            value={startDate}
                            onChange={(event) =>
                                setStartDate(event.target.value)
                            }
                        />
                    </div>

                    <div className="agent-form-field agent-form-field--standard">
                        <span className="agent-dynamic-label">Fecha fin</span>
                        <input
                            type="date"
                            className="agent-input agent-survey-input"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                        />
                    </div>

                    <div
                        className="agent-form-field agent-form-field--standard"
                        style={{
                            justifyContent: "flex-end",
                            alignSelf: "end",
                        }}
                    >
                        <span
                            className="agent-dynamic-label"
                            style={{ visibility: "hidden" }}
                        >
                            Acción
                        </span>
                        <Button
                            variant="primary"
                            type="button"
                            onClick={handleSearch}
                            disabled={!canSearch || loadingRows}
                        >
                            {loadingRows ? "Consultando..." : "Buscar"}
                        </Button>
                    </div>
                </div>
            </div>

            {error ? (
                <p className="agent-error" style={{ marginTop: "1rem" }}>
                    {error}
                </p>
            ) : null}

            <div style={{ marginTop: "1rem" }}>
                <Table
                    columns={tableColumns}
                    data={rows}
                    keyField="tmstmp"
                    loading={loadingRows}
                    noDataMessage="No hay registros para los filtros seleccionados."
                />
                {false && (
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.83rem",
                    }}
                >
                    <thead>
                        <tr>
                            {[
                                "Campaña",
                                "Cliente",
                                "Agente",
                                "Identificación",
                                "Nombre",
                                "Celular",
                                "Categorización",
                                "Level1",
                                "Level2",
                                "Observaciones",
                                "Fecha",
                            ].slice(1).map((label) => (
                                <th
                                    key={label}
                                    style={{
                                        textAlign: "left",
                                        padding: "0.6rem",
                                        borderBottom:
                                            "1px solid rgba(148,163,184,0.35)",
                                    }}
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={10}
                                    style={{
                                        padding: "0.85rem 0.6rem",
                                        color: "#64748b",
                                    }}
                                >
                                    {loadingRows
                                        ? "Consultando registros..."
                                        : "No hay registros para los filtros seleccionados."}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={`${row.tmstmp || index}-${row.identification || "sin-id"}-${index}`}>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.nombre_cliente_ref || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.agent || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.identification || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.full_name || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.celular || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.categorizacion || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.result_level1 || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                        }}
                                    >
                                        {row.result_level2 || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                            maxWidth: "24rem",
                                        }}
                                    >
                                        {row.observaciones || ""}
                                    </td>
                                    <td
                                        style={{
                                            padding: "0.6rem",
                                            borderBottom:
                                                "1px solid rgba(226,232,240,0.5)",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {formatDateTime(row.tmstmp)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                )}
            </div>
        </section>
    );
}

InboundHistoricoPanel.propTypes = {
    campaignId: PropTypes.string,
};
