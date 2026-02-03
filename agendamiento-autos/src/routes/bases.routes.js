// backend/src/routes/bases.routes.js
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import pool from "../services/db.js"; // conexión a Postgres

const router = express.Router();

// Multer en memoria (no guarda en disco)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /bases
 * Lista todas las bases cargadas
 * (ruta real: GET http://localhost:4004/bases)
 */
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, status, total_records, uploaded_at, cliente, tipo_campania, prioridad_base
       FROM bases
       ORDER BY uploaded_at DESC`,
        );
        return res.json({ bases: result.rows });
    } catch (err) {
        console.error("Error listando bases:", err);
        return res.status(500).json({ error: "Error listando bases" });
    }
});

/**
 * POST /bases/upload
 * Recibe un Excel, crea una base y guarda sus registros en base_registros
 * (ruta real: POST http://localhost:4004/bases/upload)
 */
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const { baseName, description } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No se recibió archivo" });
        }

        // 1) Leer el Excel desde el buffer
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const totalRecords = rows.length;

        // 2) Crear la base en Postgres
        const insertBaseQuery = `
      INSERT INTO bases (name, description, status, total_records, origen, uploaded_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, description, status, total_records, uploaded_at, cliente, tipo_campania, prioridad_base
    `;
        const baseResult = await pool.query(insertBaseQuery, [
            baseName,
            description,
            "pendiente",
            totalRecords,
            "excel",
        ]);

        const baseInsert = baseResult.rows[0];

        // 3) Mapear filas del Excel a nuestra tabla base_registros
        const registros = rows.map((r) => ({
            base_id: baseInsert.id,
            nombre_completo: r["Nombres Completos"] || "",
            placa: r["Placa"] || "",
            telefono1: r["Teléfono 1"] || "",
            telefono2: r["Teléfono 2"] || "",
            modelo: r["Modelo"] || "",
            estado: "pendiente",
            intentos_totales: 0,
            pool: "activo",
            raw_data: r, // fila completa por si luego necesitas más campos
        }));

        // 4) Insertar todos los registros en base_registros
        if (registros.length > 0) {
            const insertRegistrosQuery = `
        INSERT INTO base_registros
        (base_id, nombre_completo, placa, telefono1, telefono2, modelo, estado, intentos_totales, pool, raw_data)
        VALUES ${registros
            .map(
                (_, i) =>
                    `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`,
            )
            .join(",")}
      `;

            const values = registros.flatMap((r) => [
                r.base_id,
                r.nombre_completo,
                r.placa,
                r.telefono1,
                r.telefono2,
                r.modelo,
                r.estado,
                r.intentos_totales,
                r.pool,
                JSON.stringify(r.raw_data),
            ]);

            await pool.query(insertRegistrosQuery, values);
        }

        // 5) Devolver preview de las primeras filas al frontend
        const preview = rows.slice(0, 5);

        return res.json({
            message: "Base cargada correctamente (modo preliminar)",
            base: baseInsert,
            preview,
        });
    } catch (err) {
        console.error("Error en /bases/upload:", err);
        return res.status(500).json({ error: "Error procesando archivo" });
    }
});

export default router;
