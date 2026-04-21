import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "../../components/common";
import Button from "../../components/common/Button";
import Table from "../../components/common/Table";
import {
    fetchInboundCorrectionContext,
    fetchInboundHistorico,
    saveInboundCorrection,
} from "../../services/dashboard.service";

function formatDateTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace("T", " ").slice(0, 19);
}

function buildUniqueOptions(values = []) {
    return [
        ...new Set(
            values.map((item) => String(item || "").trim()).filter(Boolean),
        ),
    ];
}

function buildMotivoOptions(levels = [], categorizacion = "") {
    return buildUniqueOptions(
        (levels || [])
            .filter(
                (row) =>
                    String(row?.description || "").trim() ===
                    String(categorizacion || "").trim(),
            )
            .map((row) => row?.level1),
    );
}

function buildSubmotivoOptions(levels = [], categorizacion = "", motivo = "") {
    return buildUniqueOptions(
        (levels || [])
            .filter(
                (row) =>
                    String(row?.description || "").trim() ===
                        String(categorizacion || "").trim() &&
                    String(row?.level1 || "").trim() === String(motivo || "").trim(),
            )
            .map((row) => row?.level2),
    );
}

export default function CorreccionesInboundPage({
    selfMode = false,
    currentAdvisor = "",
}) {
    const [searchText, setSearchText] = useState("");
    const [campaignFilter, setCampaignFilter] = useState("");
    const [agentFilter, setAgentFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loadingRows, setLoadingRows] = useState(false);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState("");

    const [loadingContext, setLoadingContext] = useState(false);
    const [savingCorrection, setSavingCorrection] = useState(false);
    const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
    const [selectedContext, setSelectedContext] = useState(null);
    const [newActions, setNewActions] = useState([
        {
            categorizacion: "",
            motivo: "",
            submotivo: "",
            observaciones: "",
        },
    ]);

    const tableColumns = useMemo(
        () => [
            { key: "campaign_id", label: "Campaña" },
            { key: "agent", label: "Agente" },
            { key: "identification", label: "Identificación" },
            { key: "full_name", label: "Nombre" },
            { key: "action_order", label: "Orden" },
            { key: "categorizacion", label: "Categorización" },
            { key: "result_level1", label: "Motivo" },
            { key: "result_level2", label: "Submotivo" },
            {
                key: "tmstmp",
                label: "Fecha",
                render: (value) => formatDateTime(value),
            },
        ],
        [],
    );

    const existingActionColumns = useMemo(
        () => [
            { key: "actionOrder", label: "Orden" },
            { key: "agent", label: "Actor" },
            { key: "categorizacion", label: "Categorización" },
            { key: "motivo", label: "Motivo" },
            { key: "submotivo", label: "Submotivo" },
            { key: "observaciones", label: "Observaciones" },
            {
                key: "tmstmp",
                label: "Fecha",
                render: (value) => formatDateTime(value),
            },
        ],
        [],
    );

    const levels = useMemo(
        () => selectedContext?.levels || [],
        [selectedContext?.levels],
    );
    const categorizacionOptions = useMemo(
        () => buildUniqueOptions((levels || []).map((row) => row?.description)),
        [levels],
    );
    const campaignOptions = useMemo(
        () => buildUniqueOptions(rows.map((row) => row?.campaign_id)),
        [rows],
    );
    const agentOptions = useMemo(
        () => buildUniqueOptions(rows.map((row) => row?.agent)),
        [rows],
    );
    const filteredRows = useMemo(
        () =>
            (rows || []).filter((row) => {
                const campaignMatches =
                    !campaignFilter ||
                    String(row?.campaign_id || "").trim() ===
                        String(campaignFilter || "").trim();
                const agentMatches =
                    !agentFilter ||
                    String(row?.agent || "").trim() ===
                        String(agentFilter || "").trim();

                return campaignMatches && agentMatches;
            }),
        [agentFilter, campaignFilter, rows],
    );

    const loadHistorico = async (filters = {}) => {
        const nextSearchText =
            filters.searchText !== undefined ? filters.searchText : searchText;
        const nextStartDate =
            filters.startDate !== undefined ? filters.startDate : startDate;
        const nextEndDate =
            filters.endDate !== undefined ? filters.endDate : endDate;

        if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
            setRows([]);
            setError("La fecha inicial no puede ser mayor que la fecha final.");
            return;
        }

        setLoadingRows(true);
        setError("");

        const effectiveAdvisor = selfMode
            ? String(currentAdvisor || "").trim()
            : "";

        try {
            const { ok, json } = await fetchInboundHistorico({
                campaignId: "",
                advisor: effectiveAdvisor,
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

    useEffect(() => {
        loadHistorico({
            searchText: "",
            startDate: "",
            endDate: "",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpenCorrection = async (row) => {
        const gestionId = Number(row?.id || 0);
        if (!gestionId) {
            setError("No se pudo identificar la gestión a corregir.");
            return;
        }

        setIsCorrectionModalOpen(true);
        setSelectedContext(null);
        setLoadingContext(true);
        setError("");

        try {
            const { ok, json } = await fetchInboundCorrectionContext({ gestionId });
            if (!ok || !json?.data) {
                setSelectedContext(null);
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo cargar el contexto de corrección.",
                );
                return;
            }

            setSelectedContext(json.data);
            setNewActions([
                {
                    categorizacion: "",
                    motivo: "",
                    submotivo: "",
                    observaciones: "",
                },
            ]);
        } finally {
            setLoadingContext(false);
        }
    };

    const handleCloseCorrection = () => {
        if (savingCorrection) return;
        setIsCorrectionModalOpen(false);
        setLoadingContext(false);
        setSelectedContext(null);
        setNewActions([
            {
                categorizacion: "",
                motivo: "",
                submotivo: "",
                observaciones: "",
            },
        ]);
    };

    const handleChangeNewAction = (index, field, value) => {
        setNewActions((prev) =>
            prev.map((item, currentIndex) => {
                if (currentIndex !== index) return item;

                if (field === "categorizacion") {
                    return {
                        ...item,
                        categorizacion: value,
                        motivo: "",
                        submotivo: "",
                    };
                }

                if (field === "motivo") {
                    return {
                        ...item,
                        motivo: value,
                        submotivo: "",
                    };
                }

                return {
                    ...item,
                    [field]: value,
                };
            }),
        );
    };

    const handleAddNewAction = () => {
        setNewActions((prev) => [
            ...prev,
            {
                categorizacion: "",
                motivo: "",
                submotivo: "",
                observaciones: "",
            },
        ]);
    };

    const handleRemoveNewAction = (index) => {
        setNewActions((prev) => {
            const next = prev.filter((_, currentIndex) => currentIndex !== index);
            return next.length > 0
                ? next
                : [
                      {
                          categorizacion: "",
                          motivo: "",
                          submotivo: "",
                          observaciones: "",
                      },
                  ];
        });
    };

    const handleSaveCorrection = async () => {
        const gestionId = Number(selectedContext?.base?.id || 0);
        if (!gestionId) {
            setError("No hay una gestión seleccionada para corregir.");
            return;
        }

        const normalizedActions = newActions
            .map((detail) => ({
                categorizacion: String(detail?.categorizacion || "").trim(),
                motivo: String(detail?.motivo || "").trim(),
                submotivo: String(detail?.submotivo || "").trim(),
                observaciones: String(detail?.observaciones || "").trim(),
            }))
            .filter(
                (detail) =>
                    detail.categorizacion && detail.motivo && detail.submotivo,
            );

        if (normalizedActions.length === 0) {
            setError(
                "Debes completar al menos una transacción nueva con categorización, motivo y submotivo.",
            );
            return;
        }

        setSavingCorrection(true);
        setError("");

        try {
            const { ok, json } = await saveInboundCorrection({
                gestionId,
                interactionDetails: normalizedActions,
            });

            if (!ok) {
                setError(
                    json?.detail ||
                        json?.error ||
                        "No se pudo guardar la corrección inbound.",
                );
                return;
            }

            await handleOpenCorrection({ id: gestionId });
            await loadHistorico();
        } finally {
            setSavingCorrection(false);
        }
    };

    return (
        <PageContainer>
            <section className="agent-form-card agent-form-card--secondary">
                <div className="agent-form-header-row">
                    <p className="agent-form-card__title">
                        {selfMode
                            ? "Mis Correcciones Inbound"
                            : "Correcciones Inbound"}
                    </p>
                </div>

                <div className="agent-dynamic-section agent-dynamic-section--standard">
                    <div className="agent-dynamic-row agent-dynamic-row--standard">
                        <div className="agent-form-field agent-form-field--standard">
                            <span className="agent-dynamic-label">Búsqueda</span>
                            <input
                                type="text"
                                className="agent-input agent-survey-input"
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="Busca por asesor, identificación, nombre, cliente, categorización, motivo, submotivo, campaña, ticket, etc."
                            />
                        </div>

                        <div className="agent-form-field agent-form-field--standard">
                            <span className="agent-dynamic-label">Campaña</span>
                            <select
                                className="agent-input agent-survey-input"
                                value={campaignFilter}
                                onChange={(event) =>
                                    setCampaignFilter(event.target.value)
                                }
                            >
                                <option value="">Todas</option>
                                {campaignOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {!selfMode ? (
                            <div className="agent-form-field agent-form-field--standard">
                                <span className="agent-dynamic-label">Agente</span>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={agentFilter}
                                    onChange={(event) =>
                                        setAgentFilter(event.target.value)
                                    }
                                >
                                    <option value="">Todos</option>
                                    {agentOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

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
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => loadHistorico()}
                        disabled={loadingRows}
                    >
                        {loadingRows ? "Consultando..." : "Buscar"}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={loadingRows}
                        onClick={() => {
                            setSearchText("");
                            setCampaignFilter("");
                            setAgentFilter("");
                            setStartDate("");
                            setEndDate("");
                            loadHistorico({
                                searchText: "",
                                startDate: "",
                                endDate: "",
                            });
                        }}
                    >
                        Limpiar
                    </Button>
                </div>

                {error ? (
                    <p className="agent-error" style={{ marginTop: "1rem" }}>
                        {error}
                    </p>
                ) : null}

                <div style={{ marginTop: "1rem" }}>
                    <Table
                        columns={tableColumns}
                        data={filteredRows}
                        keyField="id"
                        loading={loadingRows}
                        noDataMessage="No hay registros inbound para los filtros seleccionados."
                        actions={[
                            {
                                label: "Corregir",
                                variant: "primary",
                                onClick: handleOpenCorrection,
                            },
                        ]}
                    />
                </div>
            </section>

            {isCorrectionModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(15,23,42,0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1500,
                        padding: "1rem",
                    }}
                    onClick={handleCloseCorrection}
                >
                    <div
                        className="agent-form-card agent-form-card--secondary"
                        style={{
                            width: "100%",
                            maxWidth: "1220px",
                            maxHeight: "88vh",
                            overflowY: "auto",
                            margin: 0,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div
                            className="agent-form-header-row"
                            style={{ justifyContent: "space-between", gap: "1rem" }}
                        >
                            <p className="agent-form-card__title">
                                {selectedContext?.base
                                    ? `Gestión: ${selectedContext.base.campaignId} - Ticket ${selectedContext.base.ticketId || "-"}`
                                    : "Corrección Inbound"}
                            </p>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCloseCorrection}
                                disabled={savingCorrection}
                            >
                                Cerrar
                            </Button>
                        </div>

                        {loadingContext ? (
                            <p className="agent-info-text">Cargando contexto...</p>
                        ) : !selectedContext?.base ? (
                            <p className="agent-info-text">
                                No se pudo cargar la gestión seleccionada.
                            </p>
                        ) : (
                            <>
                                <div style={{ marginTop: "1rem" }}>
                                    <h3 className="agent-form-card__title">
                                        Transacciones existentes
                                    </h3>
                                    <Table
                                        columns={existingActionColumns}
                                        data={selectedContext.actions || []}
                                        keyField="id"
                                        noDataMessage="No hay transacciones previas."
                                    />
                                </div>

                                <div style={{ marginTop: "1rem" }}>
                                    <h3 className="agent-form-card__title">
                                        Agregar nuevas transacciones
                                    </h3>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.85rem",
                                        }}
                                    >
                                        {newActions.map((action, index) => {
                                            const motivoOptions = buildMotivoOptions(
                                                levels,
                                                action.categorizacion,
                                            );
                                            const submotivoOptions =
                                                buildSubmotivoOptions(
                                                    levels,
                                                    action.categorizacion,
                                                    action.motivo,
                                                );

                                            return (
                                                <div
                                                    key={`new-action-${index}`}
                                                    style={{
                                                        border: "1px solid #dbe3ef",
                                                        borderRadius: "12px",
                                                        padding: "0.85rem",
                                                        backgroundColor: "#f8fbff",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent:
                                                                "space-between",
                                                            marginBottom: "0.6rem",
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontWeight: 700,
                                                                color: "#0f172a",
                                                            }}
                                                        >
                                                            Transacción #{index + 1}
                                                        </span>
                                                    </div>

                                                    <div
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns:
                                                                "repeat(auto-fit, minmax(220px, 1fr))",
                                                            gap: "0.75rem",
                                                        }}
                                                    >
                                                        <div className="agent-form-field">
                                                            <span className="agent-dynamic-label">
                                                                Categorización
                                                            </span>
                                                            <select
                                                                className="agent-input agent-survey-input"
                                                                value={action.categorizacion}
                                                                onChange={(event) =>
                                                                    handleChangeNewAction(
                                                                        index,
                                                                        "categorizacion",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            >
                                                                <option value="">
                                                                    Selecciona...
                                                                </option>
                                                                {categorizacionOptions.map(
                                                                    (option) => (
                                                                        <option
                                                                            key={
                                                                                option
                                                                            }
                                                                            value={
                                                                                option
                                                                            }
                                                                        >
                                                                            {option}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                        </div>

                                                        <div className="agent-form-field">
                                                            <span className="agent-dynamic-label">
                                                                Motivo
                                                            </span>
                                                            <select
                                                                className="agent-input agent-survey-input"
                                                                value={action.motivo}
                                                                onChange={(event) =>
                                                                    handleChangeNewAction(
                                                                        index,
                                                                        "motivo",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            >
                                                                <option value="">
                                                                    Selecciona...
                                                                </option>
                                                                {motivoOptions.map(
                                                                    (option) => (
                                                                        <option
                                                                            key={
                                                                                option
                                                                            }
                                                                            value={
                                                                                option
                                                                            }
                                                                        >
                                                                            {option}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                        </div>

                                                        <div className="agent-form-field">
                                                            <span className="agent-dynamic-label">
                                                                Submotivo
                                                            </span>
                                                            <select
                                                                className="agent-input agent-survey-input"
                                                                value={action.submotivo}
                                                                onChange={(event) =>
                                                                    handleChangeNewAction(
                                                                        index,
                                                                        "submotivo",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            >
                                                                <option value="">
                                                                    Selecciona...
                                                                </option>
                                                                {submotivoOptions.map(
                                                                    (option) => (
                                                                        <option
                                                                            key={
                                                                                option
                                                                            }
                                                                            value={
                                                                                option
                                                                            }
                                                                        >
                                                                            {option}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                        </div>

                                                        <div
                                                            className="agent-form-field"
                                                            style={{
                                                                gridColumn:
                                                                    "1 / -1",
                                                            }}
                                                        >
                                                            <span className="agent-dynamic-label">
                                                                Observaciones
                                                            </span>
                                                            <input
                                                                className="agent-input agent-survey-input"
                                                                value={
                                                                    action.observaciones
                                                                }
                                                                onChange={(event) =>
                                                                    handleChangeNewAction(
                                                                        index,
                                                                        "observaciones",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                placeholder="Observación"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            justifyContent:
                                                                "flex-end",
                                                            marginTop: "0.6rem",
                                                        }}
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                handleRemoveNewAction(index)
                                                            }
                                                        >
                                                            Quitar
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "0.5rem",
                                            marginTop: "1rem",
                                        }}
                                    >
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleAddNewAction}
                                        >
                                            + Agregar transacción
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            onClick={handleSaveCorrection}
                                            disabled={savingCorrection}
                                        >
                                            {savingCorrection
                                                ? "Guardando..."
                                                : "Guardar correcciones"}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
