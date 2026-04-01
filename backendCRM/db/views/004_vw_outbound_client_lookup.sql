CREATE OR REPLACE VIEW vw_outbound_client_lookup AS
SELECT
    c.*,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.identificacion')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.Identificacion')),
        c.IDENTIFICACION,
        ''
    ) AS outbound_identificacion,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.apellidosNombres')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.NombreCliente')),
        c.NOMBRE_CLIENTE,
        c.ContactName,
        ''
    ) AS outbound_nombre_cliente,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.celular')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.Celular')),
        c.ContactAddress,
        ''
    ) AS outbound_celular,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.tipoCampana')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.TipoCampania')),
        c.CAMPO1,
        ''
    ) AS outbound_tipo_campana,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.motivoInteraccion')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.MotivoLlamada')),
        c.ResultLevel1,
        ''
    ) AS outbound_motivo_interaccion,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.submotivoInteraccion')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.SubmotivoLlamada')),
        c.ResultLevel2,
        ''
    ) AS outbound_submotivo_interaccion,
    COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.observaciones')),
        JSON_UNQUOTE(JSON_EXTRACT(c.CamposAdicionalesJson, '$.Observaciones')),
        ''
    ) AS outbound_observaciones
FROM clientes_outbound c;
