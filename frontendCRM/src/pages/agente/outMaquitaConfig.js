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
    {
        id: "seguimiento",
        title: "Seguimiento",
        description:
            "Revisa registros con documentos Completos/Incompletos y agrega comentarios.",
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

export const OUT_MAQUITA_SHARED_MOTIVO_SUBMOTIVOS = {
    "Contactado efectivo": [
        "Cierre de venta",
        "Cliente indeciso",
        "No interesado",
        "Solicita información adicional",
        "Se direcciona a agencia",
        "Información enviada por canales digitales",
    ],
    "No contactado": [
        "No contesta",
        "Línea ocupada",
        "Buzón de voz / grabadora",
        "Número equivocado",
        "Tercero informa / contesta tercero",
        "Sin cobertura",
        "Inubicable",
    ],
    Seguimiento: [
        "Volver a llamar",
        "Cliente solicita contacto posterior",
        "Gestión en proceso",
    ],
    "Gestión no aplicable": ["No aplica"],
};

export const OUT_MAQUITA_MAIL_MOTIVOS = Object.keys(
    OUT_MAQUITA_SHARED_MOTIVO_SUBMOTIVOS,
);
export const OUT_MAQUITA_RRSS_MOTIVOS = OUT_MAQUITA_MAIL_MOTIVOS;

export const OUT_MAQUITA_MAIL_SUBMOTIVOS = Object.values(
    OUT_MAQUITA_SHARED_MOTIVO_SUBMOTIVOS,
).flat();
export const OUT_MAQUITA_RRSS_SUBMOTIVOS = OUT_MAQUITA_MAIL_SUBMOTIVOS;

export function getOutMaquitaSubmotivosByMotivo(motivo = "") {
    const key = String(motivo || "").trim();
    if (!key) return [];
    return OUT_MAQUITA_SHARED_MOTIVO_SUBMOTIVOS[key] || [];
}

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
