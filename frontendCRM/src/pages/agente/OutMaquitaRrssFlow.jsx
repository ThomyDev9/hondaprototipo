import React from "react";
import { formF2Template } from "../../templates/formF2Template";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
import FormularioDinamico from "../../components/FormularioDinamico";
import Tabs from "../../components/common/Tabs";
import { fetchOutMaquitaFlowData } from "../../services/outMaquitaFlows.service";
import { guardarGestionOutbound } from "../../services/dashboard.service";
import {
    getFirstNonEmptyValue,
    getRegistroIdentification,
    getRrssRegistroIdentification,
    getTodayFormatted,
    OUT_MAQUITA_AGENCIA_ASISTIR_OPTIONS,
    OUT_MAQUITA_ENTREGA_DOCUMENTOS_OPTIONS,
    OUT_MAQUITA_RRSS_MOTIVOS,
    getOutMaquitaSubmotivosByMotivo,
} from "./outMaquitaConfig";
import "./OutMaquitaRrssFlow.css";

const FLOW_STATUS_KEYS = ["Estado", "Estado ", "U"];
const CAMPAIGN_ID = "Out Maquita Cushunchic";
const DEFAULT_TIPO_CAMPANA = "VENTAS";
const RRSS_OBSERVACION_KEYS = ["Observacion AGENTE MAQUITA", "R"];
const RRSS_PROCESO_KEYS = ["PROCESO A REALIZAR ", "PROCESO A REALIZAR", "S"];
const RRSS_TIPO_RELACION_KEYS = [
    "tipo_relacion_laboral",
    "Tipo de relación laboral",
    "Tipo de relacion laboral",
    "L",
];
const RRSS_TIPO_VIVIENDA_KEYS = [
    "Tipo de Vivienda:",
    "Tipo de Vivienda",
    "N",
];
const RRSS_PRODUCTO_KEYS = ["Producto", "Q"];

const RRSS_EXTRA_FIELDS = [
    {
        name: "Autoriza Buró si / no",
        label: "Autoriza Buró si / no",
        type: "text",
        required: false,
    },
    {
        name: "ciudad",
        label: "CIUDAD",
        type: "text",
        required: false,
    },
    {
        name: "montoSolicitadoRrss",
        label: "Monto solicitado:",
        type: "text",
        required: false,
    },
    {
        name: "montoAceptado",
        label: "Monto aceptado",
        type: "text",
        required: false,
    },
    {
        name: "tipoVivienda",
        label: "Tipo de Vivienda:",
        type: "text",
        required: false,
    },
    {
        name: "tipoRelacionLaboral",
        label: "Tipo de relacion laboral",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "producto",
        label: "Producto",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "observacionAgenteMaquita",
        label: "Observacion AGENTE MAQUITA",
        type: "textarea",
        required: false,
        readOnly: true,
    },
    {
        name: "procesoARealizarRrss",
        label: "PROCESO A REALIZAR",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "entregaDocumentos",
        label: "Entrega de documentos",
        type: "select",
        required: false,
        options: OUT_MAQUITA_ENTREGA_DOCUMENTOS_OPTIONS.map((item) => ({
            value: item,
            label: item,
        })),
    },
    {
        name: "agenciaAsistir",
        label: "Agencia asistir",
        type: "select",
        required: false,
        visibleWhen: (values) =>
            String(values?.entregaDocumentos || "").trim() ===
            "Entrega fisica",
        options: OUT_MAQUITA_AGENCIA_ASISTIR_OPTIONS.map((item) => ({
            value: item,
            label: item,
        })),
    },
];


