--
-- PostgreSQL database dump
--

-- Dumped from database version 15.7 (Debian 15.7-1.pgdg120+1)
-- Dumped by pg_dump version 17.0

-- Started on 2026-02-04 11:44:29

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3778 (class 1262 OID 448508)
-- Name: honda; Type: DATABASE; Schema: -; Owner: -
--

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 7 (class 2615 OID 448624)
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;
SET search_path = public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


--
-- TOC entry 3779 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 282 (class 1255 OID 458689)
-- Name: fn_bases_resumen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bases_resumen() RETURNS TABLE(base_id uuid, base text, description text, registros bigint, sin_gestionar bigint, citas bigint, no_desea bigint, rellamadas bigint, re_gestionables bigint, inubicables bigint, avance numeric)
    LANGUAGE plpgsql
    AS $$
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
        COUNT(r.id) FILTER (WHERE r.estado = 'regestionable') AS re_gestionables,
        COUNT(r.id) FILTER (WHERE r.estado = 'numero_incorrecto') AS inubicables,
        ROUND(
          (COUNT(r.id)::numeric - COUNT(r.id) FILTER (WHERE r.estado = 'en_gestion')::numeric)
          / NULLIF(COUNT(r.id)::numeric,0) * 100, 2
        ) AS avance
    FROM bases b
    LEFT JOIN base_registros r ON r.base_id = b.id
    GROUP BY b.id, b.name, b.description;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 448625)
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid NOT NULL,
    email text NOT NULL,
    encrypted_password text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 216 (class 1259 OID 448550)
-- Name: admin_parametros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_parametros (
    codigo text NOT NULL,
    descripcion text,
    valor_num numeric,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 225 (class 1259 OID 448739)
-- Name: agent_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_status (
    user_id uuid NOT NULL,
    status text DEFAULT 'offline'::text NOT NULL,
    last_heartbeat timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 448755)
-- Name: agente_estados_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agente_estados_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agente_id uuid NOT NULL,
    estado text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 448844)
-- Name: agente_gestiones_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agente_gestiones_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agente_id uuid NOT NULL,
    base_registro_id uuid NOT NULL,
    estado_final text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 448970)
-- Name: base_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.base_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pendiente'::text NOT NULL,
    current_attempt integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    last_result text,
    last_agent_id uuid,
    last_contact_at timestamp with time zone,
    assigned_agent_id uuid,
    assigned_at timestamp with time zone,
    scheduled_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 448821)
-- Name: base_registros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.base_registros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_id uuid NOT NULL,
    nombre_completo text,
    placa text,
    telefono1 text,
    telefono2 text,
    modelo text,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_agent_id uuid,
    assigned_at timestamp with time zone,
    intentos_totales integer DEFAULT 0 NOT NULL,
    ultimo_resultado text,
    ultimo_agente_id uuid,
    pool text DEFAULT 'activo'::text NOT NULL,
    proxima_llamada_at timestamp with time zone,
    etiqueta_origen text,
    ciudad text,
    ramv text,
    anio integer,
    documento text,
    direccion text,
    email text,
    estado_actual text,
    agente_asignado uuid,
    asignado_en timestamp with time zone,
    agente_id uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 227 (class 1259 OID 448801)
-- Name: bases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    source text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    total_records integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'activa'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cliente text,
    tipo_campania text,
    origen text DEFAULT 'excel'::text,
    provincia_objetivo text,
    ciudad_objetivo text,
    fecha_inicio_campania date,
    fecha_fin_campania date,
    prioridad_base text DEFAULT 'media'::text,
    max_intentos_base integer,
    dias_reciclaje_base integer,
    kpi_objetivo_contacto numeric,
    kpi_objetivo_citas numeric,
    kpi_objetivo_asistencia numeric,
    campaign_code text,
    campaign_name text,
    campaign_year integer
);


--
-- TOC entry 233 (class 1259 OID 449009)
-- Name: call_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_record_id uuid NOT NULL,
    agent_id uuid,
    result text NOT NULL,
    notes text,
    contacted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 234 (class 1259 OID 449029)
-- Name: catalogo_estados_gestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_estados_gestion (
    code text NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    es_contacto_efectivo boolean DEFAULT false
);


--
-- TOC entry 236 (class 1259 OID 449038)
-- Name: chatbot_interesados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_interesados (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nombre text,
    celular text,
    email text,
    negocio text,
    comentario text
);


--
-- TOC entry 235 (class 1259 OID 449037)
-- Name: chatbot_interesados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chatbot_interesados ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.chatbot_interesados_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 237 (class 1259 OID 449046)
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    cliente_id text NOT NULL,
    canal text NOT NULL,
    modo_humano boolean DEFAULT false,
    origen text DEFAULT 'directo'::text,
    fecha_ultima_interaccion timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chats_canal_check CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'messenger'::text, 'instagram'::text]))),
    CONSTRAINT chats_origen_check CHECK ((origen = ANY (ARRAY['bot'::text, 'directo'::text])))
);


--
-- TOC entry 239 (class 1259 OID 449100)
-- Name: cita_recordatorios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cita_recordatorios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cita_id uuid NOT NULL,
    tipo text NOT NULL,
    canal_sms boolean DEFAULT true,
    canal_email boolean DEFAULT true,
    scheduled_at timestamp with time zone NOT NULL,
    enviado boolean DEFAULT false,
    enviado_at timestamp with time zone
);


--
-- TOC entry 238 (class 1259 OID 449072)
-- Name: citas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_registro_id uuid NOT NULL,
    base_id uuid NOT NULL,
    agente_id uuid,
    fecha_cita timestamp with time zone NOT NULL,
    agencia_cita text,
    estado_cita text DEFAULT 'programada'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notificacion_sms_enviada boolean DEFAULT false,
    notificacion_email_enviada boolean DEFAULT false,
    nombre_cliente text,
    placa text,
    comentarios text
);


--
-- TOC entry 240 (class 1259 OID 449116)
-- Name: config_global; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_global (
    id integer DEFAULT 1 NOT NULL,
    max_intentos_generales integer DEFAULT 6 NOT NULL,
    min_minutos_entre_intentos integer DEFAULT 60 NOT NULL,
    horario_inicio_llamadas time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    horario_fin_llamadas time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    dias_habiles text[] DEFAULT ARRAY['L'::text, 'M'::text, 'X'::text, 'J'::text, 'V'::text] NOT NULL,
    dias_para_reciclaje integer DEFAULT 30 NOT NULL,
    dias_para_archivo_definitivo integer DEFAULT 180 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 242 (class 1259 OID 449133)
-- Name: contactos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nombre text,
    email text,
    mensaje text
);


