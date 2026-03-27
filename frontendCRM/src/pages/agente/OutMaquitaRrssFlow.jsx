import React from "react";
import { formF2Template } from "../../templates/formF2Template";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
import FormularioDinamico from "../../components/FormularioDinamico";
import Tabs from "../../components/common/Tabs";
import { fetchOutMaquitaFlowData } from "../../services/outMaquitaFlows.service";
import {
    guardarGestionOutbound,
    guardarOutMaquitaRrssDrive,
} from "../../services/dashboard.service";
import {
    getFirstNonEmptyValue,
    getRegistroIdentification,
    getRrssRegistroIdentification,
    getTodayFormatted,
    OUT_MAQUITA_RRSS_MOTIVOS,
    OUT_MAQUITA_RRSS_SUBMOTIVOS,
} from "./outMaquitaConfig";
import "./OutMaquitaRrssFlow.css";

const FLOW_GID = "463742430";
const FLOW_STATUS_KEYS = ["Estado", "Estado ", "S"];
const RRSS_REGESTION_STATUS_VALUES = [
    "No contesta",
    "Volver a llamar",
    "Seguimiento",
];
const CAMPAIGN_ID = "Out Maquita Cushunchic";

const RRSS_EXTRA_FIELDS = [
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
        name: "tipoVivienda",
        label: "Tipo de Vivienda:",
        type: "text",
        required: false,
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
        name: "usuarioMaquita",
        label: "Usuario Maquita",
        type: "text",
        required: false,
        readOnly: true,
    },
];

const RRSS_DRIVE_TEMPLATE = [
    {
        name: "asesor",
        label: "Asesor",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "fecha",
        label: "Fecha",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "identificacion",
        label: "Numero de Cedula",
        type: "text",
        required: false,
    },
    {
        name: "apellidosNombres",
        label: "Apellidos y Nombres Completos",
        type: "text",
        required: false,
    },
    {
        name: "estadoCivil",
        label: "Estado Civil",
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
        name: "celular",
        label: "Celular",
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
        name: "destinoCredito",
        label: "Destino del credito:",
        type: "textarea",
        required: false,
    },
    {
        name: "actividadEconomicaTiempo",
        label: "Actividad economica y que tiempo:",
        type: "textarea",
        required: false,
    },
    {
        name: "ingresoNetoRecibir",
        label: "Ingreso Neto a recibir:",
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
        name: "mantieneHijos",
        label: "Si mantiene hijos que dependan:",
        type: "text",
        required: false,
    },
    {
        name: "otrosIngresos",
        label: "Otros ingresos:",
        type: "textarea",
        required: false,
    },
];

