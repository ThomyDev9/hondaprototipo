# Arquitectura Backend

## Objetivo

Ordenar el backend para que:

- las rutas no concentren SQL ni reglas de negocio complejas,
- el acceso a datos sea consistente,
- las consultas grandes tengan dueno claro,
- sea mas facil evitar duplicados y mantener cambios futuros.

## Regla de capas

### `routes/`

Responsables de:

- recibir request y validar datos de entrada,
- invocar servicios,
- devolver respuesta HTTP.

No deberian contener consultas SQL grandes ni logica de negocio extensa.

### `services/`

Responsables de:

- coordinar casos de uso,
- ejecutar reglas de negocio,
- combinar resultados de multiples DAOs o fuentes.

### `services/dao/`

Responsables de:

- encapsular acceso a base de datos,
- ejecutar queries parametrizadas,
- centralizar transacciones y operaciones CRUD o de lectura especializada,
- concentrar el SQL activo por dominio.

### `docs/`

Responsables de:

- registrar decisiones de arquitectura,
- documentar migraciones DAO,
- documentar candidatas a vistas SQL y auditorias de uso.

## Criterios para mover SQL a vistas

Una consulta conviene pasarla a vista cuando:

- es de solo lectura,
- tiene joins repetidos en varios lugares,
- alimenta dashboards, reportes o listados,
- su estructura es estable y semantica para el negocio.

No conviene usar vistas para:

- inserts,
- updates,
- deletes,
- procesos con transacciones,
- queries muy dinamicas.

## Estado Actual

Dominios ya migrados a DAO:

- `agente`
- `bases`
- `campaign`
- `menu`
- `admin/forms`
- `admin/scripts`
- `admin/management-levels`
- `users`

Registros de soporte:

- [query-dao-migration-registry.md](/c:/Projects/prototipo%20honda/backendCRM/docs/query-dao-migration-registry.md)
- [dao-query-registry.md](/c:/Projects/prototipo%20honda/backendCRM/docs/dao-query-registry.md)
- [sql-view-candidates.md](/c:/Projects/prototipo%20honda/backendCRM/docs/sql-view-candidates.md)

## Regla actual del proyecto

1. Las rutas deben mantenerse delgadas.
2. Los servicios coordinan casos de uso.
3. El SQL nuevo entra por DAO, no por una capa `queries`.
4. Las lecturas pesadas y estables deben evaluarse primero como vistas SQL.
5. Todo bloque legacy que ya no soporte un flujo vivo debe salir del codigo.

## Siguientes pasos sugeridos

1. Aplicar en MySQL las vistas SQL ya propuestas para resumenes operativos.
2. Seguir reduciendo SQL inline restante en `admin/index.js` fuera del bloque de management-levels.
3. Mantener en DAO las consultas operativas pequenas de `agente` y no forzar vistas donde no aportan.
4. Si hace falta otra vista, priorizar catalogos admin estables antes que consultas transaccionales del flujo del asesor.
5. Revisar `supervisor` despues, si se decide volver al modulo de grabaciones.
