import fs from "node:fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes/index.js";
import path from "node:path";

dotenv.config();

const app = express();

// CORS para el front (Vite)
app.use(
    cors({
        origin: ["http://localhost:5173", "http://172.19.10.61:5173"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);

// 🔴 MUY IMPORTANTE
app.options("*", cors());

// Para poder leer JSON en req.body
app.use(express.json());

// Servir archivos de grabaciones desde una ruta local configurable
const recordingsPath =
    process.env.RECORDINGS_PATH || path.join(process.cwd(), "grabaciones");
app.use("/grabaciones", express.static(recordingsPath));
// Servir archivos PDF desde /uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
const inboundImagesPath =
    process.env.INBOUND_IMAGES_PATH ||
    path.join(process.cwd(), "storage", "inbound-images");
const inboundFilesPath =
    process.env.INBOUND_FILES_PATH ||
    path.join(process.cwd(), "storage", "inbound-archivos");
fs.mkdirSync(inboundImagesPath, { recursive: true });
fs.mkdirSync(inboundFilesPath, { recursive: true });
app.use("/inbound-images", express.static(inboundImagesPath));
app.use("/inbound-archivos", express.static(inboundFilesPath));

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
// Endpoint para listar archivos PDF en uploads
app.get("/uploads-list", (req, res) => {
    const uploadsDir = path.join(process.cwd(), "uploads");
    fs.readdir(uploadsDir, (err, files) => {
        if (err)
            return res.status(500).json({ error: "No se pudo leer uploads" });
        // Solo archivos PDF
        const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
        res.json(pdfs);
    });
});
start();

export default app;
