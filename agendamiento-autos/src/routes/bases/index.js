// backend/src/routes/bases.routes.js
import express from "express";
import * as basesService from "../../services/bases.service.js";
import {
    uploadCSV,
    handleUploadError,
} from "../../middleware/upload.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

const router = express.Router();

/**
 * GET /bases
 * Lista todas las bases cargadas
 * (ruta real: GET http://localhost:4004/bases)
 */
router.get("/", async (req, res) => {
    try {
        // Usar el servicio en lugar de query directo
        const bases = await basesService.obtenerBases();
        return res.json({ bases });
    } catch (err) {
        console.error("Error listando bases:", err);
        return res.status(500).json({ error: "Error listando bases" });
    }
});

/**
 * POST /bases/upload
 * Carga un archivo CSV con datos de contactos y los importa a la campaña
 * Formato esperado:
 * CODIGO_CAMPANIA;NOMBRE_CAMPANIA;IDENTIFICACION;NOMBRE_CLIENTE;CAMPO1...CAMPO10;TELEFONO_01...TELEFONO_10
 */
router.post(
    "/upload",
    requireAuth,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
    uploadCSV.single("file"),
    handleUploadError,
    async (req, res) => {
        try {
            const {
                campaignId,
                importName,
                importCase = "bancoPichinchaEncuestasGenericas",
                importUser: importUserFromBody,
            } = req.body;
            const file = req.file;
            const importUser =
                importUserFromBody ||
                req.user?.username ||
                req.user?.email ||
                String(req.user?.id || "system");

            // Validar campos requeridos
            if (!file) {
                return res
                    .status(400)
                    .json({ error: "No se recibió archivo CSV" });
            }

            if (!campaignId) {
                return res
                    .status(400)
                    .json({ error: "campaignId es requerido" });
            }

            if (!importName) {
                return res
                    .status(400)
                    .json({ error: "importName es requerido" });
            }

            // Procesar el CSV
            const resultado = await basesService.procesarCSV(
                file.path,
                campaignId,
                importName,
                importUser,
                importCase,
            );

            res.json({
                success: true,
                message: "Archivo CSV importado correctamente",
                data: resultado,
            });
        } catch (err) {
            console.error("Error en /bases/upload:", err);
            res.status(500).json({
                error: err.message || "Error procesando archivo CSV",
            });
        }
    },
);

export default router;
