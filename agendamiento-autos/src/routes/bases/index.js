// backend/src/routes/bases.routes.js
import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import pool from "../../services/db.js"; // conexión a MySQL
import * as basesService from "../../services/bases.service.js";

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
 * Recibe un Excel, crea una base y guarda sus registros en base_registros
 * (ruta real: POST http://localhost:4004/bases/upload)
 */
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const { baseName, description, mapeo, campania } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No se recibió archivo" });
        }

        if (!mapeo || !campania) {
            return res.status(400).json({
                error: "Mapeo y campaña son campos obligatorios",
            });
        }

        // 1) Leer el Excel desde el buffer
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const totalRecords = rows.length;

        // 2) Crear la base en MySQL usando el servicio
        const newBase = await basesService.crearBase({
            nombre: baseName,
            mapeo: mapeo,
            campania: campania,
            estado: 1,
        });

        const baseInsertId = newBase.id;

        // 3) Mapear filas del Excel a nuestra tabla base_registros
        const registros = rows.map((r) => ({
            base_id: baseInsertId,
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

        // 4) Insertar todos los registros en base_registros (MySQL)
        if (registros.length > 0) {
            const insertRegistrosQuery = `
        INSERT INTO base_registros
        (base_id, nombre_completo, placa, telefono1, telefono2, modelo, estado, intentos_totales, pool, raw_data)
        VALUES ${registros.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",")}
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
            message: "Base cargada correctamente con mapeo y campaña",
            baseId: baseInsertId,
            baseName,
            mapeo,
            campania,
            totalRecords,
            preview,
        });
    } catch (err) {
        console.error("Error en /bases/upload:", err);
        return res.status(500).json({ error: "Error procesando archivo" });
    }
});

export default router;
