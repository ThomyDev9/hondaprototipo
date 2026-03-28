CREATE OR REPLACE VIEW vw_admin_bases_summary AS
SELECT
    cab.id AS id,
    cis.CampaignId AS campaign_id,
    cis.ImportId AS import_id,
    COALESCE(cab.State, '0') AS base_state,
    cis.TotalRegistros AS total_registros,
    cis.PendientesReales AS pendientes,
    cis.PendientesLibres AS pendientes_libres,
    cis.PendientesAsignadosSinGestion AS pendientes_asignados_sin_gestion
FROM campaign_import_stats cis
LEFT JOIN campaign_active_base cab
    ON cab.CampaignId = cis.CampaignId
   AND cab.ImportId = cis.ImportId;
