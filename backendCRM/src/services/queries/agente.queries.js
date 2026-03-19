/**
 * AGENTE QUERIES
 *
 * Sentencias SQL específicas del módulo de asesor/agente.
 */

// Para compatibilidad con queries existentes
const encuestaSchema =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev";
const encuestaSchemaDev = "bancopichinchaencuesta_dev";
const encuestaSchemaProd = "bancopichinchaencuesta";

const agenteQueries = {
    // Grabaciones por número de teléfono en bancopichinchaencuesta_dev
    getRecordingsByPhoneDev: `
      SELECT
        CampaignId,
        ContactId,
        ContactName,
        ContactAddress,
        InteractionId,
        ImportId,
        Agent,
        ResultLevel1
      FROM ${encuestaSchemaDev}.gestionfinal
      WHERE ContactAddress IS NOT NULL
      ORDER BY Id DESC
      LIMIT 100
    `,

    // Grabaciones por número de teléfono en bancopichinchaencuesta
    getRecordingsByPhoneProd: `
      SELECT
        CampaignId,
        ContactId,
        ContactName,
        ContactAddress,
        InteractionId,
        ImportId,
        Agent,
        ResultLevel1
      FROM ${encuestaSchemaProd}.gestionfinal
      WHERE ContactAddress IS NOT NULL
      ORDER BY Id DESC
      LIMIT 100
    `,
    getUserStateByIdUser: `
        SELECT State
        FROM user
        WHERE IdUser = ?
        LIMIT 1
    `,

    getActiveImportByCampaign: `
        SELECT ImportId
        FROM campaign_active_base
        WHERE CampaignId = ?
        AND State = 1
        LIMIT 1
    `,
    // Card de bases activas para agente dashboard, con conteo de pendientes
    getActiveBasesSummary: `
      SELECT
        cab.CampaignId AS campaign_id,
        cab.ImportId AS import_id,
        COALESCE(cis.TotalRegistros, cab.TotalRegistros, 0) AS total_registros,
        COALESCE(cis.PendientesReales, 0) AS pendientes,
        COALESCE(cis.PendientesLibres, 0) AS pendientes_libres,
        COALESCE(cis.PendientesAsignadosSinGestion, 0) AS pendientes_asignados_sin_gestion
      FROM campaign_active_base cab
      LEFT JOIN campaign_import_stats cis
        ON cis.CampaignId = cab.CampaignId
       AND cis.ImportId = cab.ImportId
      WHERE cab.State = '1'
        AND NOT (COALESCE(cis.PendientesReales, 0) = 0 
                AND COALESCE(cis.PendientesLibres, 0) = 0)
      ORDER BY pendientes DESC, cab.CampaignId ASC;
    `,
    // Card de bases regestion (reciclables) para dashboard
    getRegestionBasesSummary: `
          SELECT 
      ci.Campaign AS campaign_id,
      ci.LastUpdate AS import_id,
      COUNT(*) AS total_reciclables
    FROM contactimportcontact ci
    WHERE ci.action = 'reciclable'
    GROUP BY ci.Campaign, ci.LastUpdate;
    `,

    releaseStaleAutoAssignmentsByCampaign: `
        UPDATE contactimportcontact
        SET LastAgent = 'Pendiente',
          UserShift = 'system',
          TmStmpShift = NOW()
        WHERE Campaign LIKE ?
          AND LastAgent IS NOT NULL
          AND LastAgent <> ''
          AND LastAgent <> 'Pendiente'
          AND COALESCE(Action, '') IN ('Asignar Base', 'Reciclar Base')
          AND TmStmpShift IS NOT NULL
          AND TmStmpShift < DATE_SUB(NOW(), INTERVAL ? MINUTE)
      `,

    getClienteById: `
        SELECT *
        FROM ${encuestaSchema}.clientes
        WHERE Id = ?
        LIMIT 1
      `,

    getClienteByIdentificationAndCampaign: `
        SELECT *
        FROM ${encuestaSchema}.clientes
        WHERE IDENTIFICACION = ?
          AND CampaignId LIKE ?
        ORDER BY Id DESC
        LIMIT 1
    `,

    getClienteContactKeysByIdOrContactId: `
      SELECT Id, ContactId, IDENTIFICACION
      FROM ${encuestaSchema}.clientes
      WHERE Id = ?
         OR ContactId = ?
      LIMIT 1
    `,

    updateClienteSurveyAndManagement: `
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
           OR (IDENTIFICACION = ? AND CampaignId LIKE ?)
      `,

    getGestionFinalByContactId: `
        SELECT ContactId
      FROM ${encuestaSchema}.gestionfinal
        WHERE ContactId = ?
        LIMIT 1
    `,

    insertGestionFinalFromCliente: `
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
          c.IDENTIFICACION,
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
            OR (c.IDENTIFICACION = ? AND c.CampaignId LIKE ?)
        LIMIT 1
      `,

    updateGestionFinalByContactId: `
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
      `,

    insertGestionHistoricaFromGestionFinal: `
        INSERT INTO ${encuestaSchema}.gestionhistorica
        SELECT *
        FROM ${encuestaSchema}.gestionfinal
        WHERE ContactId = ?
        ORDER BY TmStmp DESC
        LIMIT 1
      `,

    getPhonesByContactId: `
        SELECT NumeroMarcado
        FROM contactimportphone
        WHERE ContactId = ?
          AND NumeroMarcado IS NOT NULL
          AND NumeroMarcado <> ''
        ORDER BY DescripcionTelefono ASC
    `,

    getLatestPhoneDataByContactId: `
        SELECT NumeroMarcado, InteractionId
        FROM contactimportphone
        WHERE ContactId = ?
        ORDER BY FechaHoraFin DESC, FechaHora DESC
        LIMIT 1
      `,

    updateContactPhoneByStatusChange: `
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
    `,

    getManagementLevelsByCampaign: `
        SELECT DISTINCT level1, level2, level3, code
        FROM campaignresultmanagement
        WHERE campaignid = ?
        AND COALESCE(State, '1') = '1'
        ORDER BY level1 ASC, level2 ASC, level3 ASC
    `,

    getManagementCodeByLevels: `
        SELECT code
        FROM campaignresultmanagement
        WHERE campaignid = ?
          AND COALESCE(State, '1') = '1'
          AND level1 = ?
          AND level2 = ?
          AND level3 = ?
        LIMIT 1
    `,

    getManagementCodeByLevelsWithoutLevel3: `
        SELECT code
        FROM campaignresultmanagement
        WHERE campaignid = ?
          AND COALESCE(State, '1') = '1'
          AND level1 = ?
          AND level2 = ?
          AND (level3 IS NULL OR level3 = '')
        LIMIT 1
    `,

    getPhoneStatusCatalog: `
        SELECT Descripcion
        FROM statephones
        ORDER BY Id ASC
    `,

    getOtherAdvisors: `
        SELECT Id
        FROM user
        WHERE usergroup >= '3'
          AND state = '1'
        ORDER BY Id ASC
    `,

    getLastPhoneStatusByContactAndNumber: `
        SELECT Estado, InteractionId
        FROM contactimportphone
        WHERE contactid = ?
          AND numeromarcado = ?
        ORDER BY FechaHora DESC
        LIMIT 1
    `,

    getActiveTemplateByCampaignAndType: `
      SELECT
        t.id AS template_id,
        t.name AS template_name,
        t.form_type,
        t.version
      FROM menu_items m
      INNER JOIN form_template_assignments a
        ON a.menu_item_id = m.id
         AND a.is_active = 1
         AND a.form_type = ?
      INNER JOIN form_templates t
        ON t.id = a.template_id
         AND t.status = 'published'
      WHERE m.nombre_item = ?
        AND m.estado = 'activo'
      ORDER BY a.assigned_at DESC, t.version DESC, t.id DESC
      LIMIT 1
    `,

    getTemplateFieldsWithOptions: `
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
    `,

    insertDynamicFormResponse: `
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
    `,

    // Nueva versión: tomar candidato y asignar por agente y sesión de pestaña
    takeCandidateForAgentWithSession: `
    UPDATE contactimportcontact
    SET LastAgent = ?,
      TabSessionId = ?,
      Action = ?,
      Number = COALESCE(Number, 0) + 1,
      UserShift = ?,
      TmStmpShift = NOW()
    WHERE Id = ?
      AND Campaign = ?
      AND (LastAgent = '' OR LastAgent = 'Pendiente')
  `,
};

export default agenteQueries;
