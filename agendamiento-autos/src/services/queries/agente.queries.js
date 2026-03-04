/**
 * AGENTE QUERIES
 *
 * Sentencias SQL específicas del módulo de asesor/agente.
 */

const encuestaSchema =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev  ";

const agenteQueries = {
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
          AND UPPER(State) IN ('1', 'ACTIVO', 'ACTIVE', 'A')
        LIMIT 1
    `,

    getAssignedClientByAgentAndCampaignLike: `
        SELECT
            c.ID,
            c.CampaignId,
            c.ImportId,
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
            c.ResultLevel1,
            c.ResultLevel2,
            cc.LastAgent AS Agent,
            cc.LastUpdate,
            cc.Number AS intentos_totales
        FROM ${encuestaSchema}.clientes c
        INNER JOIN contactimportcontact cc ON c.ID = cc.Id
        WHERE cc.LastAgent = ?
          AND c.CampaignId LIKE ?
          AND (cc.Action = 'Reciclar Base' OR cc.Action = 'Asignar Base')
          AND cc.Action <> 'Cancelar base'
        ORDER BY cc.TmStmpShift DESC, c.ID DESC
        LIMIT 1
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

    getLatestImportWithPendingByCampaign: `
      SELECT c.LastUpdate AS ImportId
      FROM contactimportcontact c
      WHERE c.Campaign = ?
        AND c.LastUpdate IS NOT NULL
        AND c.LastUpdate <> ''
        AND c.Action <> 'Cancelar base'
        AND (c.LastAgent = '' OR c.LastAgent = 'Pendiente')
        ORDER BY c.LastUpdate DESC
      LIMIT 1
    `,

    upsertCampaignActiveBase: `
      INSERT INTO campaign_active_base
        (CampaignId, ImportId, State, UserShift, UpdatedAt)
      VALUES
        (?, ?, '1', ?, NOW())
      ON DUPLICATE KEY UPDATE
        ImportId = VALUES(ImportId),
        State = '1',
        UserShift = VALUES(UserShift),
        UpdatedAt = NOW()
    `,

    getNextCandidateByCampaignAndImport: `
        SELECT c.Id,
               c.Name,
               c.Identification,
               c.LastUpdate,
               c.LastManagementResult,
               c.Campaign,
               COALESCE(c.Number, 0) AS intentos_totales
        FROM contactimportcontact c
        WHERE c.Campaign = ?
          AND c.LastUpdate = ?
          AND c.Action <> 'Cancelar base'
          AND (c.LastAgent = '' OR c.LastAgent = 'Pendiente')
        ORDER BY COALESCE(c.Number, 0) ASC, c.Id ASC
        LIMIT 1
    `,

    takeCandidateForAgent: `
        UPDATE contactimportcontact
        SET LastAgent = ?,
            Action = ?,
            Number = COALESCE(Number, 0) + 1,
            UserShift = ?,
            TmStmpShift = NOW()
        WHERE Id = ?
          AND Campaign = ?
          AND (LastAgent = '' OR LastAgent = 'Pendiente')
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

    updateContactPhoneFromGestion: `
      UPDATE contactimportphone
      SET InteractionId = ?,
        Agente = ?,
        Estado = ?,
        FechaHora = NOW(),
        FechaHoraFin = NOW(),
        DescripcionTelefono = COALESCE(NULLIF(?, ''), DescripcionTelefono),
        IdentificacionCliente = COALESCE(NULLIF(?, ''), IdentificacionCliente)
      WHERE ContactId = ?
        AND NumeroMarcado = ?
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
        ORDER BY level1 ASC, level2 ASC, level3 ASC
    `,

    getManagementCodeByLevels: `
        SELECT code
        FROM campaignresultmanagement
        WHERE campaignid = ?
          AND level1 = ?
          AND level2 = ?
          AND level3 = ?
        LIMIT 1
    `,

    getManagementCodeByLevelsWithoutLevel3: `
        SELECT code
        FROM campaignresultmanagement
        WHERE campaignid = ?
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
};

export default agenteQueries;
