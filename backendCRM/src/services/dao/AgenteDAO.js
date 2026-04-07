import pool from "../db.js";

const outboundSchema =
    process.env.MYSQL_DB ||
    process.env.MYSQL_DB_ENCUESTA ||
    "cck_dev_pruebas";

const GET_USER_STATE_BY_ID = `
    SELECT State
    FROM user
    WHERE IdUser = ?
    LIMIT 1
`;

const GET_CLIENTE_BY_ID = `
    SELECT *
    FROM ${outboundSchema}.vw_outbound_client_lookup
    WHERE Id = ?
    LIMIT 1
`;

const GET_CLIENTE_BY_IDENTIFICATION_AND_CAMPAIGN = `
    SELECT *
    FROM ${outboundSchema}.vw_outbound_client_lookup
    WHERE IDENTIFICACION = ?
      AND CampaignId LIKE ?
    ORDER BY Id DESC
    LIMIT 1
`;

const GET_CLIENTE_BY_IDENTIFICATION = `
    SELECT *
    FROM ${outboundSchema}.vw_outbound_client_lookup
    WHERE IDENTIFICACION = ?
    ORDER BY Id DESC
    LIMIT 1
`;

const GET_OUTBOUND_CLIENT_BASE_BY_ID_OR_IDENTIFICATION = `
  SELECT *
  FROM ${outboundSchema}.clientes_outbound
  WHERE Id = ?
     OR IDENTIFICACION = ?
  ORDER BY TmStmp DESC
  LIMIT 1
`;

const GET_CLIENTE_CONTACT_KEYS_BY_ID_OR_CONTACT_ID = `
  SELECT Id, ContactId, IDENTIFICACION
  FROM ${outboundSchema}.clientes_outbound
  WHERE Id = ?
     OR ContactId = ?
  LIMIT 1
`;

const UPDATE_CLIENTE_SURVEY_AND_MANAGEMENT = `
    UPDATE ${outboundSchema}.clientes_outbound
    SET LastAgent = ?,
      ResultLevel1 = ?,
      ResultLevel2 = ?,
      ResultLevel3 = ?,
      ManagementResultCode = ?,
      ContactAddress = ?,
      InteractionId = ?,
      Intentos = ?,
      Action = ?,
      UserShift = ?,
      TmStmp = NOW()
    WHERE Id = ?
       OR ContactId = ?
`;

const GET_GESTION_FINAL_BY_CONTACT_ID = `
    SELECT ContactId
    FROM ${outboundSchema}.gestionfinal_outbound
    WHERE ContactId = ?
    LIMIT 1
`;

const INSERT_GESTION_FINAL_FROM_CLIENTE = `
  INSERT INTO ${outboundSchema}.gestionfinal_outbound (
      VCC, CampaignId, ContactId, ContactName, ContactAddress, InteractionId, ImportId, Agent,
      ResultLevel1, ResultLevel2, ResultLevel3, ManagementResultCode, ManagementResultDescription,
      StartedManagement, TmStmp, Intentos, FechaAgendamiento, Telefono2, Observaciones, ID,
      CODIGO_CAMPANIA, IDENTIFICACION, NOMBRE_CLIENTE, CAMPO1, CAMPO2, CAMPO3, CAMPO4, CAMPO5,
      CAMPO6, CAMPO7, CAMPO8, CAMPO9, CAMPO10,
      PREGUNTA_1, PREGUNTA_2, PREGUNTA_3, PREGUNTA_4, PREGUNTA_5, PREGUNTA_6, PREGUNTA_7, PREGUNTA_8, PREGUNTA_9, PREGUNTA_10,
      PREGUNTA_11, PREGUNTA_12, PREGUNTA_13, PREGUNTA_14, PREGUNTA_15, PREGUNTA_16, PREGUNTA_17, PREGUNTA_18, PREGUNTA_19, PREGUNTA_20,
      PREGUNTA_21, PREGUNTA_22, PREGUNTA_23, PREGUNTA_24, PREGUNTA_25, PREGUNTA_26, PREGUNTA_27, PREGUNTA_28, PREGUNTA_29, PREGUNTA_30,
      RESPUESTA_1, RESPUESTA_2, RESPUESTA_3, RESPUESTA_4, RESPUESTA_5, RESPUESTA_6, RESPUESTA_7, RESPUESTA_8, RESPUESTA_9, RESPUESTA_10,
      RESPUESTA_11, RESPUESTA_12, RESPUESTA_13, RESPUESTA_14, RESPUESTA_15, RESPUESTA_16, RESPUESTA_17, RESPUESTA_18, RESPUESTA_19, RESPUESTA_20,
      RESPUESTA_21, RESPUESTA_22, RESPUESTA_23, RESPUESTA_24, RESPUESTA_25, RESPUESTA_26, RESPUESTA_27, RESPUESTA_28, RESPUESTA_29, RESPUESTA_30
    )
    SELECT
      c.VCC,
      c.CampaignId,
      ?,
      c.ContactName,
      ?,
      ?,
      c.ImportId,
      ?,
      ?,
      ?,
      ?,
      ?,
      '',
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      c.ID,
      c.CODIGO_CAMPANIA,
      ?,
      c.NOMBRE_CLIENTE,
      c.CAMPO1,
      c.CAMPO2,
      c.CAMPO3,
      c.CAMPO4,
      c.CAMPO5,
      c.CAMPO6,
      c.CAMPO7,
      c.CAMPO8,
      c.CAMPO9,
      c.CAMPO10,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM ${outboundSchema}.clientes_outbound c
    WHERE c.Id = ?
       OR c.ContactId = ?
    LIMIT 1
`;

