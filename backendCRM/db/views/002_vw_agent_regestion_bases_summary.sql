CREATE OR REPLACE VIEW vw_agent_regestion_bases_summary AS
SELECT
    ci.Campaign AS campaign_id,
    ci.LastUpdate AS import_id,
    COUNT(*) AS total_reciclables
FROM contactimportcontact ci
WHERE ci.Action = 'reciclable'
GROUP BY ci.Campaign, ci.LastUpdate;
