import { useMemo, useState } from "react";
import {
    checkPublicRrssLeadByCedula,
    submitPublicRrssLead,
} from "../services/publicRrssForm.service";
import "./PublicMaquitaRrssForm.css";

const ESTADOS_CIVILES = [
    "Soltero",
    "Casado",
    "Uni�n libre",
    "Divorciado",
    "Viudo",
];

const CIUDADES = [
    "LATACUNGA",
    "LA MANA",
    "PANGUA",
    "PUJILI",
    "SALCEDO",
    "SAQUISILI",
    "SIGCHOS",
    "IBARRA",
    "ANTONIO ANTE",
    "COTACACHI",
    "OTAVALO",
    "PIMAMPIRO",
    "SAN MIGUEL DE URCUQUI",
    "PORTOVIEJO",
    "BOLIVAR",
    "CHONE",
    "EL CARMEN",
    "FLAVIO ALFARO",
    "JIPIJAPA",
    "JUNIN",
    "MANTA",
    "MONTECRISTI",
    "PAJAN",
    "PICHINCHA",
    "ROCAFUERTE",
    "SANTA ANA",
    "SUCRE",
    "TOSAGUA",
    "24 DE MAYO",
    "PEDERNALES",
    "OLMEDO",
    "PUERTO LOPEZ",
    "JAMA",
    "JARAMIJO",
    "SAN VICENTE",
    "QUITO",
    "CAYAMBE",
    "MEJIA",
    "PEDRO MONCAYO",
    "RUMI�AHUI",
    "SAN MIGUEL DE LOS BANCOS",
    "PEDRO VICENTE MALDONADO",
    "PUERTO QUITO",
];

const DESTINOS_CREDITO = [
    "Consumo personal y familiar",
    "Pago, consolidaci�n y refinanciamiento de deudas",
    "Vivienda (compra, construcci�n, ampliaci�n, remodelaci�n y mantenimiento)",
    "Compra de veh�culo",
    "Reparaci�n de veh�culo",
    "Educaci�n y formaci�n acad�mica",
    "Salud, tratamientos m�dicos y emergencias",
    "Agricultura, ganader�a y actividades rurales",
    "Compra de bienes, equipos, maquinaria e insumos",
    "Capital de trabajo",
    "Compra de inmueble",
];

const FUENTES_INGRESO = [
    "Jubilaci�n",
    "Arriendos",
    "Sueldo fijo",
    "Negocio propio",
    "Remesas",
];

const ACTIVIDADES = [
    "Agricultura, ganader�a y pesca",
    "Comercio",
    "Industria y manufactura",
    "Servicios",
    "Transporte y log�stica",
    "Construcci�n y vivienda",
    "Actividades financieras y administrativas",
    "Educaci�n",
    "Salud",
    "Actividades independientes / autoempleo",
    "Turismo y entretenimiento",
    "Tecnolog�a y digital",
];

const TIPOS_VIVIENDA = ["Familiar", "Propia", "Arrendada"];
const HIJOS_OPTIONS = Array.from({ length: 11 }, (_, i) => String(i));

const INITIAL_FORM = {
    autoriza_buro: "Si",
    numero_cedula: "",
    apellidos_nombres_completos: "",
    estado_civil: "",
    ciudad: "",
    celular: "",
    monto_solicitado: "",
    destino_credito: "",
    ingreso_neto_recibir: "",
    fuente_ingreso: "",
    actividad_economica: "",
    tiempo_actividad_anios: "",
    tipo_vivienda: "",
    mantiene_hijos: "",
    otros_ingresos: "",
};

