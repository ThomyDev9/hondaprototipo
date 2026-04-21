// src/routes/agente.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import AgenteDAO from "../../services/dao/AgenteDAO.js";
import {
    ensureImportStatsTable,
    recomputeImportStats,
} from "../../services/bases.service.js";
import {
    linkManagementToKnownRecording,
    linkManagementToRecording,
} from "../../services/recording-link.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { registerQueueRoutes } from "./queue.routes.js";
import { registerFormRoutes } from "./form.routes.js";
import { registerGestionRoutes } from "./gestion.routes.js";
import { registerOutboundRoutes } from "./outbound.routes.js";
import { registerInboundRoutes } from "./inbound.routes.js";
import { registerRedesRoutes } from "./redes.routes.js";
import recordingSftpRouter from "../supervisor/recording.sftp.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const OUT_MAQUITA_CAMPAIGN = "out maquita cushunchic";
const outboundSchema =
    process.env.MYSQL_DB ||
    process.env.MYSQL_DB_ENCUESTA ||
    "cck_dev_pruebas";
const agenteDAO = new AgenteDAO(pool);

function isOutMaquitaCampaign(campaignId) {
    return String(campaignId || "").trim().toLowerCase() === OUT_MAQUITA_CAMPAIGN;
}

/**
 * Middleware: verifica que el agente NO esté bloqueado
 */
async function requireNotBlocked(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Usuario no autenticado" });
        }

        const userStateRow = await agenteDAO.getUserStateById(userId);

        if (!userStateRow) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const userState = String(userStateRow.State || "").toUpperCase();
        const bloqueado =
            userState === "0" ||
            userState === "BLOQUEADO" ||
            userState === "INACTIVO";

        if (bloqueado) {
            return res.status(403).json({
                error: "Usuario bloqueado por inactividad. Comunícate con un administrador.",
            });
        }

        return next();
    } catch (err) {
        console.error("Error en requireNotBlocked:", err);
        return res
            .status(500)
            .json({ error: "Error verificando estado del agente" });
    }
}

// Middlewares comunes para todas las rutas del agente
const agenteMiddlewares = [
    requireAuth,
    loadUserRoles,
    requireRole(["ASESOR", "SUPERVISOR", "ADMINISTRADOR"]),
    requireNotBlocked,
];

function getAgentActor(req) {
    return req.user?.username || req.user?.email || String(req.user?.id);
}

async function recomputeStatsByContactId(contactId, actor) {
    const id = String(contactId || "").trim();
    if (!id) return;

    const contactRow = await agenteDAO.getCampaignAndImportByContactId(id);

    const campaignId = String(contactRow?.Campaign || "").trim();
    const importId = String(contactRow?.LastUpdate || "").trim();

    if (!campaignId || !importId) {
        return;
    }

    await recomputeImportStats(campaignId, importId, actor || "system", pool);
}

function normalizeTemplateRows(rows) {
    const byFieldId = new Map();

    for (const row of rows) {
        if (!byFieldId.has(row.field_id)) {
            byFieldId.set(row.field_id, {
                key: String(row.field_key || "").trim(),
                label: String(row.label || "").trim(),
                type: String(row.field_type || "text").trim() || "text",
                required: Number(row.is_required || 0) === 1,
                order: Number(row.display_order || 0),
                placeholder: row.placeholder || "",
                maxLength: row.max_length || null,
                minValue: row.min_value || null,
                maxValue: row.max_value || null,
                defaultValue: row.default_value || "",
                helpText: row.help_text || "",
                options: [],
            });
        }

        if (row.option_value !== null && row.option_value !== undefined) {
            const field = byFieldId.get(row.field_id);
            field.options.push(
                String(row.option_label || row.option_value || "").trim(),
            );
        }
    }

    return Array.from(byFieldId.values()).sort((a, b) => a.order - b.order);
}