const UPDATE_GESTION_FINAL_BY_CONTACT_ID = `
  UPDATE ${outboundSchema}.gestionfinal_outbound
  SET ContactAddress = ?,
      InteractionId = ?,
      Agent = ?,
      ResultLevel1 = ?,
      ResultLevel2 = ?,
      ResultLevel3 = ?,
      ManagementResultDescription = '',
      ManagementResultCode = ?,
      StartedManagement = ?,
      TmStmp = ?,
      Intentos = ?,
      FechaAgendamiento = ?,
      Telefono2 = ?,
      Observaciones = ?,
      PREGUNTA_1 = ?, PREGUNTA_2 = ?, PREGUNTA_3 = ?, PREGUNTA_4 = ?, PREGUNTA_5 = ?,
      PREGUNTA_6 = ?, PREGUNTA_7 = ?, PREGUNTA_8 = ?, PREGUNTA_9 = ?, PREGUNTA_10 = ?,
      PREGUNTA_11 = ?, PREGUNTA_12 = ?, PREGUNTA_13 = ?, PREGUNTA_14 = ?, PREGUNTA_15 = ?,
      PREGUNTA_16 = ?, PREGUNTA_17 = ?, PREGUNTA_18 = ?, PREGUNTA_19 = ?, PREGUNTA_20 = ?,
      PREGUNTA_21 = ?, PREGUNTA_22 = ?, PREGUNTA_23 = ?, PREGUNTA_24 = ?, PREGUNTA_25 = ?,
      PREGUNTA_26 = ?, PREGUNTA_27 = ?, PREGUNTA_28 = ?, PREGUNTA_29 = ?, PREGUNTA_30 = ?,
      RESPUESTA_1 = ?, RESPUESTA_2 = ?, RESPUESTA_3 = ?, RESPUESTA_4 = ?, RESPUESTA_5 = ?,
      RESPUESTA_6 = ?, RESPUESTA_7 = ?, RESPUESTA_8 = ?, RESPUESTA_9 = ?, RESPUESTA_10 = ?,
      RESPUESTA_11 = ?, RESPUESTA_12 = ?, RESPUESTA_13 = ?, RESPUESTA_14 = ?, RESPUESTA_15 = ?,
      RESPUESTA_16 = ?, RESPUESTA_17 = ?, RESPUESTA_18 = ?, RESPUESTA_19 = ?, RESPUESTA_20 = ?,
      RESPUESTA_21 = ?, RESPUESTA_22 = ?, RESPUESTA_23 = ?, RESPUESTA_24 = ?, RESPUESTA_25 = ?,
      RESPUESTA_26 = ?, RESPUESTA_27 = ?, RESPUESTA_28 = ?, RESPUESTA_29 = ?, RESPUESTA_30 = ?
  WHERE ContactId = ?
`;

const INSERT_GESTION_HISTORICA_FROM_GESTION_FINAL = `
    INSERT INTO ${outboundSchema}.gestionhistorica_outbound
    SELECT *
    FROM ${outboundSchema}.gestionfinal_outbound
    WHERE ContactId = ?
    ORDER BY TmStmp DESC
    LIMIT 1
`;

const GET_PHONES_BY_CONTACT_ID = `
    SELECT NumeroMarcado
    FROM contactimportphone
    WHERE ContactId = ?
      AND NumeroMarcado IS NOT NULL
      AND NumeroMarcado <> ''
    ORDER BY DescripcionTelefono ASC
`;

const GET_LATEST_PHONE_DATA_BY_CONTACT_ID = `
    SELECT NumeroMarcado, InteractionId
    FROM contactimportphone
    WHERE ContactId = ?
    ORDER BY FechaHoraFin DESC, FechaHora DESC
    LIMIT 1
`;

const UPDATE_CONTACT_PHONE_BY_STATUS_CHANGE = `
  UPDATE contactimportphone
  SET InteractionId = ?,
    Agente = ?,
    Estado = ?,
    FechaHora = ?,
    FechaHoraFin = ?,
    DescripcionTelefono = COALESCE(NULLIF(?, ''), DescripcionTelefono),
    IdentificacionCliente = COALESCE(NULLIF(?, ''), IdentificacionCliente)
  WHERE ContactId = ?
    AND NumeroMarcado = ?
`;

const GET_MANAGEMENT_LEVELS_BY_CAMPAIGN = `
    SELECT DISTINCT Description AS description, level1, level2, level3, code
    FROM campaignresultmanagement
    WHERE campaignid = ?
      AND COALESCE(State, '1') = '1'
    ORDER BY Description ASC, level1 ASC, level2 ASC, level3 ASC
`;

const GET_MANAGEMENT_CODE_BY_LEVELS_WITHOUT_LEVEL3 = `
    SELECT code
    FROM campaignresultmanagement
    WHERE campaignid = ?
      AND COALESCE(State, '1') = '1'
      AND level1 = ?
      AND level2 = ?
      AND (level3 IS NULL OR level3 = '')
    LIMIT 1
`;

const GET_REDES_MANAGEMENT_LEVELS = `
    SELECT DISTINCT Description AS description, level1, level2, level3, code
    FROM campaignresultmanagement
    WHERE COALESCE(State, '1') = '1'
      AND CAST(code AS UNSIGNED) > 2000
    ORDER BY code ASC, Description ASC, level1 ASC, level2 ASC, level3 ASC
`;

const GET_REDES_MANAGEMENT_CODE_BY_LEVELS_WITHOUT_LEVEL3 = `
    SELECT code
    FROM campaignresultmanagement
    WHERE COALESCE(State, '1') = '1'
      AND CAST(code AS UNSIGNED) > 2000
      AND level1 = ?
      AND level2 = ?
      AND (level3 IS NULL OR level3 = '')
    ORDER BY CAST(code AS UNSIGNED) ASC
    LIMIT 1
`;

const GET_PHONE_STATUS_CATALOG = `
    SELECT Descripcion
    FROM statephones
    ORDER BY Id ASC
`;

const GET_AGENT_STATUS_CATALOG = `
    SELECT *
    FROM userstates
`;

const GET_AGENT_SESSION_BY_ID = `
    SELECT SessionId, Agent, AgentNumber, Estado, EstadoInicio, EstadoFin, LoginAt, LogoutAt, TmStmp
    FROM session
    WHERE SessionId = ?
    LIMIT 1
`;

const UPSERT_AGENT_SESSION_CONTEXT = `
    INSERT INTO session (
        SessionId,
        Agent,
        AgentNumber,
        Estado,
        EstadoInicio,
        EstadoFin,
        LoginAt,
        LogoutAt,
        TmStmp
    )
    VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        Agent = VALUES(Agent),
        AgentNumber = CASE
            WHEN VALUES(AgentNumber) IS NULL THEN AgentNumber
            ELSE VALUES(AgentNumber)
        END,
        Estado = VALUES(Estado),
        EstadoInicio = VALUES(EstadoInicio),
        EstadoFin = VALUES(EstadoFin),
        LoginAt = VALUES(LoginAt),
        LogoutAt = VALUES(LogoutAt),
        TmStmp = VALUES(TmStmp)
`;

const GET_OPEN_AGENT_SESSION_STATE_LOG = `
    SELECT id, SessionId, Agent, AgentNumber, Estado, EstadoInicio, EstadoFin
    FROM session_estado_log
    WHERE SessionId = ?
      AND EstadoFin IS NULL
    ORDER BY EstadoInicio DESC, id DESC
    LIMIT 1
`;

const INSERT_AGENT_SESSION_STATE_LOG = `
    INSERT INTO session_estado_log (
        SessionId,
        Agent,
        AgentNumber,
        Estado,
        EstadoInicio,
        EstadoFin,
        CreatedAt,
        UpdatedAt
    )
    VALUES (?, ?, NULLIF(?, ''), ?, ?, NULL, NOW(), NOW())
`;

const CLOSE_AGENT_SESSION_STATE_LOG = `
    UPDATE session_estado_log
    SET EstadoFin = ?,
        UpdatedAt = NOW()
    WHERE id = ?
`;

const GET_OTHER_ADVISORS = `
    SELECT Id
    FROM user
    WHERE usergroup >= '3'
      AND state = '1'
    ORDER BY Id ASC
`;

