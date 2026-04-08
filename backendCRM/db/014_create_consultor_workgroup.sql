INSERT INTO workgroup (Id, Description)
SELECT 5, 'CONSULTOR'
WHERE NOT EXISTS (
    SELECT 1
    FROM workgroup
    WHERE Id = 5
       OR UPPER(TRIM(Description)) = 'CONSULTOR'
);
