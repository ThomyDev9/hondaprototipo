import { verificarToken } from "../utils/jwt.js";

export const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = authHeader.slice(7);
        const payload = verificarToken(token);

        if (!payload) {
            return res.status(401).json({ error: "Invalid token" });
        }

        // Usuario autenticado
        req.user = payload;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ error: "Auth middleware error" });
    }
};

// Compatibilidad con código antiguo
export const authMiddleware = requireAuth;