const GET_LAST_PHONE_STATUS_BY_CONTACT_AND_NUMBER = `
    SELECT Estado, InteractionId
    FROM contactimportphone
    WHERE contactid = ?
      AND numeromarcado = ?
    ORDER BY FechaHora DESC
    LIMIT 1
`;

const GET_ACTIVE_TEMPLATE_BY_CAMPAIGN_AND_TYPE = `
  SELECT
    v.menu_item_id,
    v.category_id,
    v.template_id,
    v.template_name,
    v.template_form_type AS form_type,
    v.version
  FROM menu_items mi
  LEFT JOIN menu_items p
    ON p.id = mi.id_padre
  LEFT JOIN menu_categorias mc
    ON mc.id = mi.id_categoria
  INNER JOIN vw_active_form_template_by_campaign v
    ON v.form_type = ?
   AND (
        v.menu_item_id = mi.id
        OR (
            ? = 'F2'
            AND mi.id_padre IS NOT NULL
            AND LOWER(COALESCE(mc.nombre_categoria, '')) LIKE '%inbound%'
            AND v.menu_item_id = p.id
        )
   )
  WHERE mi.nombre_item = ?
    AND mi.estado = 'activo'
    AND (? = '' OR mi.id_categoria = ?)
  ORDER BY
    CASE WHEN v.menu_item_id = mi.id THEN 0 ELSE 1 END ASC,
    v.assigned_at DESC,
    v.version DESC,
    v.template_id DESC,
    v.menu_item_id ASC
  LIMIT 1
`;

const GET_ACTIVE_TEMPLATE_BY_MENU_ITEM_AND_TYPE = `
  SELECT
    v.menu_item_id,
    v.category_id,
    v.template_id,
    v.template_name,
    v.template_form_type AS form_type,
    v.version
  FROM menu_items mi
  LEFT JOIN menu_items p
    ON p.id = mi.id_padre
  LEFT JOIN menu_categorias mc
    ON mc.id = mi.id_categoria
  INNER JOIN vw_active_form_template_by_campaign v
    ON v.form_type = ?
   AND (
        v.menu_item_id = mi.id
        OR (
            ? = 'F2'
            AND mi.id_padre IS NOT NULL
            AND LOWER(COALESCE(mc.nombre_categoria, '')) LIKE '%inbound%'
            AND v.menu_item_id = p.id
        )
   )
  WHERE mi.id = ?
    AND mi.estado = 'activo'
  ORDER BY
    CASE WHEN v.menu_item_id = mi.id THEN 0 ELSE 1 END ASC,
    v.assigned_at DESC,
    v.version DESC,
    v.template_id DESC
  LIMIT 1
`;

const GET_TEMPLATE_FIELDS_WITH_OPTIONS = `
  SELECT
    f.id AS field_id,
    f.field_key,
    f.label,
    f.field_type,
    f.is_required,
    f.display_order,
    f.placeholder,
    f.max_length,
    f.min_value,
    f.max_value,
    f.default_value,
    f.help_text,
    o.option_value,
    o.option_label,
    o.display_order AS option_order
  FROM form_template_fields f
  LEFT JOIN form_template_field_options o
    ON o.field_id = f.id
   AND o.is_active = 1
  WHERE f.template_id = ?
    AND f.is_active = 1
  ORDER BY f.display_order ASC, f.id ASC, o.display_order ASC, o.id ASC
`;

const GET_SUBCAMPAIGN_SCRIPT_BY_CAMPAIGN = `
  SELECT
    menu_item_id,
    category_id,
    campaign_id,
    script_json,
    updated_by,
    updated_at
  FROM vw_subcampaign_scripts
  WHERE campaign_id = ?
    AND (? = '' OR category_id = ?)
  ORDER BY updated_at DESC, menu_item_id ASC
  LIMIT 1
`;

const GET_SUBCAMPAIGN_SCRIPT_BY_MENU_ITEM = `
  SELECT
    menu_item_id,
    category_id,
    campaign_id,
    script_json,
    updated_by,
    updated_at
  FROM vw_subcampaign_scripts
  WHERE menu_item_id = ?
  ORDER BY updated_at DESC, menu_item_id ASC
  LIMIT 1
`;

const GET_CAMPAIGN_TYPES = `
  SELECT
    tipo_nombre
  FROM vw_campaign_types
  WHERE campaign_id = ?
    AND tipo_estado = 1
  ORDER BY tipo_nombre ASC
`;

const INSERT_DYNAMIC_FORM_RESPONSE = `
  INSERT INTO form_responses (
    menu_item_id,
    form_type,
    template_id,
    contact_id,
    agent_user,
    payload_json,
    submitted_at
  )
  VALUES (?, ?, ?, ?, ?, ?, NOW())
`;

const GET_INBOUND_CLIENT_BY_IDENTIFICATION_AND_CAMPAIGN = `
  SELECT *
  FROM clientes_inbound
  WHERE identification = ?
    AND campaign_id = ?
  ORDER BY id DESC
  LIMIT 1
`;

const GET_INBOUND_CLIENT_BY_IDENTIFICATION = `
  SELECT *
  FROM clientes_inbound
  WHERE identification = ?
  ORDER BY id DESC
  LIMIT 1
`;

const INSERT_INBOUND_CLIENT = `
  INSERT INTO clientes_inbound (
    contact_id,
    campaign_id,
    category_id,
    menu_item_id,
    identification,
    tipo_identificacion,
    full_name,
    city,
    email,
    celular,
    convencional,
    ticket_id,
    tipo_cliente,
    relacion,
    tipo_canal,
    nombre_cliente_ref,
    categorizacion,
    motivo,
    submotivo,
    observaciones,
    payload_json,
    created_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_INBOUND_CLIENT_BY_ID = `
  UPDATE clientes_inbound
  SET contact_id = ?,
      campaign_id = ?,
      category_id = ?,
      menu_item_id = ?,
      identification = ?,
      tipo_identificacion = ?,
      full_name = ?,
      city = ?,
      email = ?,
      celular = ?,
      convencional = ?,
      ticket_id = ?,
      tipo_cliente = ?,
      relacion = ?,
      tipo_canal = ?,
      nombre_cliente_ref = ?,
      categorizacion = ?,
      motivo = ?,
      submotivo = ?,
      observaciones = ?,
      payload_json = ?,
      created_by = ?
  WHERE id = ?
`;

const GET_INBOUND_GESTION_FINAL_BY_CONTACT_ID = `
  SELECT *
  FROM gestionfinal_inbound
  WHERE contact_id = ?
  LIMIT 1
`;

const COUNT_INBOUND_GESTIONES_BY_CONTACT_ID = `
  SELECT COUNT(DISTINCT interaction_id) AS total
  FROM gestionfinal_inbound
  WHERE contact_id = ?
