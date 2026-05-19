// backend/src/routes/admin.routes.js
import express from "express";
import pool from "../../services/db.js";
import * as userService from "../../services/user.service.js";
import AdminManagementDAO from "../../services/dao/AdminManagementDAO.js";
import { DEFAULT_MENU_CATEGORY_ID } from "../../services/menu.service.js";
import {
    createManagementLevel,
    createManagementLevelsBulk,
    createManagementLevelsFromPairs,
    normalizeManagementPayload,
    resolveManagementActor,
    updateManagementLevel,
} from "../../services/adminManagement.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";
import ServiceResourcesDAO from "../../services/dao/ServiceResourcesDAO.js";
import { decryptSecret, encryptSecret } from "../../utils/credentialVault.js";

const router = express.Router();
const adminManagementDAO = new AdminManagementDAO(pool);
const serviceResourcesDAO = new ServiceResourcesDAO(pool);

const middlewaresAdmin = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR", "SUPERVISOR"]),
];

const middlewaresAdminStrict = [
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
];

function getFlexibleCategoryCodeRange(categoryName = "") {
    const normalized = String(categoryName || "").trim().toLowerCase();
    if (normalized.includes("inbound")) {
        return { minCode: 1000, maxCode: 1999 };
    }
    if (normalized.includes("redes")) {
        return { minCode: 2000, maxCode: 2099 };
    }
    return null;
}

router.get("/users", ...middlewaresAdmin, async (_req, res) => {
    try {
        const users = await userService.obtenerUsuarios();
        return res.json({ users });
    } catch (err) {
        console.error("Error en /admin/users:", err);
        return res.status(500).json({
            error: "Error inesperado en /admin/users",
        });
    }
});

router.get(
    "/management-levels/suggestions",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const data = await adminManagementDAO.getManagementLevelSuggestions();
            const categoryId = String(
                req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const categoryName =
                await adminManagementDAO.getCategoryNameById(categoryId);
            const flexibleRange = getFlexibleCategoryCodeRange(categoryName);

            let descriptions = [];
            let nextCode = null;
            if (flexibleRange) {
                descriptions =
                    await adminManagementDAO.getFlexibleDescriptionSuggestions(
                        flexibleRange.minCode,
                        flexibleRange.maxCode,
                    );
                nextCode = await adminManagementDAO.getNextCodeInRange(
                    flexibleRange.minCode,
                    flexibleRange.maxCode,
                );
            }

            return res.json({
                data: {
                    ...data,
                    descriptions,
                    nextCode,
                },
            });
        } catch (err) {
            console.error(
                "Error GET /admin/management-levels/suggestions:",
                err,
            );
            return res.status(500).json({
                error: "Error obteniendo sugerencias de niveles",
            });
        }
    },
);

router.get(
    "/management-levels/campaigns",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const categoryId = String(
                req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const rows =
                await adminManagementDAO.getManagementLevelCampaigns(categoryId);

            return res.json({
                data: rows.map((row) => ({
                    id: row.campaign_id,
                    label: `${row.parent_name} > ${row.campaign_id}`,
                })),
            });
        } catch (err) {
            console.error("Error GET /admin/management-levels/campaigns:", err);
            return res.status(500).json({
                error: "Error obteniendo campanas para niveles de gestion",
            });
        }
    },
);

router.get(
    "/management-levels",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const categoryId = String(
                req.query?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const campaignId = String(req.query?.campaignId || "").trim();
            const state = String(req.query?.state || "1").trim();

            if (!campaignId) {
                return res
                    .status(400)
                    .json({ error: "campaignId es requerido" });
            }

            const rows = await adminManagementDAO.getManagementLevels(
                campaignId,
                state,
            );

            return res.json({ data: rows });
        } catch (err) {
            console.error("Error GET /admin/management-levels:", err);
            return res.status(500).json({
                error: "Error obteniendo niveles de gestion",
            });
        }
    },
);

