import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "supersecret";

export function generarToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, roles: user.roles || [] },
        SECRET,
        { expiresIn: "8h" },
    );
}

export function verificarToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch (err) {
        return null;
    }
}
