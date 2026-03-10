import React from "react";
import { formF2Template } from "../../templates/formF2Template";
import { fetchTiposCampaniaOutMaquita } from "../../services/tiposCampania.service";
import FormularioDinamico from "../../components/FormularioDinamico";
import {
    insertarTrxOut,
    actualizarTrxOut,
} from "../../services/trxout.service";
import { buscarTrxOutPorIdentificacion } from "../../services/buscarTrxOut.service";
import { fetchOutMaquitaData } from "../../services/outMaquita.service";
import "./OutMaquitaPage.css";

// import { listarNivelesGestion } from "../../services/managementLevels.service";
export default function OutMaquitaPage() {
    const [busquedaId, setBusquedaId] = React.useState("");
    const [buscando, setBuscando] = React.useState(false);
    const [registro, setRegistro] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [pdfUrl, setPdfUrl] = React.useState(null);

    const [motivos, setMotivos] = React.useState([]);
    const [submotivos, setSubmotivos] = React.useState([]);
    const [selectedMotivo, setSelectedMotivo] = React.useState("");
    const [levels, setLevels] = React.useState([]);
    const [tiposCampania, setTiposCampania] = React.useState([]);
    // Obtener tipos de campaña dinámicamente
    React.useEffect(() => {
        async function fetchTipos() {
            try {
                const tipos = await fetchTiposCampaniaOutMaquita();
                setTiposCampania(
                    tipos.map((t) => t.TipoCampania).filter(Boolean),
                );
            } catch (err) {
                setTiposCampania([]);
            }
        }
        fetchTipos();
    }, []);
    React.useEffect(() => {
        let mounted = true;
        fetchOutMaquitaData()
            .then((data) => {
                if (mounted) setRegistro(data[0] || null);
            })
            .catch(() => setError("No se pudo obtener datos de Google Sheets"))
            .finally(() => setLoading(false));
        return () => {
            mounted = false;
        };
    }, []);

    // Usar el identificador correcto según el origen del registro
    const identificacion =
        registro?.identificacion ||
        registro?.Identificacion ||
        registro?.["Nº de cédula"] ||
        "";
    const apellidosNombres =
        registro && registro["Nombres completos"]
            ? registro["Nombres completos"]
            : "";

    React.useEffect(() => {
        if (!identificacion) return;
        async function buscarPdf() {
            try {
                // Obtener listado de archivos PDF desde el backend
                const res = await fetch("http://localhost:4004/uploads-list");
                const archivos = await res.json();
                const encontrado = archivos.find((nombre) =>
                    nombre.startsWith(identificacion),
                );
                if (encontrado) {
                    setPdfUrl(`http://localhost:4004/uploads/${encontrado}`);
                } else {
                    setPdfUrl(null);
                }
            } catch (e) {
                setPdfUrl(null);
            }
        }
        buscarPdf();
    }, [identificacion]);

    React.useEffect(() => {
        async function fetchLevels() {
            if (!identificacion) return;
            try {
                const API_BASE = import.meta.env.VITE_API_BASE;
                const token = localStorage.getItem("access_token") || "";
                const res = await fetch(
                    `${API_BASE}/agente/form-catalogos?campaignId=Out%20Maquita%20Cushunchic&contactId=${encodeURIComponent(identificacion)}`,
                    {
                        headers: {
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                    },
                );
                const json = await res.json();
                const levelsData = Array.isArray(json.levels)
                    ? json.levels
                    : [];
                setLevels(levelsData);
                const level1s = [
                    ...new Set(levelsData.map((n) => n.level1).filter(Boolean)),
                ];
                setMotivos(level1s);
            } catch (err) {
                console.error("Error obteniendo levels:", err);
                setMotivos([]);
            }
        }
        fetchLevels();
    }, [identificacion]);

    // Cargar submotivos (Level2) cuando cambia el motivo
    React.useEffect(() => {
        if (!selectedMotivo) {
            setSubmotivos([]);
            return;
        }
        const level2s = levels
            .filter((n) => n.level1 === selectedMotivo)
            .map((n) => n.level2)
            .filter(Boolean);
        setSubmotivos([...new Set(level2s)]);
    }, [selectedMotivo, levels]);

    if (loading) return null;
    if (error) return <div className="outmaquita-error">{error}</div>;

    // Mostrar solo el formulario de búsqueda si no hay registro
    if (!registro) {
        return (
            <div className="outmaquita-flex-row">
                <div className="outmaquita-form-panel">
                    <h1 className="outmaquita-title">Out Maquita Cushunchic</h1>
                    <div>
                        <input
                            type="text"
                            placeholder="Buscar por identificación"
                            value={busquedaId}
                            onChange={(e) => setBusquedaId(e.target.value)}
                            maxLength={20}
                            style={{ flex: 1, padding: 6 }}
                        />
                        <button
                            type="button"
                            disabled={buscando || !busquedaId}
                            onClick={async () => {
                                setBuscando(true);
                                setError("");
                                try {
                                    let data =
                                        await buscarTrxOutPorIdentificacion(
                                            busquedaId,
                                        );
                                    if (!data) {
                                        const all = await fetchOutMaquitaData();
                                        data =
                                            all.find(
                                                (r) =>
                                                    (r["Nº de cédula"] ||
                                                        r.Identificacion) ===
                                                    busquedaId,
                                            ) || null;
                                    }
                                    if (data) {
                                        setRegistro(data);
                                        let id =
                                            data.identificacion ||
                                            data.Identificacion ||
                                            data["Nº de cédula"] ||
                                            "";
                                        setTimeout(() => {
                                            setPdfUrl(null);
                                            setSelectedMotivo(
                                                data.motivoInteraccion ||
                                                    data.MotivoLlamada ||
                                                    "",
                                            );
                                        }, 0);
                                    } else {
                                        setRegistro(null);
                                        setPdfUrl(null);
                                        setSelectedMotivo("");
                                        setError(
                                            "No se encontró registro para esa identificación.",
                                        );
                                    }
                                } catch {
                                    setError("Error buscando registro");
                                } finally {
                                    setBuscando(false);
                                }
                            }}
                        >
                            {buscando ? "Buscando..." : "Buscar"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Soporta ambos casos: carga automática (Google Sheets) y búsqueda (trxout)
    const initialValues = {
        identificacion:
            registro?.identificacion ||
            registro?.Identificacion ||
            registro?.["Nº de cédula"] ||
            "",
        apellidosNombres:
            registro?.apellidosNombres ||
            registro?.NombreCliente ||
            registro?.["Nombres completos"] ||
            "",
        tipoCampana: registro?.tipoCampana || registro?.TipoCampania || "",
        celular:
            registro?.celular ||
            registro?.Celular ||
            registro?.["Teléfono Celular"] ||
            "",
        motivoInteraccion:
            registro?.motivoInteraccion || registro?.MotivoLlamada || "",
        submotivoInteraccion:
            registro?.submotivoInteraccion || registro?.SubmotivoLlamada || "",
        observaciones: registro?.observaciones || registro?.Observaciones || "",
    };

    // Construir template dinámico para el formulario
    const dynamicTemplate = formF2Template.map((field) => {
        if (field.name === "tipoCampana") {
            return {
                ...field,
                type: "select",
                options: tiposCampania.map((tc) => ({ value: tc, label: tc })),
            };
        }
        if (field.name === "motivoInteraccion") {
            return {
                ...field,
                type: "select",
                options: motivos.map((m) => ({ value: m, label: m })),
                onChange: (e) => setSelectedMotivo(e.target.value),
            };
        }
        if (field.name === "submotivoInteraccion") {
            return {
                ...field,
                type: "select",
                options: submotivos.map((s) => ({ value: s, label: s })),
            };
        }
        return field;
    });

    return (
        <div className="outmaquita-flex-row">
            <div className="outmaquita-form-panel">
                <h1 className="outmaquita-title">Out Maquita Cushunchic</h1>
                {/* Campo de búsqueda por identificación */}
                <div>
                    <input
                        type="text"
                        placeholder="Buscar por identificación"
                        value={busquedaId}
                        onChange={(e) => setBusquedaId(e.target.value)}
                        maxLength={20}
                        style={{ flex: 1, padding: 6 }}
                    />
                    <button
                        type="button"
                        disabled={buscando || !busquedaId}
                        onClick={async () => {
                            setBuscando(true);
                            setError("");
                            try {
                                // 1. Buscar en trxout
                                let data =
                                    await buscarTrxOutPorIdentificacion(
                                        busquedaId,
                                    );
                                if (!data) {
                                    // 2. Si no existe, buscar en Google Sheets
                                    const all = await fetchOutMaquitaData();
                                    data =
                                        all.find(
                                            (r) =>
                                                (r["Nº de cédula"] ||
                                                    r.Identificacion) ===
                                                busquedaId,
                                        ) || null;
                                }
                                if (data) {
                                    setRegistro(data);
                                    // Forzar actualización de PDF y selects tras buscar
                                    let id =
                                        data.identificacion ||
                                        data.Identificacion ||
                                        data["Nº de cédula"] ||
                                        "";
                                    setTimeout(() => {
                                        setPdfUrl(null); // Limpiar PDF antes de actualizar
                                        setSelectedMotivo(
                                            data.motivoInteraccion ||
                                                data.MotivoLlamada ||
                                                "",
                                        );
                                    }, 0);
                                } else {
                                    setRegistro(null);
                                    setPdfUrl(null);
                                    setSelectedMotivo("");
                                    setError(
                                        "No se encontró registro para esa identificación.",
                                    );
                                }
                            } catch {
                                setError("Error buscando registro");
                            } finally {
                                setBuscando(false);
                            }
                        }}
                    >
                        {buscando ? "Buscando..." : "Buscar"}
                    </button>
                </div>
                <div className="outmaquita-form-wrapper">
                    <FormularioDinamico
                        key={JSON.stringify(initialValues)}
                        template={dynamicTemplate}
                        onSubmit={async (formData) => {
                            try {
                                // Determinar si es insert o update
                                const esUpdate = !!(
                                    registro?.Identificacion ||
                                    registro?.identificacion
                                );
                                // Mapear los campos del formulario a los de la tabla
                                const payload = {
                                    Agent: "",
                                    StartedManagement: null,
                                    TmStmp: null,
                                    Cooperativa: "",
                                    TipoCampania: formData.tipoCampana || null,
                                    Identificacion:
                                        formData.identificacion || null,
                                    NombreCliente:
                                        formData.apellidosNombres || null,
                                    Celular: formData.celular || null,
                                    MotivoLlamada:
                                        formData.motivoInteraccion || null,
                                    SubmotivoLlamada:
                                        formData.submotivoInteraccion || null,
                                    Observaciones:
                                        formData.observaciones || null,
                                    AgentShift: "",
                                    TmStmpShift: "",
                                };
                                if (esUpdate) {
                                    await actualizarTrxOut(payload);
                                    setError(
                                        "Registro actualizado correctamente",
                                    );
                                } else {
                                    await insertarTrxOut(payload);
                                    setError(
                                        "Registro insertado correctamente",
                                    );
                                }
                            } catch (e) {
                                setError("Error guardando registro");
                            }
                        }}
                        initialValues={initialValues}
                        className="outmaquita-form"
                    />
                </div>
            </div>
            <div className="outmaquita-pdf-panel">
                {pdfUrl ? (
                    <iframe
                        src={pdfUrl}
                        className="outmaquita-pdf-iframe"
                        title="PDF"
                    />
                ) : (
                    <div className="outmaquita-pdf-empty">
                        No se encontró PDF para la identificación.
                    </div>
                )}
            </div>
        </div>
    );
}
