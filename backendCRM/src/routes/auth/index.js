import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { generarToken } from "../../utils/jwt.js";
import { desencriptar } from "../../utils/crypto.js";

const router = express.Router();

/**
 * Helper: Finds user by username (decrypt stored Id values)
 */
async function findUserByUsername(loginId) {
    const allUsers = await userService.obtenerUsuarios();

    if (!allUsers || allUsers.length === 0) {
        return null;
    }

    for (const u of allUsers) {
        let decrypted;
        try {
            decrypted = desencriptar(u.Id);
        } catch (err) {
            // Some users may have invalid encrypted values, skip them
            console.error(
                "Could not decrypt Id for user:",
                u.IdUser,
                err.message,
            );
            continue;
        }

        if (decrypted === loginId) {
            return u;
        }
    }

    return null;
}

/**
 * Helper: Finds user by email or username, then validates password
 */
async function findUserByCredentials(loginId, password) {
    // Try matching by email first
    let foundUser = await userService.obtenerUsuarioPorEmail(loginId);

    // If not found, try by username
    if (!foundUser) {
        foundUser = await findUserByUsername(loginId);
    }

    if (!foundUser) {
        return null;
    }

    console.log("✓ Usuario encontrado:", foundUser.IdUser, foundUser.Email);
    console.log(
        "Password en BD:",
        foundUser.Password ? "✓ existe" : "✗ NO existe",
    );

    // Decrypt and validate password
    let passwordDesencriptada;
    try {
        passwordDesencriptada = desencriptar(foundUser.Password);
        console.log("✓ Password desencriptada correctamente");
    } catch (err) {
        console.error("✗ Error desencriptando password:", err.message);
        return null;
    }

    const isValid = password === passwordDesencriptada;
    console.log("Comparación:", isValid ? "✓ MATCH" : "✗ NO MATCH");

    return isValid ? foundUser : null;
}

/**
 * Helper: Gets user roles from workgroup
 */
async function getUserRoles(userGroupId) {
    const [roleRows] = await pool.query(
        "SELECT description FROM workgroup WHERE id=?",
        [userGroupId],
    );

    return roleRows.map((r) => r.description.toUpperCase());
}

/**
 * Helper: Builds auth token response
 */
function buildAuthToken(foundUser, roles) {
    const usernameDecrypted = foundUser.Id ? desencriptar(foundUser.Id) : null;

    const token = generarToken({
        id: foundUser.IdUser,
        email: foundUser.Email || usernameDecrypted || null,
        username: usernameDecrypted,
        roles,
    });

    return {
        token,
        user: {
            id: foundUser.IdUser,
            email: foundUser.Email,
            username: usernameDecrypted,
            full_name:
                `${foundUser.Name1} ${foundUser.Name2 || ""} ${foundUser.Surname1} ${foundUser.Surname2 || ""}`.trim(),
            workgroup_id: foundUser.UserGroup,
        },
    };
}

async function markUserAsActive(foundUser) {
    const actor =
        foundUser.Email ||
        (foundUser.Id ? desencriptar(foundUser.Id) : null) ||
        String(foundUser.IdUser);

    const [byIdUser] = await pool.query(
        `UPDATE user
         SET State = '1',
             UserShift = ?,
             TmStmpShift = NOW()
         WHERE IdUser = ?`,
        [actor, foundUser.IdUser],
    );

    if (byIdUser.affectedRows > 0) {
        return;
    }

    await pool.query(
        `UPDATE user
         SET State = '1',
             UserShift = ?,
             TmStmpShift = NOW()
         WHERE Id = ?`,
        [actor, foundUser.Id],
    );
}

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

        const foundUser = await findUserByCredentials(loginId, password);

        if (!foundUser) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        await markUserAsActive(foundUser);

        const roles = await getUserRoles(foundUser.UserGroup);
        const authResponse = buildAuthToken(foundUser, roles);

        res.json(authResponse);
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
                username: req.user?.username || null,
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
