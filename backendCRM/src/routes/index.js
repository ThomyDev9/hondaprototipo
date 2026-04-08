/**
 * ROUTE REGISTRY
 * Sistema centralizado para registrar y gestionar todas las rutas
 *
 * Estructura modular por carpetas:
 * - admin/    → Rutas de administración
 * - auth/     → Autenticación
 * - agente/   → Funcionalidades del agente
 * - bases/    → Carga y gestión de bases
 * - supervisor/ → Funcionalidades del supervisor
 * - shared/   → Rutas compartidas (mapping, campaign)
 */

export const routeRegistry = [
    // Authentication
    {
        path: "/auth",
        module: () => import("./auth/index.js"),
        description: "Autenticación (login, logout, etc)",
    },

    // Admin Module
    {
        path: "/admin/users",
        module: () => import("./admin/users.js"),
        description: "Gestión de usuarios del sistema",
    },

    {
        path: "/admin",
        module: () => import("./admin/index.js"),
        description: "Rutas admin generales",
    },

    {
        path: "/admin/forms",
        module: () => import("./admin/forms.js"),
        description: "Configuración de formularios dinámicos F2/F3",
    },
    {
        path: "/admin/scripts",
        module: () => import("./admin/scripts.js"),
        description: "Configuración de scripts por subcampaña",
    },

    // Agente Module
    {
        path: "/agente",
        module: () => import("./agente/index.js"),
        description: "Funcionalidades del agente",
    },

    // Bases Module
    {
        path: "/bases",
        module: () => import("./bases/index.js"),
        description: "Cargar y gestionar bases de clientes",
    },

    // Supervisor Module
    {
        path: "/supervisor",
        module: () => import("./supervisor/index.js"),
        description: "Funcionalidades del supervisor",
    },
    {
        path: "/consultor",
        module: () => import("./consultor/index.js"),
        description: "Gestion externa para rol consultor",
    },

    {
        path: "/campaigns",
        module: () => import("./shared/campaign.js"),
        description: "Gestión de campañas",
    },

    {
        path: "/api/menu",
        module: () => import("./menu.routes.js"),
        description: "Menú jerárquico de campañas (outbound)",
    },
];

/**
 * Registrar todas las rutas en la aplicación Express
 * @param {Express} app - Instancia de Express
 */
export async function registerRoutes(app) {
    console.log("📍 Registrando rutas...\n");

    for (const route of routeRegistry) {
        try {
            const routeModule = await route.module();
            const router = routeModule.default;

            app.use(route.path, router);

            console.log(`✅ ${route.path.padEnd(25)} → ${route.description}`);
        } catch (err) {
            console.error(`❌ Error cargando ruta ${route.path}:`, err.message);
        }
    }

    console.log("\n✅ Todas las rutas registradas");
}

/**
 * Obtener información de una ruta
 * @param {string} path - Path de la ruta
 * @returns {Object|null} Información de la ruta
 */
export function getRouteInfo(path) {
    return routeRegistry.find((r) => r.path === path) || null;
}

/**
 * Listar todas las rutas registradas
 * @returns {Array} Array con información de todas las rutas
 */
export function listRoutes() {
    return routeRegistry.map((r) => ({
        path: r.path,
        description: r.description,
    }));
}

export default routeRegistry;
