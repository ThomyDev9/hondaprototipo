INSERT INTO external_leads (
    source_channel,
    source_provider,
    source_external_id,
    source_import_batch,
    source_sheet_name,
    source_row_number,
    fecha_origen_raw,
    fecha_origen_dt,
    identification,
    full_name,
    celular,
    telefono_domicilio,
    city,
    province,
    estado_civil,
    actividad_economica,
    monto_solicitado,
    monto_aplica,
    external_status,
    external_substatus,
    observacion_externo,
    proceso_a_realizar,
    fecha_contacto_raw,
    fecha_contacto_dt,
    estatus,
    agencia,
    asesor_operativo,
    workflow_status,
    workflow_substatus,
    is_ready_for_promotion,
    promotion_status,
    payload_json
)
SELECT
    'mail' AS source_channel,
    'maquita' AS source_provider,
    CONCAT('mail:', src.id) AS source_external_id,
    src.import_batch,
    src.source_sheet_name,
    src.row_number,
    NULLIF(TRIM(src.fecha), ''),
    CASE
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%Y-%m-%d %H:%i:%s')
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%d/%m/%Y %H:%i:%s')
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%Y-%m-%d')
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%d/%m/%Y')
        ELSE NULL
    END AS fecha_origen_dt,
    TRIM(src.numero_cedula) AS identification,
    NULLIF(TRIM(src.nombres_completos), ''),
    NULLIF(TRIM(src.telefono_celular), ''),
    NULLIF(TRIM(src.telefono_domicilio), ''),
    NULL AS city,
    NULLIF(TRIM(src.provincia), ''),
    NULLIF(TRIM(src.estado_civil), ''),
    NULLIF(TRIM(src.actividad_economica), ''),
    NULLIF(TRIM(src.monto_solicitado), ''),
    NULLIF(TRIM(src.monto_aplica), ''),
    NULLIF(TRIM(src.estado), ''),
    NULLIF(TRIM(src.sub_estado), ''),
    NULLIF(TRIM(src.observacion), ''),
    NULLIF(TRIM(src.proceso_a_realizar), ''),
    NULLIF(TRIM(src.fecha_contacto), ''),
    CASE
        WHEN NULLIF(TRIM(src.fecha_contacto), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha_contacto), ''), '%Y-%m-%d %H:%i:%s')
        WHEN NULLIF(TRIM(src.fecha_contacto), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha_contacto), ''), '%d/%m/%Y %H:%i:%s')
        WHEN NULLIF(TRIM(src.fecha_contacto), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha_contacto), ''), '%Y-%m-%d')
        WHEN NULLIF(TRIM(src.fecha_contacto), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha_contacto), ''), '%d/%m/%Y')
        ELSE NULL
    END AS fecha_contacto_dt,
    NULLIF(TRIM(src.estatus), ''),
    NULLIF(TRIM(src.agencia), ''),
    NULLIF(TRIM(src.asesor_operativo), ''),
    CASE
        WHEN TRIM(COALESCE(src.estado, '')) <> ''
             AND TRIM(COALESCE(src.sub_estado, '')) <> ''
             AND TRIM(COALESCE(src.observacion, '')) <> ''
        THEN 'ya_gestionado'
        WHEN TRIM(COALESCE(src.proceso_a_realizar, '')) <> ''
             AND TRIM(COALESCE(src.observacion_cooperativa, '')) <> ''
        THEN 'listo_para_promocion'
        ELSE 'pendiente_completar'
    END AS workflow_status,
    NULLIF(TRIM(src.sub_estado), '') AS workflow_substatus,
    CASE
        WHEN TRIM(COALESCE(src.estado, '')) <> ''
             AND TRIM(COALESCE(src.sub_estado, '')) <> ''
             AND TRIM(COALESCE(src.observacion, '')) <> ''
        THEN 0
        WHEN TRIM(COALESCE(src.proceso_a_realizar, '')) <> ''
             AND TRIM(COALESCE(src.observacion_cooperativa, '')) <> ''
        THEN 1
        ELSE 0
    END AS is_ready_for_promotion,
    CASE
        WHEN TRIM(COALESCE(src.estado, '')) <> ''
             AND TRIM(COALESCE(src.sub_estado, '')) <> ''
             AND TRIM(COALESCE(src.observacion, '')) <> ''
        THEN 'ya_gestionado'
        WHEN TRIM(COALESCE(src.proceso_a_realizar, '')) <> ''
             AND TRIM(COALESCE(src.observacion_cooperativa, '')) <> ''
        THEN 'listo'
        ELSE 'pendiente'
    END AS promotion_status,
    COALESCE(
        src.raw_payload_json,
        JSON_OBJECT(
            'Fecha', src.fecha,
            'Nombres completos', src.nombres_completos,
            'Provincia', src.provincia,
            'Nº de cédula', src.numero_cedula,
            'Estado civil', src.estado_civil,
            'Actividad económica', src.actividad_economica,
            'Teléfono Domicilio', src.telefono_domicilio,
            'Teléfono Celular', src.telefono_celular,
            'Monto solicitado', src.monto_solicitado,
            'Estado', src.estado,
            'Sub estado', src.sub_estado,
            'OBSERVACIÓN.', src.observacion,
            'PROCESO A REALIZAR', src.proceso_a_realizar,
            'Monto Aplica', src.monto_aplica,
            'Observacion Cooperativa', src.observacion_cooperativa,
            'Fecha de contacto', src.fecha_contacto,
            'Estatus', src.estatus,
            'Agencia', src.agencia,
            'Asesor Operativo', src.asesor_operativo
        )
    ) AS payload_json
