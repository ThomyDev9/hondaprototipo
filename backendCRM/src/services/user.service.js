
import { UserDAO } from "./dao/UserDAO.js";
const userDAO = new UserDAO();

/**
 * USUARIO SERVICE
 * Centraliza lógica de negocio para usuarios
 * Usa sistema de queries centralizado
 */

export async function obtenerUsuarios() {
    try {
        return await userDAO.getAllWithWorkgroup();
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        throw error;
    }
}

export async function obtenerUsuarioPorId(idUser) {
    try {
        return await userDAO.getByIdWithWorkgroup(idUser);
    } catch (error) {
        console.error("Error al obtener usuario por ID:", error);
        throw error;
    }
}

export async function obtenerUsuarioPorEmail(email) {
    try {
        return await userDAO.getByEmail(email);
    } catch (error) {
        console.error("Error al obtener usuario por email:", error);
        throw error;
    }
}

export async function buscarUsuarios(searchTerm) {
    try {
        return await userDAO.search(searchTerm);
    } catch (error) {
        console.error("Error al buscar usuarios:", error);
        throw error;
    }
}

export async function crearUsuario(userData) {
    try {
        return await userDAO.create(userData);
    } catch (error) {
        console.error("Error al crear usuario:", error);
        throw error;
    }
}

export async function actualizarUsuario(idUser, userData) {
    try {
        return await userDAO.update(idUser, userData);
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        throw error;
    }
}

export async function cambiarEstadoUsuario(idUser) {
    try {
        return await userDAO.updateState(idUser);
    } catch (error) {
        console.error("Error al cambiar estado del usuario:", error);
        throw error;
    }
}


export async function cambiarRolUsuario(idUser, newRole) {
    try {
        return await userDAO.updateRole(idUser, newRole);
    } catch (error) {
        console.error("Error al cambiar rol del usuario:", error);
        throw error;
    }
}


export async function cambiarPasswordUsuario(idUser, newPassword) {
    try {
        return await userDAO.updatePassword(idUser, newPassword);
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        throw error;
    }
}

export async function verificarIdentificacion(identification) {
    try {
        return await userDAO.verificarIdentificacion(identification);
    } catch (error) {
        console.error("Error al verificar identificación:", error);
        throw error;
    }
}

export async function verificarCredenciales(idUser) {
    try {
        return await userDAO.verificarCredenciales(idUser);
    } catch (error) {
        console.error("Error al obtener credenciales:", error);
        throw error;
    }
}

export async function obtenerUsuariosPorGrupo(groupId) {
    try {
        return await userDAO.getByGroup(groupId);
    } catch (error) {
        console.error("Error al obtener usuarios por grupo:", error);
        throw error;
    }
}

export async function contarUsuarios() {
    try {
        return await userDAO.countAll();
    } catch (error) {
        console.error("Error al contar usuarios:", error);
        throw error;
    }
}

export async function obtenerUsuariosActivos() {
    try {
        return await userDAO.getActive();
    } catch (error) {
        console.error("Error al obtener usuarios activos:", error);
        throw error;
    }
}
