import { opciones } from "../../utils/selectOptions";
import React, { useEffect, useRef, useState } from "react";

import { formF2Template } from "../../templates/formF2Template";
import FormularioDinamico from "../../components/FormularioDinamico";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
import {
    fetchFormTemplates,
    fetchGestionOutboundByIdentification,
    guardarGestionOutbound,
} from "../../services/dashboard.service";
const API_BASE = import.meta.env.VITE_API_BASE;

function mapTemplateFieldToFormField(field) {
    return {
        name: String(field?.key || "").trim(),
        label: String(field?.label || field?.key || "").trim(),
        type: String(field?.type || "text").trim() || "text",
        required: Boolean(field?.required),
        placeholder: field?.placeholder || "",
        maxLength: field?.maxLength || null,
        options: Array.isArray(field?.options)
            ? field.options.map((opt) => ({
                  value: String(opt ?? "").trim(),
                  label: String(opt ?? "").trim(),
              }))
            : [],
    };
}

export default function GestionOutboundDemo({ campaignName = "" }) {
    const [template, setTemplate] = useState(formF2Template);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [levels, setLevels] = useState([]);
    const [motivoSeleccionado, setMotivoSeleccionado] = useState("");
    const [initialValues, setInitialValues] = useState({});
    const [isUpdate, setIsUpdate] = useState(false);
    const nombreCampania = String(campaignName || "Out Kullki Wasi").trim();
    const nombreFormulario = `Gestion Outbound ${nombreCampania}`;
    const lastLookupIdRef = useRef("");

    useEffect(() => {
        async function cargarDatos() {
            setLoading(true);
            setError("");
            setSuccessMessage("");
            try {
                const [tipos, catalogos, templatesResp] = await Promise.all([
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
                    fetchFormTemplates({ campaignId: nombreCampania }),
                ]);

                const niveles = Array.isArray(catalogos.levels)
                    ? catalogos.levels
                    : [];
                setLevels(niveles);
                const motivos = Array.from(
                    new Set(niveles.map((n) => n.level1).filter(Boolean)),
                );
                const form4Fields = Array.isArray(
                    templatesResp?.json?.form4?.fields,
                )
                    ? templatesResp.json.form4.fields
                    : [];

                const baseTemplate = formF2Template.map((field) => {
                    if (field.name === "tipoCampana") {
                        return {
                            ...field,
                            options: opciones(tipos),
                        };
                    }
                    if (field.name === "motivoInteraccion") {
                        return {
                            ...field,
                            options: opciones(motivos),
                        };
                    }
                    if (field.name === "submotivoInteraccion") {
                        return {
                            ...field,
                            options: [
                                { value: "", label: "Seleccione un motivo" },
                            ],
                        };
                    }
                    return field;
                });

                const additionalTemplate = form4Fields
                    .map(mapTemplateFieldToFormField)
                    .filter(
                        (field) =>
                            field.name &&
                            !baseTemplate.some(
                                (baseField) => baseField.name === field.name,
                            ),
                    );

                setTemplate([...baseTemplate, ...additionalTemplate]);
            } catch {
                setTemplate(formF2Template);
                setError("No se pudo cargar datos dinamicos");
            } finally {
                setLoading(false);
            }
        }
        cargarDatos();
    }, [nombreCampania]);

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

    useEffect(() => {
        const identification = String(
            initialValues?.identificacion || "",
        ).trim();

        if (!identification || identification.length < 5) {
            lastLookupIdRef.current = "";
            setIsUpdate(false);
            return;
        }

        if (lastLookupIdRef.current === identification) {
            return;
        }

        const timeoutId = setTimeout(() => {
            lastLookupIdRef.current = identification;
            buscarGestionExistente(identification);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [initialValues?.identificacion]);

    const buscarGestionExistente = async (identificacion) => {
        const busquedaId = String(identificacion || "").trim();
        if (!busquedaId) {
            setInitialValues({});
            setIsUpdate(false);
            return;
        }

        try {
            setError("");
            const { ok, json, status } =
                await fetchGestionOutboundByIdentification({
                    campaignId: nombreCampania,
                    identification: busquedaId,
                });

            if (!ok) {
                if (status === 404) {
                    setInitialValues((prev) => ({
                        ...prev,
                        identificacion: busquedaId,
                    }));
                    setIsUpdate(false);
                    setSuccessMessage("");
                    return;
                }
                throw new Error(json?.error || "No se pudo buscar la gestion");
            }

            const data = json?.data || {};
            setInitialValues({
                ...data,
                identificacion:
                    data.identificacion || data.Identificacion || busquedaId,
                apellidosNombres:
                    data.apellidosNombres ||
                    data.NombreCliente ||
                    data.NOMBRE_CLIENTE ||
                    "",
                celular: data.celular || data.Celular || "",
                tipoCampana: data.tipoCampana || data.TipoCampania || "",
                motivoInteraccion:
                    data.motivoInteraccion || data.MotivoLlamada || "",
                submotivoInteraccion:
                    data.submotivoInteraccion || data.SubmotivoLlamada || "",
                observaciones:
                    data.observaciones || data.Observaciones || "",
            });
            setMotivoSeleccionado(
                data.motivoInteraccion || data.MotivoLlamada || "",
            );
            setIsUpdate(true);
            setSuccessMessage("");
        } catch (err) {
            console.error(err);
            setError(err?.message || "No se pudo buscar la gestion");
        }
    };

    const saveOutboundGestion = async (formData) => {
        setError("");
        setSuccessMessage("");
        const identification = String(formData?.identificacion || "").trim();

        if (!identification) {
            setError("La identificacion es obligatoria.");
            return;
        }

        const fieldsMeta = template.map((field) => ({
            name: field.name,
            label: field.label,
        }));

        const { ok, json } = await guardarGestionOutbound({
            campaignId: nombreCampania,
            formData,
            fieldsMeta,
        });

        if (!ok) {
            throw new Error(
                json?.error || "No se pudo guardar la gestion outbound",
            );
        }

        setSuccessMessage(
            isUpdate
                ? "Gestion outbound actualizada correctamente."
                : "Gestion outbound guardada correctamente.",
        );
        setInitialValues({});
        setIsUpdate(false);
        setMotivoSeleccionado("");
        lastLookupIdRef.current = "";
    };

    const handleCancelarGestion = () => {
        setError("");
        setSuccessMessage("");
        setInitialValues({});
        setIsUpdate(false);
        setMotivoSeleccionado("");
        lastLookupIdRef.current = "";
    };

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
            <h2>{nombreFormulario}</h2>
            {loading && <div>Cargando tipos de campana...</div>}
            {error && <div style={{ color: "red" }}>{error}</div>}
            {successMessage && (
                <div style={{ color: "#166534", marginBottom: 12 }}>
                    {successMessage}
                </div>
            )}
            <FormularioDinamico
                template={template}
                initialValues={initialValues}
                esUpdate={isUpdate}
                onChangeCampo={(name, value) => {
                    if (name === "motivoInteraccion") {
                        setMotivoSeleccionado(value);
                    }
                    if (name === "identificacion") {
                        setInitialValues((prev) => ({
                            ...prev,
                            identificacion: value,
                        }));
                    }
                }}
                onGuardar={async (formData) => {
                    try {
                        await saveOutboundGestion(formData);
                    } catch (err) {
                        console.error(err);
                        setError(
                            err?.message ||
                                "No se pudo guardar la gestion outbound",
                        );
                    }
                }}
                onActualizar={async (formData) => {
                    try {
                        await saveOutboundGestion(formData);
                    } catch (err) {
                        console.error(err);
                        setError(
                            err?.message ||
                                "No se pudo actualizar la gestion outbound",
                            );
                    }
                }}
                onCancelar={handleCancelarGestion}
            />
        </div>
    );
}