function buildRrssBaseValues(registro) {
    return {
        identificacion: getRrssRegistroIdentification(registro),
        apellidosNombres:
            registro?.apellidosNombres ||
            registro?.NombreCliente ||
            registro?.full_name ||
            getFirstNonEmptyValue(registro, [
                "Apellidos y Nombres Completos ",
                "Apellidos y Nombres Completos",
                "D",
            ]) ||
            "",
        tipoCampana:
            registro?.tipoCampana ||
            registro?.TipoCampania ||
            DEFAULT_TIPO_CAMPANA,
        celular:
            registro?.celular ||
            getFirstNonEmptyValue(registro, ["Celular", "G"]) ||
            "",
        motivoInteraccion:
            registro?.motivoInteraccion || registro?.MotivoLlamada || "",
        submotivoInteraccion:
            registro?.submotivoInteraccion || registro?.SubmotivoLlamada || "",
        observaciones: registro?.observaciones || registro?.Observaciones || "",
        autorizaBuro: getFirstNonEmptyValue(registro, [
            "autoriza_buro",
            "Autoriza Buró si / no",
            "Autoriza Buro si / no",
            "Autoriza Buró",
            "Autoriza Buro",
            "C",
        ]),
        ciudad: getFirstNonEmptyValue(registro, ["city", "CIUDAD", "F"]),
        montoSolicitadoRrss: getFirstNonEmptyValue(registro, [
            "monto_solicitado",
            "Monto solicitado:",
            "Monto solicitado",
            "H",
        ]),
        montoAceptado: getFirstNonEmptyValue(registro, [
            "montoAceptado",
            "Monto aceptado",
            "Monto Aceptado",
        ]),
        tipoRelacionLaboral: getFirstNonEmptyValue(
            registro,
            RRSS_TIPO_RELACION_KEYS,
        ),
        tipoVivienda: getFirstNonEmptyValue(registro, [
            "tipo_vivienda",
            ...RRSS_TIPO_VIVIENDA_KEYS,
        ]),
        producto: getFirstNonEmptyValue(registro, [
            "producto",
            ...RRSS_PRODUCTO_KEYS,
        ]),
        observacionAgenteMaquita: getFirstNonEmptyValue(
            registro,
            ["observacion_cooperativa", ...RRSS_OBSERVACION_KEYS],
        ),
        procesoARealizarRrss: getFirstNonEmptyValue(registro, [
            "proceso_a_realizar",
            ...RRSS_PROCESO_KEYS,
        ]),
        entregaDocumentos: getFirstNonEmptyValue(registro, [
            "Entrega de documentos",
            "Entrega Documentos",
            "Tipo entrega documentos",
            "CAMPO2",
        ]),
        agenciaAsistir: getFirstNonEmptyValue(registro, [
            "Agencia asistir",
            "Agencia Asistir",
            "CAMPO3",
        ]),
        asesor: localStorage.getItem("import_user") || "",
        fecha: getTodayFormatted(),
        estadoCivil: "",
        destinoCredito: "",
        actividadEconomicaTiempo: "",
        ingresoNetoRecibir: "",
        mantieneHijos: "",
        otrosIngresos: "",
    };
}

function buildTipoCampanaOptions(tiposCampania = []) {
    const values = tiposCampania
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    const hasDefault = values.some(
        (item) => item.toLowerCase() === DEFAULT_TIPO_CAMPANA.toLowerCase(),
    );

    const normalized = hasDefault
        ? values
        : [DEFAULT_TIPO_CAMPANA, ...values];

    return normalized.map((item) => ({
        value: item,
        label: item,
    }));
}

