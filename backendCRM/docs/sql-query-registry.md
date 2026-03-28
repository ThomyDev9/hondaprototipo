# Registro De Queries

Este archivo documenta donde vive hoy el SQL activo del backend.

## Estado Actual

La antigua carpeta `backendCRM/src/services/queries` ya no participa en el flujo activo del backend.
Los dominios principales quedaron migrados a sus DAOs:

- [AgenteDAO.js](/c:/Projects/prototipo%20honda/backendCRM/src/services/dao/AgenteDAO.js)
- [BasesDAO.js](/c:/Projects/prototipo%20honda/backendCRM/src/services/dao/BasesDAO.js)
- [CampaignDAO.js](/c:/Projects/prototipo%20honda/backendCRM/src/services/dao/CampaignDAO.js)
- [MenuDAO.js](/c:/Projects/prototipo%20honda/backendCRM/src/services/dao/MenuDAO.js)

Documentos relacionados:

- [query-dao-migration-registry.md](/c:/Projects/prototipo%20honda/backendCRM/docs/query-dao-migration-registry.md)
- [query-usage-audit.md](/c:/Projects/prototipo%20honda/backendCRM/docs/query-usage-audit.md)
- [sql-view-candidates.md](/c:/Projects/prototipo%20honda/backendCRM/docs/sql-view-candidates.md)
- [dao-query-registry.md](/c:/Projects/prototipo%20honda/backendCRM/docs/dao-query-registry.md)

## Oportunidades De Vista SQL

### Alto valor

- resumen de bases activas y regestion,
- lecturas supervisor con gestiones + grabaciones,
- joins repetidos de `clientes` con contacto y telefonos.

Ver detalle propuesto en [sql-view-candidates.md](/c:/Projects/prototipo%20honda/backendCRM/docs/sql-view-candidates.md).

### Mantener En DAO

- actualizacion de gestion,
- cambios de estado del agente,
- asignacion y liberacion de registros,
- inserciones historicas,
- importacion CSV y activacion de bases.
