import { verificarToken } from "../utils/jwt.js";

export const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = authHeader.slice(7);
        const { payload, error } = verificarToken(token);
        if (!payload) {
            console.error("[AUTH] Token invalido recibido:", token);
        }

        if (!payload) {
            const isExpired = error?.name === "TokenExpiredError";
            return res.status(401).json({
                error: isExpired ? "Token expired" : "Invalid token",
                code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
            });
        }

        // Usuario autenticado
        req.user = payload;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ error: "Auth middleware error" });
    }
};

// Compatibilidad con codigo antiguo
export const authMiddleware = requireAuth;
