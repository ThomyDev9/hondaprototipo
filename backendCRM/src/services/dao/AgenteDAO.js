import pool from "../db.js";

const encuestaSchema =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev";

const GET_USER_STATE_BY_ID = `
    SELECT State
    FROM user
    WHERE IdUser = ?
    LIMIT 1
`;

const GET_CLIENTE_BY_ID = `
    SELECT *
    FROM ${encuestaSchema}.vw_outbound_client_lookup
    WHERE Id = ?
    LIMIT 1
`;

const GET_CLIENTE_BY_IDENTIFICATION_AND_CAMPAIGN = `
    SELECT *
    FROM ${encuestaSchema}.vw_outbound_client_lookup
    WHERE IDENTIFICACION = ?
      AND CampaignId LIKE ?
    ORDER BY Id DESC
    LIMIT 1
`;

const GET_CLIENTE_CONTACT_KEYS_BY_ID_OR_CONTACT_ID = `
  SELECT Id, ContactId, IDENTIFICACION
  FROM ${encuestaSchema}.clientes
  WHERE Id = ?
     OR ContactId = ?
  LIMIT 1
`;

const UPDATE_CLIENTE_SURVEY_AND_MANAGEMENT = `
    UPDATE ${encuestaSchema}.clientes
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
    FROM ${encuestaSchema}.gestionfinal
    WHERE ContactId = ?
    LIMIT 1
`;

const INSERT_GESTION_FINAL_FROM_CLIENTE = `
  INSERT INTO ${encuestaSchema}.gestionfinal (
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
    FROM ${encuestaSchema}.clientes c
    WHERE c.Id = ?
       OR c.ContactId = ?
    LIMIT 1
`;

const UPDATE_GESTION_FINAL_BY_CONTACT_ID = `
  UPDATE ${encuestaSchema}.gestionfinal
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
    INSERT INTO ${encuestaSchema}.gestionhistorica
    SELECT *
    FROM ${encuestaSchema}.gestionfinal
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

const GET_PHONE_STATUS_CATALOG = `
    SELECT Descripcion
    FROM statephones
    ORDER BY Id ASC
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

    async getPhoneStatusCatalog(executor = this.pool) {
        const [rows] = await executor.query(GET_PHONE_STATUS_CATALOG);
        return rows;
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
            INSERT INTO ${encuestaSchema}.clientes
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
            UPDATE ${encuestaSchema}.clientes
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
            UPDATE ${encuestaSchema}.gestionfinal
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
}

export default AgenteDAO;
