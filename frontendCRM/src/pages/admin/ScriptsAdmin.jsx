import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    FormField,
    PageContainer,
    Select,
} from "../../components/common";
import {
    getAdminCampaignScript,
    listScriptSubcampaigns,
    saveAdminCampaignScript,
} from "../../services/campaignScripts.service";
import "./ScriptsAdmin.css";

const EMPTY_SCRIPT_TEMPLATE = {
    greeting: "",
    informative: "",
    farewell: "",
    objections: "",
};

const SCRIPT_FIELDS = [
    {
        key: "greeting",
        label: "Saludo",
        help: "Inicio de la llamada y presentación del asesor.",
        rows: 5,
    },
    {
        key: "informative",
        label: "Informativo",
        help: "Motivo principal de la llamada o cuerpo del guion.",
        rows: 6,
    },
    {
        key: "farewell",
        label: "Despedida",
        help: "Cierre de la llamada.",
        rows: 5,
    },
    {
        key: "objections",
        label: "Manejo de objeciones",
        help: "Respuestas sugeridas ante dudas u objeciones.",
        rows: 8,
    },
];


function buildPrettyScriptJson(scriptObject) {
    return JSON.stringify(scriptObject, null, 2);
}


function normalizeScriptShape(rawScript) {
    const nextScript = { ...EMPTY_SCRIPT_TEMPLATE };

    if (
        !rawScript ||
        typeof rawScript !== "object" ||
        Array.isArray(rawScript)
    ) {
        return nextScript;
    }

    Object.keys(nextScript).forEach((key) => {
        nextScript[key] = String(rawScript[key] || "");
    });

    return nextScript;
}

