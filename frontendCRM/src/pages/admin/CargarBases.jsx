// frontend/src/pages/bases/CargarBases.jsx
import { useState, useEffect } from "react";
import { Select } from "../../components/common";
import { obtenerCampaniasDesdeMenu } from "../../services/campaign.service";
import "./CargarBases.css";

const API_BASE = import.meta.env.VITE_API_BASE;
// El token se obtiene justo antes de cada petición

export default function CargarBases() {
    const [baseName, setBaseName] = useState("");
    const [campania, setCampania] = useState("");
    const [campaniaPadre, setCampaniaPadre] = useState("");
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("");
    const [preview, setPreview] = useState([]);
    const [menuCampanias, setMenuCampanias] = useState([]);
    const [loadingCampanias, setLoadingCampanias] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const loadCampanias = async () => {
            try {
                setLoadingCampanias(true);
                const tree = await obtenerCampaniasDesdeMenu();
                setMenuCampanias(tree);
            } catch (err) {
                console.error("Error cargando campañas de menú:", err);
                setStatus("Error al cargar campañas y subcampañas desde menú.");
            } finally {
                setLoadingCampanias(false);
            }
        };

        loadCampanias();
    }, []);

    const campaniaPadreOptions = menuCampanias
        .map((item) => item.campania)
        .filter(Boolean)
        .map((nombre) => ({ id: nombre, label: nombre }));

    const subcampaniaOptions = (
        menuCampanias.find((item) => item.campania === campaniaPadre)
            ?.subcampanias || []
    ).map((nombre) => ({ id: nombre, label: nombre }));

    // ✅ Validación
    const validarFormulario = () => {
        const nuevosErrores = {};
        if (!baseName.trim())
            nuevosErrores.baseName = "El nombre de la base es obligatorio";
        if (!campaniaPadre.trim())
            nuevosErrores.campaniaPadre = "La campaña es obligatoria";
        if (!campania.trim())
            nuevosErrores.campania = "La subcampaña es obligatoria";
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
            const formData = new FormData();
            const importUser = localStorage.getItem("import_user") || "";
            formData.append("file", file); // CSV
            formData.append("campaignId", campania); // ID campaña
            formData.append("importName", baseName); // Nombre base
            formData.append("importUser", importUser);

            const token = localStorage.getItem("access_token") || "";
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
            setCampaniaPadre("");
            setCampania("");
            setFile(null);
        } catch (err) {
            console.error(err);
            setStatus(err.message || "Error de conexión con el servidor.");
        }
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="carga-bases-form">
                {/* Nombre base - Solo visible cuando hay archivo */}
                {file && (
                    <label className="label" htmlFor="baseName">
                        Nombre de la base
                    </label>
                )}
                {file && (
                    <input
                        id="baseName"
                        type="text"
                        value={baseName}
                        disabled
                        className="input inputDisabled"
                        placeholder={file.name}
                    />
                )}
                {file && errors.baseName && (
                    <span className="errorText">{errors.baseName}</span>
                )}

                <Select
                    label="Campaña"
                    options={campaniaPadreOptions}
                    value={campaniaPadre}
                    onChange={(value) => {
                        setCampaniaPadre(value);
                        setCampania("");
                    }}
                    placeholder="Selecciona campaña padre"
                    disabled={loadingCampanias}
                    error={errors.campaniaPadre}
                    required
                />

                <Select
                    label="Subcampaña"
                    options={subcampaniaOptions}
                    value={campania}
                    onChange={setCampania}
                    placeholder={
                        campaniaPadre
                            ? "Selecciona subcampaña"
                            : "Primero selecciona campaña"
                    }
                    disabled={!campaniaPadre || loadingCampanias}
                    error={errors.campania}
                    required
                />

                {/* Archivo CSV */}
                <label className="label" htmlFor="csvFile">
                    Archivo CSV (.csv)
                </label>
                <input
                    id="csvFile"
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
                    <h2 className="previewTitle">Preview (primeras filas)</h2>
                    <pre className="previewPre">
                        {JSON.stringify(preview, null, 2)}
                    </pre>
                </div>
            )}
        </>
    );
}
