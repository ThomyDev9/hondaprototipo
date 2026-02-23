import express from "express";
import pool from "../services/db.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { encriptar, desencriptar, generarPassword } from "../utils/crypto.js";
import { generarUsuarioSeguro } from "../utils/userGenerator.js";

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
            const [rows] = await pool.query(`
                SELECT 
                    u.*,
                    w.Description,
                    w.Id AS IdWorkgroup
                FROM user u
                LEFT JOIN workgroup w 
                    ON w.Id = u.UserGroup
                ORDER BY u.IdUser DESC
            `);

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

            rows.forEach((u) => {
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
        const connection = await pool.getConnection();

        try {
            console.log("POST /admin/users payload:", req.body);
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
            } = req.body;

            // ✅ valores por defecto
            const extIn = Number(extensionIn) || 0;
            const extOut = Number(extensionOut) || 0;

            if (!Identification || !Name1 || !Surname1 || !Email) {
                return res.status(400).json({
                    error: "Faltan campos obligatorios",
                });
            }

            // ✅ evitar duplicado por identificación
            const [exists] = await connection.query(
                "SELECT Identification FROM user WHERE Identification=?",
                [Identification],
            );

            if (exists.length > 0) {
                return res.status(400).json({
                    error: "Usuario ya existe con esa identificación",
                });
            }

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

            await connection.query(
                `INSERT INTO user
                (Id,VCC,extensionIn,extensionOut,
                Identification,Name1,Name2,Surname1,Surname2,
                Gender,Country,City,dateBirth,
                Password,Address,ContacAddress,ContacAddress1,
                Email,State,UserGroup,
                UserCreate,TmStmpCreate,UserShift,TmStmpShift)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
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
                ],
            );

            await connection.commit();

            // fetch the inserted row to return useful info (decrypt Id -> Usuario)
            const [newRows] = await connection.query(
                `SELECT IdUser, Id, Identification, Email, ContacAddress, UserGroup, State
                 FROM user
                 WHERE Identification = ?
                 ORDER BY IdUser DESC
                 LIMIT 1`,
                [Identification],
            );

            const inserted = newRows && newRows.length ? newRows[0] : null;

            const created = inserted
                ? {
                      IdUser: inserted.IdUser,
                      Usuario: desencriptar(inserted.Id),
                      Identification: inserted.Identification,
                      Email: inserted.Email,
                      ContacAddress: inserted.ContacAddress,
                      UserGroup: inserted.UserGroup,
                      State: inserted.State,
                  }
                : null;

            await connection.commit();

            res.json({
                message: "✅ Usuario creado correctamente",
                usuario: username,
                password: passwordPlain,
                created,
            });
        } catch (error) {
            await connection.rollback();

            console.error("🔥 ERROR SQL:", error);

            res.status(500).json({
                error: "Error creando usuario",
            });
        } finally {
            connection.release();
        }
    },
);

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
            await pool.query(
                `UPDATE user
                SET Name1=?, Name2=?, Surname1=?, Surname2=?, dateBirth=?, Address=?, ContacAddress1=?, Email=?, UserGroup=?
                WHERE IdUser=?`,
                [
                    Name1,
                    Name2 || null,
                    Surname1,
                    Surname2 || null,
                    dateBirth || null,
                    Address || "",
                    ContacAddress || "",
                    Email,
                    UserGroup,
                    id,
                ],
            );

            res.json({ message: "Usuario actualizado correctamente" });
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
            // Cambiar estado: si está activo (1) → inactivo (0), si está inactivo (0) → activo (1)
            await pool.query(
                `UPDATE user SET State = IF(State = 1, 0, 1) WHERE IdUser = ?`,
                [id],
            );
            res.json({ message: "Estado del usuario cambiado correctamente" });
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

            const [rows] = await pool.query(
                "SELECT Id, Password FROM user WHERE IdUser=?",
                [id],
            );

            if (!rows.length) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }

            const user = rows[0];
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
