import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function CargarBases() {
    const [baseName, setBaseName] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("");
    const [preview, setPreview] = useState([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus("");
        setPreview([]);

        if (!file) {
            setStatus("Por favor selecciona un archivo Excel.");
            return;
        }

        try {
            const formData = new FormData();
            formData.append("baseName", baseName);
            formData.append("description", description);
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
        } catch (err) {
            console.error(err);
            setStatus("Error de conexión con el servidor.");
        }
    };

    return (
        <div style={styles.wrapper}>
            <h1 style={styles.title}>Cargar nueva base</h1>
            <p style={styles.subtitle}>
                Sube un archivo Excel con los registros de clientes y vehículos
                para agendamiento.
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
                        required
                    />
                </label>

                <label style={styles.label}>
                    Descripción
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={{
                            ...styles.input,
                            minHeight: "70px",
                            resize: "vertical",
                        }}
                        placeholder="Ej: Clientes con mantenimiento pendiente, zona Quito."
                    />
                </label>

                <label style={styles.label}>
                    Archivo Excel (.xlsx)
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setFile(e.target.files[0] || null)}
                        style={styles.input}
                    />
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
    );
}

const styles = {
    wrapper: {
        maxWidth: "720px",
        backgroundColor: "#FFFFFF",
        padding: "2rem",
        borderRadius: "1rem",
        boxShadow: "0 10px 30px rgba(15,23,42,0.1)",
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
