# Vistas SQL

Este directorio guarda objetos de solo lectura que conviene mantener en MySQL para evitar repetir joins y agregaciones en el backend.

## Vistas iniciales

- `000_apply_agent_views.sql`
- `001_vw_agent_active_bases_summary.sql`
- `002_vw_agent_regestion_bases_summary.sql`
- `003_vw_admin_bases_summary.sql`
- `004_vw_outbound_client_lookup.sql`
- `005_vw_active_form_template_by_campaign.sql`
- `006_vw_subcampaign_scripts.sql`
- `007_vw_campaign_types.sql`

## Criterio

- usar vistas para dashboards y lecturas pesadas estables
- mantener escrituras y transacciones en DAO/servicios
- versionar cada vista en un archivo separado

## Siguiente paso

1. aplicar las vistas en la base correspondiente
2. validar que `AgenteDAO` y `BasesDAO` lean desde ellas
3. confirmar que los payloads HTTP no cambien

## Aplicacion sugerida

Desde MySQL sobre la base de pruebas:

```sql
USE cck_dev_pruebas;
SOURCE backendCRM/db/views/000_apply_agent_views.sql;
```

Si tu cliente MySQL no soporta `SOURCE`, ejecuta primero:

```sql
USE cck_dev_pruebas;
```

Luego corre en orden:

1. `001_vw_agent_active_bases_summary.sql`
2. `002_vw_agent_regestion_bases_summary.sql`
3. `003_vw_admin_bases_summary.sql`
4. `005_vw_active_form_template_by_campaign.sql`
5. `006_vw_subcampaign_scripts.sql`
6. `007_vw_campaign_types.sql`

## Vista outbound

`004_vw_outbound_client_lookup.sql` debe ejecutarse en el esquema de encuestas
configurado por `MYSQL_DB_ENCUESTA`, porque la vista usa la tabla `clientes`
de ese esquema.
