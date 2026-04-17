CREATE TABLE IF NOT EXISTS machine_zoiper_map (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  machine_ip VARCHAR(64) NOT NULL,
  zoiper_code VARCHAR(32) NOT NULL,
  machine_label VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_machine_zoiper_map_ip (machine_ip),
  KEY idx_machine_zoiper_map_active (is_active)
);

