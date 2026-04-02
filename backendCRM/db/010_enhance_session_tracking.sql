USE cck_dev_pruebas;

ALTER TABLE `session`
ADD COLUMN `EstadoInicio` DATETIME NULL AFTER `Estado`,
ADD COLUMN `EstadoFin` DATETIME NULL AFTER `EstadoInicio`,
ADD COLUMN `LoginAt` DATETIME NULL AFTER `EstadoFin`,
ADD COLUMN `LogoutAt` DATETIME NULL AFTER `LoginAt`;

CREATE TABLE IF NOT EXISTS `session_estado_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `SessionId` VARCHAR(100) NOT NULL,
  `Agent` VARCHAR(255) NOT NULL,
  `AgentNumber` VARCHAR(50) DEFAULT NULL,
  `Estado` VARCHAR(50) NOT NULL,
  `EstadoInicio` DATETIME NOT NULL,
  `EstadoFin` DATETIME DEFAULT NULL,
  `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_estado_log_session` (`SessionId`),
  KEY `idx_session_estado_log_agent` (`Agent`),
  KEY `idx_session_estado_log_estado` (`Estado`),
  KEY `idx_session_estado_log_inicio` (`EstadoInicio`),
  KEY `idx_session_estado_log_fin` (`EstadoFin`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