router.post(
    "/management-levels",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const result = await createManagementLevel(adminManagementDAO, {
                ...normalizeManagementPayload(req.body),
                actor: resolveManagementActor(req.user),
            });

            return res.status(201).json({
                message: "Nivel de gestion creado correctamente",
                data: { id: result.insertId },
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({ error: err.message });
            }

            console.error("Error POST /admin/management-levels:", err);
            return res.status(500).json({
                error: "Error creando nivel de gestion",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/management-levels/bulk",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const result = await createManagementLevelsBulk(adminManagementDAO, {
                ...normalizeManagementPayload(req.body),
                actor: resolveManagementActor(req.user),
                level2List: req.body?.level2List,
            });

            return res.status(201).json({
                message: `Niveles creados: ${result.createdCount}. Omitidos por duplicado: ${result.skippedCount}`,
                data: result,
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({ error: err.message });
            }

            console.error("Error POST /admin/management-levels/bulk:", err);
            return res.status(500).json({
                error: "Error creando niveles de gestion en bloque",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/management-levels/bulk-pairs",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const categoryId = String(
                req.body?.categoryId || DEFAULT_MENU_CATEGORY_ID,
            ).trim();
            const campaignId = String(req.body?.campaignId || "").trim();
            const code = Number(req.body?.code || 0);
            const description = String(req.body?.description || "").trim();
            const isgoal = Number(req.body?.isgoal || 1) === 1 ? 1 : 0;
            const state = Number(req.body?.state || 1) === 0 ? "0" : "1";
            const actor = resolveManagementActor(req.user);
            const items = Array.isArray(req.body?.items) ? req.body.items : [];

            if (!campaignId) {
                return res.status(400).json({
                    error: "campaignId es requerido",
                });
            }

            if (items.length === 0) {
                return res.status(400).json({
                    error: "Debes enviar al menos un par Level1/Level2",
                });
            }

            const result = await createManagementLevelsFromPairs(
                adminManagementDAO,
                {
                    categoryId,
                    campaignId,
                    code,
                    description,
                    isgoal,
                    state,
                    actor,
                    items,
                },
            );

            return res.status(201).json({
                message: `Niveles creados: ${result.createdCount}`,
                data: result,
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({
                    error: err.message,
                    data: err.payload,
                });
            }

            console.error(
                "Error POST /admin/management-levels/bulk-pairs:",
                err,
            );
            return res.status(500).json({
                error: "Error creando niveles por pares",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.put(
    "/management-levels/:id",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            await updateManagementLevel(adminManagementDAO, {
                id: Number(req.params?.id || 0),
                ...normalizeManagementPayload(req.body),
                actor: resolveManagementActor(req.user),
            });

            return res.json({
                message: "Nivel de gestion actualizado correctamente",
            });
        } catch (err) {
            if (err?.status) {
                return res.status(err.status).json({ error: err.message });
            }

            console.error("Error PUT /admin/management-levels/:id:", err);
            return res.status(500).json({
                error: "Error actualizando nivel de gestion",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.get(
    "/coop-services",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const campaignId = String(req.query?.campaignId || "").trim();
            const rows = await serviceResourcesDAO.listResources({
                campaignId,
                includeInactive: true,
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
                        activo: Number(row.activo || 0) === 1,
                        homeShortcut: Number(row.home_shortcut || 0) === 1,
                        requiresVirtualMachine:
                            Number(row.requires_virtual_machine || 0) === 1,
                        virtualMachineNotes: row.virtual_machine_notes || "",
                        credentials: [],
                    });
                }

                if (
                    row.credential_id &&
                    (String(row.scope_type || "global") === "global" ||
                        (String(row.scope_type || "global") === "advisor" &&
                            !row.owner_user_id))
                ) {
                    grouped.get(row.id).credentials.push({
                        id: row.credential_id,
                        alias: row.alias,
                        priority: Number(row.priority || 0),
                        activo: Number(row.credential_activo || 0) === 1,
                        scopeType: String(row.scope_type || "global"),
                        credentialKind: String(row.credential_kind || "app"),
                        ownerUserId: Number(row.owner_user_id || 0) || null,
                        ownerUsername: String(row.owner_username || ""),
                    });
                }
            }

            return res.json({ data: Array.from(grouped.values()) });
        } catch (err) {
            console.error("Error GET /admin/coop-services:", err);
            return res.status(500).json({ error: "Error cargando servicios" });
        }
    },
);

router.post("/coop-services", ...middlewaresAdminStrict, async (req, res) => {
    try {
        const actor = resolveManagementActor(req.user);
        const campaignId = String(req.body?.campaignId || "").trim();
        const accessScope =
            String(req.body?.accessScope || "campaign").trim().toLowerCase() ===
            "all_advisors"
                ? "all_advisors"
                : "campaign";
        const nombreServicio = String(req.body?.nombreServicio || "").trim();
        const url = String(req.body?.url || "").trim();
        const notas = String(req.body?.notas || "").trim();
        const orden = Number(req.body?.orden || 0);
        const activo = Number(req.body?.activo ?? 1) === 1 ? 1 : 0;
        const requiresVirtualMachine =
            Number(req.body?.requiresVirtualMachine || 0) === 1 ? 1 : 0;
        const virtualMachineNotes = String(
            req.body?.virtualMachineNotes || "",
        ).trim();

        if (!nombreServicio) {
            return res.status(400).json({ error: "nombreServicio es requerido" });
        }
        if (accessScope === "campaign" && !campaignId) {
            return res.status(400).json({
                error: "campaignId es requerido cuando el alcance es por campaña",
            });
        }

        const normalizedCampaignId =
            accessScope === "all_advisors"
                ? campaignId || "GLOBAL_SHARED"
                : campaignId;

        const resourceId = await serviceResourcesDAO.createResource({
            campaignId: normalizedCampaignId,
            accessScope,
            nombreServicio,
            url,
            notas,
            orden,
            activo,
            homeShortcut: Number(req.body?.homeShortcut || 0) === 1 ? 1 : 0,
            requiresVirtualMachine,
            virtualMachineNotes,
            actor,
        });

        return res.status(201).json({ data: { id: resourceId } });
    } catch (err) {
        console.error("Error POST /admin/coop-services:", err);
        return res.status(500).json({ error: "Error creando servicio" });
    }
});

router.patch(
    "/coop-services/:id",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const actor = resolveManagementActor(req.user);
            const resourceId = Number(req.params?.id || 0);
            const campaignId = String(req.body?.campaignId || "").trim();
            const accessScope =
                String(req.body?.accessScope || "campaign")
                    .trim()
                    .toLowerCase() === "all_advisors"
                    ? "all_advisors"
                    : "campaign";
            const nombreServicio = String(req.body?.nombreServicio || "").trim();
            const url = String(req.body?.url || "").trim();
            const notas = String(req.body?.notas || "").trim();
            const orden = Number(req.body?.orden || 0);
            const activo = Number(req.body?.activo ?? 1) === 1 ? 1 : 0;
            const requiresVirtualMachine =
                Number(req.body?.requiresVirtualMachine || 0) === 1 ? 1 : 0;
            const virtualMachineNotes = String(
                req.body?.virtualMachineNotes || "",
            ).trim();

            if (!resourceId || !nombreServicio) {
                return res.status(400).json({
                    error: "id y nombreServicio son requeridos",
                });
            }
            if (accessScope === "campaign" && !campaignId) {
                return res.status(400).json({
                    error: "campaignId es requerido cuando el alcance es por campaña",
                });
            }

            const normalizedCampaignId =
                accessScope === "all_advisors"
                    ? campaignId || "GLOBAL_SHARED"
                    : campaignId;

            await serviceResourcesDAO.updateResource(resourceId, {
                campaignId: normalizedCampaignId,
                accessScope,
                nombreServicio,
                url,
                notas,
                orden,
                activo,
                homeShortcut: Number(req.body?.homeShortcut || 0) === 1 ? 1 : 0,
                requiresVirtualMachine,
                virtualMachineNotes,
                actor,
            });

            return res.json({ message: "Servicio actualizado" });
        } catch (err) {
            console.error("Error PATCH /admin/coop-services/:id:", err);
            return res.status(500).json({ error: "Error actualizando servicio" });
        }
    },
);

router.post(
    "/coop-services/:id/credentials",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const actor = resolveManagementActor(req.user);
            const resourceId = Number(req.params?.id || 0);
            const alias = String(req.body?.alias || "").trim();
            const username = String(req.body?.username || "").trim();
            const password = String(req.body?.password || "").trim();
            const extra = String(req.body?.extra || "").trim();
            const priority = Number(req.body?.priority || 0);
            const activo = Number(req.body?.activo ?? 1) === 1 ? 1 : 0;
            const scopeType =
                String(req.body?.scopeType || "global").trim().toLowerCase() ===
                "advisor"
                    ? "advisor"
                    : "global";
            const credentialKind =
                String(req.body?.credentialKind || "app").trim().toLowerCase() ===
                "vm"
                    ? "vm"
                    : "app";
            const normalizedScopeType =
                credentialKind === "vm" ? "global" : scopeType;

            if (
                !resourceId ||
                !alias ||
                (normalizedScopeType === "global" && (!username || !password))
            ) {
                return res.status(400).json({
                    error: "resourceId y alias son requeridos. Para global también username y password",
                });
            }

            const credentialId = await serviceResourcesDAO.createCredential({
                resourceId,
                alias,
                username: encryptSecret(username || ""),
                password: encryptSecret(password || ""),
                extra: extra ? encryptSecret(extra) : null,
                priority,
                activo,
                scopeType: normalizedScopeType,
                ownerUserId: null,
                ownerUsername: null,
                credentialKind,
                actor,
            });

            return res.status(201).json({ data: { id: credentialId } });
        } catch (err) {
            console.error("Error POST /admin/coop-services/:id/credentials:", err);
            return res.status(500).json({ error: "Error creando credencial" });
        }
    },
);

router.patch(
    "/coop-services/credentials/:credentialId",
    ...middlewaresAdminStrict,
    async (req, res) => {
        try {
            const actor = resolveManagementActor(req.user);
            const credentialId = Number(req.params?.credentialId || 0);
            const current = await serviceResourcesDAO.getCredentialById(credentialId);

            if (!current) {
                return res.status(404).json({ error: "Credencial no encontrada" });
            }
            const requestedScopeType =
                String(req.body?.scopeType || "").trim().toLowerCase() === "advisor"
                    ? "advisor"
                    : "global";
            const requestedCredentialKind =
                String(req.body?.credentialKind || current.credential_kind || "app")
                    .trim()
                    .toLowerCase() === "vm"
                    ? "vm"
                    : "app";
            const scopeType = current.owner_user_id
                ? "advisor"
                : requestedScopeType || String(current.scope_type || "global");
            const normalizedScopeType =
                requestedCredentialKind === "vm" ? "global" : scopeType;

            const alias = String(req.body?.alias || current.alias || "").trim();
            const username = String(
                req.body?.username ||
                    decryptSecret({
                        encrypted: current.username_encrypted,
                        iv: current.username_iv,
                        tag: current.username_tag,
                    }),
            ).trim();
            const password = String(
                req.body?.password ||
                    decryptSecret({
                        encrypted: current.password_encrypted,
                        iv: current.password_iv,
                        tag: current.password_tag,
                    }),
            ).trim();
            const extraIncoming = req.body?.extra;
            const extra =
                extraIncoming === undefined
                    ? decryptSecret({
                          encrypted: current.extra_encrypted,
                          iv: current.extra_iv,
                          tag: current.extra_tag,
                      })
                    : String(extraIncoming || "").trim();
            const priority = Number(req.body?.priority || 0);
            const activo = Number(req.body?.activo ?? 1) === 1 ? 1 : 0;

            await serviceResourcesDAO.updateCredential(credentialId, {
                alias,
                username: encryptSecret(username || ""),
                password: encryptSecret(password || ""),
                extra: extra ? encryptSecret(extra) : null,
                priority,
                activo,
                scopeType: normalizedScopeType,
                ownerUserId: current.owner_user_id || null,
                ownerUsername: current.owner_username || null,
                credentialKind: requestedCredentialKind,
                actor,
            });

            return res.json({ message: "Credencial actualizada" });
        } catch (err) {
            console.error(
                "Error PATCH /admin/coop-services/credentials/:credentialId:",
                err,
            );
            return res.status(500).json({ error: "Error actualizando credencial" });
        }
    },
);

export default router;