export default function ScriptsAdmin() {
    const [subcampaignOptions, setSubcampaignOptions] = useState([]);
    const [selectedCampaignName, setSelectedCampaignName] = useState("");
    const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
    const [scriptForm, setScriptForm] = useState(EMPTY_SCRIPT_TEMPLATE);
    const [scriptJsonText, setScriptJsonText] = useState(
        buildPrettyScriptJson(EMPTY_SCRIPT_TEMPLATE),
    );
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [loadingScript, setLoadingScript] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [meta, setMeta] = useState(null);

    useEffect(() => {
        const loadSubcampaigns = async () => {
            try {
                setLoadingOptions(true);
                setAlert(null);
                const data = await listScriptSubcampaigns();
                setSubcampaignOptions(
                    data.map((item) => ({
                        id: String(item.id || ""),
                        label: item.label,
                        campania: item.campania || "",
                        subcampania: item.subcampania || "",
                    })),
                );
            } catch (error) {
                setAlert({
                    type: "error",
                    message: error.message || "No se pudo cargar subcampañas",
                });
            } finally {
                setLoadingOptions(false);
            }
        };

        loadSubcampaigns();
    }, []);

    useEffect(() => {
        const loadScript = async () => {
            if (!selectedMenuItemId) {
                setMeta(null);
                setScriptForm(EMPTY_SCRIPT_TEMPLATE);
                setScriptJsonText(buildPrettyScriptJson(EMPTY_SCRIPT_TEMPLATE));
                return;
            }

            try {
                setLoadingScript(true);
                setAlert(null);
                const data = await getAdminCampaignScript(selectedMenuItemId);
                const resolvedScript = normalizeScriptShape(
                    data?.script || EMPTY_SCRIPT_TEMPLATE,
                );

                setScriptForm(resolvedScript);
                setScriptJsonText(buildPrettyScriptJson(resolvedScript));
                setMeta({
                    source: data?.script ? "db" : "empty",
                    updatedBy: data?.updatedBy || "",
                    updatedAt: data?.updatedAt || null,
                });
            } catch (error) {
                setAlert({
                    type: "error",
                    message: error.message || "No se pudo cargar el script",
                });
            } finally {
                setLoadingScript(false);
            }
        };

        loadScript();
    }, [selectedMenuItemId, subcampaignOptions]);

    const selectedOption = useMemo(
        () =>
            subcampaignOptions.find(
                (option) => String(option.id) === String(selectedMenuItemId),
            ) || null,
        [selectedMenuItemId, subcampaignOptions],
    );

    const campaignOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    subcampaignOptions
                        .map((option) => String(option.campania || "").trim())
                        .filter(Boolean),
                ),
            )
                .sort((a, b) => a.localeCompare(b))
                .map((campaignName) => ({
                    id: campaignName,
                    label: campaignName,
                })),
        [subcampaignOptions],
    );

    const filteredSubcampaignOptions = useMemo(
        () =>
            subcampaignOptions
                .filter(
                    (option) =>
                        !selectedCampaignName ||
                        option.campania === selectedCampaignName,
                )
                .map((option) => ({
                    id: option.id,
                    label: option.subcampania,
                })),
        [selectedCampaignName, subcampaignOptions],
    );

    const handleCampaignChange = (campaignName) => {
        setSelectedCampaignName(campaignName);
        setSelectedMenuItemId("");
    };

    const handleFieldChange = (fieldKey, value) => {
        setScriptForm((prev) => {
            const nextScript = {
                ...prev,
                [fieldKey]: value,
            };
            setScriptJsonText(buildPrettyScriptJson(nextScript));
            return nextScript;
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setAlert(null);

            if (!selectedMenuItemId) {
                setAlert({
                    type: "error",
                    message: "Selecciona una subcampaña",
                });
                return;
            }

            const parsedScript = JSON.parse(scriptJsonText);
            if (
                !parsedScript ||
                typeof parsedScript !== "object" ||
                Array.isArray(parsedScript)
            ) {
                throw new Error("El JSON debe ser un objeto");
            }

            const normalizedScript = normalizeScriptShape(parsedScript);

            const response = await saveAdminCampaignScript(
                selectedMenuItemId,
                normalizedScript,
            );

            setScriptForm(normalizedScript);
            setScriptJsonText(buildPrettyScriptJson(normalizedScript));
            setAlert({
                type: "success",
                message: response.message || "Script guardado correctamente",
            });
            setMeta((prev) => ({
                source: "db",
                updatedBy: prev?.updatedBy || "actualizado",
                updatedAt: new Date().toISOString(),
            }));
        } catch (error) {
            setAlert({
                type: "error",
                message:
                    error.message ||
                    "No se pudo guardar el script en formato JSON",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageContainer>
            <div className="scripts-admin">
                {alert && (
                    <Alert
                        type={alert.type}
                        message={alert.message}
                        onClose={() => setAlert(null)}
                    />
                )}

                <div className="scripts-admin__header">
                    <div>
                        <h2 className="scripts-admin__title">
                            Scripts por subcampaña
                        </h2>
                        <p className="scripts-admin__subtitle">
                            Edita el JSON del guion y guárdalo en la tabla
                            `sub_campaign_scripts`.
                        </p>
                    </div>
                </div>

                <div className="scripts-admin__panel">
                    <div className="scripts-admin__selectors">
                        <Select
                            label="Campaña"
                            options={campaignOptions}
                            value={selectedCampaignName}
                            onChange={handleCampaignChange}
                            placeholder={
                                loadingOptions
                                    ? "Cargando campañas..."
                                    : "Selecciona una campaña"
                            }
                            disabled={loadingOptions}
                        />
                        <Select
                            label="Subcampaña"
                            options={filteredSubcampaignOptions}
                            value={selectedMenuItemId}
                            onChange={setSelectedMenuItemId}
                            placeholder={
                                selectedCampaignName
                                    ? "Selecciona una subcampaña"
                                    : "Primero selecciona una campaña"
                            }
                            disabled={loadingOptions || !selectedCampaignName}
                        />
                    </div>
                    <Select
                        label="Subcampaña"
                        options={subcampaignOptions}
                        value={selectedMenuItemId}
                        onChange={setSelectedMenuItemId}
                        placeholder={
                            loadingOptions
                                ? "Cargando subcampañas..."
                                : "Selecciona una subcampaña"
                        }
                        disabled={loadingOptions}
                    />

                    {selectedOption && (
                        <div className="scripts-admin__meta">
                            <div>
                                <strong>Subcampaña:</strong>{" "}
                                {selectedOption.subcampania}
                            </div>
                            <div>
                                <strong>Origen actual:</strong>{" "}
                                {meta?.source === "db" ? "Base de datos" : "Vacío"}
                            </div>
                            {meta?.updatedBy && (
                                <div>
                                    <strong>Último editor:</strong>{" "}
                                    {meta.updatedBy}
                                </div>
                            )}
                            {meta?.updatedAt && (
                                <div>
                                    <strong>Última actualización:</strong>{" "}
                                    {new Date(meta.updatedAt).toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="scripts-admin__fields">
                        {SCRIPT_FIELDS.map((field) => (
                            <div
                                key={field.key}
                                className="scripts-admin__field-card"
                            >
                                <div className="scripts-admin__field-header">
                                    <h3>{field.label}</h3>
                                    <p>{field.help}</p>
                                </div>
                                <FormField
                                    label=""
                                    type="textarea"
                                    name={field.key}
                                    value={scriptForm[field.key] || ""}
                                    onChange={(event) =>
                                        handleFieldChange(
                                            field.key,
                                            event.target.value,
                                        )
                                    }
                                    rows={field.rows}
                                    placeholder={`Escribe aquí la sección "${field.label}"`}
                                    className="scripts-admin__field-input"
                                />
                            </div>
                        ))}
                    </div>

                    {loadingScript && (
                        <div className="scripts-admin__loading">
                            Cargando script...
                        </div>
                    )}

                    <div className="scripts-admin__actions">
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={!selectedMenuItemId || saving}
                        >
                            {saving ? "Guardando..." : "Guardar script"}
                        </Button>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
