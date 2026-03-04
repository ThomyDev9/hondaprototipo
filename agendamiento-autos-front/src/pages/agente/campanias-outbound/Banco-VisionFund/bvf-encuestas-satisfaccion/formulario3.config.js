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
            label: "2. ¿El producto (créditos, banca, tarjeta o seguros) entregado cumplió con sus expectativas?",
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
            label: "4. ¿Cuál fue el principal medio por el cual conoció a Banco VisionFund y que más influyó en su decisión de contactarnos o solicitar información?",
            type: "select",
            options: [
                "Radio",
                "Televisión",
                "Redes sociales (Facebook , Instagram, Twitter, TikTok)",
                "Recomendación de un familiar o amigo -Publicidad digital",
                "Ferias o eventos públicos",
                "Otros",
            ],
        },
    ],
};

export default formulario3Config;
