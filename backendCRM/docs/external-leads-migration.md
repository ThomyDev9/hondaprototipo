# Migracion Inicial De Leads Externos

Este flujo crea un modulo aislado para asesores externos sin tocar las tablas actuales de CRM, inbound, outbound o redes.

## Archivos SQL

- `backendCRM/db/012_create_external_leads_tables.sql`
- `backendCRM/db/013_migrate_external_sheet_staging.sql`

## Objetivo

1. Crear una tabla general `external_leads`.
2. Cargar historicos de hojas `mail` y `rrss` en tablas staging.
3. Migrar esos datos a `external_leads` con mapeo unificado.

## Tablas creadas

- `external_leads`
- `external_leads_mail_staging`
- `external_leads_rrss_staging`

## Flujo sugerido

1. Ejecutar `012_create_external_leads_tables.sql`.
2. Exportar cada hoja actual a CSV.
3. Importar el CSV de `mail` en `external_leads_mail_staging`.
4. Importar el CSV de `rrss` en `external_leads_rrss_staging`.
5. Ejecutar `013_migrate_external_sheet_staging.sql`.
6. Revisar los datos en `external_leads`.

## Carga a staging

Puedes usar el importador CSV de MySQL Workbench, DBeaver o la herramienta que uses normalmente.

Recomendaciones:

- Llenar `import_batch` para identificar cada corrida.
- Llenar `row_number` con el numero de fila original si la herramienta lo permite.
- Si haces una transformacion previa, conservar el registro original en `raw_payload_json`.

## Regla actual de deduplicacion

La tabla final tiene una llave unica por:

- `source_channel`
- `identification`

Eso significa:

- una cedula puede existir una vez en `mail`
- una cedula puede existir una vez en `rrss`
- si vuelves a migrar el mismo canal y la misma cedula, el registro se actualiza

## Regla actual de seleccion en staging

Si staging tiene varias filas con la misma cedula dentro del mismo canal, la migracion toma una sola fila:

- prioriza la fecha parseable mas reciente
- si empatan, prioriza `row_number`
- si aun empatan, prioriza el `id` mas alto

## Estados iniciales del workflow externo

Durante la migracion se inicializan estos campos:

- `workflow_status`
- `workflow_substatus`
- `promotion_status`
- `is_ready_for_promotion`

Regla base:

- si `Estado` parece aprobado, queda `aprobado_para_gestion` y `listo`
- si `Estado` parece rechazo o descarte, queda `cerrado`
- si `Estado` tiene valor pero no es final, queda `en_seguimiento`
- si no tiene estado, queda `nuevo`

## Validacion recomendada despues de migrar

- contar cuantas cedulas llegaron por `mail`
- contar cuantas cedulas llegaron por `rrss`
- revisar filas con `identification` vacia en staging
- revisar si `workflow_status = aprobado_para_gestion` coincide con lo esperado
- revisar si `payload_json` conserva el origen correctamente

## Nota

Estos scripts no conectan aun el nuevo modulo con formularios, rutas o promociones al flujo real. Solo dejan lista la base para probar carga y migracion sin afectar lo existente.
