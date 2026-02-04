// backend/src/routes/auth.routes.js
import express from "express";
import pool from "../services/db.js"; // conexión a Postgres
import { requireAuth } from "../middleware/auth.middleware.js";
import { generarToken } from "../utils/jwt.js"; // utilidades JWT
import bcrypt from "bcrypt";

const router = express.Router();

/**
 * POST /auth/login
 * Valida credenciales contra la tabla users y devuelve token + usuario
 */
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT id, email, full_name, password, is_active, bloqueado FROM user_profiles WHERE email=$1",
            [email],
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const user = result.rows[0];

        // 🔐 comparar password plano vs hash
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // opcional: bloquear usuarios
        if (user.bloqueado) {
            return res.status(403).json({ error: "Usuario bloqueado" });
        }

        const token = generarToken({
            id: user.id,
            email: user.email,
        });

        // nunca mandes el password al frontend
        delete user.password;

        res.json({ token, user });
    } catch (err) {
        console.error("Error en /auth/login:", err);
        res.status(500).json({ error: "Error interno en login" });
    }
});

/**
 * GET /auth/me
 * Devuelve el usuario logueado + roles desde la base
 */
router.get("/me", requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res
                .status(401)
                .json({ error: "No se encontró el usuario en el token" });
        }

        const result = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.is_active, u.bloqueado,
              array_agg(r.code) AS roles
       FROM user_profiles u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id=$1
       GROUP BY u.id`,
            [userId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const profile = result.rows[0];

        return res.json({
            user: {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                roles: profile.roles.filter(Boolean),
                is_active: profile.is_active ?? true,
                bloqueado: profile.bloqueado ?? false,
            },
        });
    } catch (err) {
        console.error("Error general en /auth/me:", err);
        return res.status(500).json({ error: "Error interno en /auth/me" });
    }
});

export default router;
