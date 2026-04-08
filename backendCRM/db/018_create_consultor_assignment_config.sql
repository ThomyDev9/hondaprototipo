CREATE TABLE IF NOT EXISTS consultor_assignment_config (
    user_id BIGINT NOT NULL,
    assignment_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT chk_consultor_assignment_percentage
        CHECK (assignment_percentage >= 0 AND assignment_percentage <= 100)
);

INSERT INTO consultor_assignment_config (user_id, assignment_percentage, is_active)
SELECT u.IdUser, 0, 0
FROM user u
JOIN workgroup w ON w.Id = u.UserGroup
WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
  AND NOT EXISTS (
      SELECT 1
      FROM consultor_assignment_config cfg
      WHERE cfg.user_id = u.IdUser
  );
