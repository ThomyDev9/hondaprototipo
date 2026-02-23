/**
 * ÍNDICE CENTRAL DE QUERIES
 *
 * Este archivo sirve como punto de entrada centralizado para todas las queries SQL
 * del proyecto. Cada módulo (usuarios, bases, mappings, etc.) tiene su propio archivo
 * con las queries organizadas por funcionalidad.
 *
 * ESTRUCTURA:
 * - Cada entidad tiene un archivo: user.queries.js, bases.queries.js, etc.
 * - Las queries están organizadas por operación (SELECT, INSERT, UPDATE, DELETE)
 * - Se exportan como objetos con nombres descriptivos
 * - Los servicios/DAOs importan solo las queries que necesitan
 *
 * BENEFICIOS:
 * ✅ Un único lugar donde ver todas las queries
 * ✅ Fácil mantener y actualizar SQL
 * ✅ Evita repetición de código
 * ✅ Escalable para nuevas funcionalidades
 * ✅ Mejor control de cambios
 */

// Importar queries por módulo
export { default as userQueries } from "./user.queries.js";
export { default as basesQueries } from "./bases.queries.js";
export { default as mappingQueries } from "./mapping.queries.js";
export { default as campaignQueries } from "./campaign.queries.js";
export { default as sharedQueries } from "./shared.queries.js";

// Exportar todas juntas para acceso centralizado
export const allQueries = {
    user: userQueries,
    bases: basesQueries,
    mapping: mappingQueries,
    campaign: campaignQueries,
    shared: sharedQueries,
};
