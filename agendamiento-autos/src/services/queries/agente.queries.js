/**
 * AGENTE QUERIES
 *
 * Sentencias SQL específicas del módulo de asesor/agente.
 */

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
};

export default agenteQueries;
