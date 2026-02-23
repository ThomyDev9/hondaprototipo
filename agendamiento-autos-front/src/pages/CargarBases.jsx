import { useState, useEffect } from "react";
import { PageContainer, Select, AutoComplete } from "../components/common";
import { obtenerMapeos } from "../services/mapping.service";
import { buscarCampanas } from "../services/campaign.service";

const API_BASE = import.meta.env.VITE_API_BASE;

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

    // Cargar mapeos al montar el componente
    useEffect(() => {
        const loadMapeos = async () => {
            try {
                setLoadingMapeos(true);
                const data = await obtenerMapeos();
                // Transformar a formato de Select
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

    // Validar formulario
    const validarFormulario = () => {
        const nuevosErrores = {};

        if (!baseName.trim()) {
            nuevosErrores.baseName = "El nombre de la base es obligatorio";
        }

        if (!mapeo) {
            nuevosErrores.mapeo = "Debe seleccionar un mapeo";
        }

        if (!campania.trim()) {
            nuevosErrores.campania = "La campaña es obligatoria";
        }

        if (!file) {
            nuevosErrores.file = "Debe seleccionar un archivo Excel";
        }

        setErrors(nuevosErrores);
        return Object.keys(nuevosErrores).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus("");
        setPreview([]);

        if (!validarFormulario()) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append("baseName", baseName);
            formData.append("mapeo", mapeo);
            formData.append("campania", campania);
            formData.append("file", file);

            const resp = await fetch(`${API_BASE}/bases/upload`, {
                method: "POST",
                body: formData,
            });

            const json = await resp.json();

            if (!resp.ok) {
                setStatus(json.error || "Error al cargar la base");
                return;
            }

            setStatus(json.message || "Base cargada correctamente.");
            setPreview(json.preview || []);
            // Limpiar formulario
            setBaseName("");
            setMapeo("");
            setCampania("");
            setFile(null);
        } catch (err) {
            console.error(err);
            setStatus("Error de conexión con el servidor.");
        }
    };

    return (
        <PageContainer title="Cargar nueva base" fullWidth={true}>
            <div style={styles.wrapper}>
                <p style={styles.subtitle}>
                    Sube un archivo Excel con los registros de clientes y
                    vehículos para agendamiento.
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>
                        Nombre de la base
                        <input
                            type="text"
                            value={baseName}
                            onChange={(e) => setBaseName(e.target.value)}
                            style={styles.input}
                            placeholder="Ej: Base Honda Noviembre 2025"
                        />
                        {errors.baseName && (
                            <span style={styles.errorText}>
                                {errors.baseName}
                            </span>
                        )}
                    </label>

                    <Select
                        label="Mapeo"
                        options={mapeoOptions}
                        value={mapeo}
                        onChange={setMapeo}
                        placeholder="Selecciona un mapeo"
                        disabled={loadingMapeos}
                        error={errors.mapeo}
                        required={true}
                    />

                    <AutoComplete
                        label="Campaña"
                        value={campania}
                        onChange={setCampania}
                        onSearch={buscarCampanas}
                        placeholder="Escribe el ID de la campaña..."
                        error={errors.campania}
                        required={true}
                    />

                    <label style={styles.label}>
                        Archivo Excel (.xlsx)
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setFile(e.target.files[0] || null)}
                            style={styles.input}
                        />
                        {errors.file && (
                            <span style={styles.errorText}>{errors.file}</span>
                        )}
                    </label>

                    {file && (
                        <p style={styles.fileInfo}>
                            Archivo seleccionado: <strong>{file.name}</strong>
                        </p>
                    )}

                    {status && <p style={styles.status}>{status}</p>}

                    <button type="submit" style={styles.button}>
                        Cargar base
                    </button>
                </form>

                {preview.length > 0 && (
                    <div style={styles.previewBox}>
                        <h2 style={styles.previewTitle}>
                            Preview (primeras filas)
                        </h2>
                        <pre style={styles.previewPre}>
                            {JSON.stringify(preview, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}

const styles = {
    wrapper: {
        width: "100%",
        height: "100%",
        backgroundColor: "#FFFFFF",
        padding: "2rem",
        borderRadius: "1rem",
        boxShadow: "0 10px 30px rgba(15,23,42,0.1)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
    },
    title: {
        fontSize: "1.6rem",
        marginBottom: "0.25rem",
        color: "#0F172A",
    },
    subtitle: {
        fontSize: "0.9rem",
        marginBottom: "1.5rem",
        color: "#64748B",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
    },
    label: {
        fontSize: "0.9rem",
        color: "#0F172A",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
    },
    input: {
        padding: "0.7rem",
        borderRadius: "0.5rem",
        border: "1px solid #CBD5E1",
        fontSize: "0.95rem",
    },
    button: {
        marginTop: "0.5rem",
        padding: "0.8rem",
        borderRadius: "0.5rem",
        backgroundColor: "#1D4ED8",
        color: "#FFFFFF",
        border: "none",
        fontSize: "1rem",
        fontWeight: "600",
        cursor: "pointer",
        alignSelf: "flex-start",
    },
    fileInfo: {
        fontSize: "0.85rem",
        color: "#0F172A",
    },
    status: {
        fontSize: "0.85rem",
        color: "#F97316",
    },
    errorText: {
        fontSize: "0.8rem",
        color: "#ef4444",
        marginTop: "0.25rem",
    },
    previewBox: {
        marginTop: "2rem",
        padding: "1rem",
        borderRadius: "0.75rem",
        backgroundColor: "#F8FAFC",
        border: "1px solid #E2E8F0",
    },
    previewTitle: {
        fontSize: "1rem",
        marginBottom: "0.5rem",
        color: "#0F172A",
    },
    previewPre: {
        margin: 0,
        fontSize: "0.8rem",
        maxHeight: "200px",
        overflow: "auto",
    },
};
