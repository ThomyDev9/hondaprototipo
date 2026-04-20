USE cck_dev;

ALTER TABLE `session_estado_log`
MODIFY COLUMN `EstadoInicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS `trg_session_estado_log_bi_force_now`;
DELIMITER $$
CREATE TRIGGER `trg_session_estado_log_bi_force_now`
BEFORE INSERT ON `session_estado_log`
FOR EACH ROW
BEGIN
  SET NEW.EstadoInicio = NOW();
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_session_estado_log_bu_force_now`;
DELIMITER $$
CREATE TRIGGER `trg_session_estado_log_bu_force_now`
BEFORE UPDATE ON `session_estado_log`
FOR EACH ROW
BEGIN
  IF OLD.EstadoFin IS NULL AND NEW.EstadoFin IS NOT NULL THEN
    SET NEW.EstadoFin = NOW();
  END IF;
END$$
DELIMITER ;
