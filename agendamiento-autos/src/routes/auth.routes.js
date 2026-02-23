import express from "express";
import pool from "../services/db.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { generarToken } from "../utils/jwt.js";
import { encriptar, desencriptar } from "../utils/crypto.js";
import bcrypt from "bcrypt";

const router = express.Router();

/**
 * POST /auth/login
 */
router.post("/login", async (req, res) => {
    // accept either username or email from the frontend
    const { username, email, password } = req.body;

    try {
        const loginId = username || email;

        if (!loginId || !password) {
            return res
                .status(400)
                .json({ error: "Usuario (o email) y password son requeridos" });
        }

        // First try matching by email
        const [emailRows] = await pool.query(
            "SELECT IdUser, Id, Email, Name1, Name2, Surname1, Surname2, password, UserGroup FROM user WHERE Email=?",
            [loginId],
        );

        let user = null;

        if (emailRows && emailRows.length > 0) {
            user = emailRows[0];
        } else {
            // If not found by email, try decrypting stored Id values to match username
            const [idRows] = await pool.query(
                "SELECT IdUser, Id, Email, Name1, Name2, Surname1, Surname2, password, UserGroup FROM user WHERE Id IS NOT NULL",
            );

            if (idRows && idRows.length > 0) {
                for (const r of idRows) {
                    try {
                        const decrypted = desencriptar(r.Id);
                        if (decrypted === loginId) {
                            user = r;
                            break;
                        }
                    } catch (err) {
                        // ignore decrypt errors for individual rows
                    }
                }
            }
        }

        if (!user) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Buscar rol desde workgroup
        const [roleRows] = await pool.query(
            "SELECT description FROM workgroup WHERE id=?",
            [user.UserGroup],
        );

        const roles = roleRows.map((r) => r.description.toUpperCase());

        // Generar token con roles
        // Decrypt username from Id column if present
        const usernameDecrypted = user.Id ? desencriptar(user.Id) : null;

        const token = generarToken({
            id: user.IdUser,
            email: user.Email || usernameDecrypted || null,
            roles,
        });

        res.json({
            token,
            user: {
                id: user.IdUser,
                email: user.Email,
                username: usernameDecrypted,
                full_name:
                    `${user.Name1} ${user.Name2 || ""} ${user.Surname1} ${user.Surname2 || ""}`.trim(),
                workgroup_id: user.UserGroup,
            },
        });
    } catch (err) {
        console.error("ERROR EN /auth/login:", err);
        res.status(500).json({ error: "Error interno en login" });
    }
});

/**
 * GET /auth/me
 */
router.get("/me", requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res
                .status(401)
                .json({ error: "No se encontró el usuario en el token" });
        }

        const [userRows] = await pool.query(
            "SELECT IdUser, Email, Name1, Name2, Surname1, Surname2, UserGroup FROM user WHERE IdUser=?",
            [userId],
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const user = userRows[0];

        const [roleRows] = await pool.query(
            "SELECT description AS role FROM workgroup WHERE id=?",
            [user.UserGroup],
        );

        const roles = roleRows.map((r) => r.role.toUpperCase());

        res.json({
            user: {
                id: user.IdUser, // ✅ corregido
                email: user.Email,
                full_name:
                    `${user.Name1} ${user.Name2 || ""} ${user.Surname1} ${user.Surname2 || ""}`.trim(),
                roles,
            },
        });
    } catch (err) {
        console.error("ERROR EN /auth/me:", err);
        res.status(500).json({ error: "Error interno en /auth/me" });
    }
});

export default router;
