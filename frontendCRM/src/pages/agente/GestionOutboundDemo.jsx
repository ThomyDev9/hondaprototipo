import { opciones } from "../../utils/selectOptions";
import React, { useState, useEffect } from "react";

import { formF2Template } from "../../templates/formF2Template";
import FormularioDinamico from "../../components/FormularioDinamico";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function GestionOutboundDemo() {
    const [result, setResult] = useState(null);
    const [template, setTemplate] = useState(formF2Template);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [levels, setLevels] = useState([]);
    const [motivoSeleccionado, setMotivoSeleccionado] = useState("");
    // Cambia aquí el nombre de la campaña para probar otros outs
    const nombreCampania = "Out Kullki Wasi";

    // Utilidad para opciones de selects (fuera del componente)

    useEffect(() => {
        async function cargarDatos() {
            setLoading(true);
            setError("");
            try {
                const [tipos, catalogos] = await Promise.all([
                    fetchTiposCampaniaOutbound(nombreCampania),
                    fetch(
                        `${API_BASE}/agente/form-catalogos?campaignId=${encodeURIComponent(nombreCampania)}&contactId=`,
                        {
                            headers: {
                                Authorization: localStorage.getItem(
                                    "access_token",
                                )
                                    ? `Bearer ${localStorage.getItem("access_token")}`
                                    : "",
                            },
                        },
                    ).then((res) => res.json()),
                ]);

                const niveles = Array.isArray(catalogos.levels)
                    ? catalogos.levels
                    : [];
                setLevels(niveles);
                const motivos = Array.from(
                    new Set(niveles.map((n) => n.level1).filter(Boolean)),
                );

                const nuevoTemplate = formF2Template.map((field) => {
                    if (field.name === "tipoCampana") {
                        return { ...field, options: opciones(tipos) };
                    }
                    if (field.name === "motivoInteraccion") {
                        // onChange se maneja en el render del formulario
                        return {
                            ...field,
                            options: opciones(motivos),
                        };
                    }
                    if (field.name === "submotivoInteraccion") {
                        // Inicialmente vacío, se actualizará por efecto
                        return {
                            ...field,
                            options: [
                                { value: "", label: "Seleccione un motivo" },
                            ],
                        };
                    }
                    return field;
                });
                setTemplate(nuevoTemplate);
            } catch {
                setTemplate(formF2Template);
                setError("No se pudo cargar datos dinámicos");
            } finally {
                setLoading(false);
            }
        }
        cargarDatos();
    }, [nombreCampania]);

    // Actualizar submotivos cuando cambia el motivo seleccionado
    useEffect(() => {
        if (!levels.length) return;
        const submotivos = motivoSeleccionado
            ? Array.from(
                  new Set(
                      levels
                          .filter((n) => n.level1 === motivoSeleccionado)
                          .map((n) => n.level2)
                          .filter(Boolean),
                  ),
              )
            : [];

        setTemplate((prev) =>
            prev.map((field) => {
                if (field.name === "submotivoInteraccion") {
                    return {
                        ...field,
                        options: opciones(submotivos),
                    };
                }
                return field;
            }),
        );
    }, [motivoSeleccionado, levels]);

    return (
        <div
            style={{
                maxWidth: 500,
                margin: "0 auto",
                background: "#fff",
                borderRadius: 8,
                padding: 24,
                boxShadow: "0 2px 8px #0001",
            }}
        >
            <h2>Gestión Outbound · Formulario F2</h2>
            {loading && <div>Cargando tipos de campaña...</div>}
            {error && <div style={{ color: "red" }}>{error}</div>}
            <FormularioDinamico
                template={template}
                onChangeCampo={(name, value) => {
                    if (name === "motivoInteraccion")
                        setMotivoSeleccionado(value);
                }}
                onSubmit={setResult}
            />
            {result && (
                <pre
                    style={{
                        background: "#f3f4f6",
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 6,
                    }}
                >
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    );
}
