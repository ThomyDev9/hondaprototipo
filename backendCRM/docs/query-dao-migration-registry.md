# Registro De Migracion Query -> DAO

Este archivo deja claro que dominio ya migro su SQL a DAO y que pendiente operativo queda por resolver.

## Estado Actual

### `agente`

- DAO dueno: `AgenteDAO`
- Estado: `done`
- Ya migrado:
- validacion de usuario bloqueado
- bases activas y regestion
- catalogos del formulario
- plantillas dinamicas
- telefonos y cliente detalle del flujo `/agente/siguiente`
- ultimo estado de telefono
- resolucion de llaves internas de cliente
- codigo de gestion sin `level3`
- lectura de `gestionfinal` por `ContactId`
- escritura principal de `gestionfinal`
- escritura de cliente gestionado
- insercion de historico de gestion
- escritura outbound sobre `clientes` y metadatos de `gestionfinal`
- sentencias SQL locales dentro de `AgenteDAO`
- Pendiente operativo:
- aplicar en base de datos las vistas `vw_agent_active_bases_summary` y `vw_agent_regestion_bases_summary`

### `bases`

- DAO dueno: `BasesDAO`
- Estado: `done`
- Ya migrado:
- resumen admin de bases activas e inactivas
- infraestructura de `campaign_import_stats`
- recalculo de stats por importacion
- importaciones con estado por campana
- activacion y desactivacion de base activa
- validacion de campana/importacion para CSV
- insercion de contacto importado, cliente espejo y telefonos
- cabecera y detalle final de importacion
- sentencias SQL locales dentro de `BasesDAO`

### `campaign`

- DAO dueno: `CampaignDAO`
- Estado: `done`
- Ya migrado:
- `campaign.service.js`
- endpoints compartidos `/campaigns`, `/campaigns/active`, `/campaigns/search`
- sentencias SQL locales dentro de `CampaignDAO`

### `menu`

- DAO dueno: `MenuDAO`
- Estado: `done`
- Nota:
- las sentencias SQL viven dentro de `MenuDAO`
- nuevas consultas de `menu_items` deberian entrar por `MenuDAO`

## Regla Recomendada

1. Una ruta no deberia importar SQL ni `*.queries.js` directamente.
2. Un servicio deberia coordinar casos de uso, no concentrar sentencias SQL.
3. Si una lectura pesada se repite, evaluar vista SQL antes de duplicarla.
4. Si una consulta pertenece a un dominio, su dueno debe ser el DAO de ese dominio.
