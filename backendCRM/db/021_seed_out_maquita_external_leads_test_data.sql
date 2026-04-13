-- Datos de prueba para validar flujo Out Maquita 100% desde BD (external_leads).
-- Ejecutar en entorno de pruebas.

SET @batch := 'test_out_maquita_db_flow_20260410';

DELETE FROM external_leads
WHERE source_provider = 'maquita'
  AND source_import_batch = @batch;

INSERT INTO external_leads (
    source_channel,
    source_provider,
    source_external_id,
    source_import_batch,
    source_sheet_name,
    source_row_number,
    identification,
    full_name,
    celular,
    external_status,
    external_substatus,
    observacion_externo,
    proceso_a_realizar,
    observacion_cooperativa,
    workflow_status,
    workflow_substatus,
    promotion_status,
    is_ready_for_promotion,
    payload_json
) VALUES
(
    'mail',
    'maquita',
    CONCAT('seed-mail-gestion-', UNIX_TIMESTAMP()),
    @batch,
    'mail',
    1,
    '0990000001',
    'Mail Gestion Demo',
    '0990000001',
    'Contactado',
    'Seguimiento',
    'Cliente con interes',
    'Consumo',
    'Validado por cooperativa',
    'listo_para_promocion',
    'Seguimiento',
    'listo',
    1,
    JSON_OBJECT('seed', 1, 'flow', 'mail', 'mode', 'gestion')
),
(
    'mail',
    'maquita',
    CONCAT('seed-mail-regestion-', UNIX_TIMESTAMP()),
    @batch,
    'mail',
    2,
    '0990000002',
    'Mail Regestion Demo',
    '0990000002',
    'Volver a llamar',
    'No contesta',
    'Reintentar contacto',
    '',
    '',
    'pendiente_completar',
    'No contesta',
    'pendiente',
    0,
    JSON_OBJECT('seed', 1, 'flow', 'mail', 'mode', 'regestion')
),
(
    'rrss',
    'maquita',
    CONCAT('seed-rrss-gestion-', UNIX_TIMESTAMP()),
    @batch,
    'rrss',
    1,
    '0990000003',
    'RRSS Gestion Demo',
    '0990000003',
    'Contactado',
    'Interesado',
    'Cliente calificado',
    'Microcredito',
    '',
    'listo_para_promocion',
    'Interesado',
    'listo',
    1,
    JSON_OBJECT('seed', 1, 'flow', 'rrss', 'mode', 'gestion')
),
(
    'rrss',
    'maquita',
    CONCAT('seed-rrss-regestion-', UNIX_TIMESTAMP()),
    @batch,
    'rrss',
    2,
    '0990000004',
    'RRSS Regestion Demo',
    '0990000004',
    'No contesta',
    'Recontacto',
    'Intentar en otro horario',
    '',
    '',
    'pendiente_completar',
    'Recontacto',
    'pendiente',
    0,
    JSON_OBJECT('seed', 1, 'flow', 'rrss', 'mode', 'regestion')
);

-- Verificacion rapida por modo esperado:
SELECT source_channel, workflow_status, external_status, COUNT(*) AS total
FROM external_leads
WHERE source_provider = 'maquita'
  AND source_import_batch = @batch
GROUP BY source_channel, workflow_status, external_status
ORDER BY source_channel, workflow_status, external_status;
