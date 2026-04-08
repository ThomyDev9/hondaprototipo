CREATE TABLE IF NOT EXISTS external_leads_assignment_state (
    state_key VARCHAR(64) NOT NULL,
    last_consultor_id BIGINT DEFAULT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (state_key)
);

INSERT INTO external_leads_assignment_state (state_key, last_consultor_id)
SELECT 'round_robin', NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM external_leads_assignment_state
    WHERE state_key = 'round_robin'
);

DROP TRIGGER IF EXISTS trg_external_leads_before_insert_assign;
DROP TRIGGER IF EXISTS trg_external_leads_after_insert_assign;

DELIMITER $$

CREATE TRIGGER trg_external_leads_before_insert_assign
BEFORE INSERT ON external_leads
FOR EACH ROW
BEGIN
    DECLARE v_last_consultor_id BIGINT DEFAULT NULL;
    DECLARE v_next_consultor_id BIGINT DEFAULT NULL;

    IF NEW.assigned_to IS NULL
       AND COALESCE(TRIM(NEW.workflow_status), 'pendiente_completar') = 'pendiente_completar' THEN

        SELECT last_consultor_id
        INTO v_last_consultor_id
        FROM external_leads_assignment_state
        WHERE state_key = 'round_robin'
        LIMIT 1;

        SELECT u.IdUser
        INTO v_next_consultor_id
        FROM user u
        JOIN workgroup w ON w.Id = u.UserGroup
        WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
          AND TRIM(COALESCE(u.State, '')) = '1'
          AND (v_last_consultor_id IS NULL OR u.IdUser > v_last_consultor_id)
        ORDER BY u.IdUser ASC
        LIMIT 1;

        IF v_next_consultor_id IS NULL THEN
            SELECT u.IdUser
            INTO v_next_consultor_id
            FROM user u
            JOIN workgroup w ON w.Id = u.UserGroup
            WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
              AND TRIM(COALESCE(u.State, '')) = '1'
            ORDER BY u.IdUser ASC
            LIMIT 1;
        END IF;

        IF v_next_consultor_id IS NULL THEN
            SELECT u.IdUser
            INTO v_next_consultor_id
            FROM user u
            JOIN workgroup w ON w.Id = u.UserGroup
            WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
            ORDER BY u.IdUser ASC
            LIMIT 1;
        END IF;

        IF v_next_consultor_id IS NOT NULL THEN
            SET NEW.assigned_to = CAST(v_next_consultor_id AS CHAR);
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_external_leads_after_insert_assign
AFTER INSERT ON external_leads
FOR EACH ROW
BEGIN
    IF NEW.assigned_to IS NOT NULL AND TRIM(NEW.assigned_to) <> '' THEN
        INSERT INTO external_leads_assignment_state (state_key, last_consultor_id)
        VALUES ('round_robin', CAST(NEW.assigned_to AS UNSIGNED))
        ON DUPLICATE KEY UPDATE
            last_consultor_id = VALUES(last_consultor_id),
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END$$

DELIMITER ;
