DROP TRIGGER IF EXISTS trg_external_leads_mail_staging_ai_sync;
DROP TRIGGER IF EXISTS trg_external_leads_rrss_staging_ai_sync;

DELIMITER $$

CREATE TRIGGER trg_external_leads_mail_staging_ai_sync
AFTER INSERT ON external_leads_mail_staging
FOR EACH ROW
BEGIN
    IF NULLIF(TRIM(NEW.numero_cedula), '') IS NOT NULL THEN
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
        ) VALUES (
            'mail',
            'maquita',
            CONCAT('mail:', NEW.id),
            NEW.import_batch,
            NEW.source_sheet_name,
            NEW.row_number,
            NULLIF(TRIM(NEW.fecha), ''),
            NULL,
            TRIM(NEW.numero_cedula),
            NULLIF(TRIM(NEW.nombres_completos), ''),
            NULLIF(TRIM(NEW.telefono_celular), ''),
            NULLIF(TRIM(NEW.telefono_domicilio), ''),
            NULLIF(TRIM(NEW.provincia), ''),
            NULLIF(TRIM(NEW.estado_civil), ''),
            NULLIF(TRIM(NEW.actividad_economica), ''),
            NULLIF(TRIM(NEW.monto_solicitado), ''),
            NULLIF(TRIM(NEW.monto_aplica), ''),
            NULLIF(TRIM(NEW.estado), ''),
            NULLIF(TRIM(NEW.sub_estado), ''),
            NULLIF(TRIM(NEW.observacion), ''),
            NULLIF(TRIM(NEW.proceso_a_realizar), ''),
            NULLIF(TRIM(NEW.fecha_contacto), ''),
            NULL,
            NULLIF(TRIM(NEW.estatus), ''),
            NULLIF(TRIM(NEW.agencia), ''),
            NULLIF(TRIM(NEW.asesor_operativo), ''),
            CASE
                WHEN TRIM(COALESCE(NEW.estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.sub_estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion, '')) <> ''
                THEN 'ya_gestionado'
                WHEN TRIM(COALESCE(NEW.proceso_a_realizar, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion_cooperativa, '')) <> ''
                THEN 'listo_para_promocion'
                ELSE 'pendiente_completar'
            END,
            NULLIF(TRIM(NEW.sub_estado), ''),
            CASE
                WHEN TRIM(COALESCE(NEW.proceso_a_realizar, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion_cooperativa, '')) <> ''
                THEN 1 ELSE 0
            END,
            CASE
                WHEN TRIM(COALESCE(NEW.estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.sub_estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion, '')) <> ''
                THEN 'ya_gestionado'
                WHEN TRIM(COALESCE(NEW.proceso_a_realizar, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion_cooperativa, '')) <> ''
                THEN 'listo'
                ELSE 'pendiente'
            END,
            COALESCE(NEW.raw_payload_json, JSON_OBJECT('origen', 'mail_staging', 'id', NEW.id))
        )
        ON DUPLICATE KEY UPDATE
            source_external_id = VALUES(source_external_id),
            source_import_batch = VALUES(source_import_batch),
            source_sheet_name = VALUES(source_sheet_name),
            source_row_number = VALUES(source_row_number),
            fecha_origen_raw = VALUES(fecha_origen_raw),
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
            estatus = VALUES(estatus),
            agencia = VALUES(agencia),
            asesor_operativo = VALUES(asesor_operativo),
            workflow_status = VALUES(workflow_status),
            workflow_substatus = VALUES(workflow_substatus),
            is_ready_for_promotion = VALUES(is_ready_for_promotion),
            promotion_status = VALUES(promotion_status),
            payload_json = VALUES(payload_json),
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END$$

