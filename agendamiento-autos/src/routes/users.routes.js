// backend/src/routes/admin.users.routes.js
import express from "express";
import pool from "../services/db.js"; // conexión a Postgres
import { requireAuth } from "../middleware/auth.middleware.js";
import { loadUserRoles, requireRole } from "../middleware/role.middleware.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/* =========================================================
   GET /admin/users  → Listar usuarios
   ========================================================= */
router.get(
    "/",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMIN"]),
    async (req, res) => {
        try {
            const result = await pool.query(`
        SELECT u.id, u.full_name, u.email, u.is_active, u.bloqueado,
               u.estado_operativo, u.created_at,
               json_agg(json_build_object('role_id', ur.role_id, 'code', r.code, 'name', r.name)) AS user_roles
        FROM user_profiles u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

            res.json({ users: result.rows });
        } catch (err) {
            console.error("Error listando usuarios:", err);
            res.status(500).json({ error: "Error listando usuarios" });
        }
    },
);

/* =========================================================
   POST /admin/users  → Crear usuario
   ========================================================= */
router.post(
    "/",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMIN"]),
    async (req, res) => {
        const { full_name, email, password, role_code } = req.body;

        if (!full_name || !email || !password || !role_code) {
            return res
                .status(400)
                .json({ error: "Faltan campos obligatorios" });
        }

        try {
            // 1. Hashear contraseña
            const hashedPassword = await bcrypt.hash(password, 10);
            const newId = uuidv4();

            // 2. Crear usuario en auth.users
            await pool.query(
                `INSERT INTO auth.users (id, email, encrypted_password, created_at)
         VALUES ($1, $2, $3, NOW())`,
                [newId, email, hashedPassword],
            );

            // 3. Crear perfil en user_profiles
            await pool.query(
                `INSERT INTO user_profiles (id, full_name, email, password, is_active, estado_operativo, bloqueado, created_at)
         VALUES ($1, $2, $3, $4, true, 'disponible', false, NOW())`,
                [newId, full_name, email, hashedPassword],
            );

            // 4. Buscar id del rol
            const roleResult = await pool.query(
                `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
                [role_code],
            );

            if (roleResult.rows.length === 0) {
                return res
                    .status(400)
                    .json({ error: `Rol inválido: ${role_code}` });
            }

            const roleId = roleResult.rows[0].id;

            // 5. Asignar rol al usuario
            await pool.query(
                `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
                [newId, roleId],
            );

            res.json({
                message: "Usuario creado correctamente",
                user_id: newId,
            });
        } catch (err) {
            console.error("Error creando usuario:", err);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },
);

/* =========================================================
   PUT /admin/users/:id  → Editar usuario
   ========================================================= */
router.put(
    "/:id",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMIN"]),
    async (req, res) => {
        const { id } = req.params;
        const { full_name, email, bloqueado, estado_operativo, role_code } =
            req.body;

        try {
            // 1. Actualizar datos básicos del perfil
            await pool.query(
                `UPDATE user_profiles
         SET full_name = $1, email = $2, bloqueado = $3, estado_operativo = $4
         WHERE id = $5`,
                [full_name, email, bloqueado, estado_operativo, id],
            );

            // 2. Actualizar rol (si viene role_code)
            if (role_code) {
                const roleResult = await pool.query(
                    `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
                    [role_code],
                );

                if (roleResult.rows.length === 0) {
                    return res.status(400).json({ error: "Rol inválido" });
                }

                const roleId = roleResult.rows[0].id;

                // Borrar roles anteriores
                await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [
                    id,
                ]);

                // Asignar nuevo rol
                await pool.query(
                    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
                    [id, roleId],
                );
            }

            res.json({ message: "Usuario actualizado correctamente" });
        } catch (err) {
            console.error("Error actualizando usuario:", err);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },
);

/* =========================================================
   DELETE /admin/users/:id  → Desactivar usuario (soft delete)
   ========================================================= */
router.delete(
    "/:id",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMIN"]),
    async (req, res) => {
        const { id } = req.params;

        try {
            await pool.query(
                `UPDATE user_profiles SET is_active = false WHERE id = $1`,
                [id],
            );

            res.json({ message: "Usuario desactivado" });
        } catch (err) {
            console.error("Error desactivando usuario:", err);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },
);

export default router;
