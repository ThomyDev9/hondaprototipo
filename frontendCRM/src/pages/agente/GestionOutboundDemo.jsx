import { opciones } from "../../utils/selectOptions";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { formF2Template } from "../../templates/formF2Template";
import FormularioDinamico from "../../components/FormularioDinamico";
import { getAgentCampaignScript } from "../../services/campaignScripts.service";
import { fetchTiposCampaniaOutbound } from "../../services/tiposCampania.service";
import {
    fetchFormTemplates,
    fetchGestionOutboundByIdentification,
    guardarGestionOutbound,
} from "../../services/dashboard.service";
import { findOptionIgnoreCase } from "./dashboardAgente.helpers";
import "./GestionOutboundDemo.css";
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
    const [remoteScriptContent, setRemoteScriptContent] = useState(null);
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
        let cancelled = false;

        const loadRemoteScript = async () => {
            const campaignId = String(nombreCampania || "").trim();
            if (!campaignId) {
                setRemoteScriptContent(null);
                return;
            }

            try {
                const data = await getAgentCampaignScript(campaignId);
                if (cancelled) return;

                const resolvedScript =
                    data?.script &&
                    typeof data.script === "object" &&
                    !Array.isArray(data.script)
                        ? data.script
                        : null;

                setRemoteScriptContent(resolvedScript);
            } catch (fetchError) {
                console.error(
                    "No se pudo cargar script remoto outbound:",
                    fetchError,
                );
                if (!cancelled) {
                    setRemoteScriptContent(null);
                }
            }
        };

        loadRemoteScript();

        return () => {
            cancelled = true;
        };
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
                    setInitialValues({
                        identificacion: busquedaId,
                    });
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
                motivoInteraccion: "",
                submotivoInteraccion: "",
                observaciones: "",
            });
            setMotivoSeleccionado("");
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

    const quickActions = [
        {
            id: "no-contesta",
            label: "No contesta",
            apply: (currentValues) => {
                const level1Options = Array.from(
                    new Set(levels.map((item) => item.level1).filter(Boolean)),
                );
                const matchedLevel1 =
                    findOptionIgnoreCase(level1Options, "NU1 Regestionables") ||
                    "NU1 Regestionables";
                const level2Options = levels
                    .filter((item) => item.level1 === matchedLevel1)
                    .map((item) => item.level2)
                    .filter(Boolean);

                return {
                    ...currentValues,
                    motivoInteraccion: matchedLevel1,
                    submotivoInteraccion:
                        findOptionIgnoreCase(level2Options, "no contesta") ||
                        "no contesta",
                    observaciones: "No contesta",
                };
            },
        },
        {
            id: "grabadora",
            label: "Grabadora",
            apply: (currentValues) => {
                const level1Options = Array.from(
                    new Set(levels.map((item) => item.level1).filter(Boolean)),
                );
                const matchedLevel1 =
                    findOptionIgnoreCase(level1Options, "NU1 Regestionables") ||
                    "NU1 Regestionables";
                const level2Options = levels
                    .filter((item) => item.level1 === matchedLevel1)
                    .map((item) => item.level2)
                    .filter(Boolean);

                return {
                    ...currentValues,
                    motivoInteraccion: matchedLevel1,
                    submotivoInteraccion:
                        findOptionIgnoreCase(level2Options, "grabadora") ||
                        "grabadora",
                    observaciones: "Contesta grabadora",
                };
            },
        },
        {
            id: "contesta-tercero",
            label: "Contesta tercero",
            apply: (currentValues) => {
                const level1Options = Array.from(
                    new Set(levels.map((item) => item.level1).filter(Boolean)),
                );
                const matchedLevel1 =
                    findOptionIgnoreCase(level1Options, "NU1 Regestionables") ||
                    "NU1 Regestionables";
                const level2Options = levels
                    .filter((item) => item.level1 === matchedLevel1)
                    .map((item) => item.level2)
                    .filter(Boolean);

                return {
                    ...currentValues,
                    motivoInteraccion: matchedLevel1,
                    submotivoInteraccion:
                        findOptionIgnoreCase(
                            level2Options,
                            "contesta tercero",
                        ) || "contesta tercero",
                    observaciones: "Contesta tercero",
                };
            },
        },
    ];
    const scriptContent = remoteScriptContent;
    const scriptLabels = {
        greeting: "Saludo",
        informative: "Informativo",
        farewell: "Despedida",
        objections: "Manejo de objeciones",
    };
    const clienteNombre = String(
        initialValues?.apellidosNombres ||
            initialValues?.NombreCliente ||
            initialValues?.NOMBRE_CLIENTE ||
            "cliente",
    ).trim();
    const replacePlaceholders = (text) =>
        String(text || "")
            .replace(/\{cliente\}/gi, clienteNombre)
            .replace(/\{asesor\}/gi, "[Asesor]");
    const scriptEntries = useMemo(
        () =>
            Object.entries(scriptContent || {})
                .filter(
                    ([key, value]) =>
                        [
                            "greeting",
                            "informative",
                            "farewell",
                            "objections",
                        ].includes(key) && Boolean(String(value || "").trim()),
                )
                .map(([key, value]) => ({
                    key,
                    label: scriptLabels[key] || key,
                    text: replacePlaceholders(value),
                })),
        [scriptContent, clienteNombre],
    );

    return (
        <div className="gestion-outbound-demo">
            <h2 className="gestion-outbound-demo__title">{nombreFormulario}</h2>
            {loading && <div>Cargando tipos de campana...</div>}
            {error && (
                <div className="gestion-outbound-demo__error">{error}</div>
            )}
            {successMessage && (
                <div className="gestion-outbound-demo__success">
                    {successMessage}
                </div>
            )}
            {scriptEntries.length > 0 && (
                <section className="gestion-outbound-demo__scripts">
                    <div className="gestion-outbound-demo__script-nav">
                        {scriptEntries.map(({ key, label }) => (
                            <span
                                key={key}
                                className="gestion-outbound-demo__script-chip"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                    <div className="gestion-outbound-demo__script-grid">
                        {scriptEntries.map(({ key, label, text }) => (
                            <article
                                key={key}
                                className="gestion-outbound-demo__script-card"
                            >
                                <h3>{label}</h3>
                                <p>{text}</p>
                            </article>
                        ))}
                    </div>
                </section>
            )}
            <FormularioDinamico
                variant="outbound"
                template={template}
                initialValues={initialValues}
                requireAllFields
                quickActions={quickActions}
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