export default function OutMaquitaRrssFlow({ onBack }) {
    const [tiposCampania, setTiposCampania] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState("gestion");
    const [registro, setRegistro] = React.useState(null);
    const [gestionRows, setGestionRows] = React.useState([]);
    const [regestionRows, setRegestionRows] = React.useState([]);
    const [historicoRows, setHistoricoRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [successMessage, setSuccessMessage] = React.useState("");
    const [rrssDraft, setRrssDraft] = React.useState({});
    const [historicoSearch, setHistoricoSearch] = React.useState("");
    const [historicoSearchDebounced, setHistoricoSearchDebounced] = React.useState("");
    const [historicoStartDate, setHistoricoStartDate] = React.useState("");
    const [historicoEndDate, setHistoricoEndDate] = React.useState("");
    const [historicoLoading, setHistoricoLoading] = React.useState(false);
    const isRegestionTab = activeTab === "regestion";
    const isHistoricoTab = activeTab === "historico";

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setHistoricoSearchDebounced(historicoSearch);
        }, 350);
        return () => clearTimeout(timer);
    }, [historicoSearch]);

    React.useEffect(() => {
        async function fetchTipos() {
            try {
                const tipos = await fetchTiposCampaniaOutbound(CAMPAIGN_ID);
                setTiposCampania(tipos.filter(Boolean));
            } catch {
                setTiposCampania([]);
            }
        }

        fetchTipos();
    }, []);

    const loadFlowRows = React.useCallback(async () => {
        return fetchOutMaquitaFlowData({
            flow: "rrss",
            mode: isHistoricoTab
                ? "historico"
                : isRegestionTab
                  ? "regestion"
                  : "gestion",
            search: isHistoricoTab ? historicoSearchDebounced : "",
            startDate: isHistoricoTab ? historicoStartDate : "",
            endDate: isHistoricoTab ? historicoEndDate : "",
        });
    }, [
        historicoEndDate,
        historicoSearchDebounced,
        historicoStartDate,
        isHistoricoTab,
        isRegestionTab,
    ]);

    React.useEffect(() => {
        let mounted = true;

        async function loadInitialRow() {
            if (isHistoricoTab) {
                setHistoricoLoading(true);
            } else {
                setLoading(true);
            }
            setError("");
            setSuccessMessage("");

            try {
                const data = await loadFlowRows();

                if (!mounted) return;

                if (isRegestionTab) {
                    setGestionRows([]);
                    setHistoricoRows([]);
                    setRegestionRows(data);
                    setRegistro(null);
                } else if (isHistoricoTab) {
                    setGestionRows([]);
                    setRegestionRows([]);
                    setHistoricoRows(data);
                    setRegistro(null);
                } else {
                    setGestionRows(data);
                    setRegestionRows([]);
                    setHistoricoRows([]);
                    setRegistro(null);
                }
            } catch {
                if (mounted) {
                    setError("No se pudo obtener datos de Out Maquita");
                }
            } finally {
                if (mounted) {
                    if (isHistoricoTab) {
                        setHistoricoLoading(false);
                    } else {
                        setLoading(false);
                    }
                }
            }
        }

        loadInitialRow();

        return () => {
            mounted = false;
        };
    }, [isHistoricoTab, isRegestionTab, loadFlowRows]);

    React.useEffect(() => {
        if (registro) {
            setSuccessMessage("");
        }
    }, [registro]);

    React.useEffect(() => {
        if (!successMessage) return;
        const timerId = setTimeout(() => setSuccessMessage(""), 2000);
        return () => clearTimeout(timerId);
    }, [successMessage]);

    React.useEffect(() => {
        setRrssDraft(buildRrssBaseValues(registro));
    }, [registro]);

    const dynamicTemplate = React.useMemo(
        () => [
            ...formF2Template.map((field) => {
                if (field.name === "tipoCampana") {
                    return {
                        ...field,
                        type: "select",
                        options: buildTipoCampanaOptions(tiposCampania),
                    };
                }

                if (field.name === "motivoInteraccion") {
                    return {
                        ...field,
                        type: "select",
                        options: OUT_MAQUITA_RRSS_MOTIVOS.map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                if (field.name === "submotivoInteraccion") {
                    return {
                        ...field,
                        type: "select",
                        options: getOutMaquitaSubmotivosByMotivo(
                            String(rrssDraft?.motivoInteraccion || ""),
                        ).map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                return field;
            }),
            {
                name: "autorizaBuro",
                label: "Autoriza Buro si / no",
                type: "text",
                required: false,
                readOnly: true,
            },
            ...RRSS_EXTRA_FIELDS.slice(1),
        ],
        [rrssDraft?.motivoInteraccion, tiposCampania],
    );

    const cargarSiguienteRegistro = React.useCallback(
        async ({ currentIdentification = "", currentRowId = "" } = {}) => {
            let all = [];
            try {
                all = await loadFlowRows();
            } catch {
                setRegistro(null);
                setError(
                    "La gestion se guardo, pero no se pudo refrescar la lista.",
                );
                return;
            }

            const currentId = String(currentIdentification || "").trim();
            const normalizedRowId = String(currentRowId || "").trim();
            const isCurrentRow = (item) => {
                if (!item) return false;
                const itemRowId = String(item?.id || "").trim();
                if (normalizedRowId && itemRowId) {
                    return itemRowId === normalizedRowId;
                }
                const itemId = getRrssRegistroIdentification(item);
                return Boolean(currentId && itemId && itemId === currentId);
            };
            const siguiente =
                all.find((item) => {
                    const itemId = getRrssRegistroIdentification(item);
                    return itemId && !isCurrentRow(item);
                }) || null;

            if (isRegestionTab) {
                setRegestionRows(
                    all.filter((item) => {
                        const itemId = getRrssRegistroIdentification(item);
                        return itemId && !isCurrentRow(item);
                    }),
                );
                setRegistro(null);
            } else {
                setGestionRows(
                    all.filter((item) => {
                        const itemId = getRrssRegistroIdentification(item);
                        return itemId && !isCurrentRow(item);
                    }),
                );
                setRegistro(null);
            }

            if (!siguiente) {
                setSuccessMessage(
                    "Registro guardado correctamente. No hay mas registros disponibles.",
                );
            }
        },
        [isRegestionTab, loadFlowRows],
    );

    const saveWithTemplate = React.useCallback(
        async (formData, template, errorMessage) => {
            const normalizedEntrega = String(
                formData?.entregaDocumentos || "",
            ).trim();
            const payload = {
                ...formData,
                agenciaAsistir:
                    normalizedEntrega === "Entrega fisica"
                        ? formData?.agenciaAsistir || ""
                        : "",
                tipoCampana:
                    formData?.tipoCampana || DEFAULT_TIPO_CAMPANA,
            };
            const fieldsMeta = template.map((field) => ({
                name: field.name,
                label: field.label,
            }));
            const { ok, json } = await guardarGestionOutbound({
                campaignId: CAMPAIGN_ID,
                formData: {
                    ...payload,
                    outboundFlow: "rrss",
                },
                fieldsMeta,
            });

            if (!ok) {
                throw new Error(json?.detail || json?.error || errorMessage);
            }
        },
        [],
    );

    const renderGestionForm = (cancelHandler = onBack) => (
        <div className="outmaquita-rrss__tab-panel">
            <FormularioDinamico
                variant="outbound"
                template={dynamicTemplate}
                initialValues={rrssDraft}
                onChangeCampo={(name, value) =>
                    setRrssDraft((prev) => ({
                        ...prev,
                        [name]: value,
                        ...(name === "motivoInteraccion"
                            ? { submotivoInteraccion: "" }
                            : {}),
                    }))
                }
                onGuardar={async (formData) => {
                    try {
                        setError("");
                        const currentRowId = String(registro?.id || "").trim();
                        const merged = {
                            ...rrssDraft,
                            ...formData,
                        };
                        await saveWithTemplate(
                            merged,
                            dynamicTemplate,
                            "No se pudo guardar la gestion outbound",
                        );
                        setSuccessMessage("Registro guardado correctamente");
                        await cargarSiguienteRegistro(
                            {
                                currentIdentification:
                                    getRegistroIdentification(merged),
                                currentRowId,
                            },
                        );
                    } catch (saveError) {
                        setSuccessMessage("");
                        setError(
                            saveError?.message ||
                                "Error guardando gestion outbound",
                        );
                    }
                }}
                onActualizar={async (formData) => {
                    try {
                        setError("");
                        const currentRowId = String(registro?.id || "").trim();
                        const merged = {
                            ...rrssDraft,
                            ...formData,
                        };
                        await saveWithTemplate(
                            merged,
                            dynamicTemplate,
                            "No se pudo actualizar la gestion outbound",
                        );
                        setSuccessMessage("Registro actualizado correctamente");
                        await cargarSiguienteRegistro(
                            {
                                currentIdentification:
                                    getRegistroIdentification(merged),
                                currentRowId,
                            },
                        );
                    } catch (saveError) {
                        setSuccessMessage("");
                        setError(
                            saveError?.message ||
                                "Error actualizando gestion outbound",
                        );
                    }
                }}
                onCancelar={cancelHandler}
                esUpdate={Boolean(getRegistroIdentification(rrssDraft))}
            />
        </div>
    );

    const renderRegestionContent = () =>
        registro ? (
            <div className="outmaquita-rrss__tab-panel">
                <div className="outmaquita-rrss__selected-head">
                    <h2 className="outmaquita-rrss__section-title">
                        Formulario de regestion
                    </h2>
                    <button
                        type="button"
                        className="outmaquita-rrss__search-button"
                        onClick={() => {
                            setRegistro(null);
                            setSuccessMessage("");
                            setError("");
                        }}
                    >
                        Volver a tabla
                    </button>
                </div>
                {renderGestionForm(() => {
                    setRegistro(null);
                    setSuccessMessage("");
                    setError("");
                })}
            </div>
        ) : (
            <div className="outmaquita-rrss__tab-panel">
                <div className="outmaquita-rrss__regestion-card">
                    <div className="outmaquita-rrss__regestion-head">
                        <h2 className="outmaquita-rrss__section-title">
                            Registros para regestion
                        </h2>
                        <span className="outmaquita-rrss__regestion-count">
                            {regestionRows.length} pendientes
                        </span>
                    </div>
                    {regestionRows.length === 0 ? (
                        <div className="outmaquita-rrss__empty-state">
                            No hay registros disponibles para regestion.
                        </div>
                    ) : (
                        <div className="outmaquita-rrss__table-wrapper">
                            <table className="outmaquita-rrss__table">
                                <thead>
                                    <tr>
                                        <th>Identificacion</th>
                                        <th>Cliente</th>
                                        <th>Celular</th>
                                        <th>Estado</th>
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {regestionRows.map((row) => {
                                        const rowId =
                                            getRrssRegistroIdentification(row);
                                        const rowName =
                                            getFirstNonEmptyValue(row, [
                                                "full_name",
                                                "Apellidos y Nombres Completos ",
                                                "Apellidos y Nombres Completos",
                                                "D",
                                            ]) || "";
                                        const rowPhone =
                                            getFirstNonEmptyValue(row, [
                                                "celular",
                                                "Celular",
                                                "G",
                                            ]) || "";
                                        const rowEstado =
                                            getFirstNonEmptyValue(
                                                row,
                                                ["workflow_status", ...FLOW_STATUS_KEYS],
                                            ) || "";

                                        return (
                                            <tr key={`${rowId}-${row.id || ""}`}>
                                                <td>{rowId}</td>
                                                <td>{rowName}</td>
                                                <td>{rowPhone}</td>
                                                <td>{rowEstado}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="outmaquita-rrss__select-button"
                                                        onClick={() => {
                                                            setRegistro(row);
                                                            setSuccessMessage(
                                                                "",
                                                            );
                                                            setError("");
                                                        }}
                                                    >
                                                        Seleccionar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );

    const renderGestionContent = () =>
        registro ? (
            <div className="outmaquita-rrss__tab-panel">
                <div className="outmaquita-rrss__selected-head">
                    <h2 className="outmaquita-rrss__section-title">
                        Formulario de gestion
                    </h2>
                    <button
                        type="button"
                        className="outmaquita-rrss__search-button"
                        onClick={() => {
                            setRegistro(null);
                            setSuccessMessage("");
                            setError("");
                        }}
                    >
                        Volver a tabla
                    </button>
                </div>
                {renderGestionForm(() => {
                    setRegistro(null);
                    setSuccessMessage("");
                    setError("");
                })}
            </div>
        ) : (
            <div className="outmaquita-rrss__tab-panel">
                <div className="outmaquita-rrss__regestion-card">
                    <div className="outmaquita-rrss__regestion-head">
                        <h2 className="outmaquita-rrss__section-title">
                            Registros para gestion
                        </h2>
                        <span className="outmaquita-rrss__regestion-count">
                            {gestionRows.length} pendientes
                        </span>
                    </div>
                    {gestionRows.length === 0 ? (
                        <div className="outmaquita-rrss__empty-state">
                            No hay registros disponibles para gestion.
                        </div>
                    ) : (
                        <div className="outmaquita-rrss__table-wrapper">
                            <table className="outmaquita-rrss__table">
                                <thead>
                                    <tr>
                                        <th>Identificacion</th>
                                        <th>Cliente</th>
                                        <th>Celular</th>
                                        <th>Observacion</th>
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gestionRows.map((row) => {
                                        const rowId =
                                            getRrssRegistroIdentification(row);
                                        const rowName =
                                            getFirstNonEmptyValue(row, [
                                                "full_name",
                                                "Apellidos y Nombres Completos ",
                                                "Apellidos y Nombres Completos",
                                                "D",
                                            ]) || "";
                                        const rowPhone =
                                            getFirstNonEmptyValue(row, [
                                                "celular",
                                                "Celular",
                                                "G",
                                            ]) || "";
                                        const rowObservation =
                                            getFirstNonEmptyValue(
                                                row,
                                                [
                                                    "observacion_cooperativa",
                                                    ...RRSS_OBSERVACION_KEYS,
                                                ],
                                            ) || "";

                                        return (
                                            <tr key={`${rowId}-${row.id || ""}`}>
                                                <td>{rowId}</td>
                                                <td>{rowName}</td>
                                                <td>{rowPhone}</td>
                                                <td>{rowObservation}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="outmaquita-rrss__select-button"
                                                        onClick={() => {
                                                            setRegistro(row);
                                                            setSuccessMessage(
                                                                "",
                                                            );
                                                            setError("");
                                                        }}
                                                    >
                                                        Seleccionar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );

    const renderHistoricoContent = () => (
        <div className="outmaquita-rrss__tab-panel">
            <div className="outmaquita-rrss__regestion-card">
                <div className="outmaquita-rrss__regestion-head">
                    <h2 className="outmaquita-rrss__section-title">
                        Historico de gestiones
                    </h2>
                    <span className="outmaquita-rrss__regestion-count">
                        {historicoRows.length} registros
                    </span>
                </div>
                <div className="outmaquita-rrss__historico-filters">
                    <input
                        className="outmaquita-rrss__historico-input"
                        type="date"
                        value={historicoStartDate}
                        onChange={(event) => setHistoricoStartDate(event.target.value)}
                    />
                    <input
                        className="outmaquita-rrss__historico-input"
                        type="date"
                        value={historicoEndDate}
                        onChange={(event) => setHistoricoEndDate(event.target.value)}
                    />
                    <input
                        type="text"
                        className="outmaquita-rrss__historico-input outmaquita-rrss__historico-input--search"
                        placeholder="Buscar por cédula, teléfono o nombre"
                        value={historicoSearch}
                        onChange={(event) => setHistoricoSearch(event.target.value)}
                    />
                    <button
                        type="button"
                        className="outmaquita-rrss__historico-clear-btn"
                        onClick={() => {
                            setHistoricoStartDate("");
                            setHistoricoEndDate("");
                            setHistoricoSearch("");
                            setHistoricoSearchDebounced("");
                        }}
                    >
                        Limpiar filtros
                    </button>
                    {historicoLoading ? (
                        <span className="outmaquita-rrss__historico-loading">Buscando...</span>
                    ) : null}
                </div>
                {historicoRows.length === 0 ? (
                    <div className="outmaquita-rrss__empty-state">
                        No hay gestiones historicas registradas.
                    </div>
                ) : (
                    <div className="outmaquita-rrss__table-wrapper">
                        <table className="outmaquita-rrss__table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Identificacion</th>
                                    <th>Cliente</th>
                                    <th>Motivo</th>
                                    <th>Submotivo</th>
                                    <th>Observacion</th>
                                    <th>Producto</th>
                                    <th>Observacion AGENTE MAQUITA</th>
                                    <th>PROCESO A REALIZAR</th>
                                    <th>Asesor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historicoRows.map((row, index) => (
                                    <tr
                                        key={`${String(row?.identification || "").trim()}-${String(
                                            row?.fecha_gestion || "",
                                        )}-${index}`}
                                    >
                                        <td>
                                            {String(row?.fecha_gestion || "")
                                                .replace("T", " ")
                                                .slice(0, 19)}
                                        </td>
                                        <td>{String(row?.identification || "").trim()}</td>
                                        <td>{String(row?.full_name || "").trim()}</td>
                                        <td>{String(row?.motivo_interaccion || "").trim()}</td>
                                        <td>{String(row?.submotivo_interaccion || "").trim()}</td>
                                        <td>{String(row?.observaciones || "").trim()}</td>
                                        <td>{String(row?.producto || "").trim()}</td>
                                        <td>{String(row?.observacion_agente_maquita || "").trim()}</td>
                                        <td>{String(row?.proceso_a_realizar || "").trim()}</td>
                                        <td>{String(row?.agent || "").trim()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading && !isHistoricoTab) {
        return (
            <div className="outmaquita-rrss__status">Cargando registros...</div>
        );
    }

    return (
        <div className="outmaquita-rrss">
            <div className="outmaquita-rrss__shell">
                <div className="outmaquita-rrss__header">
                    <button
                        type="button"
                        className="outmaquita-rrss__back-button"
                        onClick={onBack}
                    >
                        Regresar
                    </button>
                    <h1 className="outmaquita-rrss__title">
                        Gestion Leads RRSS
                    </h1>
                </div>

                {successMessage ? (
                    <div className="outmaquita-rrss__success">
                        {successMessage}
                    </div>
                ) : null}

                {error ? (
                    <div className="outmaquita-rrss__error">{error}</div>
                ) : null}

                <div className="outmaquita-rrss__tabs-card">
                    <Tabs
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        tabs={[
                            {
                                id: "gestion",
                                label: "Gestion",
                                content: renderGestionContent(),
                            },
                            {
                                id: "regestion",
                                label: "Regestion",
                                content: renderRegestionContent(),
                            },
                            {
                                id: "historico",
                                label: "Historico",
                                content: renderHistoricoContent(),
                            },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}









