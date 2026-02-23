import { useState, useEffect } from "react";
import { Select, AutoComplete, PageContainer } from "../components/common";
import { obtenerMapeos } from "../services/mapping.service";
import { buscarCampanas } from "../services/campaign.service";

const API_BASE = import.meta.env.VITE_API_BASE;

/**
 * EJEMPLO: Usando los componentes Select y AutoComplete
 * Este archivo muestra cómo integrar mapeo y campaña en cualquier formulario
 */
export function EjemploUsoCamposSelectYAutoComplete() {
    const [mapeoOptions, setMapeoOptions] = useState([]);
    const [mapeoSeleccionado, setMapeoSeleccionado] = useState("");
    const [campaniaTexto, setCampaniaTexto] = useState("");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // ============================================
    // 1. CARGAR MAPEOS AL MONTAR EL COMPONENTE
    // ============================================
    useEffect(() => {
        const cargarMapeos = async () => {
            try {
                setLoading(true);
                const datos = await obtenerMapeos();

                // Transformar datos al formato que espera Select
                const opciones = datos.map((mappeo) => ({
                    id: mappeo.ID, // ID numérico
                    label: mappeo.descripcion, // Texto visible
                }));

                setMapeoOptions(opciones);
            } catch (error) {
                console.error("Error cargando mapeos:", error);
                setErrors((prev) => ({
                    ...prev,
                    mapeo: "Error al cargar mapeos disponibles",
                }));
            } finally {
                setLoading(false);
            }
        };

        cargarMapeos();
    }, []);

    // ============================================
    // 2. VALIDAR FORMULARIO
    // ============================================
    const validarFormulario = () => {
        const nuevosErrores = {};

        if (!mapeoSeleccionado) {
            nuevosErrores.mapeo = "Debes seleccionar un mapeo";
        }

        if (!campaniaTexto.trim()) {
            nuevosErrores.campania = "La campaña no puede estar vacía";
        }

        setErrors(nuevosErrores);
        return Object.keys(nuevosErrores).length === 0;
    };

    // ============================================
    // 3. ENVIAR FORMULARIO
    // ============================================
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) {
            return;
        }

        try {
            const payload = {
                mapeo: mapeoSeleccionado,
                campania: campaniaTexto,
                // ... otros campos
            };

            console.log("Enviando datos:", payload);

            const response = await fetch(`${API_BASE}/ejemplo/procesar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await response.json();

            if (!response.ok) {
                alert(`Error: ${json.error}`);
                return;
            }

            alert("Datos procesados correctamente");
            // Limpiar formulario
            setMapeoSeleccionado("");
            setCampaniaTexto("");
        } catch (error) {
            console.error("Error enviando datos:", error);
            alert("Error de conexión");
        }
    };

    return (
        <PageContainer title="Ejemplo: Mapeo y Campaña">
            <div style={styles.container}>
                <form onSubmit={handleSubmit} style={styles.form}>
                    {/* ============================================
                        SELECT: MAPEO
                        ============================================ */}
                    <Select
                        label="Selecciona un Mapeo"
                        options={mapeoOptions}
                        value={mapeoSeleccionado}
                        onChange={setMapeoSeleccionado}
                        placeholder="Elige un mapeo disponible"
                        disabled={loading}
                        required={true}
                        error={errors.mapeo}
                    />

                    {/* Información sobre el mapeo seleccionado */}
                    {mapeoSeleccionado && (
                        <div style={styles.info}>
                            <p>
                                Mapeo seleccionado ID:{" "}
                                <strong>{mapeoSeleccionado}</strong>
                            </p>
                        </div>
                    )}

                    {/* ============================================
                        AUTOCOMPLETE: CAMPAÑA
                        ============================================ */}
                    <AutoComplete
                        label="Ingresa o busca una Campaña"
                        value={campaniaTexto}
                        onChange={setCampaniaTexto}
                        onSearch={buscarCampanas}
                        placeholder="Ej: CAMP001, CAMP002..."
                        debounceMs={300} // Espera 300ms antes de buscar
                        required={true}
                        error={errors.campania}
                    />

                    {/* Información sobre la campaña ingresada */}
                    {campaniaTexto && (
                        <div style={styles.info}>
                            <p>
                                Campaña ingresada:{" "}
                                <strong>{campaniaTexto}</strong>
                            </p>
                        </div>
                    )}

                    {/* Botón enviar */}
                    <button type="submit" style={styles.button}>
                        Procesar
                    </button>
                </form>

                {/* ============================================
                    TABLA: RESUMEN DEL COMPONENTE
                    ============================================ */}
                <div style={styles.summary}>
                    <h3>Resumen de Propiedades</h3>

                    <h4>Select (Mapeo)</h4>
                    <table style={styles.table}>
                        <tbody>
                            <tr>
                                <td>label</td>
                                <td>
                                    "Selecciona un Mapeo" - Etiqueta visible
                                </td>
                            </tr>
                            <tr>
                                <td>options</td>
                                <td>
                                    Array de {`{id, label}`} - Opciones cargadas
                                    desde backend
                                </td>
                            </tr>
                            <tr>
                                <td>value</td>
                                <td>
                                    mapeoSeleccionado - ID numérico del mapeo
                                    escogido
                                </td>
                            </tr>
                            <tr>
                                <td>onChange</td>
                                <td>
                                    setMapeoSeleccionado - Actualizar estado
                                </td>
                            </tr>
                            <tr>
                                <td>required</td>
                                <td>true - Campo obligatorio</td>
                            </tr>
                            <tr>
                                <td>error</td>
                                <td>errors.mapeo - Mostrar errores</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4>AutoComplete (Campaña)</h4>
                    <table style={styles.table}>
                        <tbody>
                            <tr>
                                <td>label</td>
                                <td>
                                    "Ingresa o busca una Campaña" - Etiqueta
                                    visible
                                </td>
                            </tr>
                            <tr>
                                <td>value</td>
                                <td>campaniaTexto - Texto ingresado</td>
                            </tr>
                            <tr>
                                <td>onChange</td>
                                <td>setCampaniaTexto - Actualizar texto</td>
                            </tr>
                            <tr>
                                <td>onSearch</td>
                                <td>
                                    buscarCampanas - Función que busca en
                                    backend
                                </td>
                            </tr>
                            <tr>
                                <td>debounceMs</td>
                                <td>
                                    300 - Espera 300ms antes de hacer la
                                    búsqueda
                                </td>
                            </tr>
                            <tr>
                                <td>required</td>
                                <td>true - Campo obligatorio</td>
                            </tr>
                            <tr>
                                <td>error</td>
                                <td>errors.campania - Mostrar errores</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </PageContainer>
    );
}

const styles = {
    container: {
        maxWidth: "800px",
        backgroundColor: "#fff",
        padding: "2rem",
        borderRadius: "0.75rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        marginBottom: "2rem",
    },
    info: {
        padding: "0.75rem",
        backgroundColor: "#f0f9ff",
        borderLeft: "4px solid #1d4ed8",
        borderRadius: "0.5rem",
        fontSize: "0.9rem",
    },
    button: {
        padding: "0.8rem 1.5rem",
        backgroundColor: "#1d4ed8",
        color: "#fff",
        border: "none",
        borderRadius: "0.5rem",
        fontSize: "1rem",
        fontWeight: "600",
        cursor: "pointer",
        alignSelf: "flex-start",
        marginTop: "1rem",
    },
    summary: {
        borderTop: "2px solid #e2e8f0",
        paddingTop: "2rem",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: "1.5rem",
        fontSize: "0.9rem",
    },
};

styles.table.tr = {
    borderBottom: "1px solid #e2e8f0",
};

styles.table.td = {
    padding: "0.75rem",
    textAlign: "left",
};

export default EjemploUsoCamposSelectYAutoComplete;
