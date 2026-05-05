import fs from "node:fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startInboundGhostDepurationScheduler } from "./services/inboundGhostDepuration.service.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDataPath(envValue, relativeName) {
    const fromEnv = String(envValue || "").trim();
    if (fromEnv) {
        return fromEnv;
    }

    const candidates = [
        path.join(process.cwd(), relativeName),
        path.join(process.cwd(), "backendCRM", relativeName),
        path.resolve(__dirname, "..", relativeName),
    ];

    const existing = candidates.find((candidate) => fs.existsSync(candidate));
    return existing || candidates[0];
}

const extraCorsOrigins = String(process.env.EXTERNAL_FORM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

const allowedCorsOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://172.19.10.61:5173",
    "http://172.19.10.61:5174",
    "http://172.19.10.61:5175",
    "http://186.5.32.134:8078",
    ...extraCorsOrigins,
];

// CORS para el front (Vite)
app.use(
    cors({
        origin: allowedCorsOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "x-access-token",
            "token",
            "Bearer",
        ],
        exposedHeaders: ["Content-Disposition"],
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
const uploadsPath = resolveDataPath(process.env.UPLOADS_PATH, "uploads");
fs.mkdirSync(uploadsPath, { recursive: true });
app.use("/uploads", express.static(uploadsPath));
const entregaDocumentosPath =
    process.env.ENTREGA_DOCUMENTOS_PATH ||
    path.join(process.cwd(), "entrega_documentos");
const inboundImagesPath =
    process.env.INBOUND_IMAGES_PATH ||
    path.join(process.cwd(), "storage", "inbound-images");
const inboundFilesPath =
    process.env.INBOUND_FILES_PATH ||
    path.join(process.cwd(), "storage", "inbound-archivos");
fs.mkdirSync(entregaDocumentosPath, { recursive: true });
fs.mkdirSync(inboundImagesPath, { recursive: true });
fs.mkdirSync(inboundFilesPath, { recursive: true });
app.use("/entrega_documentos", express.static(entregaDocumentosPath));
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
        startInboundGhostDepurationScheduler();

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
    fs.readdir(uploadsPath, (err, files) => {
        if (err) {
            return res.json([]);
        }
        // Solo archivos PDF
        const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
        res.json(pdfs);
    });
});
start();

export default app;
