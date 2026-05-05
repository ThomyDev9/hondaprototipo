ALTER TABLE external_leads_rrss_staging
    ADD COLUMN IF NOT EXISTS fuente_ingreso VARCHAR(128) DEFAULT NULL AFTER ingreso_neto_recibir;

ALTER TABLE external_leads
    ADD COLUMN IF NOT EXISTS fuente_ingreso VARCHAR(128) DEFAULT NULL AFTER ingreso_neto_recibir;

