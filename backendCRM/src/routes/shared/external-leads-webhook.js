import express from "express";
import pool from "../../services/db.js";

const router = express.Router();

function normalizeValue(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === "" ? null : normalized;
}

function ensureWebhookToken(req, res, next) {
    const expectedToken = String(
        process.env.EXTERNAL_LEADS_WEBHOOK_TOKEN || "",
    ).trim();

    if (!expectedToken) {
        return res.status(503).json({
            error: "Webhook token no configurado en servidor",
        });
    }

    const providedToken = String(req.headers["x-webhook-token"] || "").trim();
    if (providedToken !== expectedToken) {
        return res.status(401).json({ error: "Token de webhook invalido" });
    }

    return next();
}

router.post("/rrss", ensureWebhookToken, async (req, res) => {
    try {
        const body = req.body || {};

        const numeroCedula = normalizeValue(body.numero_cedula);
        if (!numeroCedula) {
            return res
                .status(400)
                .json({ error: "numero_cedula es obligatorio" });
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

        const actividadEconomica = normalizeValue(body.actividad_economica);
        const tiempoActividad = normalizeValue(
            body.tiempo_actividad_economica_anios || body.tiempo_actividad_anios,
        );
        const actividadEconomicaTiempo =
            normalizeValue(body.actividad_economica_tiempo) ||
            normalizeValue(
                `${actividadEconomica || ""}${actividadEconomica && tiempoActividad ? " | " : ""}${tiempoActividad || ""}`,
            );

        const params = [
            normalizeValue(body.source_sheet_name) || "rrss",
            normalizeValue(body.fecha),
            normalizeValue(body.autoriza_buro),
            numeroCedula,
            normalizeValue(body.apellidos_nombres_completos),
            normalizeValue(body.estado_civil),
            normalizeValue(body.ciudad),
            normalizeValue(body.celular),
            normalizeValue(body.monto_solicitado),
            normalizeValue(body.destino_credito),
            normalizeValue(body.ingreso_neto_recibir),
            normalizeValue(body.fuente_ingreso),
            normalizeValue(body.tipo_relacion_laboral),
            actividadEconomica,
            tiempoActividad,
            actividadEconomicaTiempo,
            normalizeValue(body.tipo_vivienda),
            normalizeValue(body.mantiene_hijos),
            normalizeValue(body.otros_ingresos),
            JSON.stringify(body),
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
            staging_id: result.insertId,
            message:
                "Lead insertado en staging RRSS. Sync a tabla maestra via trigger.",
        });
    } catch (err) {
        console.error("Error en POST /external-leads-webhook/rrss:", err);
        return res.status(500).json({
            error: "Error insertando lead RRSS en staging",
        });
    }
});

export default router;
