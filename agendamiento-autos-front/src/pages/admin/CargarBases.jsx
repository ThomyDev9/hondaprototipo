// frontend/src/pages/bases/CargarBases.jsx
import { useState, useEffect } from "react";
import { PageContainer, Select, AutoComplete } from "../../components/common";
import { obtenerMapeos } from "../../services/mapping.service";
import { buscarCampanas } from "../../services/campaign.service";
import "./CargarBases.css";

const API_BASE = import.meta.env.VITE_API_BASE;
const token = localStorage.getItem("access_token");

const MAPEO_TO_IMPORT_CASE = {
    "banco pichincha encuestas": "bancoPichinchaEncuestasGenericas",
    "banco pichincha multioferta": "bancoPichinchaMultioferta",
};

function resolveImportCaseByMapeo(mapeoId, mapeoOptions) {
    const selected = mapeoOptions.find(
        (opt) => String(opt.id) === String(mapeoId),
    );
    if (!selected?.label) return null;

    const normalized = selected.label.trim().toLowerCase();
    return MAPEO_TO_IMPORT_CASE[normalized] || null;
}

export default function CargarBases() {
    const [baseName, setBaseName] = useState("");
    const [mapeo, setMapeo] = useState("");
    const [campania, setCampania] = useState("");
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("");
    const [preview, setPreview] = useState([]);
    const [mapeoOptions, setMapeoOptions] = useState([]);
    const [loadingMapeos, setLoadingMapeos] = useState(false);
    const [errors, setErrors] = useState({});

    // ✅ Cargar mapeos
    useEffect(() => {
        const loadMapeos = async () => {
            try {
                setLoadingMapeos(true);
                const data = await obtenerMapeos();
                const options = data.map((m) => ({
                    id: m.ID,
                    label: m.descripcion,
                }));
                setMapeoOptions(options);
            } catch (err) {
                console.error("Error cargando mapeos:", err);
                setStatus("Error al cargar los mapeos disponibles");
            } finally {
                setLoadingMapeos(false);
            }
        };
        loadMapeos();
    }, []);

    // ✅ Validación
    const validarFormulario = () => {
        const nuevosErrores = {};
        if (!baseName.trim())
            nuevosErrores.baseName = "El nombre de la base es obligatorio";
        if (!mapeo) nuevosErrores.mapeo = "Debe seleccionar un mapeo";
        if (!campania.trim())
            nuevosErrores.campania = "La campaña es obligatoria";
        if (!file) nuevosErrores.file = "Debe seleccionar un archivo CSV";
        setErrors(nuevosErrores);
        return Object.keys(nuevosErrores).length === 0;
    };

    // ✅ Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus("");
        setPreview([]);

        if (!validarFormulario()) return;

        try {
            const importCase = resolveImportCaseByMapeo(mapeo, mapeoOptions);

            if (!importCase) {
                setStatus(
                    "No se pudo determinar el tipo de importación para el mapeo seleccionado.",
                );
                return;
            }

            if (importCase === "bancoPichinchaMultioferta") {
                setStatus(
                    "El mapeo Banco Pichincha Multioferta aún no está implementado en backend.",
                );
                return;
            }

            const formData = new FormData();
            const importUser = localStorage.getItem("import_user") || "";
            formData.append("file", file); // CSV
            formData.append("campaignId", campania); // ID campaña
            formData.append("importName", baseName); // Nombre base
            formData.append("mapeoId", String(mapeo));
            formData.append("importCase", importCase);
            formData.append("importUser", importUser);

            const resp = await fetch(`${API_BASE}/bases/upload`, {
                method: "POST",
                body: formData,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            let json;
            try {
                json = await resp.json();
            } catch {
                throw new Error("El backend no respondió JSON");
            }

            if (!resp.ok) {
                setStatus(json.error || "Error al cargar la base");
                return;
            }

            setStatus(json.message || "Base cargada correctamente.");
            setPreview(json.data || []);

            // limpiar formulario
            setBaseName("");
            setMapeo("");
            setCampania("");
            setFile(null);
        } catch (err) {
            console.error(err);
            setStatus(err.message || "Error de conexión con el servidor.");
        }
    };

    return (
        <PageContainer title="Cargar nueva base" fullWidth>
            <div className="wrapper">
                <form onSubmit={handleSubmit} className="form">
                    {/* Nombre base - Solo visible cuando hay archivo */}
                    {file && (
                        <label className="label">
                            Nombre de la base
                            <input
                                type="text"
                                value={baseName}
                                disabled={true}
                                className="input inputDisabled"
                                placeholder={file.name}
                            />
                            {errors.baseName && (
                                <span className="errorText">
                                    {errors.baseName}
                                </span>
                            )}
                        </label>
                    )}
                    {/* Mapeo */}
                    <Select
                        label="Mapeo"
                        options={mapeoOptions}
                        value={mapeo}
                        onChange={setMapeo}
                        placeholder="Selecciona un mapeo"
                        disabled={loadingMapeos}
                        error={errors.mapeo}
                        required
                    />

                    {/* Campaña */}
                    <AutoComplete
                        label="Campaña"
                        value={campania}
                        onChange={setCampania}
                        onSearch={buscarCampanas}
                        placeholder="Escribe el ID de la campaña..."
                        error={errors.campania}
                        required
                    />

                    {/* Archivo CSV */}
                    <label className="label">
                        Archivo CSV (.csv)
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            className="input"
                            onChange={(e) => {
                                const selectedFile = e.target.files[0];
                                if (
                                    selectedFile &&
                                    !selectedFile.name.endsWith(".csv")
                                ) {
                                    setErrors({
                                        ...errors,
                                        file: "Solo se permiten archivos CSV",
                                    });
                                    setFile(null);
                                    return;
                                }
                                setErrors({ ...errors, file: null });
                                setFile(selectedFile || null);

                                // ✅ Autocomplete: usar nombre del archivo como nombre de base
                                if (selectedFile) {
                                    const fileName = selectedFile.name.replace(
                                        /\.csv$/i,
                                        "",
                                    );
                                    setBaseName(fileName);
                                }
                            }}
                        />
                        {errors.file && (
                            <span className="errorText">{errors.file}</span>
                        )}
                    </label>

                    {file && (
                        <p className="fileInfo">
                            Archivo seleccionado: <strong>{file.name}</strong>
                        </p>
                    )}

                    {status && <p className="status">{status}</p>}

                    <button type="submit" className="button">
                        Cargar base
                    </button>
                </form>

                {preview.length > 0 && (
                    <div className="previewBox">
                        <h2 className="previewTitle">
                            Preview (primeras filas)
                        </h2>
                        <pre className="previewPre">
                            {JSON.stringify(preview, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
