import { useState, useEffect } from "react";
import { Select, Button, Alert } from "../../components/common";
import { obtenerCampaniasActivas } from "../../services/campaign.service";
import "./CargarBases.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function GestionarEstadoBases() {
    const [campanias, setCampanias] = useState([]);
    const [campaniaSeleccionada, setCampaniaSeleccionada] = useState("");
    const [importaciones, setImportaciones] = useState([]);
    const [importacionSeleccionada, setImportacionSeleccionada] = useState("");
    const [accion, setAccion] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    // Cargar campañas activas al montar
    useEffect(() => {
        cargarCampanias();
    }, []);

    // Cargar importaciones cuando se selecciona una campaña
    useEffect(() => {
        if (campaniaSeleccionada) {
            cargarImportaciones(campaniaSeleccionada);
        } else {
            setImportaciones([]);
            setImportacionSeleccionada("");
        }
    }, [campaniaSeleccionada]);

    const cargarCampanias = async () => {
        try {
            const options = await obtenerCampaniasActivas();
            setCampanias(options);
        } catch (err) {
            console.error("Error cargando campañas:", err);
            setAlert({
                type: "error",
                message: "Error al cargar campañas activas",
            });
        }
    };

    const cargarImportaciones = async (campaignId) => {
        try {
            setLoading(true);
            setAlert(null);
            const token = localStorage.getItem("access_token");

            console.log("Cargando importaciones para campaña:", campaignId);

            const response = await fetch(
                `${API_BASE}/bases/importaciones/${campaignId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const json = await response.json();
            console.log("Importaciones recibidas:", json);

            const options = (json.importaciones || []).map((imp) => ({
                id: imp.LastUpdate,
                label: imp.LastUpdate,
            }));

            console.log("Importaciones procesadas:", options);
            setImportaciones(options);

            if (options.length === 0) {
                setAlert({
                    type: "error",
                    message:
                        "No hay importaciones disponibles para esta campaña",
                });
            }
        } catch (err) {
            console.error("Error cargando importaciones:", err);
            setAlert({
                type: "error",
                message: `Error al cargar importaciones: ${err.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAlert(null);

        if (!campaniaSeleccionada) {
            setAlert({
                type: "error",
                message: "Debe seleccionar una campaña",
            });
            return;
        }

        if (!importacionSeleccionada) {
            setAlert({
                type: "error",
                message: "Debe seleccionar una importación",
            });
            return;
        }

        if (!accion) {
            setAlert({ type: "error", message: "Debe seleccionar una acción" });
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem("access_token");

            const response = await fetch(`${API_BASE}/bases/administrar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    campaignId: campaniaSeleccionada,
                    importDate: importacionSeleccionada,
                    action: accion,
                }),
            });

            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.error || "Error al administrar base");
            }

            setAlert({
                type: "success",
                message: json.message || "Operación exitosa",
            });

            // Limpiar formulario
            setCampaniaSeleccionada("");
            setImportacionSeleccionada("");
            setAccion("");
        } catch (err) {
            console.error("Error administrando base:", err);
            setAlert({
                type: "error",
                message: err.message || "Error al administrar base",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper">
            <form onSubmit={handleSubmit} className="form">
                {/* Seleccionar Campaña */}
                <Select
                    label="Seleccionar Campaña"
                    options={campanias}
                    value={campaniaSeleccionada}
                    onChange={setCampaniaSeleccionada}
                    placeholder="Seleccione una campaña activa..."
                    required
                />

                {/* Seleccionar Importación */}
                <Select
                    label="Seleccionar Importación"
                    options={importaciones}
                    value={importacionSeleccionada}
                    onChange={setImportacionSeleccionada}
                    placeholder={
                        campaniaSeleccionada
                            ? "Seleccione una importación"
                            : "Primero seleccione una campaña"
                    }
                    disabled={!campaniaSeleccionada || loading}
                    required
                />

                {/* Seleccionar Acción */}
                <Select
                    label="Seleccionar Acción"
                    options={[
                        { id: "activar", label: "Activar Base" },
                        { id: "desactivar", label: "Desactivar Base" },
                    ]}
                    value={accion}
                    onChange={setAccion}
                    placeholder="Seleccione acción a realizar..."
                    required
                />

                {/* Alerta */}
                {alert && <Alert type={alert.type} message={alert.message} />}

                {/* Botón Submit */}
                <Button type="submit" disabled={loading}>
                    {loading ? "Procesando..." : "Ejecutar"}
                </Button>
            </form>
        </div>
    );
}
