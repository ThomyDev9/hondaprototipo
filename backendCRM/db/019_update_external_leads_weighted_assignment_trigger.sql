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

        SELECT cfg.user_id
        INTO v_next_consultor_id
        FROM consultor_assignment_config cfg
        JOIN user u ON u.IdUser = cfg.user_id
        JOIN workgroup w ON w.Id = u.UserGroup
        LEFT JOIN (
            SELECT assigned_to, COUNT(*) AS total
            FROM external_leads
            WHERE assigned_to IS NOT NULL
              AND workflow_status = 'pendiente_completar'
            GROUP BY assigned_to
        ) loads ON loads.assigned_to = CAST(cfg.user_id AS CHAR)
        WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
          AND cfg.is_active = 1
          AND cfg.assignment_percentage > 0
          AND TRIM(COALESCE(u.State, '')) = '1'
        ORDER BY
            COALESCE(loads.total, 0) / NULLIF(cfg.assignment_percentage, 0) ASC,
            cfg.user_id ASC
        LIMIT 1;

        IF v_next_consultor_id IS NULL THEN
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
        END IF;

        IF v_next_consultor_id IS NOT NULL THEN
            SET NEW.assigned_to = CAST(v_next_consultor_id AS CHAR);
            SET NEW.assigned_at = COALESCE(NEW.assigned_at, CURRENT_TIMESTAMP);
        END IF;
    ELSEIF NEW.assigned_to IS NOT NULL
       AND TRIM(NEW.assigned_to) <> ''
       AND NEW.assigned_at IS NULL THEN
        SET NEW.assigned_at = CURRENT_TIMESTAMP;
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
