-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.



CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  encrypted_password text,
  created_at timestamp with time zone DEFAULT now()
  -- agrega las columnas que necesites
);

CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  document_number text,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  bloqueado boolean NOT NULL DEFAULT false,
  estado_operativo text NOT NULL DEFAULT 'disponible'::text,
  registro_actual uuid,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

ALTER TABLE public.user_profiles ADD COLUMN password text;


CREATE TABLE public.admin_parametros (
  codigo text NOT NULL,
  descripcion text,
  valor_num numeric,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_parametros_pkey PRIMARY KEY (codigo)
);

CREATE TABLE public.empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  numero_whatsapp text,
  phone_number_id text,
  waba_id text,
  access_token text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id)
);


CREATE TABLE public.user_role_assignments (
  user_id uuid NOT NULL,
  role_code text NOT NULL,
  CONSTRAINT user_role_assignments_pkey PRIMARY KEY (user_id, role_code)
);

CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text DEFAULT 'user'::text,
  empresa_id uuid,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
);

CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid,
  email text NOT NULL,
  rol text DEFAULT 'viewer'::text CHECK (rol = ANY (ARRAY['admin'::text, 'agente'::text, 'tecnico'::text, 'viewer'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
);

CREATE TABLE public.agent_status (
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'offline'::text,
  last_heartbeat timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_status_pkey PRIMARY KEY (user_id),
  CONSTRAINT agent_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.agente_estados_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL,
  estado text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agente_estados_log_pkey PRIMARY KEY (id),
  CONSTRAINT agente_estados_log_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.bases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  source text,
  uploaded_by uuid,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  total_records integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'activa'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
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
  campaign_year integer,
  CONSTRAINT bases_pkey PRIMARY KEY (id),
  CONSTRAINT bases_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.base_registros (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL,
  nombre_completo text,
  placa text,
  telefono1 text,
  telefono2 text,
  modelo text,
  estado text NOT NULL DEFAULT 'pendiente'::text,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_agent_id uuid,
  assigned_at timestamp with time zone,
  intentos_totales integer NOT NULL DEFAULT 0,
  ultimo_resultado text,
  ultimo_agente_id uuid,
  pool text NOT NULL DEFAULT 'activo'::text,
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
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT base_registros_pkey PRIMARY KEY (id),
  CONSTRAINT base_registros_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id),
  CONSTRAINT base_registros_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id)
);

CREATE TABLE public.agente_gestiones_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL,
  base_registro_id uuid NOT NULL,
  estado_final text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agente_gestiones_log_pkey PRIMARY KEY (id),
  CONSTRAINT agente_gestiones_log_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id),
  CONSTRAINT agente_gestiones_log_base_registro_id_fkey FOREIGN KEY (base_registro_id) REFERENCES public.base_registros(id)
);

CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  document_number text,
  email text,
  phone_main text,
  phone_alt text,
  city text,
  address text,
  preferred_channel text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_pkey PRIMARY KEY (id),
  CONSTRAINT vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE TABLE public.base_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendiente'::text,
  current_attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_result text,
  last_agent_id uuid,
  last_contact_at timestamp with time zone,
  assigned_agent_id uuid,
  assigned_at timestamp with time zone,
  scheduled_retry_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT base_records_pkey PRIMARY KEY (id),
  CONSTRAINT base_records_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES public.user_profiles(id),
  CONSTRAINT base_records_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id),
  CONSTRAINT base_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT base_records_last_agent_id_fkey FOREIGN KEY (last_agent_id) REFERENCES public.user_profiles(id),
  CONSTRAINT base_records_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);

CREATE TABLE public.call_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_record_id uuid NOT NULL,
  agent_id uuid,
  result text NOT NULL,
  notes text,
  contacted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT call_attempts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.user_profiles(id),
  CONSTRAINT call_attempts_base_record_id_fkey FOREIGN KEY (base_record_id) REFERENCES public.base_records(id)
);