`;

const INSERT_INBOUND_GESTION_FINAL = `
  INSERT INTO gestionfinal_inbound (
    contact_id,
    cliente_inbound_id,
    campaign_id,
    category_id,
    menu_item_id,
    interaction_id,
    action_order,
    agent,
    management_result_code,
    result_level1,
    result_level2,
    categorizacion,
    observaciones,
    fecha_agendamiento,
    identification,
    full_name,
    celular,
    tipo_cliente,
    tipo_identificacion,
    tipo_canal,
    relacion,
    nombre_cliente_ref,
    city,
    email,
    convencional,
    ticket_id,
    payload_json,
    fields_meta_json,
    PREGUNTA_1, PREGUNTA_2, PREGUNTA_3, PREGUNTA_4, PREGUNTA_5,
    PREGUNTA_6, PREGUNTA_7, PREGUNTA_8, PREGUNTA_9, PREGUNTA_10,
    PREGUNTA_11, PREGUNTA_12, PREGUNTA_13, PREGUNTA_14, PREGUNTA_15,
    PREGUNTA_16, PREGUNTA_17, PREGUNTA_18, PREGUNTA_19, PREGUNTA_20,
    PREGUNTA_21, PREGUNTA_22, PREGUNTA_23, PREGUNTA_24, PREGUNTA_25,
    PREGUNTA_26, PREGUNTA_27, PREGUNTA_28, PREGUNTA_29, PREGUNTA_30,
    RESPUESTA_1, RESPUESTA_2, RESPUESTA_3, RESPUESTA_4, RESPUESTA_5,
    RESPUESTA_6, RESPUESTA_7, RESPUESTA_8, RESPUESTA_9, RESPUESTA_10,
    RESPUESTA_11, RESPUESTA_12, RESPUESTA_13, RESPUESTA_14, RESPUESTA_15,
    RESPUESTA_16, RESPUESTA_17, RESPUESTA_18, RESPUESTA_19, RESPUESTA_20,
    RESPUESTA_21, RESPUESTA_22, RESPUESTA_23, RESPUESTA_24, RESPUESTA_25,
    RESPUESTA_26, RESPUESTA_27, RESPUESTA_28, RESPUESTA_29, RESPUESTA_30,
    started_management,
    tmstmp,
    intentos
  )
  VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), COALESCE(?, NOW()), ?
  )
`;

const UPDATE_INBOUND_GESTION_FINAL_BY_CONTACT_ID = `
  UPDATE gestionfinal_inbound
  SET cliente_inbound_id = ?,
      campaign_id = ?,
      category_id = ?,
      menu_item_id = ?,
      interaction_id = ?,
      agent = ?,
      management_result_code = ?,
      result_level1 = ?,
      result_level2 = ?,
      categorizacion = ?,
      observaciones = ?,
      fecha_agendamiento = ?,
      identification = ?,
      full_name = ?,
      celular = ?,
      tipo_cliente = ?,
      tipo_identificacion = ?,
      tipo_canal = ?,
      relacion = ?,
      nombre_cliente_ref = ?,
      city = ?,
      email = ?,
      convencional = ?,
      ticket_id = ?,
      payload_json = ?,
      fields_meta_json = ?,
      PREGUNTA_1 = ?, PREGUNTA_2 = ?, PREGUNTA_3 = ?, PREGUNTA_4 = ?, PREGUNTA_5 = ?,
      PREGUNTA_6 = ?, PREGUNTA_7 = ?, PREGUNTA_8 = ?, PREGUNTA_9 = ?, PREGUNTA_10 = ?,
      PREGUNTA_11 = ?, PREGUNTA_12 = ?, PREGUNTA_13 = ?, PREGUNTA_14 = ?, PREGUNTA_15 = ?,
      PREGUNTA_16 = ?, PREGUNTA_17 = ?, PREGUNTA_18 = ?, PREGUNTA_19 = ?, PREGUNTA_20 = ?,
      PREGUNTA_21 = ?, PREGUNTA_22 = ?, PREGUNTA_23 = ?, PREGUNTA_24 = ?, PREGUNTA_25 = ?,
      PREGUNTA_26 = ?, PREGUNTA_27 = ?, PREGUNTA_28 = ?, PREGUNTA_29 = ?, PREGUNTA_30 = ?,
      RESPUESTA_1 = ?, RESPUESTA_2 = ?, RESPUESTA_3 = ?, RESPUESTA_4 = ?, RESPUESTA_5 = ?,
      RESPUESTA_6 = ?, RESPUESTA_7 = ?, RESPUESTA_8 = ?, RESPUESTA_9 = ?, RESPUESTA_10 = ?,
      RESPUESTA_11 = ?, RESPUESTA_12 = ?, RESPUESTA_13 = ?, RESPUESTA_14 = ?, RESPUESTA_15 = ?,
      RESPUESTA_16 = ?, RESPUESTA_17 = ?, RESPUESTA_18 = ?, RESPUESTA_19 = ?, RESPUESTA_20 = ?,
      RESPUESTA_21 = ?, RESPUESTA_22 = ?, RESPUESTA_23 = ?, RESPUESTA_24 = ?, RESPUESTA_25 = ?,
      RESPUESTA_26 = ?, RESPUESTA_27 = ?, RESPUESTA_28 = ?, RESPUESTA_29 = ?, RESPUESTA_30 = ?,
      started_management = COALESCE(?, NOW()),
      tmstmp = COALESCE(?, NOW()),
      intentos = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE contact_id = ?
