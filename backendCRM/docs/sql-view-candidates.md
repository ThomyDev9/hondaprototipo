# Candidatas A Vista SQL

Este documento lista consultas que conviene mover a vistas SQL cuando son lecturas pesadas, repetidas y estables.

## Criterios

- se usan en dashboards o listados,
- repiten joins o agregaciones costosas,
- tienen poco comportamiento condicional,
- no escriben datos.

## Candidatas Confirmadas

### `vw_agent_active_bases_summary`

Origen actual:
- `AgenteDAO.getActiveBasesSummary()`
- `BasesDAO.getActiveAgentBasesSummary()`

Motivo:
- resumen operativo repetido para asesor y bases,
- lectura estable y agregada.

Script propuesto:
- [001_vw_agent_active_bases_summary.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/001_vw_agent_active_bases_summary.sql)

### `vw_agent_regestion_bases_summary`

Origen actual:
- `AgenteDAO.getRegestionBasesSummary()`

Motivo:
- consulta agregada de registros reciclables por campana/importacion.

Script propuesto:
- [002_vw_agent_regestion_bases_summary.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/002_vw_agent_regestion_bases_summary.sql)

### `vw_outbound_client_lookup`

Origen actual:
- `AgenteDAO.getClienteByIdentificationAndCampaign()`
- `AgenteDAO.getClienteById()`
- lecturas relacionadas de telefonos e historico de gestion

Motivo:
- concentra los campos de `clientes` usados por outbound,
- deja listos aliases normalizados para identificacion, nombre, celular y motivos,
- evita repetir resolucion de datos desde `CamposAdicionalesJson`.

Script propuesto:
- [004_vw_outbound_client_lookup.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/004_vw_outbound_client_lookup.sql)

### `vw_admin_bases_summary`

Origen actual:
- `BasesDAO.getAllBasesSummary()`
- `BasesDAO.getAllInactiveBasesSummary()`

Motivo:
- resumen admin repetido para listados de bases activas e inactivas,
- evita repetir el mismo `LEFT JOIN` entre `campaign_import_stats` y `campaign_active_base`.

Script propuesto:
- [003_vw_admin_bases_summary.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/003_vw_admin_bases_summary.sql)

### `vw_active_form_template_by_campaign`

Origen actual:
- `AgenteDAO.getActiveTemplateByCampaignAndType()`

Motivo:
- evita repetir joins entre `menu_items`, `form_template_assignments` y `form_templates`,
- sirve como base estable para las lecturas del formulario dinamico del asesor.

Script propuesto:
- [005_vw_active_form_template_by_campaign.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/005_vw_active_form_template_by_campaign.sql)

### `vw_subcampaign_scripts`

Origen actual:
- `AgenteDAO.getSubcampaignScriptByCampaign()`
- `/agente/scripts`

Motivo:
- evita repetir lookup de `menu_items` mas lectura de `sub_campaign_scripts`,
- deja el script por subcampana en una lectura unica y estable.

Script propuesto:
- [006_vw_subcampaign_scripts.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/006_vw_subcampaign_scripts.sql)

### `vw_campaign_types`

Origen actual:
- `AgenteDAO.getCampaignTypes()`
- `/agente/tipos-campania`

Motivo:
- reemplaza una consulta de catalogo directa en ruta,
- deja estable la relacion entre campana y tipos de campania activos.

Script propuesto:
- [007_vw_campaign_types.sql](/c:/Projects/prototipo%20honda/backendCRM/db/views/007_vw_campaign_types.sql)

## No Candidatas Por Ahora

Estas deben quedarse en DAO o SQL local:

- inserciones o updates de `gestionfinal`,
- activacion o desactivacion de bases,
- asignacion y liberacion de registros,
- cambios de estado de telefono.

## Auditoria Corta De Lo Que Queda

### Mantener En DAO

- `AgenteDAO.getPhonesByContactId()`
- `AgenteDAO.getLatestPhoneDataByContactId()`
- `AgenteDAO.getLastPhoneStatusByContactAndNumber()`
- `AgenteDAO.getManagementLevelsByCampaign()`
- `AgenteDAO.getManagementCodeByLevelsWithoutLevel3()`
- `AgenteDAO.getCampaignAndImportByContactId()`
- `AgenteDAO.getActiveImportByCampaign()`
- lecturas puntuales de `contactimportcontact` en `queue.routes.js` y `gestion.routes.js`

Motivo:
- son consultas chicas, operativas o altamente condicionales,
- varias participan en asignacion, gestion o escritura posterior,
- no ganan casi nada al convertirse en vista.

### Posibles Siguientes Vistas Si Hacen Falta

- catalogo de subcampanas outbound para admin/forms y admin/scripts
- sugerencias agregadas de `campaignresultmanagement` para admin/management-levels

Motivo:
- son lecturas de apoyo al panel admin,
- repiten agrupaciones y joins,
- pero no son tan prioritarias como las vistas que ya quedaron activas.

### No Recomendar Como Vista

- cualquier consulta usada en `/agente/siguiente`
- escrituras de `guardar-gestion` o `guardar-gestion-outbound`
- cambios de estado de base
- actualizaciones de templates, scripts o niveles

Motivo:
- mezclan reglas de negocio, concurrencia o transacciones,
- deben quedarse bajo control del DAO y servicios.
