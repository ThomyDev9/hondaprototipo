WITH new_user AS (
  INSERT INTO auth.users (id, email, encrypted_password)
  VALUES (uuid_generate_v4(), 'admin@citas.com', 'admin')
  RETURNING id, email
)
INSERT INTO user_profiles (id, full_name, email, is_active, bloqueado)
SELECT id, 'Administrador', email, true, false
FROM new_user;
SELECT id, email, password FROM user_profiles WHERE email='admin@citas.com';
select * from user_profiles up 


update  user_profiles set password = 'admin' where email='admin@citas.com';


INSERT INTO public.roles (code, name, description)
VALUES
  ('ADMIN', 'Administrador', 'Acceso completo al sistema'),
  ('SUPERVISOR', 'Supervisor', 'Acceso a reportes y gestión de agentes'),
  ('AGENTE', 'Agente', 'Acceso a gestión de citas');


-- Busca el id del rol ADMIN
SELECT id FROM public.roles WHERE code = 'ADMIN';

-- Supongamos que devuelve: 123e4567-e89b-12d3-a456-426614174000
-- Busca el id del usuario admin
SELECT id FROM auth.users WHERE email = 'admin@citas.com';

-- Supongamos que devuelve: 21b62b6b-cddd-456b-abb7-36626c8957ac
-- Inserta la relación
INSERT INTO public.user_roles (user_id, role_id)
VALUES ('a9c94dbf-be88-470c-8e08-ade27aca6115', '60de8c03-78f9-43f7-a5ff-7ef82ffe60ca');

SELECT u.id, u.full_name, u.email, u.is_active, u.bloqueado,
               u.estado_operativo, u.created_at,
               json_agg(json_build_object('role_id', ur.role_id, 'code', r.code, 'name', r.name)) AS user_roles
        FROM user_profiles u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        GROUP BY u.id
        ORDER BY u.created_at desc
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   



CREATE OR REPLACE VIEW vw_admin_resumen_agentes AS
SELECT 
    u.id AS agente_id,
    p.full_name,
    u.email,
    r.code AS rol,
    p.estado_operativo,
    p.bloqueado,

    -- registros gestionados hoy
    COALESCE(brh.registros_gestionados_hoy, 0) AS registros_gestionados_hoy,

    -- citas agendadas hoy
    COALESCE(brh.citas_agendadas_hoy, 0) AS citas_agendadas_hoy,

    -- minutos de pausa hoy
    COALESCE(aelh.minutos_pausa_hoy, 0) AS minutos_pausa_hoy,

    -- exceso de pausa
    CASE 
        WHEN COALESCE(aelh.minutos_pausa_hoy, 0) > (
            SELECT valor_num 
            FROM admin_parametros 
            WHERE codigo = 'PAUSA_MAX_MIN_DIA'
        )
        THEN true ELSE false
    END AS exceso_pausa

FROM auth.users u
JOIN user_profiles p ON p.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id

-- subconsulta de registros
LEFT JOIN (
    SELECT 
        agente_id,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) AS registros_gestionados_hoy,
        COUNT(*) FILTER (
            WHERE created_at::date = CURRENT_DATE
              AND estado = 'ub_exito_agendo_cita'
        ) AS citas_agendadas_hoy
    FROM base_registros
    GROUP BY agente_id
) brh ON brh.agente_id = u.id

-- subconsulta de pausas
LEFT JOIN (
    SELECT 
        agente_id,
        SUM(5) FILTER (
            WHERE created_at::date = CURRENT_DATE
              AND estado IN ('baño','consulta','lunch','reunion')
        ) AS minutos_pausa_hoy
    FROM agente_estados_log
    GROUP BY agente_id
) aelh ON aelh.agente_id = u.id

WHERE r.code = 'AGENTE'
ORDER BY p.full_name ASC;



drop view vw_admin_resumen_agentes 

CREATE OR REPLACE VIEW vw_admin_resumen_bases AS
SELECT 
    b.id AS base_id,
    b.name AS base,
    COUNT(r.id) AS registros,
    COUNT(*) FILTER (WHERE r.estado = 'pendiente') AS sin_gestionar,
    COUNT(*) FILTER (WHERE r.estado = 'cita') AS citas,
    COUNT(*) FILTER (WHERE r.estado = 'no desea') AS no_desea,
    COUNT(*) FILTER (WHERE r.estado = 'rellamada') AS rellamadas,
    COUNT(*) FILTER (WHERE r.estado = 'regestionable') AS re_gestionables,
    COUNT(*) FILTER (WHERE r.estado = 'inubicable') AS inubicables,
    ROUND(
      (COUNT(*)::numeric - COUNT(*) FILTER (WHERE r.estado = 'pendiente')) 
      / NULLIF(COUNT(*)::numeric,0) * 100, 2
    ) AS avance
FROM bases b
LEFT JOIN base_registros r ON r.base_id = b.id
GROUP BY b.id, b.name
ORDER BY b.name ASC;

CREATE OR REPLACE FUNCTION fn_bases_resumen()
RETURNS TABLE (
    base_id uuid,
    base text,
    description text,
    registros bigint,
    sin_gestionar bigint,
    citas bigint,
    no_desea bigint,
    rellamadas bigint,
    re_gestionables bigint,
    inubicables bigint,
    avance numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id AS base_id,
        b.name AS base,
        b.description,
        COUNT(r.id) AS registros,
        COUNT(r.id) FILTER (WHERE r.estado = 'en_gestion') AS sin_gestionar,
        COUNT(r.id) FILTER (WHERE r.estado = 'ub_exito_agendo_cita') AS citas,
        COUNT(r.id) FILTER (WHERE r.estado = 'no_desea') AS no_desea,
        COUNT(r.id) FILTER (WHERE r.estado = 'rellamada') AS rellamadas,
        COUNT(r.id) FILTER (WHERE r.estado = '') AS re_gestionables,
        COUNT(r.id) FILTER (WHERE r.estado = 'numero_incorrecto') AS inubicables,
        ROUND(
          (COUNT(r.id)::numeric - COUNT(r.id) FILTER (WHERE r.estado = 'en_gestion')::numeric)
          / NULLIF(COUNT(r.id)::numeric,0) * 100, 2
        ) AS avance
    FROM bases b
    LEFT JOIN base_registros r ON r.base_id = b.id
    GROUP BY b.id, b.name, b.description;
END;regestionable
$$ LANGUAGE plpgsql;

select * from agente_estados_log 
select * from agente_gestiones_log 
select * from gestiones
select * from citas
select * from base_registros
select * from bases
delete from agente_estados_log 
delete from agente_gestiones_log
delete from gestiones
delete from citas
delete from base_registros
delete from bases
select * from cita_recordatorios

select * from vw_admin_resumen_agentes
select * from admin_parametros
select * from users