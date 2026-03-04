const formulario3Config = {
    title: "Encuesta de satisfacción",
    fields: [
        {
            key: "respuesta1",
            label: "1. ¿Cómo calificarías la atención recibida por parte de nuestros funcionarios?",
            type: "select",
            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        },
        {
            key: "respuesta2",
            label: "1.1. ¿Cuál es el motivo de la calificación?",
            type: "text",
            maxLength: 500,
        },
        {
            key: "respuesta3",
            label: "2. ¿Como calificarías la calidad del producto/servicio recibido?",
            type: "select",
            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        },
        {
            key: "respuesta4",
            label: "2.1. ¿Cuál es el motivo de la calificación?",
            type: "text",
            maxLength: 500,
        },
        {
            key: "respuesta5",
            label: "3. ¿Como fue el tiempo de espera para ser atendido?",
            type: "select",
            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        },
        {
            key: "respuesta6",
            label: "4. ¿Cuál sería su método preferido de comunicación con nosotros?",
            type: "select",
            options: [
                "Correo Electrónico",
                "Llamada Telefónica",
                "Agencias",
                "WhatsApp",
            ],
        },
    ],
};

export default formulario3Config;
