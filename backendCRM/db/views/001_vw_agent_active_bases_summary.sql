CREATE OR REPLACE VIEW vw_agent_active_bases_summary AS
SELECT
    cab.CampaignId AS campaign_id,
    cab.ImportId AS import_id,
    COALESCE(cis.TotalRegistros, cab.TotalRegistros, 0) AS total_registros,
    COALESCE(cis.PendientesReales, 0) AS pendientes,
    COALESCE(cis.PendientesLibres, 0) AS pendientes_libres,
    COALESCE(cis.PendientesAsignadosSinGestion, 0)
        AS pendientes_asignados_sin_gestion
FROM campaign_active_base cab
LEFT JOIN campaign_import_stats cis
    ON cis.CampaignId = cab.CampaignId
   AND cis.ImportId = cab.ImportId
WHERE cab.State = '1'
  AND NOT (
      COALESCE(cis.PendientesReales, 0) = 0
      AND COALESCE(cis.PendientesLibres, 0) = 0
  );
