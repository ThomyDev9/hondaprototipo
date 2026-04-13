export const OUT_MAQUITA_FLOW_OPTIONS = [
    {
        id: "mail",
        title: "Gestion Leads Mail",
        description:
            "Trabaja los registros que llegan desde el flujo de correo.",
    },
    {
        id: "rrss",
        title: "Gestion Leads RRSS",
        description: "Trabaja los registros que llegan desde redes sociales.",
    },
    {
        id: "documentos",
        title: "Cargar documentos",
        description:
            "Gestiona los registros con entrega digital y adjunta su PDF.",
    },
];

export const OUT_MAQUITA_ENTREGA_DOCUMENTOS_OPTIONS = [
    "Entrega digital",
    "Entrega fisica",
];

export const OUT_MAQUITA_AGENCIA_ASISTIR_OPTIONS = [
    "QUITO SUR",
    "ARCADIA",
    "CHILLOGALLO",
    "AMERICA",
    "CENTRO",
    "CARAPUNGO",
    "TUMBACO",
    "PORTOVIEJO",
];

export const OUT_MAQUITA_MAIL_MOTIVOS = [
    "Contactado",
    "No contactado",
    "Volver a llamar",
    "Numero equivocado",
    "Grabadora",
    "Contesta tercero",
    "Cuelga llamada",
    "Seguimiento",
    "Inubicable",
    "No aplica",
    "Duplicado",
];

export const OUT_MAQUITA_MAIL_SUBMOTIVOS = [
    "No se encuentra interesada",
    "Se acercara a la agencia",
    "Contesta tercero",
    "Volver a llamar",
    "Proces de venta",
    "Sin cobertura",
    "Equivocado",
    "Inubicable",
    "Desembolsado",
    "Telefono imcompleto",
    "Duplicado",
    "No acepta producto sugerido",
    "Rechazado",
];

export const OUT_MAQUITA_RRSS_MOTIVOS = [
    "No contesta",
    "Contactado",
    "Volver a llamar",
    "Inubicable",
    "Seguimiento",
    "No aplica",
];

export const OUT_MAQUITA_RRSS_SUBMOTIVOS = [
    "No se encuentra interesada",
    "Se acercara a la agencia",
    "Contesta tercero",
    "Volver a llamar",
    "Proces de venta",
    "Sin cobertura",
    "Equivocado",
    "cliente indeciso",
    "Informacion incorrecta",
    "Grabadora",
    "Se entrega informacion por redes",
    "No acepta producto sugerido",
    "Duplicado",
];

export function getFirstNonEmptyValue(source, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return value;
        }
    }

    return "";
}

export function getRegistroIdentification(source) {
    return String(
        source?.identification ||
            source?.IDENTIFICACION ||
            source?.identificacion ||
            source?.Identificacion ||
            source?.["N�mero de Cedula"] ||
            source?.["Numero de Cedula"] ||
            source?.["N�mero de C�dula"] ||
            source?.["Numero de C�dula"] ||
            source?.["N� de c�dula"] ||
            source?.["N� de c�dula"] ||
            source?.cedula ||
            source?.Cedula ||
            source?.D ||
            source?.C ||
            "",
    ).trim();
}

export function getMailRegistroIdentification(source) {
    return String(
        source?.identification ||
            source?.IDENTIFICACION ||
            source?.identificacion ||
            source?.Identificacion ||
            source?.["N� de c�dula"] ||
            source?.["N� de c�dula"] ||
            source?.["N�mero de Cedula"] ||
            source?.["Numero de Cedula"] ||
            source?.D ||
            source?.C ||
            "",
    ).trim();
}

export function getRrssRegistroIdentification(source) {
    return String(
        source?.identification ||
            source?.IDENTIFICACION ||
            source?.identificacion ||
            source?.Identificacion ||
            source?.["N�mero de Cedula"] ||
            source?.["Numero de Cedula"] ||
            source?.["N�mero de C�dula"] ||
            source?.["Numero de C�dula"] ||
            source?.D ||
            "",
    ).trim();
}

export function getTodayFormatted() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    return `${day}/${month}/${year}`;
}
