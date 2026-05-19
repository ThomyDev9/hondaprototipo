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
import ServiceResourcesDAO from "../../services/dao/ServiceResourcesDAO.js";
import { decryptSecret, encryptSecret } from "../../utils/credentialVault.js";

const router = express.Router();
const OUT_MAQUITA_CAMPAIGN = "out maquita cushunchic";
const outboundSchema =
    process.env.MYSQL_DB || process.env.MYSQL_DB_ENCUESTA || "cck_dev_pruebas";
const agenteDAO = new AgenteDAO(pool);
const serviceResourcesDAO = new ServiceResourcesDAO(pool);

function isOutMaquitaCampaign(campaignId) {
    return (
        String(campaignId || "")
            .trim()
            .toLowerCase() === OUT_MAQUITA_CAMPAIGN
    );
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
                formData?.agenciaAsistir || formData?.["Agencia asistir"] || "",
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

router.get("/coop-services", ...agenteMiddlewares, async (req, res) => {
    try {
        const campaignId = String(req.query?.campaignId || "").trim();
        const debugMode = String(req.query?.debug || "").trim() === "1";
        const includeAllCredentials =
            String(req.query?.includeAllCredentials || "").trim() === "1";

        const advisorUserId = Number(req.user?.id || 0);
        const rows = includeAllCredentials
            ? await serviceResourcesDAO.listResources({
                  campaignId,
                  includeInactive: false,
              })
            : await serviceResourcesDAO.listResourcesWithResolvedCredentials({
                  campaignId,
                  ownerUserId: advisorUserId,
              });
        const grouped = new Map();

        for (const row of rows) {
            if (!grouped.has(row.id)) {
                grouped.set(row.id, {
                    id: row.id,
                    campaignId: row.campaign_id,
                    accessScope: String(row.access_scope || "campaign"),
                    nombreServicio: row.nombre_servicio,
                    url: row.url || "",
                    notas: row.notas || "",
                    orden: Number(row.orden || 0),
                    homeShortcut: Number(row.home_shortcut || 0) === 1,
                    requiresVirtualMachine:
                        Number(row.requires_virtual_machine || 0) === 1,
                    virtualMachineNotes: row.virtual_machine_notes || "",
                    requiresAdvisorCredential:
                        Number(row.requires_advisor_credential || 0) === 1,
                    appCredential: null,
                    vmCredential: null,
                    credentials: [],
                });
            }

            if (includeAllCredentials) {
                if (
                    row.credential_id &&
                    String(row.credential_kind || "app") === "app" &&
                    String(row.scope_type || "global") === "global" &&
                    Number(row.credential_activo || 0) === 1
                ) {
                    grouped.get(row.id).credentials.push({
                        id: row.credential_id,
                        alias: row.alias,
                        priority: Number(row.priority || 0),
                        scopeType: "global",
                    });
                }
                if (
                    row.credential_id &&
                    String(row.credential_kind || "app") === "vm" &&
                    String(row.scope_type || "global") === "global" &&
                    Number(row.credential_activo || 0) === 1 &&
                    !grouped.get(row.id).vmCredential
                ) {
                    grouped.get(row.id).vmCredential = {
                        id: row.credential_id,
                        alias: row.alias,
                        scopeType: "global",
                    };
                }
            } else {
                if (row.app_credential_id) {
                    grouped.get(row.id).appCredential = {
                        id: row.app_credential_id,
                        alias: row.app_alias,
                        priority: Number(row.app_priority || 0),
                        scopeType: String(row.app_scope_type || "global"),
                    };
                    grouped.get(row.id).credentials = [
                        grouped.get(row.id).appCredential,
                    ];
                }
                if (row.vm_credential_id) {
                    grouped.get(row.id).vmCredential = {
                        id: row.vm_credential_id,
                        alias: row.vm_alias,
                        scopeType: "global",
                    };
                }
            }
        }

        if (debugMode) {
            const summary = {
                advisorUserId,
                advisorUsername:
                    req.user?.username ||
                    req.user?.email ||
                    String(req.user?.id || ""),
                campaignIdFilter: campaignId,
                rowsCount: rows.length,
                groupedCount: grouped.size,
                requiresAdvisorCount: Array.from(grouped.values()).filter(
                    (item) => item.requiresAdvisorCredential,
                ).length,
                withResolvedCredentialCount: Array.from(
                    grouped.values(),
                ).filter((item) => (item.credentials || []).length > 0).length,
            };
        }

        return res.json({ data: Array.from(grouped.values()) });
    } catch (err) {
        console.error("Error GET /agente/coop-services:", err);
        return res
            .status(500)
            .json({ error: "Error cargando servicios de cooperativa" });
    }
});

router.post(
    "/coop-services/credentials/:credentialId/reveal",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            const credentialId = Number(req.params?.credentialId || 0);
            if (!credentialId) {
                return res.status(400).json({ error: "credentialId invalido" });
            }

            const credential =
                await serviceResourcesDAO.getCredentialForAdvisor({
                    credentialId,
                    advisorUserId: Number(req.user?.id || 0),
                    requireActive: true,
                });
            if (!credential) {
                return res
                    .status(404)
                    .json({ error: "Credencial no encontrada" });
            }

            const action =
                String(req.body?.action || "reveal").trim() || "reveal";
            await serviceResourcesDAO.insertAccessLog({
                credentialId: credential.id,
                resourceId: credential.resource_id,
                userId: req.user?.id || null,
                username:
                    req.user?.username ||
                    req.user?.email ||
                    String(req.user?.id || ""),
                action,
                ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
            });

            return res.json({
                data: {
                    credentialId: credential.id,
                    alias: credential.alias,
                    username: decryptSecret({
                        encrypted: credential.username_encrypted,
                        iv: credential.username_iv,
                        tag: credential.username_tag,
                    }),
                    password: decryptSecret({
                        encrypted: credential.password_encrypted,
                        iv: credential.password_iv,
                        tag: credential.password_tag,
                    }),
                    extra: decryptSecret({
                        encrypted: credential.extra_encrypted,
                        iv: credential.extra_iv,
                        tag: credential.extra_tag,
                    }),
                    scopeType: String(credential.scope_type || "global"),
                },
            });
        } catch (err) {
            console.error(
                "Error POST /agente/coop-services/credentials/:credentialId/reveal:",
                err,
            );
            return res
                .status(500)
                .json({ error: "Error revelando credencial" });
        }
    },
);

