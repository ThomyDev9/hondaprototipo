import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
    fetchRedesHistorico,
} from "../../../services/dashboard.service";
import {
    obtenerCampaniasDetalladasDesdeMenu,
} from "../../../services/campaign.service";
import Button from "../../../components/common/Button";
import Table from "../../../components/common/Table";
import "./RedesHistoricoPanel.css";

const REDES_PARENT_MENU_ITEM_ID = "b3d8324e-2c69-11f1-b790-000c2904c92f";
const REDES_SHARED_LABEL = "gestion redes";

function formatDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace("T", " ").slice(0, 19);
}

function getTodayLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function RedesHistoricoPanel({ campaignId, categoryId, menuItemId }) {
    const today = useMemo(() => getTodayLocalDate(), []);
    const [clientOptions, setClientOptions] = useState([]);
    const [advisor, setAdvisor] = useState("");
    const [clientName, setClientName] = useState("");
    const [searchText, setSearchText] = useState("");
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [rows, setRows] = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [loadingRows, setLoadingRows] = useState(false);
    const [error, setError] = useState("");
    const normalizedCampaignId = useMemo(
        () => String(campaignId || "").trim(),
        [campaignId],
    );
    const normalizeFlowLabel = (value) =>
        String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();

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

        const payload = {
            campaignId: normalizedCampaignId,
            advisor: nextAdvisor,
            clientName: nextClientName,
            searchText: nextSearchText,
            startDate: nextStartDate,
            endDate: nextEndDate,
        };
        console.debug("[DEBUG][REDES_HIST][FE] search", payload);

        try {
            const { ok, json } = await fetchRedesHistorico(payload);
            if (!ok) {
                setRows([]);
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo consultar el historico de redes.",
                );
                return;
            }
            const data = Array.isArray(json?.data) ? json.data : [];
            console.debug("[DEBUG][REDES_HIST][FE] rows", data.length);
            setRows(data);
        } finally {
            setLoadingRows(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const loadClientOptions = async () => {
            setLoadingClients(true);
            try {
                const normalizedCategoryId = String(categoryId || "").trim();
                const normalizedMenuItemId = String(menuItemId || "").trim();
                if (!normalizedCategoryId || !normalizedMenuItemId) {
                    setClientOptions([]);
                    return;
                }

                const tree = await obtenerCampaniasDetalladasDesdeMenu(
                    normalizedCategoryId,
                );
                if (cancelled) return;

                const rootNode = (Array.isArray(tree) ? tree : []).find(
                    (item) =>
                        String(item?.id || "").trim() === normalizedMenuItemId ||
                        (item?.subcampanias || []).some(
                            (child) =>
                                String(child?.id || "").trim() ===
                                normalizedMenuItemId,
                        ) ||
                        String(item?.id || "").trim() ===
                            REDES_PARENT_MENU_ITEM_ID ||
                        normalizeFlowLabel(item?.campania) === REDES_SHARED_LABEL,
                );

                const options = Array.isArray(rootNode?.subcampanias)
                    ? rootNode.subcampanias
                          .map((child) => ({
                              value: String(child?.id || "").trim(),
                              label: String(
                                  child?.nombre || child?.campania || "",
                              ).trim(),
                          }))
                          .filter((item) => item.value && item.label)
                    : [];

                setClientOptions(options);
            } catch {
                if (!cancelled) setClientOptions([]);
            } finally {
                if (!cancelled) setLoadingClients(false);
            }
        };

        loadClientOptions();
        handleSearch({
            advisor: "",
            clientName: "",
            searchText: "",
            startDate: today,
            endDate: today,
        });
        return () => {
            cancelled = true;
        };
    }, [categoryId, menuItemId, normalizedCampaignId, today]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <section className="agent-form-card agent-form-card--secondary">
            <div className="agent-form-header-row">
                <p className="agent-form-card__title">Historico Redes</p>
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
                            onChange={(event) => setClientName(event.target.value)}
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
                            onChange={(event) => setStartDate(event.target.value)}
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
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                                type="text"
                                className="agent-input agent-survey-input"
                                value={searchText}
                                placeholder="Identificacion o nombre"
                                onChange={(event) => setSearchText(event.target.value)}
                            />
                            <Button
                                variant="primary"
                                type="button"
                                onClick={() => handleSearch()}
                                disabled={loadingRows}
                            >
                                {loadingRows ? "Consultando..." : "Buscar"}
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
            <div className="redes-historico-table-compact" style={{ marginTop: "1rem" }}>
                <Table
                    columns={tableColumns}
                    data={rows}
                    keyField="id"
                    loading={loadingRows}
                    noDataMessage="No hay registros para los filtros seleccionados."
                />
            </div>
        </section>
    );
}

RedesHistoricoPanel.propTypes = {
    campaignId: PropTypes.string,
    categoryId: PropTypes.string,
    menuItemId: PropTypes.string,
};