--
-- TOC entry 241 (class 1259 OID 449132)
-- Name: contactos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.contactos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contactos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 230 (class 1259 OID 448911)
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    document_number text,
    email text,
    phone_main text,
    phone_alt text,
    city text,
    address text,
    preferred_channel text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 217 (class 1259 OID 448592)
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    numero_whatsapp text,
    phone_number_id text,
    waba_id text,
    access_token text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 243 (class 1259 OID 449145)
-- Name: evaluaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 244 (class 1259 OID 449146)
-- Name: evaluaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluaciones (
    id bigint DEFAULT nextval('public.evaluaciones_id_seq'::regclass) NOT NULL,
    nombre text,
    apellido text,
    email text,
    celular text,
    ciudad text,
    marca text,
    modelo text,
    anio text,
    placa_letra text,
    placa_numero text,
    matriculacion text,
    duenios text,
    pintura text,
    faros text,
    tapiceria text,
    vidrios text,
    sensores text,
    encendido text,
    asientos text,
    airbags text,
    confort_extras text,
    kilometraje text,
    garantia boolean,
    tipo_motor text,
    mantenimiento text,
    parabrisas_delantero text,
    parabrisas_posterior text,
    ventanas text,
    carroceria text,
    persiana text,
    llantas text,
    llanta_emergencia text,
    piso text,
    techo text,
    esfera_controles text,
    chapas text,
    cinturones text,
    sensorescinturon boolean,
    techocorredizo boolean,
    sensores_estacionamiento boolean,
    sensores_retro boolean,
    camara_retro boolean,
    aparcamiento_autonomo boolean,
    retrovisoreselectricos boolean,
    camara_frontal boolean,
    sensorproximidad boolean,
    sensorimpacto boolean,
    aire_asientos boolean,
    aireacondicionado boolean,
    vidrios_electricos boolean,
    vidriosconduct boolean,
    asiento_conductor text,
    asientos_pasajeros text,
    created_at timestamp with time zone DEFAULT now(),
    sistemavisual text,
    vidriostodos text,
    anio_matriculacion text,
    direccionales_frontales text,
    direccionales_posteriores text,
    luces_guias text,
    porcentaje text,
    puntaje text,
    valorfinal text,
    nota text,
    preciobase numeric,
    tipo text
);


--
-- TOC entry 245 (class 1259 OID 449155)
-- Name: gestiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gestiones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_registro_id uuid NOT NULL,
    base_id uuid NOT NULL,
    agente_id uuid NOT NULL,
    intento_n integer NOT NULL,
    resultado text,
    comentario text,
    canal text DEFAULT 'telefono'::text,
    duracion_segundos integer,
    proxima_llamada_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    estado_gestion text,
    sub_estatus text,
    telefono_contacto text
);


--
-- TOC entry 247 (class 1259 OID 449176)
-- Name: marcas_modelos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marcas_modelos (
    id bigint NOT NULL,
    marca text NOT NULL,
    modelo text NOT NULL,
    tipo_vehiculo text NOT NULL
);


--
-- TOC entry 246 (class 1259 OID 449175)
-- Name: marcas_modelos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.marcas_modelos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.marcas_modelos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 248 (class 1259 OID 449183)
-- Name: mensajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensajes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    mensaje text NOT NULL,
    tipo text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT mensajes_tipo_check CHECK ((tipo = ANY (ARRAY['cliente'::text, 'agente'::text, 'bot'::text])))
);


--
-- TOC entry 249 (class 1259 OID 449198)
-- Name: miniads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.miniads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    side text NOT NULL,
    slot smallint NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    img_url text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id text DEFAULT 'default'::text NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT miniads_side_check CHECK ((side = ANY (ARRAY['left'::text, 'right'::text]))),
    CONSTRAINT miniads_slot_check CHECK ((slot = ANY (ARRAY[1, 2])))
);


--
-- TOC entry 251 (class 1259 OID 449212)
-- Name: miniads_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.miniads_clicks (
    id bigint NOT NULL,
    site_id text NOT NULL,
    side text NOT NULL,
    slot smallint NOT NULL,
    ad_name text,
    target_url text NOT NULL,
    page_path text,
    referrer text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT miniads_clicks_side_check CHECK ((side = ANY (ARRAY['left'::text, 'right'::text]))),
    CONSTRAINT miniads_clicks_slot_check CHECK ((slot = ANY (ARRAY[1, 2])))
);


--
-- TOC entry 250 (class 1259 OID 449211)
-- Name: miniads_clicks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.miniads_clicks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.miniads_clicks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 252 (class 1259 OID 449222)
-- Name: plantillas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid,
    nombre text NOT NULL,
    contenido jsonb NOT NULL,
    estado text DEFAULT 'aprobada'::text,
    canal text DEFAULT 'whatsapp'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT plantillas_canal_check CHECK ((canal = 'whatsapp'::text))
);


--
-- TOC entry 253 (class 1259 OID 449242)
-- Name: referencias_faltantes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referencias_faltantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 254 (class 1259 OID 449243)
-- Name: referencias_faltantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referencias_faltantes (
    id integer DEFAULT nextval('public.referencias_faltantes_id_seq'::regclass) NOT NULL,
    marca text,
    modelo text,
    anio integer,
    fecha timestamp without time zone DEFAULT now()
);


--
-- TOC entry 221 (class 1259 OID 448663)
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 255 (class 1259 OID 449252)
-- Name: solicitudes_ofertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_ofertas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text,
    email text,
    whatsapp text,
    tipo text,
    marca text,
    ciudad text,
    aniomin integer,
    aniomax integer,
    preciomin numeric,
    preciomax numeric,
    combustible text,
    created_at timestamp with time zone DEFAULT now(),
    modelo text
);


--
-- TOC entry 219 (class 1259 OID 448633)
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name text NOT NULL,
    document_number text,
    email text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    estado_operativo text DEFAULT 'disponible'::text NOT NULL,
    registro_actual uuid,
    password text
);


--
-- TOC entry 220 (class 1259 OID 448650)
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    user_id uuid NOT NULL,
    role_code text NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 448674)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 448707)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'user'::text,
    empresa_id uuid
);


--
-- TOC entry 224 (class 1259 OID 448723)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid,
    email text NOT NULL,
    rol text DEFAULT 'viewer'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT usuarios_rol_check CHECK ((rol = ANY (ARRAY['admin'::text, 'agente'::text, 'tecnico'::text, 'viewer'::text])))
);