function buildRrssBaseValues(registro) {
    return {
        identificacion: getRrssRegistroIdentification(registro),
        apellidosNombres:
            registro?.apellidosNombres ||
            registro?.NombreCliente ||
            getFirstNonEmptyValue(registro, [
                "Apellidos y Nombres Completos ",
                "Apellidos y Nombres Completos",
                "D",
                "C",
            ]) ||
            "",
        tipoCampana: registro?.tipoCampana || registro?.TipoCampania || "",
        celular: getFirstNonEmptyValue(registro, ["Celular", "G"]) || "",
        motivoInteraccion:
            registro?.motivoInteraccion || registro?.MotivoLlamada || "",
        submotivoInteraccion:
            registro?.submotivoInteraccion || registro?.SubmotivoLlamada || "",
        observaciones: registro?.observaciones || registro?.Observaciones || "",
        ciudad: getFirstNonEmptyValue(registro, ["CIUDAD", "F"]),
        montoSolicitadoRrss: getFirstNonEmptyValue(registro, [
            "Monto solicitado:",
            "Monto solicitado",
            "H",
        ]),
        tipoVivienda: getFirstNonEmptyValue(registro, [
            "Tipo de Vivienda:",
            "Tipo de Vivienda",
            "L",
        ]),
        producto: getFirstNonEmptyValue(registro, ["Producto", "O"]),
        observacionAgenteMaquita: getFirstNonEmptyValue(registro, [
            "Observacion AGENTE MAQUITA",
            "P",
        ]),
        procesoARealizarRrss: getFirstNonEmptyValue(registro, [
            "PROCESO A REALIZAR ",
            "PROCESO A REALIZAR",
            "Q",
        ]),
        usuarioMaquita: getFirstNonEmptyValue(registro, [
            "Usuario Maquita ",
            "Usuario Maquita",
            "R",
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

function buildRrssDriveInitialValues() {
    return {
        asesor: localStorage.getItem("import_user") || "",
        fecha: getTodayFormatted(),
        identificacion: "",
        apellidosNombres: "",
        estadoCivil: "",
        ciudad: "",
        celular: "",
        montoSolicitadoRrss: "",
        destinoCredito: "",
        actividadEconomicaTiempo: "",
        ingresoNetoRecibir: "",
        tipoVivienda: "",
        mantieneHijos: "",
        otrosIngresos: "",
    };
}

export default function OutMaquitaRrssFlow({ onBack }) {
    const [tiposCampania, setTiposCampania] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState("gestion");
    const [busquedaId, setBusquedaId] = React.useState("");
    const [buscando, setBuscando] = React.useState(false);
    const [registro, setRegistro] = React.useState(null);
    const [regestionRows, setRegestionRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [successMessage, setSuccessMessage] = React.useState("");
    const [rrssDraft, setRrssDraft] = React.useState({});
    const [rrssDriveDraft, setRrssDriveDraft] = React.useState(
        buildRrssDriveInitialValues(),
    );
    const isRegestionTab = activeTab === "regestion";
    const flowFilter = React.useMemo(
        () =>
            isRegestionTab
                ? {
                      statusKeys: FLOW_STATUS_KEYS,
                      matchMode: "in",
                      matchValues: RRSS_REGESTION_STATUS_VALUES,
                  }
                : {
                      statusKeys: FLOW_STATUS_KEYS,
                      matchMode: "empty",
                      matchValues: [],
                  },
        [isRegestionTab],
    );

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
            gid: FLOW_GID,
            statusKeys: flowFilter.statusKeys,
            matchMode: flowFilter.matchMode,
            matchValues: flowFilter.matchValues,
        });
    }, [flowFilter]);

    React.useEffect(() => {
        let mounted = true;

        async function loadInitialRow() {
            setLoading(true);
            setError("");
            setSuccessMessage("");

            try {
                const data = await loadFlowRows();

                if (!mounted) return;

                if (isRegestionTab) {
                    setRegestionRows(data);
                    setRegistro(null);
                } else {
                    setRegestionRows([]);
                    setRegistro(data[0] || null);
                }
            } catch {
                if (mounted) {
                    setError("No se pudo obtener datos de Google Sheets");
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadInitialRow();

        return () => {
            mounted = false;
        };
    }, [isRegestionTab, loadFlowRows]);

    React.useEffect(() => {
        if (registro) {
            setSuccessMessage("");
        }
    }, [registro]);

    React.useEffect(() => {
        setRrssDraft(buildRrssBaseValues(registro));
    }, [registro]);

    React.useEffect(() => {
        setRrssDriveDraft(buildRrssDriveInitialValues());
    }, [registro]);

    const dynamicTemplate = React.useMemo(
        () => [
            ...formF2Template.map((field) => {
                if (field.name === "tipoCampana") {
                    return {
                        ...field,
                        type: "select",
                        options: tiposCampania.map((item) => ({
                            value: item,
                            label: item,
                        })),
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
                        options: OUT_MAQUITA_RRSS_SUBMOTIVOS.map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                return field;
            }),
            ...RRSS_EXTRA_FIELDS,
        ],
        [tiposCampania],
    );

    const buscarRegistro = async () => {
        setBuscando(true);
        setError("");
        setSuccessMessage("");

        try {
            const all = await loadFlowRows();
            const data =
                all.find(
                    (row) => getRrssRegistroIdentification(row) === busquedaId,
                ) || null;

            if (data) {
                setRegistro(data);
                return;
            }

            setRegistro(null);
            setError("No se encontró registro para esa identificación.");
        } catch {
            setError("Error buscando registro");
        } finally {
            setBuscando(false);
        }
    };

    const cargarSiguienteRegistro = React.useCallback(
        async (currentIdentification = "", currentRowNumber = 0) => {
            const all = await loadFlowRows();

            const currentId = String(currentIdentification || "").trim();
            const currentRow = Number(currentRowNumber || 0);

            let siguiente = null;

            if (currentRow > 0) {
                siguiente =
                    all.find(
                        (item) => Number(item?.__rowNumber || 0) > currentRow,
                    ) || null;
            }

            if (!siguiente) {
                siguiente =
                    all.find((item) => {
                        const itemId = getRrssRegistroIdentification(item);
                        return itemId && itemId !== currentId;
                    }) || null;
            }

            if (isRegestionTab) {
                setRegestionRows(
                    all.filter((item) => {
                        const itemId = getRrssRegistroIdentification(item);
                        return itemId && itemId !== currentId;
                    }),
                );
                setRegistro(null);
            } else {
                setRegistro(siguiente);
            }
            setBusquedaId("");

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
            const fieldsMeta = template.map((field) => ({
                name: field.name,
                label: field.label,
            }));
            const { ok, json } = await guardarGestionOutbound({
                campaignId: CAMPAIGN_ID,
                formData: {
                    ...formData,
                    outboundFlow: "rrss",
                },
                fieldsMeta,
            });

            if (!ok) {
                throw new Error(json?.error || errorMessage);
            }
        },
        [],
    );

    const saveDriveOnly = React.useCallback(async (formData) => {
        const identification = String(
            formData?.identificacion ||
                formData?.Identificacion ||
                formData?.identification ||
                "",
        ).trim();

        if (!identification) {
            throw new Error(
                "Numero de Cedula es requerido para enviar datos al Drive",
            );
        }

        const { ok, json } = await guardarOutMaquitaRrssDrive({
            campaignId: CAMPAIGN_ID,
            formData: {
                ...formData,
                outboundFlow: "rrss",
            },
        });

        if (!ok) {
            throw new Error(
                json?.detail ||
                    json?.error ||
                    "No se pudieron enviar los datos al Drive",
            );
        }
    }, []);

    const renderGestionForm = (cancelHandler = onBack) => (
        <div className="outmaquita-rrss__tab-panel">
            <FormularioDinamico
                template={dynamicTemplate}
                initialValues={rrssDraft}
                onChangeCampo={(name, value) =>
                    setRrssDraft((prev) => ({
                        ...prev,
                        [name]: value,
                    }))
                }
                onGuardar={async (formData) => {
                    try {
                        setError("");
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
                            getRegistroIdentification(merged),
                            registro?.__rowNumber || 0,
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
                        const merged = {
                            ...rrssDraft,
                            ...formData,
                        };
                        await saveWithTemplate(
                            merged,
                            dynamicTemplate,
                            "No se pudo actualizar la gestion outbound",
                        );
                        setSuccessMessage(
                            "Registro actualizado correctamente",
                        );
                        await cargarSiguienteRegistro(
                            getRegistroIdentification(merged),
                            registro?.__rowNumber || 0,
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
                                                "Apellidos y Nombres Completos ",
                                                "Apellidos y Nombres Completos",
                                                "D",
                                                "C",
                                            ]) || "";
                                        const rowPhone =
                                            getFirstNonEmptyValue(row, [
                                                "Celular",
                                                "G",
                                            ]) || "";
                                        const rowEstado =
                                            getFirstNonEmptyValue(
                                                row,
                                                FLOW_STATUS_KEYS,
                                            ) || "";

                                        return (
                                            <tr
                                                key={`${rowId}-${row.__rowNumber}`}
                                            >
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

    if (loading) {
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

                {!isRegestionTab ? (
                    <div className="outmaquita-rrss__search">
                        <input
                            type="text"
                            placeholder="Buscar por identificación"
                            value={busquedaId}
                            onChange={(event) => setBusquedaId(event.target.value)}
                            maxLength={20}
                            className="outmaquita-rrss__search-input"
                        />
                        <button
                            type="button"
                            disabled={buscando || !busquedaId}
                            className="outmaquita-rrss__search-button"
                            onClick={buscarRegistro}
                        >
                            {buscando ? "Buscando..." : "Buscar"}
                        </button>
                    </div>
                ) : null}

                {!registro && !isRegestionTab ? (
                    <div className="outmaquita-rrss__empty-state">
                        No hay registros disponibles para este flujo.
                    </div>
                ) : (
                    <div className="outmaquita-rrss__tabs-card">
                        <Tabs
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            tabs={[
                                {
                                    id: "gestion",
                                    label: "Gestion",
                                    content: renderGestionForm(),
                                },
                                {
                                    id: "regestion",
                                    label: "Regestion",
                                    content: renderRegestionContent(),
                                },
                                {
                                    id: "drive",
                                    label: "Datos Drive",
                                    content: (
                                        <div className="outmaquita-rrss__tab-panel">
                                            <FormularioDinamico
                                                template={RRSS_DRIVE_TEMPLATE}
                                                initialValues={rrssDriveDraft}
                                                onChangeCampo={(name, value) =>
                                                    setRrssDriveDraft(
                                                        (prev) => ({
                                                            ...prev,
                                                            [name]: value,
                                                        }),
                                                    )
                                                }
                                                onGuardar={async (formData) => {
                                                    try {
                                                        setError("");
                                                        const merged = {
                                                            ...rrssDriveDraft,
                                                            ...formData,
                                                        };
                                                        await saveDriveOnly(
                                                            merged,
                                                        );
                                                        setSuccessMessage(
                                                            "Datos del drive guardados correctamente",
                                                        );
                                                    } catch (saveError) {
                                                        setSuccessMessage("");
                                                        setError(
                                                            saveError?.message ||
                                                                "Error guardando datos del drive",
                                                        );
                                                    }
                                                }}
                                                onActualizar={async (formData) => {
                                                    try {
                                                        setError("");
                                                        const merged = {
                                                            ...rrssDriveDraft,
                                                            ...formData,
                                                        };
                                                        await saveDriveOnly(
                                                            merged,
                                                        );
                                                        setSuccessMessage(
                                                            "Datos del drive actualizados correctamente",
                                                        );
                                                    } catch (saveError) {
                                                        setSuccessMessage("");
                                                        setError(
                                                            saveError?.message ||
                                                                "Error actualizando datos del drive",
                                                        );
                                                    }
                                                }}
                                                onCancelar={onBack}
                                                esUpdate
                                            />
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
