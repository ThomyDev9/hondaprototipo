// src/services/notifications.service.js

/**
 * Simula el envío de SMS y Email para una cita.
 * Luego aquí enchufas tu API real de SMS/EMAIL.
 */
export async function enviarNotificacionCita({
  telefono,
  email,
  fechaCita,
  agencia,
  tipo, // 'confirmacion', '1d_antes', 'dia_cita', '1h_antes'
}) {
  console.log('Simulando envío de notificación de cita:', {
    telefono,
    email,
    fechaCita,
    agencia,
    tipo,
  });

  // Aquí luego llamas a tu API real
  // await axios.post('https://tu-api-sms', { ... });

  // Simulamos éxito
  return {
    smsEnviado: !!telefono,
    emailEnviado: !!email,
  };
}
