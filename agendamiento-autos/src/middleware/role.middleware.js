// backend/src/middleware/role.middleware.js
import pool from "../services/db.js";

/**
 * Carga los roles del usuario autenticado desde MySQL
 * Para tu esquema, cada usuario tiene un workgroup asociado
 */
export const loadUserRoles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(
            `SELECT w.description
       FROM user u
       JOIN workgroup w ON w.id = u.UserGroup
       WHERE u.IdUser = ?`,
            [userId],
        );

        const roleCodes = rows.map((r) => r.description);

        console.log("Roles cargados para usuario", userId, ":", roleCodes);

        req.user.roles = roleCodes;
        next();
    } catch (err) {
        console.error("Error cargando roles:", err);
        res.status(500).json({ message: "Error cargando roles" });
    }
};

/**
 * Valida que el usuario tenga alguno de los roles permitidos
 */
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        console.log("------------------------------------------------");
        console.log("Roles permitidos:", allowedRoles);
        console.log("Usuario autenticado:", req.user);
        console.log("Roles del usuario:", req.user?.roles);

        if (!req.user || !req.user.roles) {
            console.log("❌ No hay usuario o no tiene roles");
            return res
                .status(403)
                .json({ message: "Permiso denegado - sin roles" });
        }

        const hasPermission = allowedRoles.some((role) =>
            req.user.roles.includes(role),
        );

        console.log("¿Tiene permiso?:", hasPermission);

        if (!hasPermission) {
            console.log("❌ Permiso denegado");
            return res.status(403).json({ message: "Permiso denegado" });
        }

        console.log("✅ Permiso concedido");
        next();
    };
};