FROM (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(s.numero_cedula)
            ORDER BY
                COALESCE(
                    CASE
                        WHEN NULLIF(TRIM(s.fecha_contacto), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha_contacto), ''), '%Y-%m-%d %H:%i:%s')
                        WHEN NULLIF(TRIM(s.fecha_contacto), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha_contacto), ''), '%d/%m/%Y %H:%i:%s')
                        WHEN NULLIF(TRIM(s.fecha_contacto), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha_contacto), ''), '%Y-%m-%d')
                        WHEN NULLIF(TRIM(s.fecha_contacto), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha_contacto), ''), '%d/%m/%Y')
                        ELSE NULL
                    END,
                    CASE
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%Y-%m-%d %H:%i:%s')
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%d/%m/%Y %H:%i:%s')
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%Y-%m-%d')
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%d/%m/%Y')
                        ELSE NULL
                    END,
                    s.imported_at
                ) DESC,
                s.row_number DESC,
                s.id DESC
        ) AS rn
    FROM external_leads_mail_staging s
    WHERE NULLIF(TRIM(s.numero_cedula), '') IS NOT NULL
) src
WHERE src.rn = 1
ON DUPLICATE KEY UPDATE
    source_provider = VALUES(source_provider),
    source_external_id = VALUES(source_external_id),
    source_import_batch = VALUES(source_import_batch),
    source_sheet_name = VALUES(source_sheet_name),
    source_row_number = VALUES(source_row_number),
    fecha_origen_raw = VALUES(fecha_origen_raw),
    fecha_origen_dt = VALUES(fecha_origen_dt),
    full_name = VALUES(full_name),
    celular = VALUES(celular),
    telefono_domicilio = VALUES(telefono_domicilio),
    province = VALUES(province),
    estado_civil = VALUES(estado_civil),
    actividad_economica = VALUES(actividad_economica),
    monto_solicitado = VALUES(monto_solicitado),
    monto_aplica = VALUES(monto_aplica),
    external_status = VALUES(external_status),
    external_substatus = VALUES(external_substatus),
    observacion_externo = VALUES(observacion_externo),
    proceso_a_realizar = VALUES(proceso_a_realizar),
    fecha_contacto_raw = VALUES(fecha_contacto_raw),
    fecha_contacto_dt = VALUES(fecha_contacto_dt),
    estatus = VALUES(estatus),
    agencia = VALUES(agencia),
    asesor_operativo = VALUES(asesor_operativo),
    workflow_status = VALUES(workflow_status),
    workflow_substatus = VALUES(workflow_substatus),
    is_ready_for_promotion = VALUES(is_ready_for_promotion),
    promotion_status = VALUES(promotion_status),
    payload_json = VALUES(payload_json),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO external_leads (
    source_channel,
    source_provider,
    source_external_id,
    source_import_batch,
    source_sheet_name,
    source_row_number,
    fecha_origen_raw,
    fecha_origen_dt,
    identification,
    full_name,
    celular,
    city,
    estado_civil,
    actividad_economica,
    monto_solicitado,
    autoriza_buro,
    destino_credito,
    ingreso_neto_recibir,
    tipo_relacion_laboral,
    tipo_vivienda,
    mantiene_hijos,
    otros_ingresos,
    producto,
    external_status,
    external_substatus,
    observacion_externo,
    proceso_a_realizar,
    asesor_externo,
    usuario_maquita,
    seguimiento_kimobill,
    usuario_asesor_call_center,
    workflow_status,
    workflow_substatus,
    is_ready_for_promotion,
    promotion_status,
    payload_json
)
SELECT
    'rrss' AS source_channel,
    'maquita' AS source_provider,
    CONCAT('rrss:', src.id) AS source_external_id,
    src.import_batch,
    src.source_sheet_name,
    src.row_number,
    NULLIF(TRIM(src.fecha), ''),
    CASE
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%Y-%m-%d %H:%i:%s')
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%d/%m/%Y %H:%i:%s')
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%Y-%m-%d')
        WHEN NULLIF(TRIM(src.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
        THEN STR_TO_DATE(NULLIF(TRIM(src.fecha), ''), '%d/%m/%Y')
        ELSE NULL
    END AS fecha_origen_dt,
    TRIM(src.numero_cedula) AS identification,
    NULLIF(TRIM(src.apellidos_nombres_completos), ''),
    NULLIF(TRIM(src.celular), ''),
    NULLIF(TRIM(src.ciudad), ''),
    NULLIF(TRIM(src.estado_civil), ''),
    NULLIF(TRIM(src.actividad_economica_tiempo), ''),
    NULLIF(TRIM(src.monto_solicitado), ''),
    NULLIF(TRIM(src.autoriza_buro), ''),
    NULLIF(TRIM(src.destino_credito), ''),
    NULLIF(TRIM(src.ingreso_neto_recibir), ''),
    NULLIF(TRIM(src.tipo_relacion_laboral), ''),
    NULLIF(TRIM(src.tipo_vivienda), ''),
    NULLIF(TRIM(src.mantiene_hijos), ''),
    NULLIF(TRIM(src.otros_ingresos), ''),
    NULLIF(TRIM(src.producto), ''),
    NULLIF(TRIM(src.estado), ''),
    NULLIF(TRIM(src.sub_estado), ''),
    NULLIF(TRIM(src.observacion_agente_maquita), ''),
    NULLIF(TRIM(src.proceso_a_realizar), ''),
    NULLIF(TRIM(src.asesor), ''),
    NULLIF(TRIM(src.usuario_maquita), ''),
    NULLIF(TRIM(src.seguimiento_kimobill), ''),
    NULLIF(TRIM(src.usuario_asesor_call_center), ''),
    CASE
        WHEN TRIM(COALESCE(src.estado, '')) <> ''
             AND TRIM(COALESCE(src.sub_estado, '')) <> ''
             AND TRIM(COALESCE(src.seguimiento_kimobill, '')) <> ''
        THEN 'ya_gestionado'
        WHEN TRIM(COALESCE(src.producto, '')) <> ''
             AND TRIM(COALESCE(src.observacion_agente_maquita, '')) <> ''
             AND TRIM(COALESCE(src.proceso_a_realizar, '')) <> ''
        THEN 'listo_para_promocion'
        ELSE 'pendiente_completar'
    END AS workflow_status,
    NULLIF(TRIM(src.sub_estado), '') AS workflow_substatus,
    CASE
        WHEN TRIM(COALESCE(src.estado, '')) <> ''
             AND TRIM(COALESCE(src.sub_estado, '')) <> ''
             AND TRIM(COALESCE(src.seguimiento_kimobill, '')) <> ''
        THEN 0
        WHEN TRIM(COALESCE(src.producto, '')) <> ''
             AND TRIM(COALESCE(src.observacion_agente_maquita, '')) <> ''
             AND TRIM(COALESCE(src.proceso_a_realizar, '')) <> ''
        THEN 1
        ELSE 0
    END AS is_ready_for_promotion,
    CASE
        WHEN TRIM(COALESCE(src.estado, '')) <> ''
             AND TRIM(COALESCE(src.sub_estado, '')) <> ''
             AND TRIM(COALESCE(src.seguimiento_kimobill, '')) <> ''
        THEN 'ya_gestionado'
        WHEN TRIM(COALESCE(src.producto, '')) <> ''
             AND TRIM(COALESCE(src.observacion_agente_maquita, '')) <> ''
             AND TRIM(COALESCE(src.proceso_a_realizar, '')) <> ''
        THEN 'listo'
        ELSE 'pendiente'
    END AS promotion_status,
    COALESCE(
        src.raw_payload_json,
        JSON_OBJECT(
            'Asesor', src.asesor,
            'Fecha', src.fecha,
            'Autoriza Buró si / no', src.autoriza_buro,
            'Número de Cedula', src.numero_cedula,
            'Apellidos y Nombres Completos', src.apellidos_nombres_completos,
            'Estado Civil', src.estado_civil,
            'CIUDAD', src.ciudad,
            'Celular', src.celular,
            'Monto solicitado:', src.monto_solicitado,
            'Destino del credito:', src.destino_credito,
            'Ingreso Neto a recibir:', src.ingreso_neto_recibir,
            'Tipo de relación laboral', src.tipo_relacion_laboral,
            'Actividad economica y que tiempo:', src.actividad_economica_tiempo,
            'Tipo de Vivienda:', src.tipo_vivienda,
            'Si mantiene hijos que dependan:', src.mantiene_hijos,
            'Otros ingresos:', src.otros_ingresos,
            'Producto', src.producto,
            'Observacion AGENTE MAQUITA', src.observacion_agente_maquita,
            'PROCESO A REALIZAR', src.proceso_a_realizar,
            'Usuario Maquita', src.usuario_maquita,
            'Estado', src.estado,
            'Sub estado', src.sub_estado,
            'Seguimiento Kimobill', src.seguimiento_kimobill,
            'Usuario Asesor Call Center', src.usuario_asesor_call_center
        )
    ) AS payload_json
FROM (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(s.numero_cedula)
            ORDER BY
                COALESCE(
                    CASE
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%Y-%m-%d %H:%i:%s')
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%d/%m/%Y %H:%i:%s')
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%Y-%m-%d')
                        WHEN NULLIF(TRIM(s.fecha), '') REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                        THEN STR_TO_DATE(NULLIF(TRIM(s.fecha), ''), '%d/%m/%Y')
                        ELSE NULL
                    END,
                    s.imported_at
                ) DESC,
                s.row_number DESC,
                s.id DESC
        ) AS rn
    FROM external_leads_rrss_staging s
    WHERE NULLIF(TRIM(s.numero_cedula), '') IS NOT NULL
) src
WHERE src.rn = 1
ON DUPLICATE KEY UPDATE
    source_provider = VALUES(source_provider),
    source_external_id = VALUES(source_external_id),
    source_import_batch = VALUES(source_import_batch),
    source_sheet_name = VALUES(source_sheet_name),
    source_row_number = VALUES(source_row_number),
    fecha_origen_raw = VALUES(fecha_origen_raw),
    fecha_origen_dt = VALUES(fecha_origen_dt),
    full_name = VALUES(full_name),
    celular = VALUES(celular),
    city = VALUES(city),
    estado_civil = VALUES(estado_civil),
    actividad_economica = VALUES(actividad_economica),
    monto_solicitado = VALUES(monto_solicitado),
    autoriza_buro = VALUES(autoriza_buro),
    destino_credito = VALUES(destino_credito),
    ingreso_neto_recibir = VALUES(ingreso_neto_recibir),
    tipo_relacion_laboral = VALUES(tipo_relacion_laboral),
    tipo_vivienda = VALUES(tipo_vivienda),
    mantiene_hijos = VALUES(mantiene_hijos),
    otros_ingresos = VALUES(otros_ingresos),
    producto = VALUES(producto),
    external_status = VALUES(external_status),
    external_substatus = VALUES(external_substatus),
    observacion_externo = VALUES(observacion_externo),
    proceso_a_realizar = VALUES(proceso_a_realizar),
    asesor_externo = VALUES(asesor_externo),
    usuario_maquita = VALUES(usuario_maquita),
    seguimiento_kimobill = VALUES(seguimiento_kimobill),
    usuario_asesor_call_center = VALUES(usuario_asesor_call_center),
    workflow_status = VALUES(workflow_status),
    workflow_substatus = VALUES(workflow_substatus),
    is_ready_for_promotion = VALUES(is_ready_for_promotion),
    promotion_status = VALUES(promotion_status),
    payload_json = VALUES(payload_json),
    updated_at = CURRENT_TIMESTAMP;
