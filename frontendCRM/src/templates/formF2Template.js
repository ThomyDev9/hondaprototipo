// Template para formulario F2 de Gestión Outbound
export const formF2Template = [
    {
        name: "identificacion",
        label: "Identificación",
        type: "text",
        required: true,
    },
    {
        name: "apellidosNombres",
        label: "Apellidos y Nombres",
        type: "text",
        required: true,
    },
    {
        name: "tipoCampana",
        label: "Tipo campaña",
        type: "select",
        required: true,
        options: [
            { value: "out-cacpeco", label: "Out Cacpeco" },
            { value: "out-honda", label: "Out Honda" },
            { value: "out-kullki-wasi", label: "Out Kullki Wasi" },
            {
                value: "out-mutualista-imbabura",
                label: "Out Mutualista Imbabura",
            },
        ],
    },
    {
        name: "celular",
        label: "Celular",
        type: "text",
        required: true,
    },
    {
        name: "motivoInteraccion",
        label: "Motivo de la interacción",
        type: "select",
        required: true,
        options: [
            { value: "gestion", label: "Gestión" },
            { value: "consulta", label: "Consulta" },
            { value: "otro", label: "Otro" },
        ],
    },
    {
        name: "submotivoInteraccion",
        label: "Submotivo de la interacción",
        type: "select",
        required: true,
        options: [
            { value: "contactado", label: "Contactado" },
            { value: "no-contactado", label: "No contactado" },
            { value: "otro", label: "Otro" },
        ],
    },
    {
        name: "observaciones",
        label: "Observaciones de la interacción",
        type: "textarea",
        required: false,
    },
];
