import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "supersecret";

export function generarToken(user) {
    console.log("[JWT] Usando SECRET:", SECRET);
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
            roles: user.roles || [],
        },
        SECRET,
        { expiresIn: "8h" },
    );
}

export function verificarToken(token) {
    try {
        console.log("[JWT] Verificando token:", token);
        console.log("[JWT] Usando SECRET:", SECRET);
        return jwt.verify(token, SECRET);
    } catch (err) {
        console.error("Error al verificar token:", err.message);
        return null;
    }
}
