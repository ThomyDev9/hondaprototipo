INSERT INTO workgroup (Id, Description)
SELECT 6, 'CONSULTOR_ADMIN'
WHERE NOT EXISTS (
    SELECT 1
    FROM workgroup
    WHERE Id = 6
       OR UPPER(TRIM(Description)) = 'CONSULTOR_ADMIN'
);
