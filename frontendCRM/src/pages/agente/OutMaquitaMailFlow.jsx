import React from "react";
import { formF2Template } from "../../templates/formF2Template";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
import FormularioDinamico from "../../components/FormularioDinamico";
import Tabs from "../../components/common/Tabs";
import { fetchOutMaquitaFlowData } from "../../services/outMaquitaFlows.service";
import {
    fetchGestionOutboundByIdentification,
    guardarGestionOutbound,
} from "../../services/dashboard.service";
import {
    getFirstNonEmptyValue,
    getMailRegistroIdentification,
    getRegistroIdentification,
    OUT_MAQUITA_MAIL_MOTIVOS,
    OUT_MAQUITA_MAIL_SUBMOTIVOS,
} from "./outMaquitaConfig";
import "./OutMaquitaMailFlow.css";

const FLOW_GID = "676353334";
const FLOW_STATUS_KEYS = ["Estado", "Estado ", "J"];
const REGESTION_STATUS_KEYS = ["Estado", "Estado ", "K"];
const REGESTION_STATUS_VALUES = [
    "Volver a llamar",
    "Grabadora.",
    "Cuelga llamada.",
    "Seguimiento.",
];
const CAMPAIGN_ID = "Out Maquita Cushunchic";
const GESTION_REQUIRED_KEYS = ["N", "P"];
const GESTION_EMPTY_KEYS = ["K", "L", "M"];

const MAIL_EXTRA_FIELDS = [
    {
        name: "montoSolicitado",
        label: "Monto Solicitado",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "procesoARealizar",
        label: "Proceso a realizar",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "montoAplica",
        label: "Monto Aplica",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "observacionCooperativa",
        label: "Observacion Cooperativa",
        type: "textarea",
        required: false,
        readOnly: true,
    },
    {
        name: "fechaContacto",
        label: "Fecha contacto",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "estatusA",
        label: "Estatus A",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "agencia",
        label: "Agencia",
        type: "text",
        required: false,
        readOnly: true,
    },
    {
        name: "asesorOperativo",
        label: "Asesor Operativo",
        type: "text",
        required: false,
        readOnly: true,
    },
];

function buildMailInitialValues(registro) {
    return {
        identificacion: getMailRegistroIdentification(registro),
        apellidosNombres:
            registro?.apellidosNombres ||
            registro?.NombreCliente ||
            getFirstNonEmptyValue(registro, [
                "Nombres completos",
                "Apellidos y Nombres Completos",
                "C",
            ]) ||
            "",
        tipoCampana: registro?.tipoCampana || registro?.TipoCampania || "",
        celular:
            registro?.celular ||
            registro?.Celular ||
            getFirstNonEmptyValue(registro, [
                "TelÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono Celular",
                "Telefono Celular",
                "Celular",
                "H",
            ]) ||
            "",
        motivoInteraccion:
            registro?.motivoInteraccion || registro?.MotivoLlamada || "",
        submotivoInteraccion:
            registro?.submotivoInteraccion || registro?.SubmotivoLlamada || "",
        observaciones: registro?.observaciones || registro?.Observaciones || "",
        montoSolicitado: getFirstNonEmptyValue(registro, [
            "Monto solicitado",
            "Monto Solicitado",
            "I",
        ]),
        procesoARealizar: getFirstNonEmptyValue(registro, [
            "PROCESO A REALIZAR ",
            "PROCESO A REALIZAR",
            "Proceso a realizar",
            "J",
        ]),
        montoAplica: getFirstNonEmptyValue(registro, ["Monto Aplica", "K"]),
        observacionCooperativa: getFirstNonEmptyValue(registro, [
            "Observacion Cooperativa ",
            "Observacion Cooperativa",
            "ObservaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n Cooperativa",
            "L",
        ]),
        fechaContacto: getFirstNonEmptyValue(registro, [
            "Fecha de contacto",
            "Fecha contacto",
            "M",
        ]),
        estatusA: getFirstNonEmptyValue(registro, ["Estatus", "Estatus ", "Q"]),
        agencia: getFirstNonEmptyValue(registro, ["Agencia ", "Agencia", "R"]),
        asesorOperativo: getFirstNonEmptyValue(registro, [
            "Asesor Operativo ",
            "Asesor Operativo",
            "S",
        ]),
    };
}

