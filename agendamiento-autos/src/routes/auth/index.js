import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { generarToken } from "../../utils/jwt.js";
import { encriptar, desencriptar } from "../../utils/crypto.js";
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
        const user = await userService.obtenerUsuarioPorEmail(loginId);

        let foundUser = null;

        if (user) {
            foundUser = user;
        } else {
            // If not found by email, try by username (decrypt stored Id values)
            const allUsers = await userService.obtenerUsuarios();

            if (allUsers && allUsers.length > 0) {
                for (const u of allUsers) {
                    try {
                        const decrypted = desencriptar(u.Id);
                        if (decrypted === loginId) {
                            foundUser = u;
                            break;
                        }
                    } catch (err) {
                        // ignore decrypt errors for individual rows
                    }
                }
            }
        }

        if (!foundUser) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        console.log("✓ Usuario encontrado:", foundUser.IdUser, foundUser.Email);
        console.log(
            "Password en BD:",
            foundUser.Password ? "✓ existe" : "✗ NO existe",
        );

        // Desencriptar la contraseña almacenada y comparar directamente
        let passwordDesencriptada;
        try {
            passwordDesencriptada = desencriptar(foundUser.Password);
            console.log("✓ Password desencriptada correctamente");
        } catch (err) {
            console.error("✗ Error desencriptando password:", err.message);
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const isValid = password === passwordDesencriptada;
        console.log(
            "Comparación:",
            password === passwordDesencriptada ? "✓ MATCH" : "✗ NO MATCH",
        );

        if (!isValid) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Buscar rol desde workgroup
        const [roleRows] = await pool.query(
            "SELECT description FROM workgroup WHERE id=?",
            [foundUser.UserGroup],
        );

        const roles = roleRows.map((r) => r.description.toUpperCase());

        // Generar token con roles
        // Decrypt username from Id column if present
        const usernameDecrypted = foundUser.Id
            ? desencriptar(foundUser.Id)
            : null;

        const token = generarToken({
            id: foundUser.IdUser,
            email: foundUser.Email || usernameDecrypted || null,
            roles,
        });

        res.json({
            token,
            user: {
                id: foundUser.IdUser,
                email: foundUser.Email,
                username: usernameDecrypted,
                full_name:
                    `${foundUser.Name1} ${foundUser.Name2 || ""} ${foundUser.Surname1} ${foundUser.Surname2 || ""}`.trim(),
                workgroup_id: foundUser.UserGroup,
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

        const user = await userService.obtenerUsuarioPorId(userId);

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

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
