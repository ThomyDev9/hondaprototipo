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
        const { action = "desactivar" } = req.query;
        console.log("📥 Obteniendo importaciones para campaña:", campaignId);

        const importaciones =
            await basesService.obtenerImportacionesPorCampania(
                campaignId,
                action,
            );

        console.log("✅ Importaciones encontradas:", importaciones.length);
        console.log("Datos:", importaciones);

        res.json({ importaciones });
    } catch (err) {
        console.error("❌ Error obteniendo importaciones:", err);
        res.status(500).json({ error: "Error obteniendo importaciones" });
    }
});

import agenteQueries from "../../services/queries/agente.queries.js";
import pool from "../../services/db.js";

router.get(
    "/importaciones-estado/:campaignId",
    requireAuth,
    async (req, res) => {
        try {
            const { campaignId } = req.params;
            // Replica la consulta de /admin/bases-resumen pero solo para la campaña seleccionada
            const [basesRaw] = await pool.query(
                `
                SELECT
                    c.Campaign AS campaign_id,
                    c.LastUpdate AS base,
                    COUNT(*) AS registros,
                    CASE
                        WHEN MAX(CASE WHEN cab.CampaignId IS NOT NULL THEN 1 ELSE 0 END) = 1
                            THEN '1'
                        ELSE '0'
                    END AS BaseState
                FROM contactimportcontact c
                LEFT JOIN campaign_active_base cab
                  ON cab.CampaignId = c.Campaign
                 AND cab.ImportId = c.LastUpdate
                 AND cab.State = '1'
                WHERE c.Campaign IS NOT NULL
                  AND c.Campaign <> ''
                  AND c.LastUpdate IS NOT NULL
                  AND c.LastUpdate <> ''
                  AND c.Campaign = ?
                GROUP BY c.Campaign, c.LastUpdate
                ORDER BY c.Campaign ASC, c.LastUpdate DESC
            `,
                [campaignId],
            );

            // Adaptar formato esperado por el frontend
            const mapped = basesRaw.map((row) => ({
                id: row.base,
                LastUpdate: row.base,
                BaseState: String(row.BaseState ?? "0").trim() || "0",
                totalRegistros: Number(row.registros || 0),
            }));
            res.json({ importaciones: mapped });
        } catch (err) {
            console.error("❌ Error obteniendo importaciones con estado:", err);
            res.status(500).json({
                error: "Error obteniendo importaciones con estado",
            });
        }
    },
);

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