export default function PublicMaquitaRrssForm() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingCedula, setIsCheckingCedula] = useState(false);
    const [cedulaExists, setCedulaExists] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const actividadEconomicaTiempo = useMemo(
        () =>
            `${form.actividad_economica || ""}${
                form.actividad_economica && form.tiempo_actividad_anios
                    ? " | "
                    : ""
            }${form.tiempo_actividad_anios || ""}`,
        [form.actividad_economica, form.tiempo_actividad_anios],
    );

    const onChange = (key) => (e) => {
        if (key === "numero_cedula") setCedulaExists(false);
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const onChangeDigitsOnly =
        (key, maxLength = null) =>
        (e) => {
            const digits = String(e.target.value || "").replace(/\D/g, "");
            const value =
                typeof maxLength === "number"
                    ? digits.slice(0, maxLength)
                    : digits;
            if (key === "numero_cedula") setCedulaExists(false);
            setForm((prev) => ({ ...prev, [key]: value }));
        };

    const onCedulaBlur = async () => {
        const cedula = String(form.numero_cedula || "").replace(/\D/g, "");
        if (!/^\d{10,13}$/.test(cedula)) return;
        setIsCheckingCedula(true);
        try {
            const resp = await checkPublicRrssLeadByCedula(cedula);
            const exists = Boolean(resp?.json?.exists);
            setCedulaExists(exists);
            if (exists) {
                setError(
                    "Tu solicitud ya existe. Espera a que se comunique un asesor.",
                );
            } else {
                setError("");
            }
        } finally {
            setIsCheckingCedula(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setIsSubmitting(true);
        try {
            const cedulaDigits = String(form.numero_cedula || "").replace(
                /\D/g,
                "",
            );
            if (!/^\d{10,13}$/.test(cedulaDigits)) {
                throw new Error("La cédula debe tener entre 10 y 13 dígitos.");
            }
            if (cedulaExists) {
                throw new Error(
                    "Tu solicitud ya existe. Espera a que se comunique un asesor.",
                );
            }
            const celularDigits = String(form.celular || "").replace(/\D/g, "");
            if (!/^\d{7,15}$/.test(celularDigits)) {
                throw new Error("El celular debe tener entre 7 y 15 dígitos.");
            }

            const payload = {
                ...form,
                tipo_relacion_laboral: "",
                actividad_economica_tiempo: actividadEconomicaTiempo,
                source_sheet_name: "rrss_form_publico",
            };

            const response = await submitPublicRrssLead(payload);
            if (!response.ok) {
                const detail =
                    response?.json?.details?.join(", ") ||
                    response?.json?.error ||
                    "No se pudo enviar el formulario";
                throw new Error(detail);
            }

            setSuccess(
                "Formulario enviado correctamente. Pronto un asesor se contactará contigo.",
            );
            setForm(INITIAL_FORM);
            setCedulaExists(false);
        } catch (err) {
            setError(err.message || "Error enviando formulario");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="public-rrss-shell">
            <section className="public-rrss-card">
                <h1>Formulario de Precalificacion de Credito</h1>
                <form className="public-rrss-form" onSubmit={onSubmit}>
                    <label>
                        Autoriza Buro *
                        <select
                            value={form.autoriza_buro}
                            onChange={onChange("autoriza_buro")}
                            required
                        >
                            <option value="Si">Si</option>
                            <option value="No">No</option>
                        </select>
                    </label>

                    <label>
                        Numero de cedula *
                        <input
                            value={form.numero_cedula}
                            onChange={onChangeDigitsOnly("numero_cedula", 13)}
                            onBlur={onCedulaBlur}
                            required
                            pattern="[0-9]{10,13}"
                            maxLength={13}
                            inputMode="numeric"
                            title="Ingrese entre 10 y 13 digitos"
                            placeholder="1000000000"
                        />
                    </label>

                    <label>
                        Apellidos y Nombres Completos *
                        <input
                            value={form.apellidos_nombres_completos}
                            onChange={onChange("apellidos_nombres_completos")}
                            required
                            maxLength={255}
                        />
                    </label>

                    <label>
                        Estado Civil *
                        <select
                            value={form.estado_civil}
                            onChange={onChange("estado_civil")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {ESTADOS_CIVILES.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Ciudad *
                        <select
                            value={form.ciudad}
                            onChange={onChange("ciudad")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {CIUDADES.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Celular *
                        <input
                            value={form.celular}
                            onChange={onChangeDigitsOnly("celular", 15)}
                            required
                            pattern="[0-9]{7,15}"
                            maxLength={15}
                            inputMode="numeric"
                            title="Ingrese entre 7 y 15 digitos"
                            placeholder="0999999999"
                        />
                    </label>

                    <label>
                        Monto solicitado *
                        <input
                            value={form.monto_solicitado}
                            onChange={onChangeDigitsOnly(
                                "monto_solicitado",
                                12,
                            )}
                            required
                            maxLength={64}
                            inputMode="numeric"
                            pattern="[0-9]+"
                            placeholder="1000"
                        />
                    </label>

                    <label>
                        Destino del credito *
                        <select
                            value={form.destino_credito}
                            onChange={onChange("destino_credito")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {DESTINOS_CREDITO.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Ingresos mensuales aproximados *
                        <input
                            value={form.ingreso_neto_recibir}
                            onChange={onChangeDigitsOnly(
                                "ingreso_neto_recibir",
                                12,
                            )}
                            required
                            maxLength={64}
                            inputMode="numeric"
                            pattern="[0-9]+"
                            placeholder="450"
                        />
                    </label>

                    <label>
                        Fuente de ingreso *
                        <select
                            value={form.fuente_ingreso}
                            onChange={onChange("fuente_ingreso")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {FUENTES_INGRESO.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Actividad economica *
                        <select
                            value={form.actividad_economica}
                            onChange={onChange("actividad_economica")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {ACTIVIDADES.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Tiempo de actividad economica (a�os) *
                        <input
                            value={form.tiempo_actividad_anios}
                            onChange={onChange("tiempo_actividad_anios")}
                            required
                            maxLength={32}
                        />
                    </label>

                    <label>
                        Tipo de Vivienda *
                        <select
                            value={form.tipo_vivienda}
                            onChange={onChange("tipo_vivienda")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {TIPOS_VIVIENDA.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Hijos que dependen *
                        <select
                            value={form.mantiene_hijos}
                            onChange={onChange("mantiene_hijos")}
                            required
                        >
                            <option value="">Selecciona</option>
                            {HIJOS_OPTIONS.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Otros ingresos *
                        <input
                            value={form.otros_ingresos}
                            onChange={onChange("otros_ingresos")}
                            required
                            maxLength={500}
                        />
                    </label>

                    {error ? (
                        <p className="public-rrss-error">{error}</p>
                    ) : null}
                    {isCheckingCedula ? (
                        <p className="public-rrss-success">
                            Validando c�dula...
                        </p>
                    ) : null}
                    {success ? (
                        <p className="public-rrss-success">{success}</p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={
                            isSubmitting || isCheckingCedula || cedulaExists
                        }
                    >
                        {isSubmitting ? "Enviando..." : "Enviar solicitud"}
                    </button>
                </form>
            </section>
        </main>
    );
}
