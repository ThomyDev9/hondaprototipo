const scriptsByCampaign = {
    default: {
        greeting:
            "Hola, mi nombre es [Tu nombre]. ¿Con quién tengo el gusto de hablar el día de hoy?",
        security:
            "Para continuar, necesito confirmar algunos datos. ¿Podría confirmarme su número de cédula y fecha de nacimiento?",
        informative:
            "Quiero comentarle que nuestro objetivo hoy es validar la información de su base y ofrecerle las opciones disponibles.",
        farewell:
            "Gracias por su tiempo. Si tiene dudas adicionales, no dude en contactarnos. Que tenga un excelente día.",
    },
    "maquita-retanqueo": {
        greeting:
            "Buenos días, soy [Tu nombre] de Maquita Retanqueo. ¿Con quién hablo hoy?",
        security:
            "Por su seguridad, confirme su número de contrato y el nombre completo registrado, por favor.",
        informative:
            "Le informo que tenemos una propuesta de retanqueo ideal para su perfil. Si lo autoriza, la gestionamos de inmediato.",
        farewell:
            "Agradecemos su apertura. Le recordamos que puede contactarnos vía WhatsApp si desea seguir la gestión más tarde.",
        additional:
            "Dato adicional: recuérdele al cliente que cualquier cambio debe firmarse en la agencia más cercana o desde la app oficial.",
    },
    "out-honda": {
        greeting:
            "Hola, soy parte del equipo Honda. ¿Está disponible para hablar sobre su vehículo?",
        security:
            "Confirmemos su placa y número de cliente para seguir con la gestión.",
        informative:
            "Su reporte indica que hay un servicio pendiente; podemos coordinarlo en la fecha que mejor le convenga.",
        farewell:
            "Muchas gracias por su tiempo. Nuestro equipo espera su respuesta para continuar la gestión.",
    },

    //correcto lucha apertura de cta
    "lucha-apertura-de-cta": {
        greeting:
            "Buenos días/tardes/noches, tengo el gusto de hablar con el/la señor(a) {cliente}. Le saluda {asesor}, en representación de Cooperativa Lucha Campesina. Con el compromiso de brindar un servicio de excelencia a todos nuestros socios, deseamos conocer su percepción sobre la atención recibida durante el proceso de apertura de cuenta en nuestra institución.",
        arcotel:
            "¿Me permite unos minutos de su tiempo, por favor? Si acepta, continuamos con la encuesta. En caso contrario, agradecemos su tiempo y cerramos la llamada. \nPara garantizar nuestros niveles de calidad y su seguridad, esta llamada está siendo grabada y monitoreada.",
        informative:
            "Durante la llamada revisaremos el proceso que vivió en la apertura de cuenta para detectar oportunidades de mejora.",
        farewell:
            "Gracias por su tiempo y confianza. Sus respuestas y comentarios son muy valiosos, ya que nos permiten seguir mejorando la calidad de nuestro servicio. Que tenga un excelente día (tarde, noche).",
        objections:
            "1. No desea realizar la encuesta por llamada telefónica → Comprendemos su decisión. Informamos que la encuesta busca mejorar nuestros servicios y su experiencia. Agradecemos su comprensión.\n2. Desconfianza sobre la llamada → Para su tranquilidad, puede comunicarse con nuestro call center 023942468 o visitar la agencia más cercana para mayor información.\n3. Solicitud para volver a llamar → ¿Qué día y horario le conviene para comunicarnos nuevamente?\n4. Contesta una tercera persona → La encuesta solo puede responderla el/la titular de la cuenta.",
    },
};

export default scriptsByCampaign;
