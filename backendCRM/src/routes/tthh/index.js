import express from "express";
import pool from "../../services/db.js";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

function resolveUploadsBasePath() {
    const candidates = [
        path.join(process.cwd(), "uploads"),
        path.join(process.cwd(), "backendCRM", "uploads"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

const employeePhotoDir = path.join(resolveUploadsBasePath(), "employee-photos");
fs.mkdirSync(employeePhotoDir, { recursive: true });

const photoUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, employeePhotoDir),
        filename: (_req, file, cb) => {
            const safeOriginal = String(file.originalname || "photo")
                .replace(/\s+/g, "_")
                .replace(/[^a-zA-Z0-9._-]/g, "");
            const ext = path.extname(safeOriginal) || ".jpg";
            const base = path.basename(safeOriginal, ext) || "photo";
            cb(null, `${Date.now()}_${base}${ext}`);
        },
    }),
    fileFilter: (_req, file, cb) => {
        const mime = String(file.mimetype || "").toLowerCase();
        if (mime.startsWith("image/")) {
            cb(null, true);
            return;
        }
        cb(new Error("Solo se permiten imagenes"));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

const tthhMiddlewares = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR", "TTHH"]),
];

function toCsvCell(value) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
}

router.get("/reports/crm-break.csv", ...tthhMiddlewares, async (req, res) => {
    try {
        const startDate = String(req.query.startDate || "").trim();
        const endDate = String(req.query.endDate || "").trim();

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate y endDate son obligatorios (YYYY-MM-DD)" });
        }

        const [rows] = await pool.query(
            `SELECT
                Agent,
                DATE_FORMAT(DATE(EstadoInicio), '%Y-%m-%d') AS FechaBase,
                DATE_FORMAT(MIN(EstadoInicio), '%H:%i:%s') AS HoraInicioSesion,
                DATE_FORMAT(MAX(EstadoFin), '%H:%i:%s') AS HoraFinSesion,
                TIME_FORMAT(SEC_TO_TIME(
                    TIMESTAMPDIFF(
                        SECOND,
                        MIN(EstadoInicio),
                        MAX(EstadoFin)
                    )
                ), '%H:%i:%s') AS TiempoSesion,
                TIME_FORMAT(SEC_TO_TIME(
                    SUM(
                        CASE
                            WHEN LOWER(TRIM(Estado)) = 'break'
                            THEN TIMESTAMPDIFF(SECOND, EstadoInicio, EstadoFin)
                            ELSE 0
                        END
                    )
                ), '%H:%i:%s') AS TiempoBreak,
                TIME_FORMAT(SEC_TO_TIME(
                    TIMESTAMPDIFF(SECOND, MIN(EstadoInicio), MAX(EstadoFin))
                    - SUM(
                        CASE
                            WHEN LOWER(TRIM(Estado)) = 'break'
                            THEN TIMESTAMPDIFF(SECOND, EstadoInicio, EstadoFin)
                            ELSE 0
                        END
                    )
                ), '%H:%i:%s') AS TiempoEfectivo
            FROM session_estado_log
            WHERE EstadoInicio IS NOT NULL
              AND EstadoFin IS NOT NULL
              AND EstadoInicio >= CONCAT(?, ' 00:00:00')
              AND EstadoInicio < DATE_ADD(CONCAT(?, ' 00:00:00'), INTERVAL 1 DAY)
            GROUP BY Agent, DATE(EstadoInicio)
            ORDER BY FechaBase DESC, Agent ASC`,
            [startDate, endDate],
        );

        const headers = [
            "Agent",
            "FechaBase",
            "HoraInicioSesion",
            "HoraFinSesion",
            "TiempoSesion",
            "TiempoBreak",
            "TiempoEfectivo",
        ];

        const csvLines = [headers.join(",")];
        for (const row of rows) {
            csvLines.push(
                headers.map((header) => toCsvCell(row?.[header])).join(","),
            );
        }

        const csvContent = csvLines.join("\r\n");
        const filename = `reporte_crm_break_${startDate}_a_${endDate}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csvContent);
    } catch (err) {
        console.error("Error GET /tthh/reports/crm-break.csv:", err);
        return res.status(500).json({ error: "Error generando reporte CRM break" });
    }
});

const CATALOG_TYPES = new Set([
    "marital_status",
    "sector",
    "gender",
    "job_title",
    "department",
    "area",
    "contract_type",
    "workday_type",
    "education_level",
    "bank",
    "work_modality",
    "employee_status",
    "exit_reason",
]);

const EMPLOYEE_FIELDS = [
    "first_name",
    "last_name",
    "full_name",
    "photo_url",
    "national_id",
    "birth_date",
    "marital_status_id",
    "children_count",
    "personal_phone",
    "alt_phone",
    "corporate_email",
    "personal_email",
    "address_text",
    "province",
    "sector_id",
    "gender_id",
    "family_dependents_count",
    "job_title_id",
    "department_id",
    "area_id",
    "hire_date",
    "exit_date",
    "contract_type_id",
    "workday_type_id",
    "education_level_id",
    "base_salary",
    "bank_id",
    "bank_account_number",
    "work_modality_id",
    "employee_status_id",
    "decimals_accumulation",
    "exit_reason_id",
    "emergency_contact_name",
    "emergency_contact_relationship",
    "emergency_contact_phone",
    "med_allergy_drug",
    "med_allergy_food",
    "med_allergy_detail",
    "observations",
];

function parseBoolean(value) {
    if (
        value === true ||
        value === 1 ||
        String(value || "")
            .trim()
            .toLowerCase() === "1" ||
        String(value || "")
            .trim()
            .toLowerCase() === "true"
    ) {
        return 1;
    }
    return 0;
}

function normalizeEmployeePayload(payload = {}) {
    const firstName = String(payload.first_name || "").trim();
    const lastName = String(payload.last_name || "").trim();
    const fullName = String(payload.full_name || `${firstName} ${lastName}`).trim();
    const nationalId = String(payload.national_id || "").trim();
    const birthDate = String(payload.birth_date || "").trim();
    const hireDate = String(payload.hire_date || "").trim();
    const exitDate = String(payload.exit_date || "").trim();
    const employeeStatusId = Number(payload.employee_status_id || 0) || null;
    const exitReasonId = Number(payload.exit_reason_id || 0) || null;

    if (!firstName || !lastName || !fullName || !nationalId || !birthDate || !hireDate) {
        return { error: "Nombres, apellidos, cedula, fecha nacimiento y fecha ingreso son obligatorios" };
    }

    if (exitDate && hireDate && new Date(exitDate) < new Date(hireDate)) {
        return { error: "Fecha de salida no puede ser menor a fecha de ingreso" };
    }

    return {
        data: {
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            photo_url: String(payload.photo_url || "").trim() || null,
            national_id: nationalId,
            birth_date: birthDate,
            marital_status_id: Number(payload.marital_status_id || 0) || null,
            children_count: Number(payload.children_count || 0),
            personal_phone: String(payload.personal_phone || "").trim() || null,
            alt_phone: String(payload.alt_phone || "").trim() || null,
            corporate_email: String(payload.corporate_email || "").trim() || null,
            personal_email: String(payload.personal_email || "").trim() || null,
            address_text: String(payload.address_text || "").trim() || null,
            province: String(payload.province || "").trim() || null,
            sector_id: Number(payload.sector_id || 0) || null,
            gender_id: Number(payload.gender_id || 0) || null,
            family_dependents_count: Number(payload.family_dependents_count || 0),
            job_title_id: Number(payload.job_title_id || 0) || null,
            department_id: Number(payload.department_id || 0) || null,
            area_id: Number(payload.area_id || 0) || null,
            hire_date: hireDate,
            exit_date: exitDate || null,
            contract_type_id: Number(payload.contract_type_id || 0) || null,
            workday_type_id: Number(payload.workday_type_id || 0) || null,
            education_level_id: Number(payload.education_level_id || 0) || null,
            base_salary: Number(payload.base_salary || 0),
            bank_id: Number(payload.bank_id || 0) || null,
            bank_account_number: String(payload.bank_account_number || "").trim() || null,
            work_modality_id: Number(payload.work_modality_id || 0) || null,
            employee_status_id: employeeStatusId,
            decimals_accumulation: parseBoolean(payload.decimals_accumulation),
            exit_reason_id: exitReasonId,
            emergency_contact_name: String(payload.emergency_contact_name || "").trim() || null,
            emergency_contact_relationship:
                String(payload.emergency_contact_relationship || "").trim() || null,
            emergency_contact_phone: String(payload.emergency_contact_phone || "").trim() || null,
            med_allergy_drug: parseBoolean(payload.med_allergy_drug),
            med_allergy_food: parseBoolean(payload.med_allergy_food),
            med_allergy_detail: String(payload.med_allergy_detail || "").trim() || null,
            observations: String(payload.observations || "").trim() || null,
        },
    };
}

function employeeSelectSql(whereClause = "") {
    return `
        SELECT
            ep.*,
            TIMESTAMPDIFF(YEAR, ep.birth_date, CURDATE()) AS age_years,
            TIMESTAMPDIFF(YEAR, ep.hire_date, COALESCE(ep.exit_date, CURDATE())) AS seniority_years,
            c_marital.label AS marital_status_label,
            c_sector.label AS sector_label,
            c_gender.label AS gender_label,
            c_job.label AS job_title_label,
            c_department.label AS department_label,
            c_area.label AS area_label,
            c_contract.label AS contract_type_label,
            c_workday.label AS workday_type_label,
            c_education.label AS education_level_label,
            c_bank.label AS bank_label,
            c_modality.label AS work_modality_label,
            c_status.label AS employee_status_label,
            c_exit_reason.label AS exit_reason_label
        FROM tthh_employee_profiles ep
        LEFT JOIN tthh_catalog_options c_marital ON c_marital.id = ep.marital_status_id
        LEFT JOIN tthh_catalog_options c_sector ON c_sector.id = ep.sector_id
        LEFT JOIN tthh_catalog_options c_gender ON c_gender.id = ep.gender_id
        LEFT JOIN tthh_catalog_options c_job ON c_job.id = ep.job_title_id
        LEFT JOIN tthh_catalog_options c_department ON c_department.id = ep.department_id
        LEFT JOIN tthh_catalog_options c_area ON c_area.id = ep.area_id
        LEFT JOIN tthh_catalog_options c_contract ON c_contract.id = ep.contract_type_id
        LEFT JOIN tthh_catalog_options c_workday ON c_workday.id = ep.workday_type_id
        LEFT JOIN tthh_catalog_options c_education ON c_education.id = ep.education_level_id
        LEFT JOIN tthh_catalog_options c_bank ON c_bank.id = ep.bank_id
        LEFT JOIN tthh_catalog_options c_modality ON c_modality.id = ep.work_modality_id
        LEFT JOIN tthh_catalog_options c_status ON c_status.id = ep.employee_status_id
        LEFT JOIN tthh_catalog_options c_exit_reason ON c_exit_reason.id = ep.exit_reason_id
        ${whereClause}
    `;
}

router.get("/catalogs", ...tthhMiddlewares, async (req, res) => {
    try {
        const type = String(req.query.type || "").trim();
        const includeInactive = String(req.query.includeInactive || "").trim() === "1";

        if (type && !CATALOG_TYPES.has(type)) {
            return res.status(400).json({ error: "catalog_type no valido" });
        }

        const clauses = [];
        const params = [];
        if (type) {
            clauses.push("catalog_type = ?");
            params.push(type);
        }
        if (!includeInactive) {
            clauses.push("is_active = 1");
        }

        const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
        const [rows] = await pool.query(
            `SELECT id, catalog_type, code, label, is_active, sort_order
             FROM tthh_catalog_options
             ${whereSql}
             ORDER BY catalog_type ASC, sort_order ASC, label ASC`,
            params,
        );

        return res.json({ data: rows });
    } catch (err) {
        console.error("Error GET /tthh/catalogs:", err);
        return res.status(500).json({ error: "Error cargando catalogos" });
    }
});

router.post(
    "/employees/photo",
    ...tthhMiddlewares,
    (req, res, next) => {
        photoUpload.single("photo")(req, res, (err) => {
            if (err) {
                return res.status(400).json({ error: err.message || "Error subiendo foto" });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "Archivo de foto requerido" });
            }
            const photoUrl = `/uploads/employee-photos/${req.file.filename}`;
            return res.status(201).json({ data: { photoUrl } });
        } catch (err) {
            console.error("Error POST /tthh/employees/photo:", err);
            return res.status(500).json({ error: "Error subiendo foto" });
        }
    },
);

router.post("/catalogs", ...tthhMiddlewares, async (req, res) => {
    try {
        const catalogType = String(req.body?.catalog_type || "").trim();
        const code = String(req.body?.code || "")
            .trim()
            .toLowerCase();
        const label = String(req.body?.label || "").trim();
        const sortOrder = Number(req.body?.sort_order || 0);

        if (!CATALOG_TYPES.has(catalogType) || !code || !label) {
            return res.status(400).json({
                error: "catalog_type, code y label son obligatorios",
            });
        }

        const [result] = await pool.query(
            `INSERT INTO tthh_catalog_options (catalog_type, code, label, sort_order, is_active)
             VALUES (?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE label = VALUES(label), sort_order = VALUES(sort_order), is_active = 1`,
            [catalogType, code, label, sortOrder],
        );

        return res.status(201).json({ data: { id: result.insertId || null } });
    } catch (err) {
        console.error("Error POST /tthh/catalogs:", err);
        return res.status(500).json({ error: "Error guardando opcion de catalogo" });
    }
});

router.patch("/catalogs/:id", ...tthhMiddlewares, async (req, res) => {
    try {
        const id = Number(req.params.id || 0);
        if (!id) {
            return res.status(400).json({ error: "id invalido" });
        }

        const updates = [];
        const params = [];
        if (req.body?.label !== undefined) {
            updates.push("label = ?");
            params.push(String(req.body.label || "").trim());
        }
        if (req.body?.sort_order !== undefined) {
            updates.push("sort_order = ?");
            params.push(Number(req.body.sort_order || 0));
        }
        if (req.body?.is_active !== undefined) {
            updates.push("is_active = ?");
            params.push(parseBoolean(req.body.is_active));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No hay campos para actualizar" });
        }

        params.push(id);
        await pool.query(
            `UPDATE tthh_catalog_options
             SET ${updates.join(", ")}
             WHERE id = ?`,
            params,
        );

        return res.json({ message: "Catalogo actualizado" });
    } catch (err) {
        console.error("Error PATCH /tthh/catalogs/:id:", err);
        return res.status(500).json({ error: "Error actualizando catalogo" });
    }
});

router.get("/employees", ...tthhMiddlewares, async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const statusId = Number(req.query.employee_status_id || 0) || null;

        const clauses = [];
        const params = [];
        if (search) {
            clauses.push("(ep.full_name LIKE ? OR ep.national_id LIKE ?)");
            params.push(`%${search}%`, `%${search}%`);
        }
        if (statusId) {
            clauses.push("ep.employee_status_id = ?");
            params.push(statusId);
        }

        const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
        const [rows] = await pool.query(
            `${employeeSelectSql(whereSql)}
             ORDER BY ep.created_at DESC
             LIMIT 300`,
            params,
        );

        return res.json({ data: rows });
    } catch (err) {
        console.error("Error GET /tthh/employees:", err);
        return res.status(500).json({ error: "Error cargando colaboradores" });
    }
});

router.get("/employees/:id", ...tthhMiddlewares, async (req, res) => {
    try {
        const id = Number(req.params.id || 0);
        if (!id) {
            return res.status(400).json({ error: "id invalido" });
        }

        const [rows] = await pool.query(
            `${employeeSelectSql("WHERE ep.id = ?")}
             LIMIT 1`,
            [id],
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Colaborador no encontrado" });
        }

        return res.json({ data: rows[0] });
    } catch (err) {
        console.error("Error GET /tthh/employees/:id:", err);
        return res.status(500).json({ error: "Error cargando colaborador" });
    }
});

router.post("/employees", ...tthhMiddlewares, async (req, res) => {
    try {
        const normalized = normalizeEmployeePayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }
        const actor = String(req.user?.username || req.user?.email || "system");
        normalized.data.created_by = actor;
        normalized.data.updated_by = actor;

        const columns = [...EMPLOYEE_FIELDS, "created_by", "updated_by"];
        const values = columns.map((column) => normalized.data[column] ?? null);
        const placeholders = columns.map(() => "?").join(", ");

        const [result] = await pool.query(
            `INSERT INTO tthh_employee_profiles (${columns.join(", ")})
             VALUES (${placeholders})`,
            values,
        );

        return res.status(201).json({ data: { id: result.insertId } });
    } catch (err) {
        console.error("Error POST /tthh/employees:", err);
        return res.status(500).json({
            error: "Error guardando colaborador",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.patch("/employees/:id", ...tthhMiddlewares, async (req, res) => {
    try {
        const id = Number(req.params.id || 0);
        if (!id) {
            return res.status(400).json({ error: "id invalido" });
        }

        const normalized = normalizeEmployeePayload(req.body || {});
        if (normalized.error) {
            return res.status(400).json({ error: normalized.error });
        }

        const actor = String(req.user?.username || req.user?.email || "system");
        normalized.data.updated_by = actor;
        const columns = [...EMPLOYEE_FIELDS, "updated_by"];
        const assignments = columns.map((column) => `${column} = ?`).join(", ");
        const values = columns.map((column) => normalized.data[column] ?? null);
        values.push(id);

        await pool.query(
            `UPDATE tthh_employee_profiles
             SET ${assignments}
             WHERE id = ?`,
            values,
        );

        return res.json({ message: "Colaborador actualizado" });
    } catch (err) {
        console.error("Error PATCH /tthh/employees/:id:", err);
        return res.status(500).json({
            error: "Error actualizando colaborador",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

export default router;
