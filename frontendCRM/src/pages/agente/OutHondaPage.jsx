import React, { useContext, useRef, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { formF2Template } from "../../templates/formF2Template";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
import FormularioDinamicoReseteable from "../../components/FormularioDinamicoReseteable";
import { buscarTrxOutPorIdentificacion } from "../../services/buscarTrxOut.service";
import {
    fetchSheetAsJson,
    fetchDatosWebSheet,
} from "../../services/webSheet.service";
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
    // Estado para mostrar resumen después de guardar
    const [resumenExcel, setResumenExcel] = useState(null);
    // Cargar motivos y submotivos de la base de datos al inicio (sin identificación)
    React.useEffect(() => {
        async function fetchMotivosGlobales() {
            try {
                const API_BASE = import.meta.env.VITE_API_BASE;
                const token = localStorage.getItem("access_token") || "";
                const res = await fetch(
                    `${API_BASE}/agente/form-catalogos?campaignId=Out%20Honda&contactId=`,
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
        fetchMotivosGlobales();
    }, []);

    // Cargar tipos de campaña para Out Honda
    React.useEffect(() => {
        async function fetchTipos() {
            try {
                const tipos = await fetchTiposCampaniaOutbound("Out Honda");
                setTiposCampania(tipos.filter(Boolean));
            } catch {
                setTiposCampania([]);
            }
        }
        fetchTipos();
    }, []);

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
                // Solo actualizar selectedMotivo si el motivo del registro es válido
                const motivoRegistro =
                    registro?.motivoInteraccion ||
                    registro?.MotivoLlamada ||
                    "";
                if (motivoRegistro && level1s.includes(motivoRegistro)) {
                    setSelectedMotivo(motivoRegistro);
                } else if (!level1s.includes(selectedMotivo)) {
                    setSelectedMotivo("");
                }
            } catch {
                setMotivos([]);
            }
        }
        fetchLevels();
    }, [identificacion]);

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
                // Filtrar por Origen === 'BaseLeadsHonda2026'
                const filtrados = data.filter(
                    (row) => row.Origen === "BaseLeadsHonda2026",
                );
                // Ordenar por Fecha (columna J) descendente
                function parseFecha(fechaStr) {
                    if (!fechaStr) return 0;
                    const [d, m, y] = fechaStr.split("/");
                    if (!d || !m || !y) return 0;
                    return new Date(
                        `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
                    );
                }
                filtrados.sort((a, b) => {
                    const fechaA = parseFecha(a.Fecha || a.J);
                    const fechaB = parseFecha(b.Fecha || b.J);
                    return fechaB - fechaA;
                });
                const noGest = filtrados.filter(
                    (row) => !row.Gestionado || row.Gestionado === "#N/A",
                );
                // Excluir gestionados con Agendado === 'SGC'
                const gest = filtrados.filter(
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

    const gestionOptions = ["COTIZACION", "CITA", "VIDEOLLAMADA"];

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
                };
            }
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
            if (field.name === "submotivoInteraccion") {
                return {
                    ...field,
                    type: "select",
                    options: submotivos.map((s) => ({ value: s, label: s })),
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
        {
            name: "Provincia",
            label: "Provincia",
            type: "text",
            required: false,
            readOnly: true,
        },
        {
            name: "Gestion",
            label: "Gestion",
            type: "select",
            required: false,
            options: gestionOptions.map((v) => ({ value: v, label: v })),
        },
        {
            name: "FechaAgenda",
            label: "Fecha de Cita / Videollamada",
            type: "datetime-local",
            required: false,
            showIf: (values) =>
                values.Gestion === "CITA" || values.Gestion === "VIDEOLLAMADA",
        },
    ];

    // Mover función fuera del render
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
            Concesionario: row.Concesionario || "",
            Modelo: "", // Modelo debe ir vacío
            celular: row["telefono_real"] || row["L"] || row.Telefono || "",
            tipoCampana: row["Tipo de Campania"] || row["TipoCampania"] || "",
            motivoInteraccion: row["Motivo"] || row["MotivoInteraccion"] || "",
            submotivoInteraccion:
                row["Submotivo"] || row["SubmotivoInteraccion"] || "",
            observaciones: row["Observacion"] || row["Observaciones"] || "",
            Provincia: row.Provincia || "",
            // Agrega aquí cualquier campo adicional que quieras mapear
        };
    }

    function MensajeWhatsapp({ resumen }) {
        const tipo =
            resumen.tipoGestion || resumen.tipo_gestion || resumen.tipo || "";
        const nombresCompletos = `${resumen.nombre} ${resumen.apellido}`.trim();
        const fechaHora =
            resumen.fechaCita ||
            resumen.fechaVideollamada ||
            resumen.fecha ||
            "";
        let mensaje = "";
        if (typeof tipo === "string" && tipo.toLowerCase().includes("cita")) {
            mensaje = `Buenos días, por favor, cliente está interesado en el modelo HR-V y desea agendar test drive.\nNOMBRES COMPLETOS: ${nombresCompletos}\nC.I: ${resumen.identificacion}\nTeléfono: ${resumen.telefono}\nFecha y hora de cita: ${fechaHora}\nCorreo: ${resumen.email}\nSu gentil ayuda comunicándose, por favor.`;
        } else if (
            typeof tipo === "string" &&
            tipo.toLowerCase().includes("video")
        ) {
            mensaje = `Buenos días, por favor cliente está interesado el vehículo Honda HR-V, cliente vive en el Oriente, solicita se le realice una videollamada para conocer el auto hasta que pueda viajar al concesionario.\nNOMBRES COMPLETOS: ${nombresCompletos}\nCi: ${resumen.identificacion}\nTeléfono: ${resumen.telefono}\nCorreo: ${resumen.email}\nFecha y hora de videollamada: ${fechaHora}\nSu gentil ayuda por favor.`;
        } else {
            mensaje = `Datos del cliente:\nNOMBRES COMPLETOS: ${nombresCompletos}\nC.I: ${resumen.identificacion}\nTeléfono: ${resumen.telefono}\nCorreo: ${resumen.email}`;
        }
        return (
            <div>
                <textarea
                    style={{
                        width: "100%",
                        minHeight: 120,
                        fontFamily: "monospace",
                        fontSize: 16,
                        marginBottom: 8,
                    }}
                    readOnly
                    value={mensaje}
                    onFocus={(e) => e.target.select()}
                />
                <div style={{ fontSize: 13, color: "#888" }}>
                    Selecciona y copia el mensaje para enviarlo por WhatsApp.
                </div>
            </div>
        );
    }

    return (
        <div className="">
            <div className="outmaquita-form-panel">
                <h1 className="">Out Honda</h1>
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
                    <div>
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
                            style={{
                                marginBottom: 10,
                                width: "100%",
                                fontSize: "1.1em",
                            }}
                        >
                            <thead>
                                <tr>
                                    <th>Origen</th>
                                    <th>Identificación</th>
                                    <th>Teléfono</th>
                                    <th>Fecha</th>
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
                                    const fecha = row.Fecha || row.J || "";
                                    const uniqueKey = identificacion
                                        ? `${identificacion}_${idx}`
                                        : idx;
                                    return (
                                        <tr key={uniqueKey}>
                                            <td>{row.Origen}</td>
                                            <td>{identificacion}</td>
                                            <td>{telefono}</td>
                                            <td>{fecha}</td>
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
                    {registro && !resumenExcel && (
                        <FormularioDinamicoReseteable
                            key={
                                registro
                                    ? registro.identificacion ||
                                      registro.Identificacion ||
                                      registro["Nº de cédula"] ||
                                      "empty"
                                    : "empty"
                            }
                            initialValues={{
                                ...mapRegistroToFormValues(registro),
                                Plataforma:
                                    registro["Plataforma"] ||
                                    registro["Plataforma de origen"] ||
                                    "WEB",
                            }}
                            template={dynamicTemplate}
                            className="outmaquita-form outhonda-form-3col"
                            onGuardar={async (formData) => {
                                try {
                                    // Separar nombre y apellido
                                    let nombre = "";
                                    let apellido = "";
                                    if (formData.apellidosNombres) {
                                        const partes = formData.apellidosNombres
                                            .trim()
                                            .split(" ");
                                        if (partes.length > 1) {
                                            nombre = partes
                                                .slice(0, -1)
                                                .join(" ");
                                            apellido = partes
                                                .slice(-1)
                                                .join(" ");
                                        } else {
                                            nombre = formData.apellidosNombres;
                                            apellido = "";
                                        }
                                    }
                                    // Buscar identificación en varias variantes posibles
                                    const identificacion =
                                        formData.identificacion ||
                                        formData.Identificacion ||
                                        formData["Identificación"] ||
                                        formData["identificación"] ||
                                        "";
                                    setResumenExcel({
                                        nombre,
                                        apellido,
                                        provincia:
                                            formData.Provincia ||
                                            formData.provincia ||
                                            "",
                                        identificacion,
                                        telefono: formData.celular || "",
                                        email: formData.Email || "",
                                        tipoGestion:
                                            formData.Gestion ||
                                            formData.tipoGestion ||
                                            formData.tipo ||
                                            "",
                                        fechaCita:
                                            formData.FechaAgenda ||
                                            formData.fechaCita ||
                                            "",
                                    });
                                } catch (e) {
                                    console.error(
                                        "Error en onGuardar OutHondaPage:",
                                        e,
                                    );
                                }
                            }}
                            esUpdate={
                                !!(
                                    registro?.Identificacion ||
                                    registro?.identificacion
                                )
                            }
                            levels={levels}
                        />
                    )}
                    {resumenExcel && (
                        <div
                            style={{
                                padding: 24,
                                background: "#f8f8f8",
                                borderRadius: 8,
                                marginTop: 24,
                            }}
                        >
                            <h2>Datos para copiar y pegar en Excel</h2>
                            <div
                                style={{ fontWeight: "bold", marginBottom: 8 }}
                            >
                                Nombre Apellido Provincia Identificación
                                Teléfono Email
                            </div>
                            <textarea
                                style={{
                                    fontFamily: "monospace",
                                    fontSize: 18,
                                    background: "#fff",
                                    padding: 12,
                                    border: "1px solid #ccc",
                                    borderRadius: 4,
                                    width: "100%",
                                    minHeight: 60,
                                }}
                                readOnly
                                value={`${resumenExcel.nombre}\t${resumenExcel.apellido}\t${resumenExcel.provincia}\t${resumenExcel.identificacion}\t${resumenExcel.telefono}\t${resumenExcel.email}`}
                                onFocus={(e) => e.target.select()}
                            />

                            <MensajeWhatsapp resumen={resumenExcel} />

                            <button
                                style={{ marginTop: 16 }}
                                onClick={() => setResumenExcel(null)}
                            >
                                Volver
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
