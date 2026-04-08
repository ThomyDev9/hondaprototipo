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

export default function InboundHistoricoPanelV2({ campaignId }) {
    const [clientOptions, setClientOptions] = useState([]);
    const [advisor, setAdvisor] = useState("");
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
        const nextClientName =
            filters.clientName !== undefined ? filters.clientName : clientName;
        const nextAdvisor =
            filters.advisor !== undefined ? filters.advisor : advisor;
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
                advisor: nextAdvisor,
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
                        "No se pudo consultar el historico inbound.",
                );
                return;
            }

            setRows(Array.isArray(json?.data) ? json.data : []);
        } finally {
            setLoadingRows(false);
        }
    };

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
            advisor: "",
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

    const handleClearFilters = () => {
        setClientName("");
        setAdvisor("");
        setSearchText("");
        setStartDate("");
        setEndDate("");
        handleSearch({
            advisor: "",
            clientName: "",
            searchText: "",
            startDate: "",
            endDate: "",
        });
    };

    return (
        <section className="agent-form-card agent-form-card--secondary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">Historico</p>
            </div>

            <div className="agent-dynamic-section agent-dynamic-section--standard">
                <div className="agent-dynamic-row agent-dynamic-row--standard">
                    <div className="agent-form-field agent-form-field--standard">
                        <span className="agent-dynamic-label">Asesor</span>
                        <input
                            type="text"
                            className="agent-input agent-survey-input"
                            value={advisor}
                            placeholder="Usuario asesor"
                            onChange={(event) => setAdvisor(event.target.value)}
                        />
                    </div>

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
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="agent-form-field agent-form-field--standard">
                        <span className="agent-dynamic-label">Fecha inicio</span>
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
                        style={{ minWidth: "340px" }}
                    >
                        <span className="agent-dynamic-label">Busqueda</span>
                        <div
                            style={{
                                display: "flex",
                                gap: "0.5rem",
                                alignItems: "center",
                            }}
                        >
                            <input
                                type="text"
                                className="agent-input agent-survey-input"
                                value={searchText}
                                placeholder="Identificacion o nombre"
                                onChange={(event) =>
                                    setSearchText(event.target.value)
                                }
                            />
                            <Button
                                variant="primary"
                                type="button"
                                onClick={() => handleSearch()}
                                disabled={loadingRows}
                            >
                                {loadingRows ? "Consultando..." : "Buscar"}
                            </Button>
                            <Button
                                variant="secondary"
                                type="button"
                                onClick={handleClearFilters}
                                disabled={loadingRows}
                            >
                                Limpiar
                            </Button>
                        </div>
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
            </div>
        </section>
    );
}

InboundHistoricoPanelV2.propTypes = {
    campaignId: PropTypes.string,
};
