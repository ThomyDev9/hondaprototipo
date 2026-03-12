// src/services/notifications.service.js

/**
 * Simula el envío de SMS y Email para una cita.
 * Más adelante aquí conectamos tu API real.
 *
 * @param {Object} params
 * @param {string|null} params.telefono
 * @param {string|null} params.email
 * @param {string} params.fechaCita
 * @param {string|null} params.agencia
 * @param {string} params.tipo  'confirmacion' | '1d_antes' | 'dia_cita' | '1h_antes'
 */
export async function enviarNotificacionCita({
  telefono,
  email,
  fechaCita,
  agencia,
  tipo,
}) {
  console.log('Simulando envío de notificación de cita:', {
    telefono,
    email,
    fechaCita,
    agencia,
    tipo,
  });

  // Aquí luego llamas a tu API real de SMS / Email

  return {
    smsEnviado: !!telefono,
    emailEnviado: !!email,
  };
}