CREATE TRIGGER trg_external_leads_rrss_staging_ai_sync
AFTER INSERT ON external_leads_rrss_staging
FOR EACH ROW
BEGIN
    IF NULLIF(TRIM(NEW.numero_cedula), '') IS NOT NULL THEN
        INSERT INTO external_leads (
            source_channel, source_provider, source_external_id, source_import_batch, source_sheet_name, source_row_number,
            fecha_origen_raw, fecha_origen_dt, identification, full_name, celular, city, estado_civil, actividad_economica,
            monto_solicitado, autoriza_buro, destino_credito, ingreso_neto_recibir, tipo_relacion_laboral, tipo_vivienda,
            mantiene_hijos, otros_ingresos, producto, external_status, external_substatus, observacion_externo,
            proceso_a_realizar, asesor_externo, usuario_maquita, seguimiento_kimobill, usuario_asesor_call_center,
            workflow_status, workflow_substatus, is_ready_for_promotion, promotion_status, payload_json
        ) VALUES (
            'rrss', 'maquita', CONCAT('rrss:', NEW.id), NEW.import_batch, NEW.source_sheet_name, NEW.row_number,
            NULLIF(TRIM(NEW.fecha), ''), NULL, TRIM(NEW.numero_cedula), NULLIF(TRIM(NEW.apellidos_nombres_completos), ''),
            NULLIF(TRIM(NEW.celular), ''), NULLIF(TRIM(NEW.ciudad), ''), NULLIF(TRIM(NEW.estado_civil), ''),
            NULLIF(TRIM(NEW.actividad_economica_tiempo), ''), NULLIF(TRIM(NEW.monto_solicitado), ''),
            NULLIF(TRIM(NEW.autoriza_buro), ''), NULLIF(TRIM(NEW.destino_credito), ''), NULLIF(TRIM(NEW.ingreso_neto_recibir), ''),
            NULLIF(TRIM(NEW.tipo_relacion_laboral), ''), NULLIF(TRIM(NEW.tipo_vivienda), ''), NULLIF(TRIM(NEW.mantiene_hijos), ''),
            NULLIF(TRIM(NEW.otros_ingresos), ''), NULLIF(TRIM(NEW.producto), ''), NULLIF(TRIM(NEW.estado), ''), NULLIF(TRIM(NEW.sub_estado), ''),
            NULLIF(TRIM(NEW.observacion_agente_maquita), ''), NULLIF(TRIM(NEW.proceso_a_realizar), ''), NULLIF(TRIM(NEW.asesor), ''),
            NULLIF(TRIM(NEW.usuario_maquita), ''), NULLIF(TRIM(NEW.seguimiento_kimobill), ''), NULLIF(TRIM(NEW.usuario_asesor_call_center), ''),
            CASE
                WHEN TRIM(COALESCE(NEW.estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.sub_estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.seguimiento_kimobill, '')) <> ''
                THEN 'ya_gestionado'
                WHEN TRIM(COALESCE(NEW.producto, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion_agente_maquita, '')) <> ''
                     AND TRIM(COALESCE(NEW.proceso_a_realizar, '')) <> ''
                THEN 'listo_para_promocion'
                ELSE 'pendiente_completar'
            END,
            NULLIF(TRIM(NEW.sub_estado), ''),
            CASE
                WHEN TRIM(COALESCE(NEW.producto, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion_agente_maquita, '')) <> ''
                     AND TRIM(COALESCE(NEW.proceso_a_realizar, '')) <> ''
                THEN 1 ELSE 0
            END,
            CASE
                WHEN TRIM(COALESCE(NEW.estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.sub_estado, '')) <> ''
                     AND TRIM(COALESCE(NEW.seguimiento_kimobill, '')) <> ''
                THEN 'ya_gestionado'
                WHEN TRIM(COALESCE(NEW.producto, '')) <> ''
                     AND TRIM(COALESCE(NEW.observacion_agente_maquita, '')) <> ''
                     AND TRIM(COALESCE(NEW.proceso_a_realizar, '')) <> ''
                THEN 'listo'
                ELSE 'pendiente'
            END,
            COALESCE(NEW.raw_payload_json, JSON_OBJECT('origen', 'rrss_staging', 'id', NEW.id))
        )
        ON DUPLICATE KEY UPDATE
            source_external_id = VALUES(source_external_id),
            source_import_batch = VALUES(source_import_batch),
            source_sheet_name = VALUES(source_sheet_name),
            source_row_number = VALUES(source_row_number),
            fecha_origen_raw = VALUES(fecha_origen_raw),
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
    END IF;
END$$

DELIMITER ;
