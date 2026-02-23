import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes/index.js";

dotenv.config();

const app = express();

// CORS para el front (Vite)
app.use(
    cors({
        origin: ["http://localhost:5173", "http://172.19.10.61:5173"],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);

// 🔴 MUY IMPORTANTE
app.options("*", cors());

// Para poder leer JSON en req.body
app.use(express.json());

// Healthcheck
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "API agendamiento autos funcionando",
    });
});

// Iniciar servidor y registrar rutas
async function start() {
    try {
        // Registrar todas las rutas desde el registro centralizado
        await registerRoutes(app);

        const PORT = process.env.PORT || 4004;
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`🚀 API escuchando en 0.0.0.0:${PORT}`);
        });
    } catch (err) {
        console.error("❌ Error iniciando servidor:", err);
        process.exit(1);
    }
}

start();

export default app;