CREATE TABLE public.catalogo_estados_gestion (
  code text NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  es_contacto_efectivo boolean DEFAULT false,
  CONSTRAINT catalogo_estados_gestion_pkey PRIMARY KEY (code)
);

CREATE TABLE public.chatbot_interesados (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  nombre text,
  celular text,
  email text,
  negocio text,
  comentario text,
  CONSTRAINT chatbot_interesados_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  cliente_id text NOT NULL,
  canal text NOT NULL CHECK (canal = ANY (ARRAY['whatsapp'::text, 'messenger'::text, 'instagram'::text])),
  modo_humano boolean DEFAULT false,
  origen text DEFAULT 'directo'::text CHECK (origen = ANY (ARRAY['bot'::text, 'directo'::text])),
  fecha_ultima_interaccion timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chats_pkey PRIMARY KEY (id)
);

CREATE TABLE public.citas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  comentarios text,
  CONSTRAINT citas_pkey PRIMARY KEY (id),
  CONSTRAINT citas_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.user_profiles(id),
  CONSTRAINT citas_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id),
  CONSTRAINT citas_base_registro_id_fkey FOREIGN KEY (base_registro_id) REFERENCES public.base_registros(id)
);

CREATE TABLE public.cita_recordatorios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cita_id uuid NOT NULL,
  tipo text NOT NULL,
  canal_sms boolean DEFAULT true,
  canal_email boolean DEFAULT true,
  scheduled_at timestamp with time zone NOT NULL,
  enviado boolean DEFAULT false,
  enviado_at timestamp with time zone,
  CONSTRAINT cita_recordatorios_pkey PRIMARY KEY (id),
  CONSTRAINT cita_recordatorios_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id)
);

CREATE TABLE public.config_global (
  id integer NOT NULL DEFAULT 1,
  max_intentos_generales integer NOT NULL DEFAULT 6,
  min_minutos_entre_intentos integer NOT NULL DEFAULT 60,
  horario_inicio_llamadas time without time zone NOT NULL DEFAULT '09:00:00',
  horario_fin_llamadas time without time zone NOT NULL DEFAULT '18:00:00',
  dias_habiles text[] NOT NULL DEFAULT ARRAY['L','M','X','J','V'],
  dias_para_reciclaje integer NOT NULL DEFAULT 30,
  dias_para_archivo_definitivo integer NOT NULL DEFAULT 180,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT config_global_pkey PRIMARY KEY (id)
);

CREATE TABLE public.contactos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  nombre text,
  email text,
  mensaje text,
  CONSTRAINT contactos_pkey PRIMARY KEY (id)
);

CREATE SEQUENCE evaluaciones_id_seq;

CREATE TABLE public.evaluaciones (
  id bigint NOT NULL DEFAULT nextval('evaluaciones_id_seq'::regclass),
  nombre text,
  apellido text,
  email text,
  celular text,
  ciudad text,
  Marca text,
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
  sensoresCinturon boolean,
  techoCorredizo boolean,
  sensores_estacionamiento boolean,
  sensores_retro boolean,
  camara_retro boolean,
  aparcamiento_autonomo boolean,
  retrovisoresElectricos boolean,
  camara_frontal boolean,
  sensorProximidad boolean,
  sensorImpacto boolean,
  aire_asientos boolean,
  aireAcondicionado boolean,
  vidrios_electricos boolean,
  vidriosConduct boolean,
  asiento_conductor text,
  asientos_pasajeros text,
  created_at timestamp with time zone DEFAULT now(),
  sistemaVisual text,
  vidriosTodos text,
  anio_matriculacion text,
  direccionales_frontales text,
  direccionales_posteriores text,
  luces_guias text,
  porcentaje text,
  puntaje text,
  valorFinal text,
  nota text,
  precioBase numeric,
  tipo text,
  CONSTRAINT evaluaciones_pkey PRIMARY KEY (id)
);

