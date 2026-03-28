// backend/src/routes/bases.routes.js
import express from "express";
import * as basesService from "../../services/bases.service.js";
import {
    uploadCSV,
    handleUploadError,
} from "../../middleware/upload.middleware.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import pool from "../../services/db.js";
import { loadUserRoles } from "../../middleware/role.middleware.js";

const router = express.Router();
const adminMiddlewares = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

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

// Obtener cuántos registros son reciclables en una base específica
router.get(
    "/:campaignId/:importId/reciclables-count",
    requireAuth,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
    async (req, res) => {
        try {
            const { campaignId, importId } = req.params;

            if (!campaignId || !importId) {
                return res
                    .status(400)
                    .json({ error: "Faltan parametros campaignId o importId" });
            }

            const reciclables = await basesService.obtenerCantidadReciclables(
                campaignId,
                importId,
            );

            return res.json({ reciclables });
        } catch (err) {
            console.error("Error obteniendo cantidad de reciclables:", err);
            return res.status(500).json({
                error: "Error obteniendo cantidad de reciclables",
            });
        }
    },
);
// Resumen de todas las bases activas para DashboardAdmin (solo ADMINISTRADOR)
router.get(
    "/bases-activas-resumen",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { campaignId, importId } = req.query;
            const data = await basesService.obtenerBasesActivasResumen({
                campaignId: String(campaignId || "").trim(),
                importId: String(importId || "").trim(),
            });
            res.json({ data });
        } catch (err) {
            console.error("Error en /bases/bases-activas-resumen:", err);
            res.status(500).json({
                error: "Error cargando resumen de bases activas",
            });
        }
    },
);
// Resumen de todas las bases inactivas para DashboardAdmin (solo ADMINISTRADOR)
router.get(
    "/bases-inactivas-resumen",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { campaignId, importId } = req.query;
            const data = await basesService.obtenerBasesInactivasResumen({
                campaignId: String(campaignId || "").trim(),
                importId: String(importId || "").trim(),
            });
            res.json({ data });
        } catch (err) {
            console.error("Error en /bases/bases-inactivas-resumen:", err);
            res.status(500).json({
                error: "Error cargando resumen de bases inactivas",
            });
        }
    },
);
// Resumen de bases para DashboardAdmin
router.get(
    "/bases-resumen",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const resumen = await basesService.obtenerResumenBases();
            res.json({ resumen });
        } catch (err) {
            console.error("Error obteniendo resumen de bases:", err);
            res.status(500).json({
                error: "Error obteniendo resumen de bases",
            });
        }
    },
);

/**
 * POST /bases/:baseId/reciclar
 * Recicla contactos de campaña en cck_dev.
 */
router.post("/:baseId/reciclar", ...adminMiddlewares, async (req, res) => {
    try {
        const { baseId } = req.params;
        const importId = String(req.body?.importId || "").trim();
        const campaignId = baseId;

        if (!campaignId) {
            return res.status(400).json({ error: "Falta baseId" });
        }

        if (!importId) {
            return res.status(400).json({
                error: "Debes seleccionar la base (importacion) a reciclar",
            });
        }

        const resultado = await basesService.reciclarBase(
            campaignId,
            importId,
            req.user?.username || String(req.user?.id),
        );

        return res.json({
            ok: true,
            ...resultado,
        });
    } catch (err) {
        console.error("Error en /bases/:baseId/reciclar:", err);
        return res
            .status(500)
            .json({ error: "Error en /bases/:baseId/reciclar" });
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
                importUser: importUserFromBody,
            } = req.body;
            const importCase = "bancoPichinchaEncuestasGenericas";
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
            // NOSONAR - procesarCSV is async function
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

/**
 * GET /bases/importaciones/:campaignId
 * Obtiene lista de importaciones (fechas LastUpdate) para una campaña
 */
router.get("/importaciones/:campaignId", requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const importaciones =
            await basesService.obtenerImportacionesConEstadoPorCampania(
                campaignId,
            );

        return res.json({ importaciones });
    } catch (_err) {
        return res.status(500).json({ error: "Error obteniendo importaciones" });
    }
});

/**
 * POST /bases/administrar
 * Activa o desactiva una base (importación)
 * Body: { campaignId, importDate, action: 'activar' | 'desactivar' }
 */
router.post(
    "/administrar",
    requireAuth,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { campaignId, importDate, action } = req.body;
            const username = req.user?.username || String(req.user?.id);

            if (!campaignId || !importDate || !action) {
                return res.status(400).json({
                    error: "campaignId, importDate y action son requeridos",
                });
            }

            // Permitir pasar id para desactivar base
            const { id } = req.body;
            const resultado = await basesService.administrarBase(
                campaignId,
                importDate,
                action,
                username,
                id,
            );

            res.json({
                success: true,
                message: resultado.message,
            });
        } catch (err) {
            console.error("Error administrando base:", err);
            res.status(500).json({
                error: err.message || "Error al administrar base",
            });
        }
    },
);

export default router;



