ALTER TABLE coop_service_credentials
    ADD COLUMN credential_kind ENUM('app', 'vm') NOT NULL DEFAULT 'app' AFTER owner_username;

ALTER TABLE coop_service_credentials
    ADD KEY idx_coop_service_credentials_kind (credential_kind);
