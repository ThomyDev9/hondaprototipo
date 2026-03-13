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
import { recomputeImportStats } from "../../services/bases.service.js";
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
                    .json({ error: "Faltan parámetros campaignId o importId" });
            }
            const [rows] = await pool.query(
                `SELECT COUNT(*) AS reciclables
             FROM contactimportcontact
             WHERE Campaign = ?
               AND LastUpdate = ?
               AND LastManagementResult IN (60, 61, 62, 63, 64, 34)`,
                [campaignId, importId],
            );
            res.json({ reciclables: rows[0]?.reciclables || 0 });
        } catch (err) {
            console.error("Error obteniendo cantidad de reciclables:", err);
            res.status(500).json({
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
            const { default: basesQueries } =
                await import("../../services/queries/bases.queries.js");
            const { campaignId, importId } = req.query;
            let sql = basesQueries.getAllBasesSummary;
            const params = [];
            // Agregar filtros dinámicos
            if (campaignId && importId) {
                sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ? AND import_id = ?`;
                params.push(campaignId, importId);
            } else if (campaignId) {
                sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ?`;
                params.push(campaignId);
            } else if (importId) {
                sql = `SELECT * FROM (${sql}) AS resumen WHERE import_id = ?`;
                params.push(importId);
            }
            const [rows] = await pool.query(sql, params);
            const data = (rows || []).map((row) => ({
                campaign_id: row.campaign_id,
                base: row.import_id,
                estado_base:
                    String(row.base_state) === "1" ? "ACTIVO" : "INACTIVO",
                registros: row.total_registros,
                sin_gestionar: row.pendientes,
                pendientes_libres: row.pendientes_libres,
                pendientes_asignados_sin_gestion:
                    row.pendientes_asignados_sin_gestion,
                avance:
                    row.total_registros > 0
                        ? Math.round(
                              100 * (1 - row.pendientes / row.total_registros),
                          )
                        : 0,
            }));
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
            const { default: basesQueries } =
                await import("../../services/queries/bases.queries.js");
            const { campaignId, importId } = req.query;
            let sql = basesQueries.getAllBasesInactivasSummary;
            const params = [];
            // Agregar filtros dinámicos
            if (campaignId && importId) {
                sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ? AND import_id = ?`;
                params.push(campaignId, importId);
            } else if (campaignId) {
                sql = `SELECT * FROM (${sql}) AS resumen WHERE campaign_id = ?`;
                params.push(campaignId);
            } else if (importId) {
                sql = `SELECT * FROM (${sql}) AS resumen WHERE import_id = ?`;
                params.push(importId);
            }
            const [rows] = await pool.query(sql, params);
            const data = (rows || []).map((row) => ({
                campaign_id: row.campaign_id,
                base: row.import_id,
                estado_base:
                    String(row.base_state) === "1" ? "ACTIVO" : "INACTIVO",
                registros: row.total_registros,
                sin_gestionar: row.pendientes,
                pendientes_libres: row.pendientes_libres,
                pendientes_asignados_sin_gestion:
                    row.pendientes_asignados_sin_gestion,
                avance:
                    row.total_registros > 0
                        ? Math.round(
                              100 * (1 - row.pendientes / row.total_registros),
                          )
                        : 0,
            }));
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
        const MAX_INTENTOS = 6; // regla de negocio: hasta 6 intentos
        const campaignId = baseId;

        if (!campaignId) {
            return res.status(400).json({ error: "Falta baseId" });
        }

        if (!importId) {
            return res.status(400).json({
                error: "Debes seleccionar la base (importación) a reciclar",
            });
        }

        // Cambia Action a 'reciclable' para identificar registros reciclados
        const [result] = await pool.query(
            `
                    UPDATE contactimportcontact
                    SET LastAgent = 'Pendiente',
                        Action = 'reciclable',
                        UserShift = ?,
                        TmStmpShift = NOW()
                    WHERE Campaign = ?
                      AND LastUpdate = ?
                      AND COALESCE(Number, 0) < ?
                      AND LastManagementResult IN (60, 61, 62, 63, 64, 34)
                `,
            [
                req.user?.username || String(req.user?.id),
                campaignId,
                importId,
                MAX_INTENTOS,
            ],
        );

        await recomputeImportStats(
            campaignId,
            importId,
            req.user?.username || String(req.user?.id),
            pool,
        );

        return res.json({
            ok: true,
            base_id: campaignId,
            import_id: importId,
            registros_reciclados: result.affectedRows,
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
                    cab.id AS id,
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
                GROUP BY cab.id, c.Campaign, c.LastUpdate
                ORDER BY c.Campaign ASC, c.LastUpdate DESC
            `,
                [campaignId],
            );

            // Adaptar formato esperado por el frontend
            const mapped = basesRaw.map((row) => ({
                id: row.id || row.base, // numérico si existe, fallback a base
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
