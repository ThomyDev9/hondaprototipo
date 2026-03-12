

import { BaseDAO } from "./BaseDAO.js";
import pool from "../db.js";

export class UserDAO extends BaseDAO {
    constructor() {
        super(pool, "user", "IdUser");
    }

    // Métodos personalizados para usuarios
    async getAllWithWorkgroup() {
        const [rows] = await this.pool.query(
            `SELECT u.*, w.Description, w.Id AS IdWorkgroup FROM user u LEFT JOIN workgroup w ON w.Id = u.UserGroup ORDER BY u.IdUser DESC`
        );
        return rows;
    }

    async getByIdWithWorkgroup(id) {
        const [rows] = await this.pool.query(
            `SELECT u.*, w.Description, w.Id AS IdWorkgroup FROM user u LEFT JOIN workgroup w ON w.Id = u.UserGroup WHERE u.IdUser = ?`,
            [id]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async getByEmail(email) {
        const [rows] = await this.pool.query(
            `SELECT * FROM user WHERE Email = ?`,
            [email]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async search(term) {
        const pattern = `%${term}%`;
        const [rows] = await this.pool.query(
            `SELECT * FROM user WHERE Name1 LIKE ? OR Email LIKE ?`,
            [pattern, pattern]
        );
        return rows;
    }

    async create(userData) {
        const {
            Id,
            Email,
            Password,
            Name1,
            Name2,
            Surname1,
            Surname2,
            Identification,
            ContacAddress,
            Address,
            dateBirth,
            UserGroup
        } = userData;
        const [result] = await this.pool.query(
            `INSERT INTO user (
                Id, Email, Password, Name1, Name2, 
                Surname1, Surname2, Identification, 
                ContacAddress, Address, dateBirth,
                UserGroup, State, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [
                Id,
                Email,
                Password,
                Name1,
                Name2,
                Surname1,
                Surname2,
                Identification,
                ContacAddress,
                Address,
                dateBirth,
                UserGroup
            ]
        );
        return { IdUser: result.insertId, ...userData };
    }

    async update(idUser, userData) {
        const {
            Email,
            Name1,
            Name2,
            Surname1,
            Surname2,
            ContacAddress,
            Address,
            dateBirth,
            UserGroup
        } = userData;
        await this.pool.query(
            `UPDATE user SET Email = ?, Name1 = ?, Name2 = ?, Surname1 = ?, Surname2 = ?, ContacAddress = ?, Address = ?, dateBirth = ?, UserGroup = ? WHERE IdUser = ?`,
            [Email, Name1, Name2, Surname1, Surname2, ContacAddress, Address, dateBirth, UserGroup, idUser]
        );
        return this.getByIdWithWorkgroup(idUser);
    }

    async updateState(idUser) {
        await this.pool.query(
            `UPDATE user SET State = IF(State = 1, 0, 1) WHERE IdUser = ?`,
            [idUser]
        );
        return this.getByIdWithWorkgroup(idUser);
    }

    async updateRole(idUser, newRole) {
        await this.pool.query(
            `UPDATE user SET UserGroup = ? WHERE IdUser = ?`,
            [newRole, idUser]
        );
        return this.getByIdWithWorkgroup(idUser);
    }

    async updatePassword(idUser, newPassword) {
        await this.pool.query(
            `UPDATE user SET Password = ? WHERE IdUser = ?`,
            [newPassword, idUser]
        );
        return this.getByIdWithWorkgroup(idUser);
    }

    async verificarIdentificacion(identification) {
        const [rows] = await this.pool.query(
            `SELECT Identification FROM user WHERE Identification = ? LIMIT 1`,
            [identification]
        );
        return rows.length > 0;
    }

    async verificarCredenciales(idUser) {
        const [rows] = await this.pool.query(
            `SELECT Id, Password FROM user WHERE IdUser = ? LIMIT 1`,
            [idUser]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async createFullUser(userData, connection) {
        // userData debe contener todos los campos requeridos por la tabla user
        // connection es opcional, si no se pasa, usa this.pool
        const executor = connection || this.pool;
        const [result] = await executor.query(
            `INSERT INTO user (
                Id, VCC, extensionIn, extensionOut, Identification, Name1, Name2, Surname1, Surname2, Gender, Country, City, dateBirth, Password, Address, ContacAddress, ContacAddress1, Email, State, UserGroup, UserCreate, TmStmpCreate, UserShift, TmStmpShift
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userData.Id,
                userData.VCC,
                userData.extensionIn,
                userData.extensionOut,
                userData.Identification,
                userData.Name1,
                userData.Name2,
                userData.Surname1,
                userData.Surname2,
                userData.Gender || "",
                userData.Country || "",
                userData.City || "",
                userData.dateBirth || null,
                userData.Password,
                userData.Address || "",
                userData.ContacAddress || "",
                userData.ContacAddress1 || "",
                userData.Email,
                userData.State || 1,
                userData.UserGroup,
                userData.UserCreate || null,
                userData.TmStmpCreate || null,
                userData.UserShift || null,
                userData.TmStmpShift || null
            ]
        );
        return result;
    }

    async getLastInsertedByIdentification(identification, connection) {
        const executor = connection || this.pool;
        const [rows] = await executor.query(
            `SELECT u.*, w.Description, w.Id AS IdWorkgroup FROM user u LEFT JOIN workgroup w ON w.Id = u.UserGroup WHERE u.Identification = ? LIMIT 1`,
            [identification]
        );
        return rows.length > 0 ? rows[0] : null;
    }
}