export default function OutMaquitaMailFlow({ onBack }) {
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
    const [pdfUrl, setPdfUrl] = React.useState(null);

    const activeFlowConfig = React.useMemo(
        () =>
            activeTab === "regestion"
                ? {
                      title: "Regestion Leads Mail",
                      statusKeys: REGESTION_STATUS_KEYS,
                      matchMode: "in",
                      matchValues: REGESTION_STATUS_VALUES,
                  }
                : {
                      title: "Gestion Leads Mail",
                      statusKeys: [],
                      matchMode: "empty",
                      matchValues: [],
                  },
        [activeTab],
    );

    const hasRequiredGestionData = React.useCallback(
        (row) =>
            GESTION_REQUIRED_KEYS.every(
                (key) =>
                    String(getFirstNonEmptyValue(row, [key]) || "").trim() !==
                    "",
            ) &&
            GESTION_EMPTY_KEYS.every(
                (key) =>
                    String(getFirstNonEmptyValue(row, [key]) || "").trim() ===
                    "",
            ),
        [],
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
            statusKeys: activeFlowConfig.statusKeys,
            matchMode: activeFlowConfig.matchMode,
            matchValues: activeFlowConfig.matchValues,
        });
    }, [activeFlowConfig]);

    React.useEffect(() => {
        let mounted = true;

        async function loadInitialRow() {
            setLoading(true);
            setError("");
            setSuccessMessage("");
            setBusquedaId("");

            try {
                const data = await loadFlowRows();

                if (!mounted) return;

                if (activeTab === "regestion") {
                    setGestionRows([]);
                    setRegestionRows(data);
                    setRegistro(null);
                    return;
                }

                setGestionRows(data.filter(hasRequiredGestionData));
                setRegestionRows([]);
                setRegistro(null);
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
    }, [activeTab, hasRequiredGestionData, loadFlowRows]);

    React.useEffect(() => {
        if (registro) {
            setSuccessMessage("");
        }
    }, [registro]);

    const identificacion = getMailRegistroIdentification(registro);

    React.useEffect(() => {
        if (!identificacion) {
            setPdfUrl(null);
            return;
        }

        async function buscarPdf() {
            try {
                const apiBase = import.meta.env.VITE_API_BASE;
                const res = await fetch(`${apiBase}/uploads-list`);
                const archivos = await res.json();
                const encontrado = archivos.find((nombre) =>
                    nombre.startsWith(identificacion),
                );

                if (encontrado) {
                    setPdfUrl(`${apiBase}/uploads/${encontrado}`);
                    return;
                }

                setPdfUrl(null);
            } catch {
                setPdfUrl(null);
            }
        }

        buscarPdf();
    }, [identificacion]);

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
                        const itemId = getMailRegistroIdentification(item);
                        return itemId && itemId !== currentId;
                    }) || null;
            }

            if (activeTab === "regestion") {
                setRegestionRows(all.filter((item) => {
                    const itemId = getMailRegistroIdentification(item);
                    return itemId && itemId !== currentId;
                }));
                setRegistro(null);
            } else {
                setGestionRows(
                    all.filter((item) => {
                        const itemId = getMailRegistroIdentification(item);
                        return (
                            hasRequiredGestionData(item) &&
                            itemId &&
                            itemId !== currentId
                        );
                    }),
                );
                setRegistro(null);
            }
            setPdfUrl(null);
            setBusquedaId("");

            if (!siguiente) {
                setSuccessMessage(
                    "Registro guardado correctamente. No hay mas registros disponibles.",
                );
            }
        },
        [activeTab, hasRequiredGestionData, loadFlowRows],
    );

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
                        options: OUT_MAQUITA_MAIL_MOTIVOS.map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                if (field.name === "submotivoInteraccion") {
                    return {
                        ...field,
                        type: "select",
                        options: OUT_MAQUITA_MAIL_SUBMOTIVOS.map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                return field;
            }),
            ...MAIL_EXTRA_FIELDS,
        ],
        [tiposCampania],
    );

    const initialValues = React.useMemo(
        () => buildMailInitialValues(registro),
        [registro],
    );

    const quickActions = React.useMemo(
        () => [
            {
                id: "no-contesta",
                label: "No contesta",
                apply: (currentValues) => ({
                    ...currentValues,
                    motivoInteraccion: "No contactado",
                    submotivoInteraccion: "Volver a llamar",
                    observaciones: "No contesta",
                }),
            },
            {
                id: "grabadora",
                label: "Grabadora",
                apply: (currentValues) => ({
                    ...currentValues,
                    motivoInteraccion: "Grabadora.",
                    submotivoInteraccion: "Volver a llamar",
                    observaciones: "Contesta grabadora",
                }),
            },
            {
                id: "contesta-tercero",
                label: "Contesta tercero",
                apply: (currentValues) => ({
                    ...currentValues,
                    motivoInteraccion: "Contesta tercero.",
                    submotivoInteraccion: "Contesta tercero",
                    observaciones: "Contesta tercero",
                }),
            },
        ],
        [],
    );

    const saveOutboundGestion = React.useCallback(
        async (formData) => {
            const fieldsMeta = dynamicTemplate.map((field) => ({
                name: field.name,
                label: field.label,
            }));
            const { ok, json } = await guardarGestionOutbound({
                campaignId: CAMPAIGN_ID,
                formData: {
                    ...formData,
                    outboundFlow: "mail",
                },
                fieldsMeta,
            });

            if (!ok) {
                throw new Error(
                    json?.detail ||
                        json?.error ||
                        "No se pudo guardar la gestion outbound",
                );
            }
        },
        [dynamicTemplate],
    );

    const buscarRegistro = async () => {
        setBuscando(true);
        setError("");
        setSuccessMessage("");

        try {
            const { ok, json } = await fetchGestionOutboundByIdentification({
                campaignId: CAMPAIGN_ID,
                identification: busquedaId,
            });

            let data = ok ? json?.data : null;

            if (!data) {
                const all = await fetchOutMaquitaFlowData({
                    gid: FLOW_GID,
                    statusKeys: activeFlowConfig.statusKeys,
                    matchMode: activeFlowConfig.matchMode,
                    matchValues: activeFlowConfig.matchValues,
                });
                data =
                    all.find(
                        (row) =>
                            getMailRegistroIdentification(row) === busquedaId,
                    ) || null;
            }

            if (data) {
                setRegistro(data);
                setPdfUrl(null);
                return;
            }

            setRegistro(null);
            setPdfUrl(null);
            setError("No se encontrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ registro para esa identificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.");
        } catch {
            setError("Error buscando registro");
        } finally {
            setBuscando(false);
        }
    };

    const showRegestionTable = activeTab === "regestion";
    const showGestionTable = activeTab === "gestion";

    const renderMailTable = (rows, title, emptyMessage, statusKeys) => (
        <div className="outmaquita-mail__regestion-card">
            <div className="outmaquita-mail__regestion-head">
                <h2 className="outmaquita-mail__regestion-title">{title}</h2>
                <span className="outmaquita-mail__regestion-count">
                    {rows.length} pendientes
                </span>
            </div>

            {rows.length === 0 ? (
                <div className="outmaquita-mail__empty-state">
                    {emptyMessage}
                </div>
            ) : (
                <div className="outmaquita-mail__table-wrapper">
                    <table className="outmaquita-mail__table">
                        <thead>
                            <tr>
                                <th>Identificacion</th>
                                <th>Cliente</th>
                                <th>Celular</th>
                                <th>Observacion</th>
                                <th>Estado</th>
                                <th>Accion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const rowId = getMailRegistroIdentification(row);
                                const rowName =
                                    getFirstNonEmptyValue(row, [
                                        "Nombres completos",
                                        "Apellidos y Nombres Completos",
                                        "C",
                                    ]) || "";
                                const rowPhone =
                                    getFirstNonEmptyValue(row, [
                                        "Telefono Celular",
                                        "TelÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©fono Celular",
                                        "Celular",
                                        "H",
                                    ]) || "";
                                const rowObservation =
                                    getFirstNonEmptyValue(row, [
                                        "P",
                                        "Observacion",
                                        "Observación",
                                    ]) || "";
                                const rowEstado =
                                    getFirstNonEmptyValue(row, statusKeys) || "";

                                return (
                                    <tr key={`${rowId}-${row.__rowNumber}`}>
                                        <td>{rowId}</td>
                                        <td>{rowName}</td>
                                        <td>{rowPhone}</td>
                                        <td>{rowObservation}</td>
                                        <td>{rowEstado}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="outmaquita-mail__select-button"
                                                onClick={() => {
                                                    setRegistro(row);
                                                    setSuccessMessage("");
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
    );

    if (loading) {
        return (
            <div className="outmaquita-mail__status">Cargando registros...</div>
        );
    }

    return (
        <div className="outmaquita-mail">
            <div className="outmaquita-mail__layout">
                <section className="outmaquita-mail__form-panel">
                    <div className="outmaquita-mail__header">
                        <button
                            type="button"
                            className="outmaquita-mail__back-button"
                            onClick={onBack}
                        >
                            Regresar
                        </button>
                        <h1 className="outmaquita-mail__title">
                            {activeFlowConfig.title}
                        </h1>
                    </div>

                    <div className="outmaquita-mail__tabs">
                        <Tabs
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            tabs={[
                                { id: "gestion", label: "Gestion", content: null },
                                { id: "regestion", label: "Regestion", content: null },
                            ]}
                        />
                    </div>

                    {successMessage ? (
                        <div className="outmaquita-mail__success">
                            {successMessage}
                        </div>
                    ) : null}

                    {error ? (
                        <div className="outmaquita-mail__error">{error}</div>
                    ) : null}

                    {showRegestionTable ? (
                        <>
                            {!registro ? (
                                renderMailTable(
                                    regestionRows,
                                    "Registros para regestion",
                                    "No hay registros disponibles para regestion.",
                                    REGESTION_STATUS_KEYS,
                                )
                            ) : (
                                <div className="outmaquita-mail__selected-panel">
                                    <div className="outmaquita-mail__selected-head">
                                        <h2 className="outmaquita-mail__regestion-title">
                                            Formulario de regestion
                                        </h2>
                                        <button
                                            type="button"
                                            className="outmaquita-mail__search-button"
                                            onClick={() => {
                                                setRegistro(null);
                                                setPdfUrl(null);
                                            }}
                                        >
                                            Volver a tabla
                                        </button>
                                    </div>
                                    <FormularioDinamico
                                        template={dynamicTemplate}
                                        initialValues={initialValues}
                                        quickActions={quickActions}
                                        onGuardar={async (formData) => {
                                            try {
                                                setError("");
                                                await saveOutboundGestion(formData);
                                                setSuccessMessage(
                                                    "Registro guardado correctamente",
                                                );
                                                await cargarSiguienteRegistro(
                                                    getRegistroIdentification(formData),
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
                                                await saveOutboundGestion(formData);
                                                setSuccessMessage(
                                                    "Registro actualizado correctamente",
                                                );
                                                await cargarSiguienteRegistro(
                                                    getRegistroIdentification(formData),
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
                                        onCancelar={() => {
                                            setRegistro(null);
                                            setPdfUrl(null);
                                        }}
                                        esUpdate={Boolean(identificacion)}
                                    />
                                </div>
                            )}
                        </>
                    ) : showGestionTable ? (
                        <>
                            {!registro ? (
                                renderMailTable(
                                    gestionRows,
                                    "Registros para gestion",
                                    "No hay registros disponibles para gestion.",
                                    FLOW_STATUS_KEYS,
                                )
                            ) : (
                                <div className="outmaquita-mail__selected-panel">
                                    <div className="outmaquita-mail__selected-head">
                                        <h2 className="outmaquita-mail__regestion-title">
                                            Formulario de gestion
                                        </h2>
                                        <button
                                            type="button"
                                            className="outmaquita-mail__search-button"
                                            onClick={() => {
                                                setRegistro(null);
                                                setPdfUrl(null);
                                            }}
                                        >
                                            Volver a tabla
                                        </button>
                                    </div>
                                    <FormularioDinamico
                                        template={dynamicTemplate}
                                        initialValues={initialValues}
                                        quickActions={quickActions}
                                        onGuardar={async (formData) => {
                                            try {
                                                setError("");
                                                await saveOutboundGestion(formData);
                                                setSuccessMessage(
                                                    "Registro guardado correctamente",
                                                );
                                                await cargarSiguienteRegistro(
                                                    getRegistroIdentification(formData),
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
                                                await saveOutboundGestion(formData);
                                                setSuccessMessage(
                                                    "Registro actualizado correctamente",
                                                );
                                                await cargarSiguienteRegistro(
                                                    getRegistroIdentification(formData),
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
                                        onCancelar={() => {
                                            setRegistro(null);
                                            setPdfUrl(null);
                                        }}
                                        esUpdate={Boolean(identificacion)}
                                    />
                                </div>
                            )}
                        </>
                    ) : null}
                </section>

                <aside className="outmaquita-mail__pdf-panel">
                    {pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            className="outmaquita-mail__pdf-iframe"
                            title="PDF Out Maquita"
                        />
                    ) : !registro ? (
                        <div className="outmaquita-mail__pdf-empty">
                            Selecciona un registro de la tabla para visualizar el PDF.
                        </div>
                    ) : (
                        <div className="outmaquita-mail__pdf-empty">
                            No se encontro PDF para la identificacion.
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
