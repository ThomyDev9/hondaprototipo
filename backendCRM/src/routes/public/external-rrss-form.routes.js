import express from "express";
import pool from "../../services/db.js";

const router = express.Router();

const allowedOrigins = String(
    process.env.EXTERNAL_FORM_ALLOWED_ORIGINS || "",
)
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

const requestCounters = new Map();
const RATE_WINDOW_MS = Number(process.env.EXTERNAL_FORM_RATE_WINDOW_MS || 60000);
const RATE_MAX_REQUESTS = Number(process.env.EXTERNAL_FORM_RATE_MAX || 20);

function nowMs() {
    return Date.now();
}

function getClientIp(req) {
    const xff = String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim();
    return xff || req.ip || req.socket?.remoteAddress || "unknown";
}

function normalizeValue(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === "" ? null : normalized;
}

function isAllowedOrigin(req) {
    if (!allowedOrigins.length) return true;
    const origin = String(req.headers.origin || "").trim();
    if (!origin) return false;
    return allowedOrigins.includes(origin);
}

function requireOrigin(req, res, next) {
    if (!isAllowedOrigin(req)) {
        return res.status(403).json({ error: "Origen no permitido" });
    }
    return next();
}

function requireApiKey(req, res, next) {
    const requireApiKeyFlag =
        String(process.env.EXTERNAL_FORM_REQUIRE_API_KEY || "0").trim() === "1";
    if (!requireApiKeyFlag) {
        return next();
    }

    const expected = String(process.env.EXTERNAL_FORM_API_KEY || "").trim();
    if (!expected) {
        return res
            .status(503)
            .json({ error: "API key de formulario externo no configurada" });
    }
    const provided = String(req.headers["x-api-key"] || "").trim();
    if (provided !== expected) {
        return res.status(401).json({ error: "API key invalida" });
    }
    return next();
}

function rateLimitByIp(req, res, next) {
    const key = getClientIp(req);
    const current = nowMs();
    const existing = requestCounters.get(key);

    if (!existing || current > existing.resetAt) {
        requestCounters.set(key, {
            count: 1,
            resetAt: current + RATE_WINDOW_MS,
        });
        return next();
    }

    existing.count += 1;
    if (existing.count > RATE_MAX_REQUESTS) {
        return res.status(429).json({
            error: "Demasiadas solicitudes. Intenta nuevamente en un momento.",
        });
    }
    return next();
}

function validateBody(body = {}) {
    const errors = [];
    const requiredFields = [
        "autoriza_buro",
        "numero_cedula",
        "apellidos_nombres_completos",
        "estado_civil",
        "ciudad",
        "celular",
        "monto_solicitado",
        "destino_credito",
        "ingreso_neto_recibir",
        "fuente_ingreso",
        "actividad_economica",
        "tiempo_actividad_anios",
        "tipo_vivienda",
        "mantiene_hijos",
        "otros_ingresos",
    ];

    for (const field of requiredFields) {
        if (!normalizeValue(body[field])) {
            errors.push(`${field} es obligatorio`);
        }
    }

    const cedula = normalizeValue(body.numero_cedula) || "";
    if (cedula && !/^\d{10,13}$/.test(cedula.replace(/\D/g, ""))) {
        errors.push("numero_cedula debe tener entre 10 y 13 digitos");
    }

    const celular = normalizeValue(body.celular) || "";
    if (celular && !/^\+?\d{7,15}$/.test(celular.replace(/\s+/g, ""))) {
        errors.push("celular tiene formato invalido");
    }

    const lengthRules = [
        ["apellidos_nombres_completos", 255],
        ["estado_civil", 128],
        ["ciudad", 255],
        ["monto_solicitado", 64],
        ["ingreso_neto_recibir", 64],
        ["fuente_ingreso", 128],
        ["tipo_vivienda", 128],
        ["mantiene_hijos", 128],
    ];
    for (const [field, max] of lengthRules) {
        const value = normalizeValue(body[field]) || "";
        if (value.length > max) {
            errors.push(`${field} excede el maximo de ${max} caracteres`);
        }
    }

    return errors;
}

router.options("/rrss-leads", (_req, res) => {
    return res.sendStatus(204);
});

router.get("/rrss-leads/check-identification/:cedula", requireOrigin, async (req, res) => {
    try {
        const cedulaRaw = String(req.params?.cedula || "");
        const cedula = cedulaRaw.replace(/\D/g, "");
        if (!cedula) {
            return res.status(400).json({ error: "cedula invalida" });
        }

        const [rows] = await pool.query(
            `
                SELECT id
                FROM external_leads_rrss_staging
                WHERE REPLACE(TRIM(COALESCE(numero_cedula, '')), ' ', '') = ?
                LIMIT 1
            `,
            [cedula],
        );

        return res.json({
            exists: Array.isArray(rows) && rows.length > 0,
        });
    } catch (err) {
        console.error("Error en GET /public/rrss-leads/check-identification/:cedula:", err);
        return res.status(500).json({ error: "Error verificando cédula" });
    }
});