`;

const INSERT_INBOUND_GESTION_HISTORICA_FROM_FINAL = `
  INSERT INTO gestionhistorica_inbound (
    gestionfinal_inbound_id,
    contact_id,
    cliente_inbound_id,
    campaign_id,
    category_id,
    menu_item_id,
    interaction_id,
    action_order,
    agent,
    management_result_code,
    result_level1,
    result_level2,
    categorizacion,
    observaciones,
    fecha_agendamiento,
    identification,
    full_name,
    celular,
    tipo_cliente,
    tipo_identificacion,
    tipo_canal,
    relacion,
    nombre_cliente_ref,
    city,
    email,
    convencional,
    ticket_id,
    payload_json,
    fields_meta_json,
    PREGUNTA_1, PREGUNTA_2, PREGUNTA_3, PREGUNTA_4, PREGUNTA_5,
    PREGUNTA_6, PREGUNTA_7, PREGUNTA_8, PREGUNTA_9, PREGUNTA_10,
    PREGUNTA_11, PREGUNTA_12, PREGUNTA_13, PREGUNTA_14, PREGUNTA_15,
    PREGUNTA_16, PREGUNTA_17, PREGUNTA_18, PREGUNTA_19, PREGUNTA_20,
    PREGUNTA_21, PREGUNTA_22, PREGUNTA_23, PREGUNTA_24, PREGUNTA_25,
    PREGUNTA_26, PREGUNTA_27, PREGUNTA_28, PREGUNTA_29, PREGUNTA_30,
    RESPUESTA_1, RESPUESTA_2, RESPUESTA_3, RESPUESTA_4, RESPUESTA_5,
    RESPUESTA_6, RESPUESTA_7, RESPUESTA_8, RESPUESTA_9, RESPUESTA_10,
    RESPUESTA_11, RESPUESTA_12, RESPUESTA_13, RESPUESTA_14, RESPUESTA_15,
    RESPUESTA_16, RESPUESTA_17, RESPUESTA_18, RESPUESTA_19, RESPUESTA_20,
    RESPUESTA_21, RESPUESTA_22, RESPUESTA_23, RESPUESTA_24, RESPUESTA_25,
    RESPUESTA_26, RESPUESTA_27, RESPUESTA_28, RESPUESTA_29, RESPUESTA_30,
    started_management,
    tmstmp,
    intentos
  )
  SELECT
    id,
    contact_id,
    cliente_inbound_id,
    campaign_id,
    category_id,
    menu_item_id,
    interaction_id,
    action_order,
    agent,
    management_result_code,
    result_level1,
    result_level2,
    categorizacion,
    observaciones,
    fecha_agendamiento,
    identification,
    full_name,
    celular,
    tipo_cliente,
    tipo_identificacion,
    tipo_canal,
    relacion,
    nombre_cliente_ref,
    city,
    email,
    convencional,
    ticket_id,
    payload_json,
    fields_meta_json,
    PREGUNTA_1, PREGUNTA_2, PREGUNTA_3, PREGUNTA_4, PREGUNTA_5,
    PREGUNTA_6, PREGUNTA_7, PREGUNTA_8, PREGUNTA_9, PREGUNTA_10,
    PREGUNTA_11, PREGUNTA_12, PREGUNTA_13, PREGUNTA_14, PREGUNTA_15,
    PREGUNTA_16, PREGUNTA_17, PREGUNTA_18, PREGUNTA_19, PREGUNTA_20,
    PREGUNTA_21, PREGUNTA_22, PREGUNTA_23, PREGUNTA_24, PREGUNTA_25,
    PREGUNTA_26, PREGUNTA_27, PREGUNTA_28, PREGUNTA_29, PREGUNTA_30,
    RESPUESTA_1, RESPUESTA_2, RESPUESTA_3, RESPUESTA_4, RESPUESTA_5,
    RESPUESTA_6, RESPUESTA_7, RESPUESTA_8, RESPUESTA_9, RESPUESTA_10,
    RESPUESTA_11, RESPUESTA_12, RESPUESTA_13, RESPUESTA_14, RESPUESTA_15,
    RESPUESTA_16, RESPUESTA_17, RESPUESTA_18, RESPUESTA_19, RESPUESTA_20,
    RESPUESTA_21, RESPUESTA_22, RESPUESTA_23, RESPUESTA_24, RESPUESTA_25,
    RESPUESTA_26, RESPUESTA_27, RESPUESTA_28, RESPUESTA_29, RESPUESTA_30,
    started_management,
    tmstmp,
    intentos
  FROM gestionfinal_inbound
  WHERE contact_id = ?
  LIMIT 1
