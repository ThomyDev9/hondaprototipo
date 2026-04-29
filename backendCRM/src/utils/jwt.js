import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "supersecret";
const TOKEN_EXPIRES_IN = String(process.env.JWT_EXPIRES_IN || "24h").trim();

export function generarToken(user) {
    console.log("[JWT] Usando SECRET:", SECRET);
    console.log("[JWT] Expiracion token:", TOKEN_EXPIRES_IN);
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
            roles: user.roles || [],
        },
        SECRET,
        { expiresIn: TOKEN_EXPIRES_IN },
    );
}

export function verificarToken(token) {
    try {
        console.log("[JWT] Verificando token:", token);
        console.log("[JWT] Usando SECRET:", SECRET);
        return {
            payload: jwt.verify(token, SECRET),
            error: null,
        };
    } catch (err) {
        console.error("Error al verificar token:", err.message);
        return {
            payload: null,
            error: err,
        };
    }
}