router.patch(
    "/coop-services/:resourceId/my-credential",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            const resourceId = Number(req.params?.resourceId || 0);
            const advisorUserId = Number(req.user?.id || 0);
            const advisorUsername = String(
                req.user?.username || req.user?.email || req.user?.id || "",
            ).trim();
            const alias = String(req.body?.alias || "").trim();
            const username = String(req.body?.username || "").trim();
            const password = String(req.body?.password || "").trim();
            const extra = String(req.body?.extra || "").trim();

            if (!resourceId) {
                return res.status(400).json({ error: "resourceId invalido" });
            }
            if (!advisorUserId || !advisorUsername) {
                return res.status(401).json({ error: "Usuario invalido" });
            }
            if (!alias || !username || !password) {
                return res.status(400).json({
                    error: "alias, username y password son requeridos",
                });
            }

            const resource =
                await serviceResourcesDAO.getResourceById(resourceId);
            if (!resource || Number(resource?.activo || 0) !== 1) {
                return res
                    .status(404)
                    .json({ error: "Servicio no disponible" });
            }

            await serviceResourcesDAO.upsertAdvisorCredential({
                resourceId,
                alias,
                username: encryptSecret(username),
                password: encryptSecret(password),
                extra: extra ? encryptSecret(extra) : null,
                priority: 0,
                activo: 1,
                ownerUserId: advisorUserId,
                ownerUsername: advisorUsername,
                actor: advisorUsername,
            });

            return res.json({ message: "Credencial personal guardada" });
        } catch (err) {
            console.error(
                "Error PATCH /agente/coop-services/:resourceId/my-credential:",
                err,
            );
            return res
                .status(500)
                .json({ error: "Error guardando credencial personal" });
        }
    },
);

router.use("/grabacion-sftp", ...agenteMiddlewares, recordingSftpRouter);

export default router;
