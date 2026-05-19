CREATE TABLE IF NOT EXISTS coop_service_resources (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id VARCHAR(120) NOT NULL,
    nombre_servicio VARCHAR(150) NOT NULL,
    url VARCHAR(500) DEFAULT NULL,
    notas TEXT DEFAULT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(120) DEFAULT NULL,
    updated_by VARCHAR(120) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_coop_service_resources_campaign (campaign_id),
    KEY idx_coop_service_resources_active (activo)
);

CREATE TABLE IF NOT EXISTS coop_service_credentials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    resource_id BIGINT UNSIGNED NOT NULL,
    alias VARCHAR(120) NOT NULL,
    username_encrypted TEXT NOT NULL,
    username_iv VARCHAR(255) NOT NULL,
    username_tag VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    password_iv VARCHAR(255) NOT NULL,
    password_tag VARCHAR(255) NOT NULL,
    extra_encrypted TEXT DEFAULT NULL,
    extra_iv VARCHAR(255) DEFAULT NULL,
    extra_tag VARCHAR(255) DEFAULT NULL,
    priority INT NOT NULL DEFAULT 0,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(120) DEFAULT NULL,
    updated_by VARCHAR(120) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_coop_service_credentials_resource (resource_id),
    KEY idx_coop_service_credentials_active (activo),
    CONSTRAINT fk_coop_service_credentials_resource
        FOREIGN KEY (resource_id) REFERENCES coop_service_resources(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coop_service_access_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    credential_id BIGINT UNSIGNED NOT NULL,
    resource_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED DEFAULT NULL,
    username VARCHAR(120) DEFAULT NULL,
    action VARCHAR(32) NOT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_coop_service_logs_credential (credential_id),
    KEY idx_coop_service_logs_resource (resource_id),
    KEY idx_coop_service_logs_created (created_at),
    CONSTRAINT fk_coop_service_logs_credential
        FOREIGN KEY (credential_id) REFERENCES coop_service_credentials(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_coop_service_logs_resource
        FOREIGN KEY (resource_id) REFERENCES coop_service_resources(id)
        ON DELETE CASCADE
);
