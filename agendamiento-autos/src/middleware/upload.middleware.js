import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Crear carpeta de uploads si no existe
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${now.getTime()}`;
        const filename = `${timestamp}_${file.originalname}`;
        cb(null, filename);
    },
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
    // Solo permitir CSV
    if (
        file.originalname.toLowerCase().endsWith(".csv") ||
        file.mimetype === "text/csv"
    ) {
        cb(null, true);
    } else {
        cb(new Error("Solo se permiten archivos CSV"), false);
    }
};

// Configuración de multer
export const uploadCSV = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB máximo
    },
});

// Middleware para manejar errores de upload
export const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "FILE_TOO_LARGE") {
            return res
                .status(400)
                .json({ error: "Archivo muy grande (máximo 50MB)" });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

export default uploadCSV;
