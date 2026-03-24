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

    //correcto lucha apertura de cta
    "cobranza-cacpe-zamora": {
        greeting:
            "Script de saludo\nBuenos días, tardes, noches, me comunico con Sr/Sra. {cliente}, mucho gusto le saluda, {asesor} asesor telefónico de Cacpe Zamora Chinchipe.\n Script de Seguridad\n Por su seguridad esta llamada esta siendo grabada y monitoreada en todas sus etapas. ¿Me permite un momento para otorgarle una información importante?",
        informative: `El motivo de mi llamada es para recordarle que la cuota de su crédito venció hace (mencionar número de días vencidos) por el valor de $ {VALOR}.
                        Recuerde que es importante que usted realice su pago en la fecha establecida para evitar gastos de cobranzas y de igual manera mantener su calificación crediticia intacta.
                        Respuesta Si:
                        1. ¿Coméntenos que día realizará el pago?
                        2. ¿Porque medio realizará el pago del valor pendiente? (transferencia o depósito en ventanilla)
                        Respuesta No: 
                        Le comento que el proceso es automático y mientras tenga valores pendientes, es nuestro deber seguirle informando.`,
        farewell:
            "Script de despedida\nAnte cualquier inquietud favor acercarse a la agencia más cercana, estamos para servirle. Que tenga un buen día (tarde, noche)",
    },

    "san-jorge-cobranza": {
        greeting: `Script de saludo
             Buenos días/tardes, ¿me comunico con el señor(a) {cliente}. Mi nombre es {asesor}, asesor de la Cooperativa SAN JORGE
             ¿Podría brindarme un momento de su tiempo para compartirle una información importante?
                “Sí” → continuar con el script de seguridad y luego con el mensaje principal.
                “No” → aplicar el script de despedida:
                Entiendo, muchas gracias por su tiempo. Que tenga un excelente día.
                Script de Seguridad
                Gracias por recibir mi llamada. Para garantizar nuestros niveles de calidad, le informo que esta llamada está siendo grabada y monitoreada.
                `,
        informative: `Estimado(a) Sr./Sra./Srta. {cliente},
                        Nos comunicamos con usted para informarle que mantiene un valor pendiente de pago de $ {TOTAL VENCIDO}, con {DÍAS DE MORA} días de vencimiento.
                        Le solicitamos realizar el pago en un máximo de 48 horas, para evitar la acumulación de nuevos recargos y posibles afectaciones al historial crediticio. Puede efectuar el pago a través de transferencias, deposito directo o pago en ventanilla.
                        Cuentas disponibles para transferencia o pago directo: - banco pichincha 2214294345 - banco Rumiñahui 8062997800 RUC 0690069334001 COAC SAN JORGE, remitir el comprobante al whatsapp número 0983780467.
                        En caso de que ya haya realizado el pago, por favor omita este mensaje y le agradecemos por su puntualidad.`,
        farewell: `Script de despedida\nAgradecemos mucho su atención. Para mayor información, puede comunicarse con nuestro Call Center al 03 - 2307741 extensión 10 o al 0983780467 o acercarse a la agencia más cercana. Le deseamos un excelente día.`,
    },
};

export default scriptsByCampaign;
