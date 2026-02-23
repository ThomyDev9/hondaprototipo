import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import userQueries from "../../services/queries/user.queries.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
    encriptar,
    desencriptar,
    generarPassword,
} from "../../utils/crypto.js";
import { generarUsuarioSeguro } from "../../utils/userGenerator.js";

const router = express.Router();

/* =========================================================
   GET /admin/users  → Listar usuarios con campo "usuario"
   ========================================================= */
router.get(
    "/",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            // Usar el servicio para obtener todos los usuarios
            const allUsers = await userService.obtenerUsuarios();

            const formatearUsuario = (u) => ({
                IdUser: u.IdUser,
                Usuario: desencriptar(u.Id),
                Identificacion: u.Identification,
                Nombres: [u.Name1, u.Name2, u.Surname1, u.Surname2]
                    .filter(Boolean)
                    .join(" ")
                    .toUpperCase(),
                Email: u.Email || "",
                Address: u.Address || "",
                dateBirth: u.dateBirth
                    ? u.dateBirth.toISOString().slice(0, 10)
                    : "",
                Celular: u.ContacAddress || "",
                Perfil: u.Description || "",
                Estado: u.State == 1 ? "ACTIVO" : "INACTIVO",
                UserGroup: u.IdWorkgroup || "",
            });

            const activos = [];
            const inactivos = [];

            allUsers.forEach((u) => {
                const usuario = formatearUsuario(u);

                if (u.State == 1) {
                    activos.push(usuario);
                } else {
                    inactivos.push(usuario);
                }
            });

            res.json({
                activos,
                inactivos,
            });
        } catch (err) {
            console.error("Error listando usuarios:", err);
            res.status(500).json({
                error: "Error listando usuarios",
            });
        }
    },
);

/* =========================================================
   POST /admin/users  → Crear usuario
   ========================================================= */
router.post(
    "/",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const user = await createUser(req.body);
            res.json(user);
        } catch (err) {
            console.error("Error creando usuario:", err);
            if (err.message === "USER_EXISTS") {
                return res.status(400).json({
                    error: "El usuario ya existe",
                });
            }
            res.status(500).json({
                error: "Error creando usuario",
            });
        }
    },
);

export async function createUser(data) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            Identification,
            Name1,
            Name2,
            Surname1,
            Surname2,
            dateBirth,
            Address,
            ContacAddress,
            ContacAddress1,
            Email,
            extensionIn,
            extensionOut,
            UserGroup,
        } = data;

        const extIn = Number(extensionIn) || 0;
        const extOut = Number(extensionOut) || 0;

        // ✅ verificar duplicado
        const [exists] = await connection.query(
            userQueries.checkIdentificationExists,
            [Identification],
        );

        if (exists.length) throw new Error("USER_EXISTS");

        const username = await generarUsuarioSeguro(
            Name1,
            Surname1,
            connection,
        );

        const passwordPlain = generarPassword();

        const IdEncrypt = encriptar(username);
        const PasswordEncrypt = encriptar(passwordPlain);

        const fechaActual = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

        await connection.query(userQueries.createFullUser, [
            IdEncrypt,
            "1",
            extIn,
            extOut,
            Identification,
            Name1,
            Name2 || "",
            Surname1,
            Surname2 || "",
            "",
            "",
            "",
            dateBirth || null,
            PasswordEncrypt,
            Address || "",
            ContacAddress || "",
            ContacAddress1 || "",
            Email,
            1,
            UserGroup,
            null,
            fechaActual,
            null,
            null,
        ]);

        const [rows] = await connection.query(
            userQueries.getLastInsertedByIdentification,
            [Identification],
        );

        await connection.commit();

        const inserted = rows[0];

        return {
            usuario: username,
            password: passwordPlain,
            created: {
                IdUser: inserted.IdUser,
                Usuario: desencriptar(inserted.Id),
                Identification: inserted.Identification,
                Email: inserted.Email,
                ContacAddress: inserted.ContacAddress,
                UserGroup: inserted.UserGroup,
                State: inserted.State,
            },
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
/* =========================================================
   PUT /admin/users/:id  → Editar usuario
   ========================================================= */
router.put(
    "/:id",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        const { id } = req.params;
        const {
            Name1,
            Name2,
            Surname1,
            Surname2,
            dateBirth,
            Address,
            ContacAddress,
            Email,
            UserGroup,
        } = req.body;

        try {
            const updatedUser = await userService.actualizarUsuario(id, {
                Email,
                Name1,
                Name2: Name2 || null,
                Surname1,
                Surname2: Surname2 || null,
                ContacAddress: ContacAddress || "",
                Address: Address || "",
                dateBirth: dateBirth || null,
                UserGroup,
            });

            res.json({
                message: "Usuario actualizado correctamente",
                user: updatedUser,
            });
        } catch (err) {
            console.error("Error actualizando usuario:", err);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },
);

/* =========================================================
   DELETE /admin/users/:id  → Cambiar estado del usuario (activo/inactivo)
   ========================================================= */
router.delete(
    "/:id",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        const { id } = req.params;

        try {
            const updatedUser = await userService.cambiarEstadoUsuario(id);
            res.json({
                message: "Estado del usuario cambiado correctamente",
                user: updatedUser,
            });
        } catch (err) {
            console.error("Error cambiando estado del usuario:", err);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },
);

// POST /admin/users/:id/credentials → Mostrar usuario y contraseña con clave maestra
router.post(
    "/:id/credentials",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        const { id } = req.params;
        const { masterKey } = req.body;

        try {
            if (masterKey !== "KMB$221133") {
                return res
                    .status(403)
                    .json({ error: "Clave maestra incorrecta" });
            }

            const user = await userService.verificarCredenciales(id);

            if (!user) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }

            const username = desencriptar(user.Id); // Usuario generado
            const password = desencriptar(user.Password); // Contraseña original

            res.json({ username, password });
        } catch (err) {
            console.error("Error obteniendo credenciales:", err);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },
);

export default router;
