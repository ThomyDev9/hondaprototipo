import React, { useContext, useRef, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { formF2Template } from "../../templates/formF2Template";
import { fetchTiposCampaniaOutHonda } from "../../services/tiposCampania.service";
// import FormularioDinamico from "../../components/FormularioDinamico";
import FormularioDinamicoReseteable from "../../components/FormularioDinamicoReseteable";
import {
    insertarTrxOut,
    actualizarTrxOut,
} from "../../services/trxout.service";
import { buscarTrxOutPorIdentificacion } from "../../services/buscarTrxOut.service";
import {
    fetchSheetAsJson,
    fetchDatosWebSheet,
} from "../../services/webSheet.service";
// No PDF panel aquí
import "./OutHondaPage.css";

export default function OutHondaPage() {
    const { userInfo } = useContext(AuthContext);
    const startedManagementRef = useRef(null);
    React.useEffect(() => {
        startedManagementRef.current = new Date();
    }, []);
    const [busquedaId, setBusquedaId] = React.useState("");
    const [buscando, setBuscando] = React.useState(false);
    const [registro, setRegistro] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [motivos, setMotivos] = React.useState([]);
    const [submotivos, setSubmotivos] = React.useState([]);
    const [selectedMotivo, setSelectedMotivo] = React.useState("");
    const [levels, setLevels] = React.useState([]);
    const [tiposCampania, setTiposCampania] = React.useState([]);
    // Obtener tipos de campaña dinámicamente
    React.useEffect(() => {
        async function fetchTipos() {
            try {
                const tipos = await fetchTiposCampaniaOutHonda();
                setTiposCampania(
                    tipos.map((t) => t.TipoCampania).filter(Boolean),
                );
            } catch {
                setTiposCampania([]);
            }
        }
        fetchTipos();
    }, []);
    // No autoasignar registro ni cargar datos automáticamente

    const identificacion =
        registro?.identificacion ||
        registro?.Identificacion ||
        registro?.["Nº de cédula"] ||
        "";

    React.useEffect(() => {
        async function fetchLevels() {
            if (!identificacion) return;
            try {
                const API_BASE = import.meta.env.VITE_API_BASE;
                const token = localStorage.getItem("access_token") || "";
                const res = await fetch(
                    `${API_BASE}/agente/form-catalogos?campaignId=Out%20Honda&contactId=${encodeURIComponent(identificacion)}`,
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
            } catch {
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

    const [noGestionados, setNoGestionados] = useState([]);
    const [gestionados, setGestionados] = useState([]);
    const [filtroTabla, setFiltroTabla] = useState("no-gestionados");
    // Al cargar, traer registros no gestionados de Google Sheets
    useEffect(() => {
        setLoading(true);
        setError("");
        fetchSheetAsJson()
            .then((data) => {
                const noGest = data.filter(
                    (row) => !row.Gestionado || row.Gestionado === "#N/A",
                );
                // Excluir gestionados con Agendado === 'SGC'
                const gest = data.filter(
                    (row) =>
                        row.Gestionado &&
                        row.Gestionado !== "#N/A" &&
                        row.Agendado !== "SGC",
                );
                setNoGestionados(noGest);
                setGestionados(gest);
                setRegistro(null); // No seleccionar registro automáticamente
            })
            .catch(() => setError("Error cargando registros"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return null;

    // Preparar valores iniciales y template dinámico antes del return principal

    const concesionarioOptions = [
        "QUITO, RECORDMOTOR - AG. EL INCA",
        "QUITO, ASIAUTO - AG. GRANADOS",
        "QUITO, ASIAUTO - AG. CUMBAYÁ",
        "GUAYAQUIL, ASIAUTO - AG. F. ORELLANA",
        "GUAYAQUIL, RECORDMOTOR - AG. AMÉRICAS",
        "MANTA, ASIAUTO - AV. ELÉCTRICOS",
        "AMBATO, ASIAUTO - AG. ATAHUALPA",
        "CUENCA, RECORDMOTOR - AG. SOLANO",
    ];
    const modeloOptions = [
        "ALL NEW WR-V",
        "HR-V",
        "CR-V",
        "BR-V",
        "Civic",
        "Type R",
        "Pilot",
        "WR-V",
    ];

    const dynamicTemplate = [
        ...formF2Template.map((field) => {
            if (field.name === "tipoCampana") {
                return {
                    ...field,
                    type: "select",
                    options: tiposCampania.map((tc) => ({
                        value: tc,
                        label: tc,
                    })),
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
        }),
        {
            name: "Email",
            label: "Email",
            type: "text",
            required: false,
            readOnly: true,
        },
        {
            name: "Concesionario",
            label: "Concesionario",
            type: "select",
            required: false,
            options: concesionarioOptions.map((v) => ({ value: v, label: v })),
        },
        {
            name: "Modelo",
            label: "Modelo",
            type: "select",
            required: false,
            options: modeloOptions.map((v) => ({ value: v, label: v })),
        },
        {
            name: "Plataforma",
            label: "Plataforma",
            type: "text",
            required: false,
            readOnly: true,
        },
    ];

    // Mapeo para transformar el registro del sheet a los campos esperados por el formulario
    function mapRegistroToFormValues(row) {
        if (!row) return {};
        // Unir nombres y apellidos correctamente (Nombre y Apellido)
        const nombres = row["Nombre"] || row["Nombres"] || row["B"] || "";
        const apellidos = row["Apellido"] || row["Apellidos"] || row["C"] || "";
        const nombreCompleto = (
            nombres + (apellidos ? " " + apellidos : "")
        ).trim();
        return {
            Origen: row.Origen || "",
            identificacion:
                row["Identificación"] || row["CI"] || row["M"] || "",
            apellidosNombres: nombreCompleto,
            Email: row.Email || "",
            Provincia: row.Provincia || "",
            Concesionario: row.Concesionario || "",
            Modelo: "", // Modelo debe ir vacío
            celular: row["telefono_real"] || row["L"] || row.Telefono || "",
            tipoCampana: row["Tipo de Campania"] || row["TipoCampania"] || "",
            motivoInteraccion: row["Motivo"] || row["MotivoInteraccion"] || "",
            submotivoInteraccion:
                row["Submotivo"] || row["SubmotivoInteraccion"] || "",
            observaciones: row["Observacion"] || row["Observaciones"] || "",
            // Agrega aquí cualquier campo adicional que quieras mapear
        };
    }

    return (
        <div className="outmaquita-flex-row">
            <div className="outmaquita-form-panel">
                <h1 className="outmaquita-title">Out Honda</h1>
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
                                let data = null;
                                try {
                                    data = await fetchDatosWebSheet(busquedaId);
                                } catch {}
                                if (!data) {
                                    // Si no está en Google Sheets, buscar en la base local
                                    data =
                                        await buscarTrxOutPorIdentificacion(
                                            busquedaId,
                                        );
                                }
                                if (data) {
                                    setRegistro(data);
                                    setTimeout(() => {
                                        setSelectedMotivo(
                                            data.motivoInteraccion ||
                                                data.MotivoLlamada ||
                                                "",
                                        );
                                    }, 0);
                                } else {
                                    setRegistro(null);
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
                {error && <div className="outmaquita-error">{error}</div>}
                <div className="outmaquita-form-wrapper">
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            marginBottom: 12,
                        }}
                    >
                        <label htmlFor="filtroTabla">Ver registros:</label>
                        <select
                            id="filtroTabla"
                            value={filtroTabla}
                            onChange={(e) => setFiltroTabla(e.target.value)}
                        >
                            <option value="no-gestionados">
                                No gestionados
                            </option>
                            <option value="gestionados">Gestionados</option>
                        </select>
                    </div>
                    {loading && <div>Cargando...</div>}
                    {error && <div style={{ color: "red" }}>{error}</div>}
                    {/* Mostrar la tabla solo si NO hay registro seleccionado */}
                    {!registro && (
                        <table
                            border="1"
                            cellPadding={8}
                            style={{
                                marginBottom: 24,
                                width: "100%",
                                fontSize: "1.1em",
                            }}
                        >
                            <thead>
                                <tr>
                                    <th>Origen</th>
                                    <th>Identificación</th>
                                    <th>Teléfono</th>
                                    <th>Seleccionar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(filtroTabla === "no-gestionados"
                                    ? noGestionados
                                    : gestionados
                                ).map((row, idx) => {
                                    const identificacion =
                                        row["Identificación"] ||
                                        row["CI"] ||
                                        row["M"] ||
                                        "";
                                    const telefono =
                                        row["telefono_real"] ||
                                        row["L"] ||
                                        row.Telefono ||
                                        "";
                                    const uniqueKey = identificacion
                                        ? `${identificacion}_${idx}`
                                        : idx;
                                    return (
                                        <tr key={uniqueKey}>
                                            <td>{row.Origen}</td>
                                            <td>{identificacion}</td>
                                            <td>{telefono}</td>
                                            <td>
                                                <button
                                                    onClick={() =>
                                                        setRegistro(row)
                                                    }
                                                >
                                                    Cargar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {/* Mostrar el formulario solo si hay registro seleccionado */}
                    {registro && (
                        <FormularioDinamicoReseteable
                            key={registro ? JSON.stringify(registro) : "empty"}
                            initialValues={{
                                ...mapRegistroToFormValues(registro),
                                Plataforma:
                                    registro["Plataforma"] ||
                                    registro["Plataforma de origen"] ||
                                    "web",
                            }}
                            template={dynamicTemplate}
                            className="outmaquita-form outhonda-form-3col"
                            onGuardar={async (formData) => {
                                try {
                                    const agent = userInfo?.username || "";
                                    const startedManagement =
                                        startedManagementRef.current
                                            ? startedManagementRef.current.toISOString()
                                            : null;
                                    const tmStmp = new Date().toISOString();
                                    const payload = {
                                        Agent: agent,
                                        StartedManagement: startedManagement,
                                        TmStmp: tmStmp,
                                        Cooperativa: "Out Honda",
                                        TipoCampania:
                                            formData.tipoCampana || null,
                                        Identificacion:
                                            formData.identificacion || null,
                                        NombreCliente:
                                            formData.apellidosNombres || null,
                                        Celular: formData.celular || null,
                                        Plataforma: formData.Plataforma || null,
                                        MotivoLlamada:
                                            formData.motivoInteraccion || null,
                                        SubmotivoLlamada:
                                            formData.submotivoInteraccion ||
                                            null,
                                        Observaciones:
                                            formData.observaciones || null,
                                        AgentShift: "",
                                        TmStmpShift: "",
                                    };
                                    // Generar línea tabulada para copiar
                                    // Separar nombres y apellidos si es posible
                                    let firstName = "";
                                    let lastName = "";
                                    if (formData.apellidosNombres) {
                                        const partes = formData.apellidosNombres
                                            .trim()
                                            .split(" ");
                                        if (partes.length > 1) {
                                            lastName = partes.pop();
                                            firstName = partes.join(" ");
                                        } else {
                                            firstName =
                                                formData.apellidosNombres;
                                        }
                                    }
                                    const campos = [
                                        firstName || "", // First_Name
                                        lastName || "", // Last_Name
                                        formData.Provincia || "", // Ciudad
                                        formData.exoneradoId || "", // Exonerado ID
                                        formData.identificacion || "", // CI
                                        formData.celular || "", // Phone_Number
                                        formData.Email || "", // Email
                                        formData.Concesionario || "", // Concesionario
                                        formData.concesionarioSgcId || "", // Concesionario SGC ID
                                        formData.Modelo || "", // Modelo
                                        formData.modeloSgcId || "", // Modelo SGC ID
                                        formData.fecha || "", // Fecha
                                        formData.Plataforma || "", // Plataforma
                                    ];
                                    alert(campos.join("\t"));
                                    setError(
                                        "Registro insertado correctamente",
                                    );
                                } catch {
                                    setError("Error guardando registro");
                                }
                            }}
                            onActualizar={async (formData) => {
                                try {
                                    const agent = userInfo?.username || "";
                                    const startedManagement =
                                        startedManagementRef.current
                                            ? startedManagementRef.current.toISOString()
                                            : null;
                                    const tmStmp = new Date().toISOString();
                                    const payload = {
                                        Agent: agent,
                                        StartedManagement: startedManagement,
                                        TmStmp: tmStmp,
                                        Cooperativa: "Out Honda",
                                        TipoCampania:
                                            formData.tipoCampana || null,
                                        Identificacion:
                                            formData.identificacion || null,
                                        NombreCliente:
                                            formData.apellidosNombres || null,
                                        Celular: formData.celular || null,
                                        Plataforma: formData.Plataforma || null,
                                        MotivoLlamada:
                                            formData.motivoInteraccion || null,
                                        SubmotivoLlamada:
                                            formData.submotivoInteraccion ||
                                            null,
                                        Observaciones:
                                            formData.observaciones || null,
                                        AgentShift: "",
                                        TmStmpShift: "",
                                    };
                                    await actualizarTrxOut(payload);
                                    setError(
                                        "Registro actualizado correctamente",
                                    );
                                } catch {
                                    setError("Error actualizando registro");
                                }
                            }}
                            esUpdate={
                                !!(
                                    registro?.Identificacion ||
                                    registro?.identificacion
                                )
                            }
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