async function saveDynamicResponseIfTemplateActive({
    campaignId,
    categoryId,
    menuItemId,
    formType,
    contactId,
    agentUser,
    payload,
}) {
    const campaignIdToUse = String(campaignId || "").trim();
    const categoryIdToUse = String(categoryId || "").trim();
    const menuItemIdToUse = String(menuItemId || "").trim();
    if (!campaignIdToUse && !menuItemIdToUse) {
        return {
            saved: false,
            reason: "missing_campaign_or_menu_item",
        };
    }

    const templateRows = menuItemIdToUse
        ? await agenteDAO.getActiveTemplateByMenuItemAndType(
              formType,
              menuItemIdToUse,
          )
        : await agenteDAO.getActiveTemplateByCampaignAndType(
              formType,
              campaignIdToUse,
              categoryIdToUse,
          );

    if (templateRows.length === 0) {
        return {
            saved: false,
            reason: "template_not_found",
        };
    }

    const template = templateRows[0];
    const payloadJson = JSON.stringify(payload || {});

    await agenteDAO.insertDynamicFormResponse(
        String(template.menu_item_id || "").trim(),
        formType,
        template.template_id,
        String(contactId || "").trim(),
        String(agentUser || "").trim(),
        payloadJson,
    );

    return {
        saved: true,
        templateId: template.template_id,
        resolvedMenuItemId: String(template.menu_item_id || "").trim(),
        formType,
    };
}

function buildOutboundQuestionPayload(entries = []) {
    const preguntas = Array.from({ length: 30 }, () => "");
    const respuestas = Array.from({ length: 30 }, () => "");

    entries.slice(0, 30).forEach((entry, index) => {
        preguntas[index] = String(entry?.label || "").trim();
        respuestas[index] = String(entry?.value || "").trim();
    });

    return { preguntas, respuestas };
}

function buildOutboundCampos(formData = {}, campaignId = "") {
    if (isOutMaquitaCampaign(campaignId)) {
        return [
            String(formData?.tipoCampana || "").trim(),
            String(
                formData?.entregaDocumentos ||
                    formData?.["Entrega de documentos"] ||
                    "",
            ).trim(),
            String(
                formData?.agenciaAsistir ||
                    formData?.["Agencia asistir"] ||
                    "",
            ).trim(),
            String(formData?.Plataforma || "").trim(),
            String(formData?.Provincia || "").trim(),
            String(formData?.Gestion || "").trim(),
            String(formData?.FechaAgenda || "").trim(),
            String(formData?.Email || "").trim(),
            String(formData?.motivoInteraccion || "").trim(),
            String(formData?.submotivoInteraccion || "").trim(),
        ];
    }

    return [
        String(formData?.tipoCampana || "").trim(),
        String(formData?.Concesionario || "").trim(),
        String(formData?.Modelo || "").trim(),
        String(formData?.Plataforma || "").trim(),
        String(formData?.Provincia || "").trim(),
        String(formData?.Gestion || "").trim(),
        String(formData?.FechaAgenda || "").trim(),
        String(formData?.Email || "").trim(),
        String(formData?.motivoInteraccion || "").trim(),
        String(formData?.submotivoInteraccion || "").trim(),
    ];
}

registerQueueRoutes(router, {
    pool,
    agenteDAO,
    agenteMiddlewares,
    ensureImportStatsTable,
    recomputeStatsByContactId,
    getAgentActor,
    requireAuth,
});

registerGestionRoutes(router, {
    pool,
    agenteDAO,
    agenteMiddlewares,
    encuestaSchema: outboundSchema,
    getAgentActor,
    recomputeImportStats,
    linkManagementToRecording,
    saveDynamicResponseIfTemplateActive,
});

registerFormRoutes(router, {
    pool,
    agenteDAO,
    agenteMiddlewares,
    requireAuth,
    normalizeTemplateRows,
    getAgentActor,
});

registerOutboundRoutes(router, {
    agenteDAO,
    agenteMiddlewares,
    encuestaSchema: outboundSchema,
    getAgentActor,
    buildOutboundCampos,
    buildOutboundQuestionPayload,
    saveDynamicResponseIfTemplateActive,
    isOutMaquitaCampaign,
    linkManagementToRecording,
});

registerInboundRoutes(router, {
    agenteDAO,
    agenteMiddlewares,
    encuestaSchema: outboundSchema,
    getAgentActor,
    buildOutboundCampos,
    buildOutboundQuestionPayload,
    saveDynamicResponseIfTemplateActive,
    linkManagementToRecording,
    linkManagementToKnownRecording,
});

registerRedesRoutes(router, {
    agenteDAO,
    agenteMiddlewares,
    getAgentActor,
    saveDynamicResponseIfTemplateActive,
});

router.use("/grabacion-sftp", ...agenteMiddlewares, recordingSftpRouter);

export default router;