`;

const INSERT_INBOUND_GESTION_IMAGEN = `
  INSERT INTO gestionfinal_inbound_imagenes (
    gestionfinal_inbound_id,
    interaction_id,
    contact_id,
    cliente_inbound_id,
    campaign_id,
    category_id,
    menu_item_id,
    nombre_cliente_ref,
    uploaded_by,
    etiqueta_personalizada,
    original_filename,
    stored_filename,
    relative_path,
    mime_type,
    file_size
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const LIST_INBOUND_HISTORICO_CLIENT_OPTIONS = `
  SELECT DISTINCT
    TRIM(nombre_cliente_ref) AS value
  FROM gestionfinal_inbound
  WHERE (? = '' OR campaign_id = ?)
    AND COALESCE(TRIM(nombre_cliente_ref), '') <> ''
  ORDER BY value ASC
`;

const LIST_INBOUND_HISTORICO_ROWS = `
  SELECT
    campaign_id,
    agent,
    identification,
    full_name,
    celular,
    categorizacion,
    result_level1,
    result_level2,
    observaciones,
    tmstmp,
    nombre_cliente_ref
  FROM gestionfinal_inbound
  WHERE (? = '' OR campaign_id = ?)
    AND (? = '' OR TRIM(nombre_cliente_ref) = ?)
    AND (
      ? = ''
      OR TRIM(identification) = ?
      OR LOWER(COALESCE(TRIM(full_name), '')) LIKE CONCAT('%', LOWER(?), '%')
      OR LOWER(COALESCE(TRIM(nombre_cliente_ref), '')) LIKE CONCAT('%', LOWER(?), '%')
    )
    AND (? = '' OR DATE(tmstmp) >= DATE(?))
    AND (? = '' OR DATE(tmstmp) <= DATE(?))
  ORDER BY tmstmp DESC, id DESC
  LIMIT 500
`;

const GET_REDES_CLIENT_BY_IDENTIFICATION_AND_CAMPAIGN = `
  SELECT *
  FROM clientes_redes
  WHERE identification = ?
    AND campaign_id = ?
  ORDER BY id DESC
  LIMIT 1
`;

const GET_REDES_CLIENT_BY_IDENTIFICATION = `
  SELECT *
  FROM clientes_redes
  WHERE identification = ?
  ORDER BY id DESC
  LIMIT 1
`;

const INSERT_REDES_CLIENT = `
  INSERT INTO clientes_redes (
    contact_id,
    campaign_id,
    category_id,
    menu_item_id,
    identification,
    tipo_identificacion,
    full_name,
    cantidad_mensajes,
    celular,
    tipo_cliente,
    tipo_red_social,
    estado_conversacion,
    fecha_gestion,
    nombre_cliente_ref,
    categorizacion,
    level1,
    level2,
    observaciones,
    payload_json,
    created_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_REDES_CLIENT_BY_ID = `
  UPDATE clientes_redes
  SET contact_id = ?,
      campaign_id = ?,
      category_id = ?,
      menu_item_id = ?,
      identification = ?,
      tipo_identificacion = ?,
      full_name = ?,
      cantidad_mensajes = ?,
      celular = ?,
      tipo_cliente = ?,
      tipo_red_social = ?,
      estado_conversacion = ?,
      fecha_gestion = ?,
      nombre_cliente_ref = ?,
      categorizacion = ?,
      level1 = ?,
      level2 = ?,
      observaciones = ?,
      payload_json = ?,
      created_by = ?
  WHERE id = ?
`;

const GET_REDES_GESTION_BY_CONTACT_ID = `
  SELECT *
  FROM gestion_redes
  WHERE contact_id = ?
  LIMIT 1
`;

const COUNT_REDES_GESTIONES_BY_CONTACT_ID = `
  SELECT COUNT(DISTINCT interaction_id) AS total
  FROM gestion_redes
  WHERE contact_id = ?
`;

const INSERT_REDES_GESTION_FINAL = `
  INSERT INTO gestion_redes (
    contact_id,
    cliente_redes_id,
    campaign_id,
    category_id,
    menu_item_id,
    interaction_id,
    action_order,
    agent,
    management_result_code,
    result_level1,
    result_level2,
    categorizacion,
    level1,
    level2,
    observaciones,
    identification,
    full_name,
    celular,
    tipo_cliente,
    tipo_red_social,
    tipo_identificacion,
    nombre_cliente_ref,
    estado_conversacion,
    fecha_gestion,
    cantidad_mensajes,
    payload_json,
    fields_meta_json,
    started_management,
    tmstmp,
    intentos
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_REDES_GESTION_FINAL_BY_CONTACT_ID = `
  UPDATE gestion_redes
  SET cliente_redes_id = ?,
      campaign_id = ?,
      category_id = ?,
      menu_item_id = ?,
      interaction_id = ?,
      agent = ?,
      management_result_code = ?,
      result_level1 = ?,
      result_level2 = ?,
      categorizacion = ?,
      level1 = ?,
      level2 = ?,
      observaciones = ?,
      identification = ?,
      full_name = ?,
      celular = ?,
      tipo_cliente = ?,
      tipo_red_social = ?,
      tipo_identificacion = ?,
      nombre_cliente_ref = ?,
      estado_conversacion = ?,
      fecha_gestion = ?,
      cantidad_mensajes = ?,
      payload_json = ?,
      fields_meta_json = ?,
      started_management = ?,
      tmstmp = ?,
      intentos = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE contact_id = ?
`;

const INSERT_REDES_GESTION_HISTORICA_FROM_FINAL = `
  INSERT INTO gestionhistorica_redes (
    gestion_redes_id,
    contact_id,
    cliente_redes_id,
    campaign_id,
    category_id,
    menu_item_id,
    interaction_id,
    action_order,
    agent,
    management_result_code,
    result_level1,
    result_level2,
    categorizacion,
    level1,
    level2,
    observaciones,
    identification,
    full_name,
    celular,
    tipo_cliente,
    tipo_red_social,
    tipo_identificacion,
    nombre_cliente_ref,
    estado_conversacion,
    fecha_gestion,
    cantidad_mensajes,
    payload_json,
    fields_meta_json,
    started_management,
    tmstmp,
    intentos
  )
  SELECT
    id,
    contact_id,
    cliente_redes_id,
    campaign_id,
    category_id,
    menu_item_id,
    interaction_id,
    action_order,
    agent,
    management_result_code,
    result_level1,
    result_level2,
    categorizacion,
    level1,
    level2,
    observaciones,
    identification,
    full_name,
    celular,
    tipo_cliente,
    tipo_red_social,
    tipo_identificacion,
    nombre_cliente_ref,
    estado_conversacion,
    fecha_gestion,
    cantidad_mensajes,
    payload_json,
    fields_meta_json,
    started_management,
    tmstmp,
    intentos
  FROM gestion_redes
  WHERE contact_id = ?
  LIMIT 1
`;

export class AgenteDAO {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    async getUserStateById(userId, executor = this.pool) {
        const [rows] = await executor.query(GET_USER_STATE_BY_ID, [userId]);
        return rows[0] || null;
    }

    async getCampaignAndImportByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT Campaign, LastUpdate
            FROM contactimportcontact
            WHERE Id = ?
            LIMIT 1
            `,
            [contactId],
        );
        return rows[0] || null;
    }

    async getActiveImportByCampaign(campaignId, executor = this.pool) {
        const [rows] = await executor.query(
            `
            SELECT ImportId
            FROM campaign_active_base
            WHERE CampaignId = ?
              AND state = 1
            LIMIT 1
            `,
            [campaignId],
        );
        return rows[0] || null;
    }

    async getAssignedContactForAgent(
        agenteActor,
        tabSessionId,
        campaignId,
        importId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            `
            SELECT
              ID,
              Campaign,
              Name,
              Identification,
              LastUpdate,
              Number AS intentos_totales,
              LastAgent
            FROM contactimportcontact
            WHERE LastAgent = ?
              AND TabSessionId = ?
              AND Campaign = ?
              AND LastUpdate = ?
              AND Action = 'Asignar Base'
            LIMIT 1
            `,
            [agenteActor, tabSessionId, campaignId, importId],
        );
        return rows[0] || null;
    }

    async assignNextContactForAgent(
        agenteActor,
        tabSessionId,
        campaignId,
        importId,
        executor = this.pool,
    ) {
        const [result] = await executor.query(
            `
            UPDATE contactimportcontact
            SET
              LastAgent = ?,
              TabSessionId = ?,
              Action = 'Asignar Base',
              TmStmpShift = NOW()
            WHERE Campaign = ?
              AND LastUpdate = ?
              AND LastAgent IN ('','Pendiente')
              AND Action NOT IN ('Cancelar base')
              AND (
                    (LastManagementResult IS NULL OR LastManagementResult = '')
                    OR
                    (
                      Action IN ('re_llamada','reciclable')
                      AND LastManagementResult IN ('34','60','61','62','63','64')
                    )
              )
            ORDER BY Number ASC, ID ASC
            LIMIT 1
            `,
            [agenteActor, tabSessionId, campaignId, importId],
        );
        return result;
    }

    async getLatestAssignedContactForAgent(
        agenteActor,
        tabSessionId,
        campaignId,
        importId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            `
            SELECT
              ID,
              Campaign,
              Name,
              Identification,
              LastUpdate,
              Number AS intentos_totales,
              LastAgent
            FROM contactimportcontact
            WHERE LastAgent = ?
              AND TabSessionId = ?
              AND Campaign = ?
              AND LastUpdate = ?
            ORDER BY TmStmpShift DESC
            LIMIT 1
            `,
            [agenteActor, tabSessionId, campaignId, importId],
        );
        return rows[0] || null;
    }

    async getPhonesByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(GET_PHONES_BY_CONTACT_ID, [contactId]);
        return rows;
    }

    async getClienteById(clienteId, executor = this.pool) {
        const [rows] = await executor.query(GET_CLIENTE_BY_ID, [clienteId]);
        return rows[0] || null;
    }

    async getClienteByIdentificationAndCampaign(
        identification,
        campaignLike,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_CLIENTE_BY_IDENTIFICATION_AND_CAMPAIGN,
            [identification, campaignLike],
        );
        return rows[0] || null;
    }

    async getClienteByIdentification(identification, executor = this.pool) {
        const [rows] = await executor.query(GET_CLIENTE_BY_IDENTIFICATION, [
            identification,
        ]);
        return rows[0] || null;
    }

    async getOutboundClientBaseByIdOrIdentification(
        identification,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_OUTBOUND_CLIENT_BASE_BY_ID_OR_IDENTIFICATION,
            [identification, identification],
        );
        return rows[0] || null;
    }

    async getClienteContactKeysByIdOrContactId(
        clienteIdOrContactId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_CLIENTE_CONTACT_KEYS_BY_ID_OR_CONTACT_ID,
            [clienteIdOrContactId, clienteIdOrContactId],
        );
        return rows;
    }

    async getActiveBasesSummary(executor = this.pool) {
        const [rows] = await executor.query(`
            SELECT
                campaign_id,
                import_id,
                total_registros,
                pendientes,
                pendientes_libres,
                pendientes_asignados_sin_gestion
            FROM vw_agent_active_bases_summary
            ORDER BY pendientes DESC, campaign_id ASC
        `);
        return rows;
    }

    async getRegestionBasesSummary(executor = this.pool) {
        const [rows] = await executor.query(`
            SELECT
                campaign_id,
                import_id,
                total_reciclables
            FROM vw_agent_regestion_bases_summary
            ORDER BY total_reciclables DESC, campaign_id ASC, import_id ASC
        `);
        return rows;
    }

    async getManagementLevelsByCampaign(campaignId, executor = this.pool) {
        const [rows] = await executor.query(GET_MANAGEMENT_LEVELS_BY_CAMPAIGN, [
            campaignId,
        ]);
        return rows;
    }

    async getManagementCodeByLevelsWithoutLevel3(
        campaignId,
        level1,
        level2,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_MANAGEMENT_CODE_BY_LEVELS_WITHOUT_LEVEL3,
            [campaignId, level1, level2],
        );
        return rows[0] || null;
    }

    async getRedesManagementLevels(executor = this.pool) {
        const [rows] = await executor.query(GET_REDES_MANAGEMENT_LEVELS);
        return rows;
    }

    async getRedesManagementCodeByLevelsWithoutLevel3(
        level1,
        level2,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_REDES_MANAGEMENT_CODE_BY_LEVELS_WITHOUT_LEVEL3,
            [level1, level2],
        );
        return rows[0] || null;
    }

    async getPhoneStatusCatalog(executor = this.pool) {
        const [rows] = await executor.query(GET_PHONE_STATUS_CATALOG);
        return rows;
    }

    async getAgentStatusCatalog(executor = this.pool) {
        const [rows] = await executor.query(GET_AGENT_STATUS_CATALOG);
        return rows;
    }

    async getAgentSessionById(sessionId, executor = this.pool) {
        const [rows] = await executor.query(GET_AGENT_SESSION_BY_ID, [sessionId]);
        return rows[0] || null;
    }

    async upsertAgentSessionContext(
        {
            sessionId,
            agent,
            agentNumber = "",
            estado,
            estadoInicio,
            estadoFin = null,
            loginAt = null,
            logoutAt = null,
            tmstmp,
        },
        executor = this.pool,
    ) {
        return executor.query(UPSERT_AGENT_SESSION_CONTEXT, [
            sessionId,
            agent,
            agentNumber,
            estado,
            estadoInicio,
            estadoFin,
            loginAt,
            logoutAt,
            tmstmp,
        ]);
    }

    async getOpenAgentSessionStateLog(sessionId, executor = this.pool) {
        const [rows] = await executor.query(GET_OPEN_AGENT_SESSION_STATE_LOG, [
            sessionId,
        ]);
        return rows[0] || null;
    }

    async insertAgentSessionStateLog(
        { sessionId, agent, agentNumber = "", estado, estadoInicio },
        executor = this.pool,
    ) {
        return executor.query(INSERT_AGENT_SESSION_STATE_LOG, [
            sessionId,
            agent,
            agentNumber,
            estado,
            estadoInicio,
        ]);
    }

    async closeAgentSessionStateLog(
        { id, estadoFin },
        executor = this.pool,
    ) {
        return executor.query(CLOSE_AGENT_SESSION_STATE_LOG, [estadoFin, id]);
    }

    async getOtherAdvisors(executor = this.pool) {
        const [rows] = await executor.query(GET_OTHER_ADVISORS);
        return rows;
    }

    async getLastPhoneStatusByContactAndNumber(
        contactId,
        phoneNumber,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_LAST_PHONE_STATUS_BY_CONTACT_AND_NUMBER,
            [contactId, phoneNumber],
        );
        return rows[0] || null;
    }

    async getLatestPhoneDataByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(GET_LATEST_PHONE_DATA_BY_CONTACT_ID, [
            contactId,
        ]);
        return rows[0] || null;
    }

    async updateContactPhoneByStatusChange(params, executor = this.pool) {
        return executor.query(UPDATE_CONTACT_PHONE_BY_STATUS_CHANGE, params);
    }

    async getActiveTemplateByCampaignAndType(
        formType,
        campaignId,
        categoryId = "",
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_ACTIVE_TEMPLATE_BY_CAMPAIGN_AND_TYPE,
            [formType, formType, campaignId, categoryId, categoryId],
        );
        return rows;
    }

    async getActiveTemplateByMenuItemAndType(
        formType,
        menuItemId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_ACTIVE_TEMPLATE_BY_MENU_ITEM_AND_TYPE,
            [formType, formType, menuItemId],
        );
        return rows;
    }

    async getTemplateFieldsWithOptions(templateId, executor = this.pool) {
        const [rows] = await executor.query(GET_TEMPLATE_FIELDS_WITH_OPTIONS, [
            templateId,
        ]);
        return rows;
    }

    async getSubcampaignScriptByCampaign(
        campaignId,
        categoryId = "",
        executor = this.pool,
    ) {
        const [rows] = await executor.query(GET_SUBCAMPAIGN_SCRIPT_BY_CAMPAIGN, [
            campaignId,
            categoryId,
            categoryId,
        ]);
        return rows[0] || null;
    }

    async getSubcampaignScriptByMenuItem(menuItemId, executor = this.pool) {
        const [rows] = await executor.query(GET_SUBCAMPAIGN_SCRIPT_BY_MENU_ITEM, [
            menuItemId,
        ]);
        return rows[0] || null;
    }

    async getCampaignTypes(campaignId, executor = this.pool) {
        const [rows] = await executor.query(GET_CAMPAIGN_TYPES, [campaignId]);
        return rows;
    }

    async getGestionFinalByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(GET_GESTION_FINAL_BY_CONTACT_ID, [
            contactId,
        ]);
        return rows;
    }

    async updateClienteSurveyAndManagement(params, executor = this.pool) {
        return executor.query(UPDATE_CLIENTE_SURVEY_AND_MANAGEMENT, params);
    }

    async insertGestionFinalFromCliente(params, executor = this.pool) {
        return executor.query(INSERT_GESTION_FINAL_FROM_CLIENTE, params);
    }

    async updateGestionFinalByContactId(params, executor = this.pool) {
        return executor.query(UPDATE_GESTION_FINAL_BY_CONTACT_ID, params);
    }

    async insertGestionHistoricaFromGestionFinal(
        contactId,
        executor = this.pool,
    ) {
        return executor.query(INSERT_GESTION_HISTORICA_FROM_GESTION_FINAL, [
            contactId,
        ]);
    }

    async insertOutboundCliente(params, executor = this.pool) {
        return executor.query(
            `
            INSERT INTO ${outboundSchema}.clientes_outbound
            (
                VCC, CampaignId, ContactId, ContactName, ContactAddress, InteractionId,
                ImportId, LastAgent, ResultLevel1, ResultLevel2, ResultLevel3, ManagementResultCode,
                ManagementResultDescription, TmStmp, Intentos,
                ID, CODIGO_CAMPANIA, NOMBRE_CAMPANIA, IDENTIFICACION, NOMBRE_CLIENTE,
                CAMPO1, CAMPO2, CAMPO3, CAMPO4, CAMPO5, CAMPO6, CAMPO7, CAMPO8, CAMPO9, CAMPO10,
                CamposAdicionalesJson, UserShift, Action
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            params,
        );
    }

    async updateOutboundCliente(params, executor = this.pool) {
        return executor.query(
            `
            UPDATE ${outboundSchema}.clientes_outbound
            SET ContactId = ?,
                ContactName = ?,
                ContactAddress = ?,
                InteractionId = ?,
                ImportId = ?,
                LastAgent = ?,
                ResultLevel1 = ?,
                ResultLevel2 = ?,
                ResultLevel3 = '',
                ManagementResultCode = ?,
                ManagementResultDescription = '',
                TmStmp = ?,
                Intentos = COALESCE(Intentos, 0) + 1,
                NOMBRE_CLIENTE = ?,
                CAMPO1 = ?, CAMPO2 = ?, CAMPO3 = ?, CAMPO4 = ?, CAMPO5 = ?,
                CAMPO6 = ?, CAMPO7 = ?, CAMPO8 = ?, CAMPO9 = ?, CAMPO10 = ?,
                CamposAdicionalesJson = ?,
                UserShift = ?,
                Action = 'Gestionado'
            WHERE ContactId = ?
               OR (IDENTIFICACION = ? AND CampaignId LIKE ?)
            `,
            params,
        );
    }

    async updateOutboundGestionFinalMetadata(params, executor = this.pool) {
        return executor.query(
            `
            UPDATE ${outboundSchema}.gestionfinal_outbound
            SET ContactName = ?,
                CampaignId = ?,
                ImportId = ?,
                IDENTIFICACION = ?,
                NOMBRE_CLIENTE = ?,
                CAMPO1 = ?, CAMPO2 = ?, CAMPO3 = ?, CAMPO4 = ?, CAMPO5 = ?,
                CAMPO6 = ?, CAMPO7 = ?, CAMPO8 = ?, CAMPO9 = ?, CAMPO10 = ?
            WHERE ContactId = ?
            `,
            params,
        );
    }

    async insertDynamicFormResponse(
        menuItemId,
        formType,
        templateId,
        contactId,
        agentUser,
        payloadJson,
        executor = this.pool,
    ) {
        return executor.query(INSERT_DYNAMIC_FORM_RESPONSE, [
            menuItemId,
            formType,
            templateId,
            contactId,
            agentUser,
            payloadJson,
        ]);
    }

    async getInboundClientByIdentificationAndCampaign(
        identification,
        campaignId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_INBOUND_CLIENT_BY_IDENTIFICATION_AND_CAMPAIGN,
            [identification, campaignId],
        );
        return rows[0] || null;
    }

    async getInboundClientByIdentification(
        identification,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(GET_INBOUND_CLIENT_BY_IDENTIFICATION, [
            identification,
        ]);
        return rows[0] || null;
    }

    async insertInboundClient(params, executor = this.pool) {
        return executor.query(INSERT_INBOUND_CLIENT, params);
    }

    async updateInboundClientById(params, executor = this.pool) {
        return executor.query(UPDATE_INBOUND_CLIENT_BY_ID, params);
    }

    async getInboundGestionFinalByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(
            GET_INBOUND_GESTION_FINAL_BY_CONTACT_ID,
            [contactId],
        );
        return rows[0] || null;
    }

    async countInboundGestionesByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(
            COUNT_INBOUND_GESTIONES_BY_CONTACT_ID,
            [contactId],
        );
        return Number(rows[0]?.total || 0);
    }

    async insertInboundGestionFinal(params, executor = this.pool) {
        return executor.query(INSERT_INBOUND_GESTION_FINAL, params);
    }

    async updateInboundGestionFinalByContactId(params, executor = this.pool) {
        return executor.query(UPDATE_INBOUND_GESTION_FINAL_BY_CONTACT_ID, params);
    }

    async insertInboundGestionHistoricaFromFinal(
        contactId,
        executor = this.pool,
    ) {
        return executor.query(INSERT_INBOUND_GESTION_HISTORICA_FROM_FINAL, [
            contactId,
        ]);
    }

    async insertInboundGestionImagen(params, executor = this.pool) {
        return executor.query(INSERT_INBOUND_GESTION_IMAGEN, params);
    }

    async listInboundHistoricoClientOptions(campaignId, executor = this.pool) {
        const [rows] = await executor.query(
            LIST_INBOUND_HISTORICO_CLIENT_OPTIONS,
            [campaignId, campaignId],
        );
        return rows;
    }

    async listInboundHistoricoRows(
        {
            campaignId,
            clientName = "",
            searchText = "",
            startDate = "",
            endDate = "",
        },
        executor = this.pool,
    ) {
        const [rows] = await executor.query(LIST_INBOUND_HISTORICO_ROWS, [
            campaignId,
            campaignId,
            clientName,
            clientName,
            searchText,
            searchText,
            searchText,
            searchText,
            startDate,
            startDate,
            endDate,
            endDate,
        ]);
        return rows;
    }

    async getRedesClientByIdentificationAndCampaign(
        identification,
        campaignId,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(
            GET_REDES_CLIENT_BY_IDENTIFICATION_AND_CAMPAIGN,
            [identification, campaignId],
        );
        return rows[0] || null;
    }

    async getRedesClientByIdentification(
        identification,
        executor = this.pool,
    ) {
        const [rows] = await executor.query(GET_REDES_CLIENT_BY_IDENTIFICATION, [
            identification,
        ]);
        return rows[0] || null;
    }

    async insertRedesClient(params, executor = this.pool) {
        return executor.query(INSERT_REDES_CLIENT, params);
    }

    async updateRedesClientById(params, executor = this.pool) {
        return executor.query(UPDATE_REDES_CLIENT_BY_ID, params);
    }

    async getRedesGestionByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(GET_REDES_GESTION_BY_CONTACT_ID, [
            contactId,
        ]);
        return rows[0] || null;
    }

    async countRedesGestionesByContactId(contactId, executor = this.pool) {
        const [rows] = await executor.query(
            COUNT_REDES_GESTIONES_BY_CONTACT_ID,
            [contactId],
        );
        return Number(rows[0]?.total || 0);
    }

    async insertRedesGestionFinal(params, executor = this.pool) {
        return executor.query(INSERT_REDES_GESTION_FINAL, params);
    }

    async updateRedesGestionFinalByContactId(params, executor = this.pool) {
        return executor.query(UPDATE_REDES_GESTION_FINAL_BY_CONTACT_ID, params);
    }

    async insertRedesGestionHistoricaFromFinal(
        contactId,
        executor = this.pool,
    ) {
        return executor.query(INSERT_REDES_GESTION_HISTORICA_FROM_FINAL, [
            contactId,
        ]);
    }
}

export default AgenteDAO;
