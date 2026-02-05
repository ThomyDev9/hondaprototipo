import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import adminDashboardRoutes from "./routes/admin.dashboard.routes.js";
import adminBasesRoutes from "./routes/admin.bases.routes.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import basesRoutes from "./routes/bases.routes.js";
import agenteRoutes from "./routes/agente.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminReportesRoutes from "./routes/admin.reportes.routes.js";
import supervisorRoutes from "./routes/supervisor.routes.js";

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

// Rutas de autenticación
app.use("/auth", authRoutes);

// Rutas de usuarios (solo accesibles por admin)
app.use("/admin/users", usersRoutes);

// Rutas de bases
app.use("/bases", basesRoutes);

// Rutas de agente
app.use("/agente", agenteRoutes);

// Rutas de admin clásicas
app.use("/admin", adminRoutes);

// Dashboard admin y parámetros
app.use("/admin", adminDashboardRoutes);
app.use("/admin", adminBasesRoutes);
app.use("/admin/reportes", adminReportesRoutes);

// Rutas de supervisor
app.use("/supervisor", supervisorRoutes);

const PORT = process.env.PORT || 4004;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 API escuchando en 0.0.0.0:${PORT}`);
});

export default app;
