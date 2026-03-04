const SURVEY_PROVINCES = [
    "Azuay",
    "Bolivar",
    "Cañar",
    "Carchi",
    "Chimborazo",
    "Cotopaxi",
    "El Oro",
    "Esmeraldas",
    "Galápagos",
    "Guayanas",
    "Imbabura",
    "Loja",
    "Los Ríos",
    "Manabí",
    "Morona Santiago",
    "Napo",
    "Sucumbíos",
    "Pastaza",
    "Pinchincha",
    "Santa Elena",
    "Santo Domingo",
    "Francisco De Orellana",
    "Tungurahua",
    "Zamora Chinchipe",
];

const formulario3Config = {
    title: "Encuesta visita",
    fields: [
        {
            key: "respuesta1",
            label: "Fecha y hora de visita",
            type: "datetime-local",
        },
        {
            key: "respuesta2",
            label: "Lugar visita",
            type: "select",
            options: ["Domicilio", "Trabajo"],
        },
        {
            key: "respuesta3",
            label: "Provincia",
            type: "select",
            options: SURVEY_PROVINCES,
        },
        {
            key: "respuesta4",
            label: "Ciudad",
            type: "text",
        },
        {
            key: "respuesta10",
            label: "Opción de crédito seleccionada",
            type: "select",
            options: ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
        },
    ],
};

export default formulario3Config;