--
-- TOC entry 231 (class 1259 OID 448955)
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    plate text NOT NULL,
    brand text,
    model text,
    year integer,
    ramv_code text,
    meta_code text,
    vehicle_type text,
    fuel_type text,
    km_current integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 256 (class 1259 OID 449264)
-- Name: vehiculos_ref_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehiculos_ref_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 257 (class 1259 OID 449265)
-- Name: vehiculos_ref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehiculos_ref (
    id integer DEFAULT nextval('public.vehiculos_ref_id_seq'::regclass) NOT NULL,
    marca text NOT NULL,
    modelo text NOT NULL,
    anio numeric NOT NULL,
    tipo_vehiculo text NOT NULL,
    combustible text NOT NULL,
    precio1 numeric,
    precio2 numeric,
    precio3 numeric,
    kilometraje text
);


--
-- TOC entry 258 (class 1259 OID 449273)
-- Name: vendedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text,
    email text,
    codigo_ref text
);


--
-- TOC entry 260 (class 1259 OID 468037)
-- Name: vw_admin_resumen_agentes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_admin_resumen_agentes AS
 SELECT u.id AS agente_id,
    p.full_name,
    u.email,
    r.code AS rol,
    p.estado_operativo,
    p.bloqueado,
    COALESCE(brh.registros_gestionados_hoy, (0)::bigint) AS registros_gestionados_hoy,
    COALESCE(brh.citas_agendadas_hoy, (0)::bigint) AS citas_agendadas_hoy,
    COALESCE(aelh.minutos_pausa_hoy, (0)::bigint) AS minutos_pausa_hoy,
        CASE
            WHEN ((COALESCE(aelh.minutos_pausa_hoy, (0)::bigint))::numeric > ( SELECT admin_parametros.valor_num
               FROM public.admin_parametros
              WHERE (admin_parametros.codigo = 'PAUSA_MAX_MIN_DIA'::text))) THEN true
            ELSE false
        END AS exceso_pausa
   FROM (((((auth.users u
     JOIN public.user_profiles p ON ((p.id = u.id)))
     JOIN public.user_roles ur ON ((ur.user_id = u.id)))
     JOIN public.roles r ON ((r.id = ur.role_id)))
     LEFT JOIN ( SELECT base_registros.agente_id,
            count(*) FILTER (WHERE ((base_registros.created_at)::date = CURRENT_DATE)) AS registros_gestionados_hoy,
            count(*) FILTER (WHERE (((base_registros.created_at)::date = CURRENT_DATE) AND (base_registros.estado = 'ub_exito_agendo_cita'::text))) AS citas_agendadas_hoy
           FROM public.base_registros
          GROUP BY base_registros.agente_id) brh ON ((brh.agente_id = u.id)))
     LEFT JOIN ( SELECT agente_estados_log.agente_id,
            sum(5) FILTER (WHERE (((agente_estados_log.created_at)::date = CURRENT_DATE) AND (agente_estados_log.estado = ANY (ARRAY['baño'::text, 'consulta'::text, 'lunch'::text, 'reunion'::text])))) AS minutos_pausa_hoy
           FROM public.agente_estados_log
          GROUP BY agente_estados_log.agente_id) aelh ON ((aelh.agente_id = u.id)))
  WHERE (r.code = 'AGENTE'::text)
  ORDER BY p.full_name;


--
-- TOC entry 259 (class 1259 OID 458684)
-- Name: vw_admin_resumen_bases; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_admin_resumen_bases AS
 SELECT b.id AS base_id,
    b.name AS base,
    count(r.id) AS registros,
    count(*) FILTER (WHERE (r.estado = 'en_gestion'::text)) AS sin_gestionar,
    count(*) FILTER (WHERE (r.estado = 'ub_exito_agendo_cita'::text)) AS citas,
    count(*) FILTER (WHERE (r.estado = 'no_desea'::text)) AS no_desea,
    count(*) FILTER (WHERE (r.estado = 'rellamada'::text)) AS rellamadas,
    count(*) FILTER (WHERE (r.estado = 'regestionable'::text)) AS re_gestionables,
    count(*) FILTER (WHERE (r.estado = ANY (ARRAY['numero_incorrecto'::text, 'inubicable'::text]))) AS inubicables,
    round(((((count(*))::numeric - (count(*) FILTER (WHERE (r.estado = 'en_gestion'::text)))::numeric) / NULLIF((count(*))::numeric, (0)::numeric)) * (100)::numeric), 2) AS avance
   FROM (public.bases b
     LEFT JOIN public.base_registros r ON ((r.base_id = b.id)))
  GROUP BY b.id, b.name
  ORDER BY b.name;


--
-- TOC entry 3732 (class 0 OID 448625)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

INSERT INTO auth.users VALUES ('a9c94dbf-be88-470c-8e08-ade27aca6115', 'admin@citas.com', 'admin', '2026-01-23 20:49:09.690033+00');
INSERT INTO auth.users VALUES ('36889714-cb15-4d65-873d-d6bfda3e2377', 'prueba1@hotmail.com', '$2b$10$dEf0wf10dMiy/6PujALrD.nAaMBzvXWdiuWijEaOjyIWiz7t./Io2', '2026-01-26 17:52:19.330585+00');
INSERT INTO auth.users VALUES ('463753a9-4e8f-4959-a131-cd34c250782a', 'prueba2@hotmail.com', '$2b$10$cNbT4/FELbIfeVA/MTo2WO.u5enMKGrsFk2tR6/uGo0o3WqnH51lK', '2026-01-26 17:53:58.088232+00');
INSERT INTO auth.users VALUES ('b77a546e-0dc3-4c19-a459-edcf01aa1caa', 'supervisor1@hotmail.com', '$2b$10$wDNRswo.GCwNfHqV/OZf0eFpNMfMNQcTmrEOqREgm9dViD0xMoOpq', '2026-02-02 20:12:28.167408+00');


--
-- TOC entry 3730 (class 0 OID 448550)
-- Dependencies: 216
-- Data for Name: admin_parametros; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.admin_parametros VALUES ('PAUSA_MAX_MIN_DIA', 'Minutos máximos de pausa (baño / consulta / lunch / reunión) permitidos por día', 30, '2026-01-29 15:44:21.545491+00');


