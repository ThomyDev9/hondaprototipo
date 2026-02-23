import pool from "./db.js";
import userQueries from "./queries/user.queries.js";

/**
 * USUARIO SERVICE
 * Centraliza lógica de negocio para usuarios
 * Usa sistema de queries centralizado
 */

export async function obtenerUsuarios() {
    try {
        const [rows] = await pool.query(userQueries.getAll);
        return rows;
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        throw error;
    }
}

export async function obtenerUsuarioPorId(idUser) {
    try {
        const [rows] = await pool.query(userQueries.getById, [idUser]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error al obtener usuario por ID:", error);
        throw error;
    }
}

export async function obtenerUsuarioPorEmail(email) {
    try {
        const [rows] = await pool.query(userQueries.getByEmail, [email]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error al obtener usuario por email:", error);
        throw error;
    }
}

export async function buscarUsuarios(searchTerm) {
    try {
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await pool.query(userQueries.search, [
            searchPattern,
            searchPattern,
        ]);
        return rows;
    } catch (error) {
        console.error("Error al buscar usuarios:", error);
        throw error;
    }
}

export async function crearUsuario(userData) {
    try {
        const {
            Id,
            Email,
            Identification,
            Name1,
            Name2,
            Surname1,
            Surname2,
            password,
            ContacAddress,
            UserGroup,
            State,
        } = userData;

        const [result] = await pool.query(userQueries.create, [
            Id,
            Email,
            Identification,
            Name1,
            Name2,
            Surname1,
            Surname2,
            password,
            ContacAddress,
            UserGroup,
            State,
        ]);

        return {
            IdUser: result.insertId,
            Id,
            Email,
            Identification,
            Name1,
            Name2,
            Surname1,
            Surname2,
            ContacAddress,
            UserGroup,
            State,
        };
    } catch (error) {
        console.error("Error al crear usuario:", error);
        throw error;
    }
}

export async function actualizarUsuario(idUser, userData) {
    try {
        const {
            Email,
            Name1,
            Name2,
            Surname1,
            Surname2,
            ContacAddress,
            Address,
            dateBirth,
            UserGroup,
        } = userData;

        await pool.query(userQueries.update, [
            Email,
            Name1,
            Name2,
            Surname1,
            Surname2,
            ContacAddress,
            Address,
            dateBirth,
            UserGroup,
            idUser,
        ]);

        return await obtenerUsuarioPorId(idUser);
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        throw error;
    }
}

export async function cambiarEstadoUsuario(idUser) {
    try {
        await pool.query(userQueries.updateState, [idUser]);
        return await obtenerUsuarioPorId(idUser);
    } catch (error) {
        console.error("Error al cambiar estado del usuario:", error);
        throw error;
    }
}

export async function cambiarRolUsuario(idUser, newRole) {
    try {
        await pool.query(userQueries.updateRole, [newRole, idUser]);
        return await obtenerUsuarioPorId(idUser);
    } catch (error) {
        console.error("Error al cambiar rol del usuario:", error);
        throw error;
    }
}

export async function cambiarPasswordUsuario(idUser, newPassword) {
    try {
        await pool.query(userQueries.updatePassword, [newPassword, idUser]);
        return await obtenerUsuarioPorId(idUser);
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        throw error;
    }
}

export async function verificarIdentificacion(identification) {
    try {
        const [rows] = await pool.query(userQueries.checkIdentificationExists, [
            identification,
        ]);
        return rows.length > 0;
    } catch (error) {
        console.error("Error al verificar identificación:", error);
        throw error;
    }
}

export async function verificarCredenciales(idUser) {
    try {
        const [rows] = await pool.query(userQueries.getCredentials, [idUser]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error al obtener credenciales:", error);
        throw error;
    }
}

export async function obtenerUsuariosPorGrupo(groupId) {
    try {
        const [rows] = await pool.query(userQueries.getByGroup, [groupId]);
        return rows;
    } catch (error) {
        console.error("Error al obtener usuarios por grupo:", error);
        throw error;
    }
}

export async function contarUsuarios() {
    try {
        const [rows] = await pool.query(userQueries.count);
        return rows[0].total || 0;
    } catch (error) {
        console.error("Error al contar usuarios:", error);
        throw error;
    }
}

export async function obtenerUsuariosActivos() {
    try {
        const [rows] = await pool.query(userQueries.getActive);
        return rows;
    } catch (error) {
        console.error("Error al obtener usuarios activos:", error);
        throw error;
    }
}
