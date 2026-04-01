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
const FLOW_STATUS_KEYS = ["Estado", "Estado ", "U"];
const RRSS_REGESTION_STATUS_VALUES = [
    "No contesta",
    "Volver a llamar",
    "Seguimiento",
];
const CAMPAIGN_ID = "Out Maquita Cushunchic";
const RRSS_OBSERVACION_KEYS = ["Observacion AGENTE MAQUITA", "R"];
const RRSS_PROCESO_KEYS = ["PROCESO A REALIZAR ", "PROCESO A REALIZAR", "S"];
const RRSS_USUARIO_KEYS = ["Usuario Maquita ", "Usuario Maquita", "T"];
const RRSS_STATUS_EMPTY_KEY_GROUPS = [
    ["U"],
    ["V"],
    ["W"],
    ["X"],
];
const RRSS_TIPO_RELACION_KEYS = [
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
        name: "autorizaBuro",
        label: "Autoriza Buro si / no",
        type: "select",
        required: false,
        options: [
            { value: "SI", label: "SI" },
            { value: "NO", label: "NO" },
        ],
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
        name: "ingresoNetoRecibir",
        label: "Ingreso Neto a recibir:",
        type: "text",
        required: false,
    },
    {
        name: "tipoRelacionLaboral",
        label: "Tipo de relacion laboral",
        type: "select",
        required: false,
        options: [
            { value: "Dependiente", label: "Dependiente" },
            { value: "Independiente", label: "Independiente" },
        ],
    },
    {
        name: "actividadEconomicaTiempo",
        label: "Actividad economica y que tiempo:",
        type: "textarea",
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
            ]) ||
            "",
        tipoCampana: registro?.tipoCampana || registro?.TipoCampania || "",
        celular: getFirstNonEmptyValue(registro, ["Celular", "G"]) || "",
        motivoInteraccion:
            registro?.motivoInteraccion || registro?.MotivoLlamada || "",
        submotivoInteraccion:
            registro?.submotivoInteraccion || registro?.SubmotivoLlamada || "",
        observaciones: registro?.observaciones || registro?.Observaciones || "",
        autorizaBuro: getFirstNonEmptyValue(registro, [
            "Autoriza Buró si / no",
            "Autoriza Buro si / no",
            "Autoriza Buró",
            "Autoriza Buro",
            "C",
        ]),
        ciudad: getFirstNonEmptyValue(registro, ["CIUDAD", "F"]),
        montoSolicitadoRrss: getFirstNonEmptyValue(registro, [
            "Monto solicitado:",
            "Monto solicitado",
            "H",
        ]),
        tipoRelacionLaboral: getFirstNonEmptyValue(
            registro,
            RRSS_TIPO_RELACION_KEYS,
        ),
        tipoVivienda: getFirstNonEmptyValue(registro, RRSS_TIPO_VIVIENDA_KEYS),
        producto: getFirstNonEmptyValue(registro, RRSS_PRODUCTO_KEYS),
        observacionAgenteMaquita: getFirstNonEmptyValue(
            registro,
            RRSS_OBSERVACION_KEYS,
        ),
        procesoARealizarRrss: getFirstNonEmptyValue(registro, RRSS_PROCESO_KEYS),
        usuarioMaquita: getFirstNonEmptyValue(registro, RRSS_USUARIO_KEYS),
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
        autorizaBuro: "",
        tipoRelacionLaboral: "",
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
    const [gestionRows, setGestionRows] = React.useState([]);
    const [regestionRows, setRegestionRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [successMessage, setSuccessMessage] = React.useState("");
    const [rrssDriveDuplicateMessage, setRrssDriveDuplicateMessage] =
        React.useState("");
    const [rrssDraft, setRrssDraft] = React.useState({});
    const [rrssDriveDraft, setRrssDriveDraft] = React.useState(
        buildRrssDriveInitialValues(),
    );
    const isRegestionTab = activeTab === "regestion";
    const hasRequiredGestionData = React.useCallback(
        (row) =>
            String(getFirstNonEmptyValue(row, RRSS_OBSERVACION_KEYS) || "").trim() !==
                "" &&
            String(getFirstNonEmptyValue(row, RRSS_PROCESO_KEYS) || "").trim() !==
                "" &&
            String(getFirstNonEmptyValue(row, RRSS_USUARIO_KEYS) || "").trim() !==
                "" &&
            RRSS_STATUS_EMPTY_KEY_GROUPS.every(
                (keys) =>
                    String(getFirstNonEmptyValue(row, keys) || "").trim() ===
                    "",
            ),
        [],
    );
    const flowFilter = React.useMemo(
        () =>
            isRegestionTab
                ? {
                      statusKeys: FLOW_STATUS_KEYS,
                      matchMode: "in",
                      matchValues: RRSS_REGESTION_STATUS_VALUES,
                  }
                : {
                      statusKeys: [],
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
                    setGestionRows([]);
                    setRegestionRows(data);
                    setRegistro(null);
                } else {
                    setGestionRows(data.filter(hasRequiredGestionData));
                    setRegestionRows([]);
                    setRegistro(null);
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
    }, [hasRequiredGestionData, isRegestionTab, loadFlowRows]);

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

    React.useEffect(() => {
        setRrssDriveDraft(buildRrssDriveInitialValues());
    }, [registro]);

    React.useEffect(() => {
        let cancelled = false;

        async function validateDriveDuplicate() {
            if (activeTab !== "drive") {
                setRrssDriveDuplicateMessage("");
                return;
            }

            const identification = String(
                rrssDriveDraft?.identificacion ||
                    rrssDriveDraft?.Identificacion ||
                    rrssDriveDraft?.identification ||
                    "",
            ).trim();

            if (!identification) {
                setRrssDriveDuplicateMessage("");
                return;
            }

            try {
                const rows = await fetchOutMaquitaFlowData({
                    gid: FLOW_GID,
                    statusKeys: [],
                    matchMode: "empty",
                    matchValues: [],
                });

                if (cancelled) return;

                const exists = rows.some(
                    (row) => String(row?.D || "").trim() === identification,
                );

                setRrssDriveDuplicateMessage(
                    exists
                        ? "Ya existe un registro en Datos Drive con esa cedula."
                        : "",
                );
            } catch {
                if (!cancelled) {
                    setRrssDriveDuplicateMessage("");
                }
            }
        }

        validateDriveDuplicate();

        return () => {
            cancelled = true;
        };
    }, [activeTab, rrssDriveDraft]);

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
            {
                name: "autorizaBuro",
                label: "Autoriza Buro si / no",
                type: "text",
                required: false,
                readOnly: true,
            },
            ...RRSS_EXTRA_FIELDS.slice(1),
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
            let all = [];
            try {
                all = await loadFlowRows();
            } catch {
                setBusquedaId("");
                setRegistro(null);
                setError(
                    "La gestion se guardo, pero no se pudo refrescar la lista de Google Sheets.",
                );
                return;
            }

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
                        return (
                            itemId &&
                            itemId !== currentId &&
                            (isRegestionTab || hasRequiredGestionData(item))
                        );
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
                setGestionRows(
                    all.filter((item) => {
                        const itemId = getRrssRegistroIdentification(item);
                        return (
                            hasRequiredGestionData(item) &&
                            itemId &&
                            itemId !== currentId
                        );
                    }),
                );
                setRegistro(null);
            }
            setBusquedaId("");

            if (!siguiente) {
                setSuccessMessage(
                    "Registro guardado correctamente. No hay mas registros disponibles.",
                );
            }
        },
        [hasRequiredGestionData, isRegestionTab, loadFlowRows],
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
                throw new Error(json?.detail || json?.error || errorMessage);
            }
        },
        [],
    );

    const resetDriveForm = React.useCallback(() => {
        setRrssDriveDraft(buildRrssDriveInitialValues());
        setRrssDriveDuplicateMessage("");
    }, []);

    const saveDriveOnly = React.useCallback(
        async (formData) => {
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

            if (rrssDriveDuplicateMessage) {
                throw new Error(rrssDriveDuplicateMessage);
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
        },
        [rrssDriveDuplicateMessage],
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
                        if (
                            String(saveError?.message || "").includes(
                                "no se pudo refrescar la lista de Google Sheets",
                            )
                        ) {
                            return;
                        }
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
                        setSuccessMessage("Registro actualizado correctamente");
                        await cargarSiguienteRegistro(
                            getRegistroIdentification(merged),
                            registro?.__rowNumber || 0,
                        );
                    } catch (saveError) {
                        if (
                            String(saveError?.message || "").includes(
                                "no se pudo refrescar la lista de Google Sheets",
                            )
                        ) {
                            return;
                        }
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
                                        <th>Autoriza Buro</th>
                                        <th>Relacion laboral</th>
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
                                            ]) || "";
                                        const rowAutorizaBuro =
                                            getFirstNonEmptyValue(row, [
                                                "Autoriza Buró si / no",
                                                "Autoriza Buro si / no",
                                                "Autoriza Buró",
                                                "Autoriza Buro",
                                                "C",
                                            ]) || "";
                                        const rowTipoRelacionLaboral =
                                            getFirstNonEmptyValue(
                                                row,
                                                RRSS_TIPO_RELACION_KEYS,
                                            ) || "";
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
                                                <td>{rowAutorizaBuro}</td>
                                                <td>{rowTipoRelacionLaboral}</td>
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
                                        <th>Autoriza Buro</th>
                                        <th>Relacion laboral</th>
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
                                                "Apellidos y Nombres Completos ",
                                                "Apellidos y Nombres Completos",
                                                "D",
                                            ]) || "";
                                        const rowAutorizaBuro =
                                            getFirstNonEmptyValue(row, [
                                                "Autoriza Buró si / no",
                                                "Autoriza Buro si / no",
                                                "Autoriza Buró",
                                                "Autoriza Buro",
                                                "C",
                                            ]) || "";
                                        const rowTipoRelacionLaboral =
                                            getFirstNonEmptyValue(
                                                row,
                                                RRSS_TIPO_RELACION_KEYS,
                                            ) || "";
                                        const rowPhone =
                                            getFirstNonEmptyValue(row, [
                                                "Celular",
                                                "G",
                                            ]) || "";
                                        const rowObservation =
                                            getFirstNonEmptyValue(
                                                row,
                                                RRSS_OBSERVACION_KEYS,
                                            ) || "";

                                        return (
                                            <tr
                                                key={`${rowId}-${row.__rowNumber}`}
                                            >
                                                <td>{rowId}</td>
                                                <td>{rowAutorizaBuro}</td>
                                                <td>{rowTipoRelacionLaboral}</td>
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
                                id: "drive",
                                label: "Datos Drive",
                                content: (
                                    <div className="outmaquita-rrss__tab-panel">
                                        {rrssDriveDuplicateMessage ? (
                                            <div className="outmaquita-rrss__error">
                                                {rrssDriveDuplicateMessage}
                                            </div>
                                        ) : null}
                                        <FormularioDinamico
                                            variant="outbound"
                                            formAutoComplete="off"
                                            template={RRSS_DRIVE_TEMPLATE}
                                            initialValues={rrssDriveDraft}
                                            onChangeCampo={(name, value) =>
                                                setRrssDriveDraft((prev) => ({
                                                    ...prev,
                                                    [name]: value,
                                                }))
                                            }
                                            onGuardar={async (formData) => {
                                                try {
                                                    setError("");
                                                    const merged = {
                                                        ...rrssDriveDraft,
                                                        ...formData,
                                                    };
                                                    await saveDriveOnly(merged);
                                                    setSuccessMessage(
                                                        "Datos del drive guardados correctamente",
                                                    );
                                                    resetDriveForm();
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
                                                    await saveDriveOnly(merged);
                                                    setSuccessMessage(
                                                        "Datos del drive actualizados correctamente",
                                                    );
                                                    resetDriveForm();
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
            </div>
        </div>
    );
}
