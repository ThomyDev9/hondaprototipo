ALTER TABLE external_leads
ADD COLUMN IF NOT EXISTS assigned_at DATETIME DEFAULT NULL AFTER assigned_to;

CREATE INDEX idx_external_leads_assigned_at ON external_leads (assigned_at);

UPDATE external_leads
SET assigned_at = COALESCE(promoted_at, updated_at, created_at)
WHERE assigned_to IS NOT NULL
  AND assigned_at IS NULL;
-- Los triggers de asignacion automatica ya no viven aqui.
-- La version vigente de autoasignacion se mantiene en:
-- 019_update_external_leads_weighted_assignment_trigger.sql
