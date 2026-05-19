ALTER TABLE coop_service_credentials
    ADD COLUMN scope_type ENUM('global', 'advisor') NOT NULL DEFAULT 'global' AFTER activo,
    ADD COLUMN owner_user_id BIGINT UNSIGNED DEFAULT NULL AFTER scope_type,
    ADD COLUMN owner_username VARCHAR(120) DEFAULT NULL AFTER owner_user_id;

UPDATE coop_service_credentials
SET scope_type = 'global'
WHERE scope_type IS NULL OR scope_type = '';

ALTER TABLE coop_service_credentials
    ADD KEY idx_coop_service_credentials_scope (scope_type),
    ADD KEY idx_coop_service_credentials_owner_user (owner_user_id),
    ADD UNIQUE KEY uq_coop_service_credentials_advisor_owner (resource_id, owner_user_id, scope_type);
