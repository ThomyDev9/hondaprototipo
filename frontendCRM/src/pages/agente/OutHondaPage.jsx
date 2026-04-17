import React, { useEffect, useMemo, useState } from "react";
import FormularioDinamicoReseteable from "../../components/FormularioDinamicoReseteable";
import {
    fetchOutboundClientByIdentification,
    guardarGestionOutbound,
} from "../../services/dashboard.service";
import { formF2Template } from "../../templates/formF2Template";
import "./OutHondaPage.css";

const FIXED_TIPO_CAMPANA = "PRIMICIAS";

function findOptionIgnoreCase(options = [], target) {
    const normalizedTarget = String(target || "").trim().toLowerCase();

    return (
        options.find(
            (option) =>
                String(option || "").trim().toLowerCase() === normalizedTarget,
        ) || ""
    );
}

export default function OutHondaPage() {
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [resetKey, setResetKey] = useState(0);
    const [motivos, setMotivos] = useState([]);
    const [submotivos, setSubmotivos] = useState([]);
    const [selectedMotivo, setSelectedMotivo] = useState("");
    const [levels, setLevels] = useState([]);
    const [initialValues, setInitialValues] = useState({
        Plataforma: "WEB",
        tipoCampana: FIXED_TIPO_CAMPANA,
    });

    useEffect(() => {
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
                const levelsData = Array.isArray(json.levels) ? json.levels : [];
                setLevels(levelsData);
                setMotivos([
                    ...new Set(levelsData.map((item) => item.level1).filter(Boolean)),
                ]);
            } catch {
                setMotivos([]);
            }
        }

        fetchMotivosGlobales();
    }, []);

    useEffect(() => {
        if (!selectedMotivo) {
            setSubmotivos([]);
            return;
        }

        const level2s = levels
            .filter((item) => item.level1 === selectedMotivo)
            .map((item) => item.level2)
            .filter(Boolean);

        setSubmotivos([...new Set(level2s)]);
    }, [selectedMotivo, levels]);

    useEffect(() => {
        if (!successMessage) return undefined;

        const timeoutId = setTimeout(() => {
            setSuccessMessage("");
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [successMessage]);

    useEffect(() => {
        const identification = String(
            initialValues?.identificacion || "",
        ).trim();

        if (!identification || identification.length < 5) {
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const { ok, status, json } =
                    await fetchOutboundClientByIdentification({
                        campaignId: "Out Honda",
                        identification,
                    });

                if (!ok) {
                    if (status !== 404) {
                        setError(
                            json?.detail ||
                                json?.error ||
                                "No se pudo buscar el cliente outbound",
                        );
                    }
                    return;
                }

                const data = json?.data || {};
                setInitialValues((current) => ({
                    ...current,
                    identificacion: identification,
                    apellidosNombres:
                        data.apellidosNombres || current.apellidosNombres || "",
                    celular: data.celular || current.celular || "",
                }));
            } catch {
                // no-op
            }
        }, 450);

        return () => clearTimeout(timeoutId);
    }, [initialValues?.identificacion]);

    const concesionarioOptions = [
        "QUITO, RECORDMOTOR - AG. EL INCA",
        "QUITO, ASIAUTO - AG. GRANADOS",
        "QUITO, ASIAUTO - AG. CUMBAYA",
        "GUAYAQUIL, ASIAUTO - AG. F. ORELLANA",
        "GUAYAQUIL, RECORDMOTOR - AG. AMERICAS",
        "MANTA, ASIAUTO - AV. ELECTRICOS",
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

    const dynamicTemplate = useMemo(
        () => [
            ...formF2Template.map((field) => {
                if (field.name === "tipoCampana") {
                    return {
                        ...field,
                        type: "select",
                        options: [
                            {
                                value: FIXED_TIPO_CAMPANA,
                                label: FIXED_TIPO_CAMPANA,
                            },
                        ],
                    };
                }

                if (field.name === "motivoInteraccion") {
                    return {
                        ...field,
                        type: "select",
                        options: motivos.map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                if (field.name === "submotivoInteraccion") {
                    return {
                        ...field,
                        type: "select",
                        options: submotivos.map((item) => ({
                            value: item,
                            label: item,
                        })),
                    };
                }

                return field;
            }),
            {
                name: "Email",
                label: "Email",
                type: "text",
                required: false,
            },
            {
                name: "Concesionario",
                label: "Concesionario",
                type: "select",
                required: false,
                options: concesionarioOptions.map((item) => ({
                    value: item,
                    label: item,
                })),
            },
            {
                name: "Modelo",
                label: "Modelo",
                type: "select",
                required: false,
                options: modeloOptions.map((item) => ({
                    value: item,
                    label: item,
                })),
            },
            {
                name: "Plataforma",
                label: "Plataforma",
                type: "text",
                required: false,
            },
            {
                name: "Provincia",
                label: "Provincia",
                type: "text",
                required: false,
            },
            {
                name: "Gestion",
                label: "Gestion",
                type: "select",
                required: false,
                options: gestionOptions.map((item) => ({
                    value: item,
                    label: item,
                })),
            },
            {
                name: "FechaAgenda",
                label: "Fecha de Cita / Videollamada",
                type: "datetime-local",
                required: false,
                showIf: (values) =>
                    values.Gestion === "CITA" || values.Gestion === "VIDEOLLAMADA",
            },
        ],
        [motivos, submotivos],
    );

    const quickActions = [
        {
            id: "no-contesta",
            label: "No contesta",
            apply: (currentValues) => {
                const level1Options = [
                    ...new Set(levels.map((item) => item.level1).filter(Boolean)),
                ];
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
                const level1Options = [
                    ...new Set(levels.map((item) => item.level1).filter(Boolean)),
                ];
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
                const level1Options = [
                    ...new Set(levels.map((item) => item.level1).filter(Boolean)),
                ];
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
                        findOptionIgnoreCase(level2Options, "contesta tercero") ||
                        "contesta tercero",
                    observaciones: "Contesta tercero",
                };
            },
        },
    ];

    return (
        <div>
            <div className="gestion-outbound-demo outmaquita-form-panel out-honda-page">
                <h1 className="gestion-outbound-demo__title">Out Honda</h1>
                {error && (
                    <div className="gestion-outbound-demo__error">{error}</div>
                )}
                {successMessage && (
                    <div className="gestion-outbound-demo__success">
                        {successMessage}
                    </div>
                )}
                <div className="outmaquita-form-wrapper">
                    <FormularioDinamicoReseteable
                        key={resetKey}
                        initialValues={initialValues}
                        template={dynamicTemplate}
                        quickActions={quickActions}
                        className="outmaquita-form outhonda-form-3col out-honda-page__form"
                        levels={levels}
                        onValuesChange={(values) => {
                            setInitialValues((current) => ({
                                ...current,
                                ...values,
                            }));
                            setSelectedMotivo(
                                String(values?.motivoInteraccion || "").trim(),
                            );
                        }}
                        onGuardar={async (formData) => {
                            try {
                                setError("");
                                setSuccessMessage("");

                                const fieldsMeta = dynamicTemplate.map((field) => ({
                                    name: field.name,
                                    label: field.label,
                                }));

                                const { ok, json } = await guardarGestionOutbound({
                                    campaignId: "Out Honda",
                                    formData: {
                                        ...formData,
                                        tipoCampana: FIXED_TIPO_CAMPANA,
                                    },
                                    fieldsMeta,
                                });

                                if (!ok) {
                                    throw new Error(
                                        json?.error ||
                                            "No se pudo guardar la gestion outbound",
                                    );
                                }

                                setSuccessMessage("Gestion guardada correctamente.");
                                setSelectedMotivo("");
                                setInitialValues({
                                    Plataforma: "WEB",
                                    tipoCampana: FIXED_TIPO_CAMPANA,
                                });
                                setResetKey((current) => current + 1);
                            } catch (e) {
                                console.error("Error en onGuardar OutHondaPage:", e);
                                setError(
                                    e?.message || "Error guardando gestion outbound",
                                );
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
