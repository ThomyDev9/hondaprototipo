ALTER TABLE external_leads_rrss_staging
    ADD COLUMN IF NOT EXISTS actividad_economica VARCHAR(255) DEFAULT NULL AFTER tipo_relacion_laboral,
    ADD COLUMN IF NOT EXISTS tiempo_actividad_economica_anios VARCHAR(32) DEFAULT NULL AFTER actividad_economica;

ALTER TABLE external_leads
    ADD COLUMN IF NOT EXISTS tiempo_actividad_economica_anios VARCHAR(32) DEFAULT NULL AFTER actividad_economica;