CREATE TABLE public.gestiones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_registro_id uuid NOT NULL,
  base_id uuid NOT NULL,
  agente_id uuid NOT NULL,
  intento_n integer NOT NULL,
  resultado text,
  comentario text,
  canal text DEFAULT 'telefono'::text,
  duracion_segundos integer,
  proxima_llamada_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  estado_gestion text,
  sub_estatus text,
  telefono_contacto text,
  CONSTRAINT gestiones_pkey PRIMARY KEY (id),
  CONSTRAINT gestiones_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.bases(id),
  CONSTRAINT gestiones_base_registro_id_fkey FOREIGN KEY (base_registro_id) REFERENCES public.base_registros(id)
);

CREATE TABLE public.marcas_modelos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  marca text NOT NULL,
  modelo text NOT NULL,
  tipo_vehiculo text NOT NULL,
  CONSTRAINT marcas_modelos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.mensajes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  mensaje text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['cliente'::text, 'agente'::text, 'bot'::text])),
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT mensajes_pkey PRIMARY KEY (id),
  CONSTRAINT mensajes_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);

CREATE TABLE public.miniads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  side text NOT NULL CHECK (side = ANY (ARRAY['left'::text, 'right'::text])),
  slot smallint NOT NULL CHECK (slot = ANY (ARRAY[1, 2])),
  name text NOT NULL,
  url text NOT NULL,
  img_url text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  site_id text NOT NULL DEFAULT 'default'::text,
  expires_at timestamp with time zone,
  CONSTRAINT miniads_pkey PRIMARY KEY (id)
);

CREATE TABLE public.miniads_clicks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  site_id text NOT NULL,
  side text NOT NULL CHECK (side = ANY (ARRAY['left'::text, 'right'::text])),
  slot smallint NOT NULL CHECK (slot = ANY (ARRAY[1, 2])),
  ad_name text,
  target_url text NOT NULL,
  page_path text,
  referrer text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT miniads_clicks_pkey PRIMARY KEY (id)
);

CREATE TABLE public.plantillas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid,
  nombre text NOT NULL,
  contenido jsonb NOT NULL,
  estado text DEFAULT 'aprobada'::text,
  canal text DEFAULT 'whatsapp'::text CHECK (canal = 'whatsapp'::text),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plantillas_pkey PRIMARY KEY (id),
  CONSTRAINT plantillas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
);

CREATE SEQUENCE referencias_faltantes_id_seq;

CREATE TABLE public.referencias_faltantes (
  id integer NOT NULL DEFAULT nextval('referencias_faltantes_id_seq'::regclass),
  marca text,
  modelo text,
  anio integer,
  fecha timestamp without time zone DEFAULT now(),
  CONSTRAINT referencias_faltantes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.solicitudes_ofertas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text,
  email text,
  whatsapp text,
  tipo text,
  marca text,
  ciudad text,
  anioMin integer,
  anioMax integer,
  precioMin numeric,
  precioMax numeric,
  combustible text,
  created_at timestamp with time zone DEFAULT now(),
  modelo text,
  CONSTRAINT solicitudes_ofertas_pkey PRIMARY KEY (id)
);

CREATE SEQUENCE vehiculos_ref_id_seq;

CREATE TABLE public.vehiculos_ref (
  id integer NOT NULL DEFAULT nextval('vehiculos_ref_id_seq'::regclass),
  marca text NOT NULL,
  modelo text NOT NULL,
  anio numeric NOT NULL,
  tipo_vehiculo text NOT NULL,
  combustible text NOT NULL,
  precio1 numeric,
  precio2 numeric,
  precio3 numeric,
  kilometraje text,
  CONSTRAINT vehiculos_ref_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vendedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text,
  email text,
  codigo_ref text UNIQUE,
  CONSTRAINT vendedores_pkey PRIMARY KEY (id)
);