--
-- TOC entry 3739 (class 0 OID 448739)
-- Dependencies: 225
-- Data for Name: agent_status; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3740 (class 0 OID 448755)
-- Dependencies: 226
-- Data for Name: agente_estados_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.agente_estados_log VALUES ('f0ee7ea7-91d5-40d7-9709-ab0af9b2d913', '36889714-cb15-4d65-873d-d6bfda3e2377', 'baño', '2026-01-29 14:57:06.697+00');
INSERT INTO public.agente_estados_log VALUES ('e39002a4-4408-4fba-bd65-f584acfb774d', '36889714-cb15-4d65-873d-d6bfda3e2377', 'consulta', '2026-01-29 14:57:07.295+00');
INSERT INTO public.agente_estados_log VALUES ('a4c8ddc6-cd18-4f5b-9ec6-d039cd4c1a57', '36889714-cb15-4d65-873d-d6bfda3e2377', 'lunch', '2026-01-29 14:57:07.728+00');
INSERT INTO public.agente_estados_log VALUES ('96862be4-b84c-4eea-861b-138b1ee960d9', '36889714-cb15-4d65-873d-d6bfda3e2377', 'reunion', '2026-01-29 14:57:08.054+00');
INSERT INTO public.agente_estados_log VALUES ('98200c71-6711-411e-9f66-1b8085e5773d', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-01-29 14:57:09.315+00');
INSERT INTO public.agente_estados_log VALUES ('1466db88-1257-4ce4-94ff-422e488260ff', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:16:24.42+00');
INSERT INTO public.agente_estados_log VALUES ('df7a8495-f6cc-4646-870a-ce096d14d1a9', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'baño', '2026-01-29 15:16:30.228+00');
INSERT INTO public.agente_estados_log VALUES ('f6c15021-2151-4019-9b3f-6249fddc7302', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'consulta', '2026-01-29 15:16:45.338+00');
INSERT INTO public.agente_estados_log VALUES ('ca840f3c-ba24-412b-a989-bd4236d11a31', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'lunch', '2026-01-29 15:16:49.92+00');
INSERT INTO public.agente_estados_log VALUES ('d33c04c3-6ef4-4722-8872-7d8e187eef46', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'reunion', '2026-01-29 15:16:50.902+00');
INSERT INTO public.agente_estados_log VALUES ('7fb4a94f-c886-4974-a0c5-3038ba32cacd', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-01-29 15:17:00.764+00');
INSERT INTO public.agente_estados_log VALUES ('a2863c3c-4e86-4060-96fa-6095b58a0422', '36889714-cb15-4d65-873d-d6bfda3e2377', 'baño', '2026-01-29 15:17:02.747+00');
INSERT INTO public.agente_estados_log VALUES ('b17481fc-9261-4d6a-a967-e86761be63e5', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-01-29 15:18:20.21+00');
INSERT INTO public.agente_estados_log VALUES ('295ef1f4-d5de-41f3-a6be-284bb5a30e12', '36889714-cb15-4d65-873d-d6bfda3e2377', 'reunion', '2026-01-29 15:18:51.897+00');
INSERT INTO public.agente_estados_log VALUES ('1f474e28-b91c-4676-9166-d0c447a16b5d', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-01-29 15:19:14.332+00');
INSERT INTO public.agente_estados_log VALUES ('a7914687-c6c2-45d7-882e-65539bef245e', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'baño', '2026-01-29 15:25:09.869+00');
INSERT INTO public.agente_estados_log VALUES ('f14d4018-b5ec-48cf-a551-22d4bf6e9513', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:27:43.202+00');
INSERT INTO public.agente_estados_log VALUES ('4130e684-6e75-4066-9769-ec7aa9f88e56', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'baño', '2026-01-29 15:28:29.346+00');
INSERT INTO public.agente_estados_log VALUES ('77afb8bb-278b-41bd-81f4-676613c005a5', '36889714-cb15-4d65-873d-d6bfda3e2377', 'baño', '2026-01-29 15:28:59.34+00');
INSERT INTO public.agente_estados_log VALUES ('c9e5b93f-57dd-4df8-93c6-18511d7bec14', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:56:31.271+00');
INSERT INTO public.agente_estados_log VALUES ('b2cc8670-a471-400d-a6e9-6c199dbfe37b', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:56:35.798+00');
INSERT INTO public.agente_estados_log VALUES ('2c5d9707-dafc-4aa0-bc74-cee21149b6dd', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:56:36.475+00');
INSERT INTO public.agente_estados_log VALUES ('154e8fe4-38d8-4f54-9a8d-b308f4b246e7', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:56:36.638+00');
INSERT INTO public.agente_estados_log VALUES ('96a60f52-6177-4f8f-ab3a-2f3ba0b7ff4d', 'a9c94dbf-be88-470c-8e08-ade27aca6115', 'disponible', '2026-01-29 15:56:36.808+00');
INSERT INTO public.agente_estados_log VALUES ('e2b29432-6b37-4a54-a1b2-6c7b8f36368c', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-02-03 21:05:03.822+00');
INSERT INTO public.agente_estados_log VALUES ('7079070e-08d5-47cf-87ec-5c869e6bd492', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-02-03 21:05:04.736+00');
INSERT INTO public.agente_estados_log VALUES ('4120e48a-65e9-48d2-b53c-a013c6e4827d', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-02-03 21:05:04.802+00');
INSERT INTO public.agente_estados_log VALUES ('0da32620-3b2d-47d1-8ec2-0c650cc27f8b', '36889714-cb15-4d65-873d-d6bfda3e2377', 'disponible', '2026-02-03 21:05:04.965+00');


--
-- TOC entry 3743 (class 0 OID 448844)
-- Dependencies: 229
-- Data for Name: agente_gestiones_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.agente_gestiones_log VALUES ('69ee8492-68e2-410e-9d1b-d3005b51face', '36889714-cb15-4d65-873d-d6bfda3e2377', '0342d639-846d-4fe0-a3dc-153ca5acc7f9', 'ub_exito_agendo_cita', '2026-02-03 23:16:06.867+00');


--
-- TOC entry 3746 (class 0 OID 448970)
-- Dependencies: 232
-- Data for Name: base_records; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3742 (class 0 OID 448821)
-- Dependencies: 228
-- Data for Name: base_registros; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.base_registros VALUES ('83403904-6034-4a17-8375-e4aae060d816', 'ee808365-f89c-4f69-980f-e1c14b7efecc', 'HIDALGO SANTIN JUAN', 'ABL9313', '981401295', '', 'CIVIC', 'en_gestion', '{"6JP": 1, "ASD": "0981401295", "DSA": "", "AÑO": 2023, "RAMV": "E03037201", "Email": "hidalgo_7512@hotmail.com", "Placa": "ABL9313", "Ciudad": "AZUAY", "Modelo": "CIVIC", "Documento": 1709266884, "Dirección": "PARROQUIA SAN JOSE", "Teléfono 1": 981401295, "Teléfono 2": 0, "Etiquetas de fila": "MRHFE4640PP040012", "Nombres Completos": "HIDALGO SANTIN JUAN"}', '2026-02-03 19:45:10.7125+00', NULL, NULL, 1, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-03 21:00:43.314+00');
INSERT INTO public.base_registros VALUES ('31c9654c-2e7c-418c-9450-4d6b9cded303', 'ee808365-f89c-4f69-980f-e1c14b7efecc', 'RODRIGUEZ TAPIA FREDY FERNANDO', 'HBE2042', '983222506', '32963595', 'CIVIC', 'en_gestion', '{"6JP": 1, "ASD": "0983222506", "DSA": "032963595", "AÑO": 2023, "RAMV": "E03037199", "Email": "fredrodg@hotmail.com", "Placa": "HBE2042", "Ciudad": "CHIMBORAZO", "Modelo": "CIVIC", "Documento": 603222506, "Dirección": "CDLA LOS ALTARES MZ A VILLA 3", "Teléfono 1": 983222506, "Teléfono 2": 32963595, "Etiquetas de fila": "MRHFE4640PP040015", "Nombres Completos": "RODRIGUEZ TAPIA FREDY FERNANDO"}', '2026-02-03 19:45:10.7125+00', NULL, NULL, 1, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-03 21:00:43.349+00');
INSERT INTO public.base_registros VALUES ('c2a132a2-3df9-4a84-8cd6-bfd4c319f65b', 'ee808365-f89c-4f69-980f-e1c14b7efecc', 'SUAREZ RUIZ DANILO MAURICIO', 'GSW4645', '991823472', '', 'CIVIC', 'en_gestion', '{"6JP": 1, "ASD": "0991823472", "DSA": "", "AÑO": 2023, "RAMV": "E03037200", "Email": "danilo.suarez@live.com", "Placa": "GSW4645", "Ciudad": "GUAYAS", "Modelo": "CIVIC", "Documento": 916545957, "Dirección": "ALFREDO PAREJA DIEZCANSECO 1213", "Teléfono 1": 991823472, "Teléfono 2": 0, "Etiquetas de fila": "MRHFE4640PP040017", "Nombres Completos": "SUAREZ RUIZ DANILO MAURICIO"}', '2026-02-03 19:45:10.7125+00', NULL, NULL, 1, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-03 21:01:36.137+00');
INSERT INTO public.base_registros VALUES ('3a046fbf-6dc7-47bf-874d-114f291ba3a6', 'ee808365-f89c-4f69-980f-e1c14b7efecc', 'PEREZ PINEIDA  GRACE LORENA', 'PFE5120', '998225284', '22347214', 'CIVIC', 'en_gestion', '{"6JP": 1, "ASD": "0998225284", "DSA": "022347214", "AÑO": 2023, "RAMV": "U03037206", "Email": "gracelorenaperez@gmail.com", "Placa": "PFE5120", "Ciudad": "PICHINCHA", "Modelo": "CIVIC", "Documento": 1717133043, "Dirección": "CONOCOTO", "Teléfono 1": 998225284, "Teléfono 2": 22347214, "Etiquetas de fila": "MRHFE4640PP040018", "Nombres Completos": "PEREZ PINEIDA  GRACE LORENA"}', '2026-02-03 19:45:10.7125+00', NULL, NULL, 1, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-03 21:01:36.21+00');
INSERT INTO public.base_registros VALUES ('0baee437-32ed-46d4-9fa3-e4e72518b593', '0bcf2503-3fac-4f7e-92b3-661210c8a26b', 'SUAREZ RUIZ DANILO MAURICIO', 'GSW4645', '991823472', '', 'CIVIC', 'pendiente', '{"6JP": 1, "ASD": "0991823472", "DSA": "", "AÑO": 2023, "RAMV": "E03037200", "Email": "danilo.suarez@live.com", "Placa": "GSW4645", "Ciudad": "GUAYAS", "Modelo": "CIVIC", "Documento": 916545957, "Dirección": "ALFREDO PAREJA DIEZCANSECO 1213", "Teléfono 1": 991823472, "Teléfono 2": 0, "Etiquetas de fila": "MRHFE4640PP040017", "Nombres Completos": "SUAREZ RUIZ DANILO MAURICIO"}', '2026-02-03 23:09:12.104945+00', NULL, NULL, 0, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-03 23:09:12.104945+00');
INSERT INTO public.base_registros VALUES ('a7bc6f6d-8fc9-4aec-a907-41e1a7b0588f', '0bcf2503-3fac-4f7e-92b3-661210c8a26b', 'PEREZ PINEIDA  GRACE LORENA', 'PFE5120', '998225284', '22347214', 'CIVIC', 'pendiente', '{"6JP": 1, "ASD": "0998225284", "DSA": "022347214", "AÑO": 2023, "RAMV": "U03037206", "Email": "gracelorenaperez@gmail.com", "Placa": "PFE5120", "Ciudad": "PICHINCHA", "Modelo": "CIVIC", "Documento": 1717133043, "Dirección": "CONOCOTO", "Teléfono 1": 998225284, "Teléfono 2": 22347214, "Etiquetas de fila": "MRHFE4640PP040018", "Nombres Completos": "PEREZ PINEIDA  GRACE LORENA"}', '2026-02-03 23:09:12.104945+00', NULL, NULL, 0, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-03 23:09:12.104945+00');
INSERT INTO public.base_registros VALUES ('0342d639-846d-4fe0-a3dc-153ca5acc7f9', '0bcf2503-3fac-4f7e-92b3-661210c8a26b', 'HIDALGO SANTIN JUAN', 'ABL9313', '981401295', '', 'CIVIC', 'ub_exito_agendo_cita', '{"6JP": 1, "ASD": "0981401295", "DSA": "", "AÑO": 2023, "RAMV": "E03037201", "Email": "hidalgo_7512@hotmail.com", "Placa": "ABL9313", "Ciudad": "AZUAY", "Modelo": "CIVIC", "Documento": 1709266884, "Dirección": "PARROQUIA SAN JOSE", "Teléfono 1": 981401295, "Teléfono 2": 0, "Etiquetas de fila": "MRHFE4640PP040012", "Nombres Completos": "HIDALGO SANTIN JUAN"}', '2026-02-03 23:09:12.104945+00', NULL, NULL, 1, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-03 23:16:06.867+00');
INSERT INTO public.base_registros VALUES ('3b809fae-2681-4fc1-b61a-d1af071ebbe8', '0bcf2503-3fac-4f7e-92b3-661210c8a26b', 'RODRIGUEZ TAPIA FREDY FERNANDO', 'HBE2042', '983222506', '32963595', 'CIVIC', 'en_gestion', '{"6JP": 1, "ASD": "0983222506", "DSA": "032963595", "AÑO": 2023, "RAMV": "E03037199", "Email": "fredrodg@hotmail.com", "Placa": "HBE2042", "Ciudad": "CHIMBORAZO", "Modelo": "CIVIC", "Documento": 603222506, "Dirección": "CDLA LOS ALTARES MZ A VILLA 3", "Teléfono 1": 983222506, "Teléfono 2": 32963595, "Etiquetas de fila": "MRHFE4640PP040015", "Nombres Completos": "RODRIGUEZ TAPIA FREDY FERNANDO"}', '2026-02-03 23:09:12.104945+00', NULL, NULL, 1, NULL, NULL, 'activo', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-03 23:16:07.034+00');


--
-- TOC entry 3741 (class 0 OID 448801)
-- Dependencies: 227
-- Data for Name: bases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.bases VALUES ('ee808365-f89c-4f69-980f-e1c14b7efecc', 'nueva base', 'clientes honda 2026', NULL, NULL, '2026-02-03 19:45:10.573283+00', 4, 'pendiente', '2026-02-03 19:45:10.573283+00', NULL, NULL, 'excel', NULL, NULL, NULL, NULL, 'media', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.bases VALUES ('0bcf2503-3fac-4f7e-92b3-661210c8a26b', 'base prueba 2', '', NULL, NULL, '2026-02-03 23:09:12.068348+00', 4, 'pendiente', '2026-02-03 23:09:12.068348+00', NULL, NULL, 'excel', NULL, NULL, NULL, NULL, 'media', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- TOC entry 3747 (class 0 OID 449009)
-- Dependencies: 233
-- Data for Name: call_attempts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3748 (class 0 OID 449029)
-- Dependencies: 234
-- Data for Name: catalogo_estados_gestion; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3750 (class 0 OID 449038)
-- Dependencies: 236
-- Data for Name: chatbot_interesados; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3751 (class 0 OID 449046)
-- Dependencies: 237
-- Data for Name: chats; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3753 (class 0 OID 449100)
-- Dependencies: 239
-- Data for Name: cita_recordatorios; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3752 (class 0 OID 449072)
-- Dependencies: 238
-- Data for Name: citas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.citas VALUES ('e7f298ff-9cba-4492-9f5f-d40ede43a13d', '0342d639-846d-4fe0-a3dc-153ca5acc7f9', '0bcf2503-3fac-4f7e-92b3-661210c8a26b', '36889714-cb15-4d65-873d-d6bfda3e2377', '2026-02-10 13:14:00+00', 'nueva llamada otro dia', 'programada', '2026-02-03 23:16:07.833186+00', '2026-02-03 23:16:07.833186+00', false, false, 'HIDALGO SANTIN JUAN', 'ABL9313', NULL);


--
-- TOC entry 3754 (class 0 OID 449116)
-- Dependencies: 240
-- Data for Name: config_global; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3756 (class 0 OID 449133)
-- Dependencies: 242
-- Data for Name: contactos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3744 (class 0 OID 448911)
-- Dependencies: 230
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3731 (class 0 OID 448592)
-- Dependencies: 217
-- Data for Name: empresas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3758 (class 0 OID 449146)
-- Dependencies: 244
-- Data for Name: evaluaciones; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3759 (class 0 OID 449155)
-- Dependencies: 245
-- Data for Name: gestiones; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.gestiones VALUES ('ba402fec-abd8-47fb-a971-55a25ce7fe81', '0342d639-846d-4fe0-a3dc-153ca5acc7f9', '0bcf2503-3fac-4f7e-92b3-661210c8a26b', '36889714-cb15-4d65-873d-d6bfda3e2377', 1, NULL, NULL, 'telefono', NULL, NULL, '2026-02-03 23:16:07.841098+00', 'ub_exito_agendo_cita', NULL, '981401295');


--
-- TOC entry 3761 (class 0 OID 449176)
-- Dependencies: 247
-- Data for Name: marcas_modelos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3762 (class 0 OID 449183)
-- Dependencies: 248
-- Data for Name: mensajes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3763 (class 0 OID 449198)
-- Dependencies: 249
-- Data for Name: miniads; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3765 (class 0 OID 449212)
-- Dependencies: 251
-- Data for Name: miniads_clicks; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3766 (class 0 OID 449222)
-- Dependencies: 252
-- Data for Name: plantillas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3768 (class 0 OID 449243)
-- Dependencies: 254
-- Data for Name: referencias_faltantes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3735 (class 0 OID 448663)
-- Dependencies: 221
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES ('60de8c03-78f9-43f7-a5ff-7ef82ffe60ca', 'ADMIN', 'Administrador', 'Acceso completo al sistema', '2026-01-23 21:09:22.143337+00');
INSERT INTO public.roles VALUES ('335429ec-c7ae-4a6d-94d7-80bf44aa816f', 'SUPERVISOR', 'Supervisor', 'Acceso a reportes y gestión de agentes', '2026-01-23 21:09:22.143337+00');
INSERT INTO public.roles VALUES ('7cf1f56a-fe96-44de-8ac1-4c2e983aec3e', 'AGENTE', 'Agente', 'Acceso a gestión de citas', '2026-01-23 21:09:22.143337+00');


--
-- TOC entry 3769 (class 0 OID 449252)
-- Dependencies: 255
-- Data for Name: solicitudes_ofertas; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3733 (class 0 OID 448633)
-- Dependencies: 219
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_profiles VALUES ('463753a9-4e8f-4959-a131-cd34c250782a', 'prueba2', NULL, 'prueba2@hotmail.com', true, '2026-01-26 17:53:58.103934+00', '2026-01-26 17:53:58.103934+00', false, 'disponible', NULL, 'prueba2');
INSERT INTO public.user_profiles VALUES ('a9c94dbf-be88-470c-8e08-ade27aca6115', 'Administrador', NULL, 'admin@citas.com', true, '2026-01-23 20:49:09.690033+00', '2026-01-23 20:49:09.690033+00', false, 'disponible', NULL, '$2b$10$mUb8V3991qBuISpDYfGLie9X2Fx7pOJ.uoZfBn0KGRv1AnjZXVCxa');
INSERT INTO public.user_profiles VALUES ('b77a546e-0dc3-4c19-a459-edcf01aa1caa', 'supervisor1', NULL, 'supervisor1@hotmail.com', true, '2026-02-02 20:12:28.204735+00', '2026-02-02 20:12:28.204735+00', false, 'disponible', NULL, '$2b$10$TfKbeUdFT3.fqpmPiVehse/VFkr/6G2XwTlt1yqyxB3EUGBI50SmO');
INSERT INTO public.user_profiles VALUES ('36889714-cb15-4d65-873d-d6bfda3e2377', 'prueba1', NULL, 'prueba1@hotmail.com', true, '2026-01-26 17:52:19.337734+00', '2026-01-26 17:52:19.337734+00', false, 'disponible', NULL, '$2b$10$yvxX2FDf2nHG5qsBmJ4yD.uxYVIA1UrG.9Z25RCXYai4pWRxL5VYu');


--
-- TOC entry 3734 (class 0 OID 448650)
-- Dependencies: 220
-- Data for Name: user_role_assignments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3736 (class 0 OID 448674)
-- Dependencies: 222
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_roles VALUES ('a9c94dbf-be88-470c-8e08-ade27aca6115', '60de8c03-78f9-43f7-a5ff-7ef82ffe60ca', '2026-01-23 21:10:07.065142+00');
INSERT INTO public.user_roles VALUES ('36889714-cb15-4d65-873d-d6bfda3e2377', '7cf1f56a-fe96-44de-8ac1-4c2e983aec3e', '2026-01-26 17:52:19.34816+00');
INSERT INTO public.user_roles VALUES ('463753a9-4e8f-4959-a131-cd34c250782a', '7cf1f56a-fe96-44de-8ac1-4c2e983aec3e', '2026-01-26 17:53:58.118666+00');
INSERT INTO public.user_roles VALUES ('b77a546e-0dc3-4c19-a459-edcf01aa1caa', '335429ec-c7ae-4a6d-94d7-80bf44aa816f', '2026-02-02 20:12:28.255931+00');


--
-- TOC entry 3737 (class 0 OID 448707)
-- Dependencies: 223
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3738 (class 0 OID 448723)
-- Dependencies: 224
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3745 (class 0 OID 448955)
-- Dependencies: 231
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3771 (class 0 OID 449265)
-- Dependencies: 257
-- Data for Name: vehiculos_ref; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3772 (class 0 OID 449273)
-- Dependencies: 258
-- Data for Name: vendedores; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3780 (class 0 OID 0)
-- Dependencies: 235
-- Name: chatbot_interesados_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chatbot_interesados_id_seq', 1, false);


--
-- TOC entry 3781 (class 0 OID 0)
-- Dependencies: 241
-- Name: contactos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contactos_id_seq', 1, false);


--
-- TOC entry 3782 (class 0 OID 0)
-- Dependencies: 243
-- Name: evaluaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.evaluaciones_id_seq', 1, false);


--
-- TOC entry 3783 (class 0 OID 0)
-- Dependencies: 246
-- Name: marcas_modelos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.marcas_modelos_id_seq', 1, false);


--
-- TOC entry 3784 (class 0 OID 0)
-- Dependencies: 250
-- Name: miniads_clicks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.miniads_clicks_id_seq', 1, false);


--
-- TOC entry 3785 (class 0 OID 0)
-- Dependencies: 253
-- Name: referencias_faltantes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.referencias_faltantes_id_seq', 1, false);


--
-- TOC entry 3786 (class 0 OID 0)
-- Dependencies: 256
-- Name: vehiculos_ref_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehiculos_ref_id_seq', 1, false);


--
-- TOC entry 3485 (class 2606 OID 448632)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3481 (class 2606 OID 448557)
-- Name: admin_parametros admin_parametros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_parametros
    ADD CONSTRAINT admin_parametros_pkey PRIMARY KEY (codigo);


--
-- TOC entry 3503 (class 2606 OID 448749)
-- Name: agent_status agent_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_status
    ADD CONSTRAINT agent_status_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3505 (class 2606 OID 448763)
-- Name: agente_estados_log agente_estados_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_estados_log
    ADD CONSTRAINT agente_estados_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3511 (class 2606 OID 448852)
-- Name: agente_gestiones_log agente_gestiones_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_gestiones_log
    ADD CONSTRAINT agente_gestiones_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3517 (class 2606 OID 448983)
-- Name: base_records base_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_records
    ADD CONSTRAINT base_records_pkey PRIMARY KEY (id);


--
-- TOC entry 3509 (class 2606 OID 448833)
-- Name: base_registros base_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_registros
    ADD CONSTRAINT base_registros_pkey PRIMARY KEY (id);


--
-- TOC entry 3507 (class 2606 OID 448814)
-- Name: bases bases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bases
    ADD CONSTRAINT bases_pkey PRIMARY KEY (id);


--
-- TOC entry 3519 (class 2606 OID 449018)
-- Name: call_attempts call_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT call_attempts_pkey PRIMARY KEY (id);


--
-- TOC entry 3521 (class 2606 OID 449036)
-- Name: catalogo_estados_gestion catalogo_estados_gestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_estados_gestion
    ADD CONSTRAINT catalogo_estados_gestion_pkey PRIMARY KEY (code);


--
-- TOC entry 3523 (class 2606 OID 449045)
-- Name: chatbot_interesados chatbot_interesados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_interesados
    ADD CONSTRAINT chatbot_interesados_pkey PRIMARY KEY (id);


--
-- TOC entry 3525 (class 2606 OID 449060)
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- TOC entry 3529 (class 2606 OID 449110)
-- Name: cita_recordatorios cita_recordatorios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita_recordatorios
    ADD CONSTRAINT cita_recordatorios_pkey PRIMARY KEY (id);


--
-- TOC entry 3527 (class 2606 OID 449084)
-- Name: citas citas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_pkey PRIMARY KEY (id);


--
-- TOC entry 3531 (class 2606 OID 449131)
-- Name: config_global config_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_global
    ADD CONSTRAINT config_global_pkey PRIMARY KEY (id);


--
-- TOC entry 3533 (class 2606 OID 449140)
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id);


--
-- TOC entry 3513 (class 2606 OID 448920)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 3483 (class 2606 OID 448600)
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- TOC entry 3535 (class 2606 OID 449154)
-- Name: evaluaciones evaluaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 3537 (class 2606 OID 449164)
-- Name: gestiones gestiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gestiones
    ADD CONSTRAINT gestiones_pkey PRIMARY KEY (id);


--
-- TOC entry 3539 (class 2606 OID 449182)
-- Name: marcas_modelos marcas_modelos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marcas_modelos
    ADD CONSTRAINT marcas_modelos_pkey PRIMARY KEY (id);


--
-- TOC entry 3541 (class 2606 OID 449192)
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY (id);


--
-- TOC entry 3545 (class 2606 OID 449221)
-- Name: miniads_clicks miniads_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miniads_clicks
    ADD CONSTRAINT miniads_clicks_pkey PRIMARY KEY (id);


--
-- TOC entry 3543 (class 2606 OID 449210)
-- Name: miniads miniads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.miniads
    ADD CONSTRAINT miniads_pkey PRIMARY KEY (id);


--
-- TOC entry 3547 (class 2606 OID 449233)
-- Name: plantillas plantillas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas
    ADD CONSTRAINT plantillas_pkey PRIMARY KEY (id);


--
-- TOC entry 3549 (class 2606 OID 449251)
-- Name: referencias_faltantes referencias_faltantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referencias_faltantes
    ADD CONSTRAINT referencias_faltantes_pkey PRIMARY KEY (id);


--
-- TOC entry 3491 (class 2606 OID 448673)
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- TOC entry 3493 (class 2606 OID 448671)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 3551 (class 2606 OID 449260)
-- Name: solicitudes_ofertas solicitudes_ofertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_ofertas
    ADD CONSTRAINT solicitudes_ofertas_pkey PRIMARY KEY (id);


--
-- TOC entry 3487 (class 2606 OID 448644)
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 3489 (class 2606 OID 448656)
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (user_id, role_code);


--
-- TOC entry 3495 (class 2606 OID 448679)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- TOC entry 3497 (class 2606 OID 448717)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3499 (class 2606 OID 448715)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3501 (class 2606 OID 448733)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 3515 (class 2606 OID 448964)
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 3553 (class 2606 OID 449272)
-- Name: vehiculos_ref vehiculos_ref_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos_ref
    ADD CONSTRAINT vehiculos_ref_pkey PRIMARY KEY (id);


--
-- TOC entry 3555 (class 2606 OID 449282)
-- Name: vendedores vendedores_codigo_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_codigo_ref_key UNIQUE (codigo_ref);


--
-- TOC entry 3557 (class 2606 OID 449280)
-- Name: vendedores vendedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendedores
    ADD CONSTRAINT vendedores_pkey PRIMARY KEY (id);


--
-- TOC entry 3563 (class 2606 OID 448750)
-- Name: agent_status agent_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_status
    ADD CONSTRAINT agent_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3564 (class 2606 OID 448764)
-- Name: agente_estados_log agente_estados_log_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_estados_log
    ADD CONSTRAINT agente_estados_log_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3568 (class 2606 OID 448853)
-- Name: agente_gestiones_log agente_gestiones_log_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_gestiones_log
    ADD CONSTRAINT agente_gestiones_log_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3569 (class 2606 OID 448858)
-- Name: agente_gestiones_log agente_gestiones_log_base_registro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_gestiones_log
    ADD CONSTRAINT agente_gestiones_log_base_registro_id_fkey FOREIGN KEY (base_registro_id) REFERENCES public.base_registros(id);


--
-- TOC entry 3571 (class 2606 OID 448984)
-- Name: base_records base_records_assigned_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_records
    ADD CONSTRAINT base_records_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3572 (class 2606 OID 448989)
-- Name: base_records base_records_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_records
    ADD CONSTRAINT base_records_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id);


--
-- TOC entry 3573 (class 2606 OID 448994)
-- Name: base_records base_records_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_records
    ADD CONSTRAINT base_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 3574 (class 2606 OID 448999)
-- Name: base_records base_records_last_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_records
    ADD CONSTRAINT base_records_last_agent_id_fkey FOREIGN KEY (last_agent_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3575 (class 2606 OID 449004)
-- Name: base_records base_records_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_records
    ADD CONSTRAINT base_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 3566 (class 2606 OID 448834)
-- Name: base_registros base_registros_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_registros
    ADD CONSTRAINT base_registros_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3567 (class 2606 OID 448839)
-- Name: base_registros base_registros_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_registros
    ADD CONSTRAINT base_registros_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id);


--
-- TOC entry 3565 (class 2606 OID 448815)
-- Name: bases bases_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bases
    ADD CONSTRAINT bases_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles(id);


--
-- TOC entry 3576 (class 2606 OID 449019)
-- Name: call_attempts call_attempts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT call_attempts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3577 (class 2606 OID 449024)
-- Name: call_attempts call_attempts_base_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_attempts
    ADD CONSTRAINT call_attempts_base_record_id_fkey FOREIGN KEY (base_record_id) REFERENCES public.base_records(id);


--
-- TOC entry 3581 (class 2606 OID 449111)
-- Name: cita_recordatorios cita_recordatorios_cita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cita_recordatorios
    ADD CONSTRAINT cita_recordatorios_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id);


--
-- TOC entry 3578 (class 2606 OID 449085)
-- Name: citas citas_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3579 (class 2606 OID 449090)
-- Name: citas citas_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id);


--
-- TOC entry 3580 (class 2606 OID 449095)
-- Name: citas citas_base_registro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_base_registro_id_fkey FOREIGN KEY (base_registro_id) REFERENCES public.base_registros(id);


--
-- TOC entry 3582 (class 2606 OID 449165)
-- Name: gestiones gestiones_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gestiones
    ADD CONSTRAINT gestiones_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id);


--
-- TOC entry 3583 (class 2606 OID 449170)
-- Name: gestiones gestiones_base_registro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gestiones
    ADD CONSTRAINT gestiones_base_registro_id_fkey FOREIGN KEY (base_registro_id) REFERENCES public.base_registros(id);


--
-- TOC entry 3584 (class 2606 OID 449193)
-- Name: mensajes mensajes_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id);


--
-- TOC entry 3585 (class 2606 OID 449234)
-- Name: plantillas plantillas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas
    ADD CONSTRAINT plantillas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- TOC entry 3558 (class 2606 OID 451356)
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 3559 (class 2606 OID 448680)
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 3560 (class 2606 OID 448685)
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- TOC entry 3561 (class 2606 OID 448718)
-- Name: users users_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- TOC entry 3562 (class 2606 OID 448734)
-- Name: usuarios usuarios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- TOC entry 3570 (class 2606 OID 448965)
-- Name: vehicles vehicles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


-- Completed on 2026-02-04 11:44:30

--
-- PostgreSQL database dump complete
--

