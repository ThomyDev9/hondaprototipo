ALTER TABLE coop_service_resources
    ADD COLUMN access_scope ENUM('campaign', 'all_advisors') NOT NULL DEFAULT 'campaign' AFTER campaign_id,
    ADD COLUMN home_shortcut TINYINT(1) NOT NULL DEFAULT 0 AFTER activo;

ALTER TABLE coop_service_resources
    ADD KEY idx_coop_service_resources_scope (access_scope),
    ADD KEY idx_coop_service_resources_home_shortcut (home_shortcut);