router.post("/rrss-leads", requireOrigin, requireApiKey, rateLimitByIp, async (req, res) => {
    try {
        const body = req.body || {};
        const errors = validateBody(body);
        if (errors.length) {
            return res.status(400).json({ error: "Payload invalido", details: errors });
        }

        const cedulaToCheck = String(body.numero_cedula || "").replace(/\D/g, "");
        const [existingRows] = await pool.query(
            `
                SELECT id
                FROM external_leads_rrss_staging
                WHERE REPLACE(TRIM(COALESCE(numero_cedula, '')), ' ', '') = ?
                LIMIT 1
            `,
            [cedulaToCheck],
        );
        if (Array.isArray(existingRows) && existingRows.length > 0) {
            return res.status(409).json({
                error: "Tu solicitud ya existe. Espera a que se comunique un asesor.",
            });
        }

        const sqlWithRaw = `
            INSERT INTO external_leads_rrss_staging (
                source_sheet_name,
                fecha,
                autoriza_buro,
                numero_cedula,
                apellidos_nombres_completos,
                estado_civil,
                ciudad,
                celular,
                monto_solicitado,
                destino_credito,
                ingreso_neto_recibir,
                fuente_ingreso,
                tipo_relacion_laboral,
                actividad_economica,
                tiempo_actividad_economica_anios,
                actividad_economica_tiempo,
                tipo_vivienda,
                mantiene_hijos,
                otros_ingresos,
                raw_payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const sqlWithoutRaw = `
            INSERT INTO external_leads_rrss_staging (
                source_sheet_name,
                fecha,
                autoriza_buro,
                numero_cedula,
                apellidos_nombres_completos,
                estado_civil,
                ciudad,
                celular,
                monto_solicitado,
                destino_credito,
                ingreso_neto_recibir,
                fuente_ingreso,
                tipo_relacion_laboral,
                actividad_economica,
                tiempo_actividad_economica_anios,
                actividad_economica_tiempo,
                tipo_vivienda,
                mantiene_hijos,
                otros_ingresos
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const actividadEconomica = normalizeValue(body.actividad_economica) || "";
        const actividadTiempo = normalizeValue(body.tiempo_actividad_anios) || "";
        const mergedActividad = normalizeValue(
            body.actividad_economica_tiempo ||
                `${actividadEconomica}${actividadEconomica && actividadTiempo ? " | " : ""}${actividadTiempo}`,
        );

        const params = [
            "rrss_form_publico",
            normalizeValue(body.fecha) || new Date().toISOString(),
            normalizeValue(body.autoriza_buro),
            normalizeValue(body.numero_cedula),
            normalizeValue(body.apellidos_nombres_completos),
            normalizeValue(body.estado_civil),
            normalizeValue(body.ciudad),
            normalizeValue(body.celular),
            normalizeValue(body.monto_solicitado),
            normalizeValue(body.destino_credito),
            normalizeValue(body.ingreso_neto_recibir),
            normalizeValue(body.fuente_ingreso),
            normalizeValue(body.tipo_relacion_laboral),
            normalizeValue(body.actividad_economica),
            normalizeValue(body.tiempo_actividad_anios),
            mergedActividad,
            normalizeValue(body.tipo_vivienda),
            normalizeValue(body.mantiene_hijos),
            normalizeValue(body.otros_ingresos),
            JSON.stringify({
                ...body,
                _meta: {
                    source: "public_rrss_form",
                    ip: getClientIp(req),
                    userAgent: String(req.headers["user-agent"] || ""),
                    createdAt: new Date().toISOString(),
                },
            }),
        ];

        let result;
        try {
            const [insertResult] = await pool.query(sqlWithRaw, params);
            result = insertResult;
        } catch (insertErr) {
            if (insertErr?.code !== "ER_BAD_FIELD_ERROR") {
                throw insertErr;
            }
            const fallbackParams = params.slice(0, -1);
            const [insertResult] = await pool.query(sqlWithoutRaw, fallbackParams);
            result = insertResult;
        }
        return res.status(201).json({
            ok: true,
            message: "Formulario recibido correctamente",
            staging_id: result.insertId,
        });
    } catch (err) {
        console.error("Error en POST /public/rrss-leads:", err);
        return res.status(500).json({ error: "Error guardando formulario externo" });
    }
});

export default router;
