# Auditoria De Uso De Queries

Barrido realizado sobre `backendCRM/src` para confirmar que la antigua carpeta `src/services/queries` ya no participa en el flujo activo.

## Estado Actual

- `agente`, `bases`, `campaign` y `menu` ya no dependen funcionalmente de archivos `*.queries.js`.
- Las sentencias activas viven dentro de sus DAOs respectivos.
- La antigua capa `queries` ya puede considerarse retirada del backend.

## Regla De Mantenimiento

1. No agregar nuevos archivos `*.queries.js`.
2. Toda sentencia nueva debe vivir en el DAO del dominio correspondiente.
3. Si una lectura se repite o se vuelve pesada, evaluarla primero como vista SQL.
4. Si una compatibilidad temporal deja de usarse, removerla del codigo en la siguiente pasada de limpieza.
