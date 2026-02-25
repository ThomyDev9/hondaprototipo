// backend/src/routes/admin.reportes.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

function buildGestionReportQuery(baseId) {
    let query = `
        SELECT
            c.Campaign AS CODIGO_DE_CAMPANA,
            c.Campaign AS NOMBRE_DE_CAMPANA,
            c.Identification AS IDENTIFICACION,
            c.Name AS NOMBRE_CLIENTE,
            '' AS PROVINCIA,
            '' AS ANIO,
            '' AS ETIQUETAS,
            '' AS PLACA,
            '' AS RAMV,
            '' AS MODELO,
            '' AS CORREO,
            c.LastUpdate AS CAMPO,
            (
                SELECT p.NumeroMarcado
                FROM contactimportphone p
                WHERE p.ContactId = c.Id
                  AND p.NumeroMarcado IS NOT NULL
                  AND p.NumeroMarcado <> ''
                ORDER BY p.DescripcionTelefono ASC
                LIMIT 1
            ) AS TELEFONO_DE_CONTACTO,
            c.LastAgent AS ASESOR,
            COALESCE(c.Number, 0) AS INTENTOS,
            '' AS OBSERVACIONES,
            c.TmStmpShift AS FECHA_DE_GESTION,
            c.Action AS ESTADO_DE_GESTION,
            '' AS SUB_ESTATUS,
            '' AS AGENCIA_CITA,
            NULL AS FECHA_DE_CITA,
            NULL AS HORARIO_DE_CITA
        FROM contactimportcontact c
        WHERE c.Campaign IS NOT NULL
          AND c.Campaign <> ''
    `;

    const params = [];

    if (baseId) {
        query += " AND c.Campaign = ?";
        params.push(baseId);
    }

    query += " ORDER BY c.Campaign ASC, c.TmStmpShift DESC, c.Id DESC";
    return { query, params };
}

/**
 * 1) Endpoint JSON para ver el reporte en tablas
 *    GET /admin/reportes/gestion
 *    GET /admin/reportes/gestion?base_id=xxxx
 */
router.get(
    "/gestion",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { base_id } = req.query;

            const { query, params } = buildGestionReportQuery(base_id);

            const [rows] = await pool.query(query, params);

            return res.json({ rows });
        } catch (err) {
            console.error("Error en /admin/reportes/gestion:", err);
            return res
                .status(500)
                .json({ error: "Error interno al cargar reporte" });
        }
    },
);

/**
 * 2) Endpoint CSV para exportar el reporte en formato Excel
 *    GET /admin/reportes/gestion/export
 *    GET /admin/reportes/gestion/export?base_id=xxxx
 */
router.get(
    "/gestion/export",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const { base_id } = req.query;

            const { query, params } = buildGestionReportQuery(base_id);

            const [data] = await pool.query(query, params);

            if (!data || data.length === 0) {
                return res.status(400).json({
                    error: "No hay datos en el reporte para exportar",
                });
            }

            // Orden de columnas EXACTO al de tu vista (sin incluir base_id)
            const columns = [
                "CODIGO_DE_CAMPANA",
                "NOMBRE_DE_CAMPANA",
                "IDENTIFICACION",
                "NOMBRE_CLIENTE",
                "PROVINCIA",
                "ANIO",
                "ETIQUETAS",
                "PLACA",
                "RAMV",
                "MODELO",
                "CORREO",
                "CAMPO",
                "TELEFONO_DE_CONTACTO",
                "ASESOR",
                "INTENTOS",
                "OBSERVACIONES",
                "FECHA_DE_GESTION",
                "ESTADO_DE_GESTION",
                "SUB_ESTATUS",
                "AGENCIA_CITA",
                "FECHA_DE_CITA",
                "HORARIO_DE_CITA",
            ];

            const csvSafe = (value) => {
                if (value === null || value === undefined) return "";
                const str = String(value).replace(/\r?\n/g, " ");
                if (str.includes(";") || str.includes('"')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const headerLine = columns.join(";");
            const rowsLines = data.map((row) =>
                columns.map((col) => csvSafe(row[col])).join(";"),
            );

            const csvContent = [headerLine, ...rowsLines].join("\r\n");

            // nombre de archivo: si viene base, lo agregamos
            const today = new Date().toISOString().slice(0, 10);
            const filenameBase = base_id ? `base_${base_id}_` : "";
            const filename = `reporte_gestion_${filenameBase}${today}.csv`;

            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`,
            );

            return res.send("\uFEFF" + csvContent);
        } catch (err) {
            console.error("Error en /admin/reportes/gestion/export:", err);
            return res
                .status(500)
                .json({ error: "Error interno al exportar reporte" });
        }
    },
);

export default router;
