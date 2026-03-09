import React from "react";
import { formF2Template } from "../../templates/formF2Template";
import FormularioDinamico from "../../components/FormularioDinamico";
import { fetchOutMaquitaData } from "../../services/outMaquita.service";

export default function OutMaquitaFormF2() {
    const [registro, setRegistro] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        let mounted = true;
        fetchOutMaquitaData()
            .then((data) => {
                if (mounted) setRegistro(data[0] || null);
            })
            .catch(() => setError("No se pudo obtener datos de Google Sheets"))
            .finally(() => setLoading(false));
        return () => {
            mounted = false;
        };
    }, []);

    if (loading) return <div>Cargando datos de Out Maquita...</div>;
    if (error) return <div style={{ color: "red" }}>{error}</div>;
    if (!registro) return <div>No hay registros disponibles.</div>;

    // Mapeo de columnas a campos del formulario
    const initialValues = {
        identificacion: registro["Nº de cédula"] || "",
        apellidosNombres: registro["Nombres completos"] || "",
        tipoCampana: "out-maquita-cushunchic",
        celular: registro["Teléfono Celular"] || "",
        motivoInteraccion: "",
        submotivoInteraccion: "",
        observaciones: "",
    };

    return (
        <div
            style={{
                maxWidth: 500,
                margin: "0 auto",
                background: "#ffffff",
                borderRadius: 8,
                padding: 24,
                boxShadow: "0 2px 8px #0001",
            }}
        >
            <FormularioDinamico
                template={formF2Template}
                onSubmit={() => {}}
                initialValues={initialValues}
            />
        </div>
    );
}
