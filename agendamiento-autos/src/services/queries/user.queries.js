/**
 * USER QUERIES
 *
 * Todas las sentencias SQL relacionadas con usuarios.
 * Organizadas por operación (SELECT, INSERT, UPDATE, DELETE)
 */

const userQueries = {
    // ============= SELECT QUERIES =============

    /**
     * Obtener TODOS los usuarios activos e inactivos
     * Usado en: Listado completo de usuarios del admin
     */
    getAll: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        ORDER BY u.IdUser DESC
    `,

    /**
     * Obtener usuario específico por ID
     * Usado en: Ver detalles, editar, eliminar
     */
    getById: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE u.IdUser = ?
    `,

    /**
     * Verificar si un usuario existe por ID encriptado
     * Usado en: Login, validación
     */
    checkUserExists: `
        SELECT u.IdUser, u.Id, u.State
        FROM user u
        WHERE u.Id = ?
        LIMIT 1
    `,

    /**
     * Obtener usuario por email
     * Usado en: Validaciones, búsquedas
     */
    getByEmail: `
        SELECT 
            u.*,
            w.Description
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE u.Email = ?
        LIMIT 1
    `,

    /**
     * Obtener usuarios por grupo/perfil
     * Usado en: Filtros por rol
     */
    getByRole: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE u.UserGroup = ?
        ORDER BY u.Name1, u.Surname1
    `,

    /**
     * Obtener usuarios activos
     * Usado en: Listados filtrados
     */
    getActive: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE u.State = 1
        ORDER BY u.Name1, u.Surname1
    `,

    /**
     * Obtener usuarios inactivos
     * Usado en: Listados filtrados
     */
    getInactive: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE u.State = 0
        ORDER BY u.Name1, u.Surname1
    `,

    /**
     * Buscar usuarios por nombre, email o identificación
     * Usado en: Búsqueda global
     */
    search: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE 
            u.Name1 LIKE ? OR
            u.Name2 LIKE ? OR
            u.Surname1 LIKE ? OR
            u.Surname2 LIKE ? OR
            u.Email LIKE ? OR
            u.Identification LIKE ?
        ORDER BY u.Name1, u.Surname1
    `,

    /**
     * Obtener perfiles/grupos disponibles
     * Usado en: Seleccionar perfil al crear usuario
     */
    getProfilesAvailable: `
        SELECT 
            Id,
            Description,
            State
        FROM workgroup
        WHERE State = 1
        ORDER BY Description
    `,

    // ============= INSERT QUERIES =============

    /**
     * Crear nuevo usuario
     * Nota: Id debe venir encriptado desde el service
     */
    create: `
        INSERT INTO user (
            Id, Email, Password, Name1, Name2, 
            Surname1, Surname2, Identification, 
            ContacAddress, Address, dateBirth,
            UserGroup, State, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `,

    // ============= UPDATE QUERIES =============

    /**
     * Actualizar datos básicos de usuario
     */
    update: `
        UPDATE user
        SET 
            Email = ?,
            Name1 = ?,
            Name2 = ?,
            Surname1 = ?,
            Surname2 = ?,
            ContacAddress = ?,
            Address = ?,
            dateBirth = ?,
            UserGroup = ?
        WHERE IdUser = ?
    `,

    /**
     * Actualizar solo la contraseña
     */
    updatePassword: `
        UPDATE user
        SET 
            Password = ?
        WHERE IdUser = ?
    `,

    /**
     * Cambiar estado del usuario (activar/desactivar)
     */
    updateState: `
        UPDATE user
        SET 
            State = IF(State = 1, 0, 1)
        WHERE IdUser = ?
    `,

    /**
     * Cambiar perfil/grupo del usuario
     */
    updateRole: `
        UPDATE user
        SET 
            UserGroup = ?
        WHERE IdUser = ?
    `,

    // ============= DELETE QUERIES =============

    /**
     * Eliminar usuario completamente (borrado físico)
     * ⚠️ Usar con cuidado - considera soft delete en su lugar
     */
    delete: `
        DELETE FROM user
        WHERE IdUser = ?
    `,

    /**
     * Obtener credenciales del usuario
     * Usado en: Mostrar usuario y contraseña con clave maestra
     */
    getCredentials: `
    SELECT 
        Id,
        Password
    FROM user
    WHERE IdUser = ?
    LIMIT 1
    `,

    checkIdentificationExists: `
    SELECT Identification
    FROM user
    WHERE Identification = ?
    LIMIT 1
    `,

    /**
     * Obtener último usuario insertado por identificación
     * Usado en: Después de insertar un nuevo usuario
     */
    getLastInsertedByIdentification: `
        SELECT 
            u.*,
            w.Description,
            w.Id AS IdWorkgroup
        FROM user u
        LEFT JOIN workgroup w ON w.Id = u.UserGroup
        WHERE u.Identification = ?
        LIMIT 1
    `,

    createFullUser: `
    INSERT INTO user (
        Id,
        VCC,
        extensionIn,
        extensionOut,
        Identification,
        Name1,
        Name2,
        Surname1,
        Surname2,
        Gender,
        Country,
        City,
        dateBirth,
        Password,
        Address,
        ContacAddress,
        ContacAddress1,
        Email,
        State,
        UserGroup,
        UserCreate,
        TmStmpCreate,
        UserShift,
        TmStmpShift
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
};

export default userQueries;
