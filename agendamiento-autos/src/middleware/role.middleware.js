// backend/src/middleware/role.middleware.js
import pool from "../services/db.js";

/**
 * Carga los roles del usuario autenticado.
 *
 * 1) Intenta leer desde el esquema NUEVO:
 *      user_roles (user_id, role_id) + roles (id, code)
 * 2) Si no encuentra nada, hace fallback al esquema ANTIGUO:
 *      user_role_assignments (user_id, role_code)
 *
 * Deja los códigos de rol en:
 *   req.userRoles  (array de strings)
 *   req.user.roles (para compatibilidad con otros módulos)
 */
export const loadUserRoles = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Usuario no autenticado" });
        }

        let roleCodes = [];

        // ===== 1) Esquema nuevo: user_roles + roles =====
        const userRolesResult = await pool.query(
            `SELECT ur.role_id, r.code
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
            [userId],
        );

        if (userRolesResult.rows.length > 0) {
            roleCodes = userRolesResult.rows.map((r) => r.code).filter(Boolean);
        }

        // ===== 2) Fallback: esquema antiguo user_role_assignments =====
        if (roleCodes.length === 0) {
            const legacyResult = await pool.query(
                `SELECT role_code FROM user_role_assignments WHERE user_id = $1`,
                [userId],
            );
            if (legacyResult.rows.length > 0) {
                roleCodes = legacyResult.rows
                    .map((r) => r.role_code)
                    .filter(Boolean);
            }
        }

        req.userRoles = roleCodes;
        // compatibilidad: muchos lados esperan req.user.roles
        req.user = { ...(req.user || {}), roles: roleCodes };

        console.log("Roles del usuario", userId, ":", roleCodes);

        return next();
    } catch (err) {
        console.error("loadUserRoles error:", err);
        return res.status(500).json({ error: "Error en loadUserRoles" });
    }
};

/**
 * Valida que el usuario tenga alguno de los roles permitidos
 * Ejemplo: requireRole(['ADMIN']), requireRole(['AGENTE', 'SUPERVISOR'])
 */
export const requireRole = (rolesPermitidos = []) => {
    return (req, res, next) => {
        const roles = req.userRoles || req.user?.roles || [];

        const autorizado = Array.isArray(roles)
            ? roles.some((r) => rolesPermitidos.includes(r))
            : false;

        if (!autorizado) {
            return res.status(403).json({ error: "Permiso denegado" });
        }

        return next();
    };
};
