import express from "express";
import pool from "../../services/db.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

router.use(
    requireAuth,
    loadUserRoles,
    requireRole(["CONSULTOR", "CONSULTOR_ADMIN"]),
);

function normalizeValue(value) {
    return String(value || "").trim();
}

function hasRole(req, role) {
    return Array.isArray(req.user?.roles) && req.user.roles.includes(role);
}

function getCurrentAssignee(req) {
    return normalizeValue(req.user?.id);
}

function buildWorkflowSnapshot(lead = {}) {
    const sourceChannel = normalizeValue(lead.source_channel).toLowerCase();
    const externalStatus = normalizeValue(lead.external_status);
    const externalSubstatus = normalizeValue(lead.external_substatus);
    const observacionExterno = normalizeValue(lead.observacion_externo);
    const seguimientoKimobill = normalizeValue(lead.seguimiento_kimobill);
    const observacionCooperativa = normalizeValue(lead.observacion_cooperativa);
    const procesoARealizar = normalizeValue(lead.proceso_a_realizar);
    const producto = normalizeValue(lead.producto);

    const alreadyManaged =
        sourceChannel === "mail"
            ? Boolean(externalStatus && externalSubstatus && observacionExterno)
            : sourceChannel === "rrss"
              ? Boolean(
                    externalStatus && externalSubstatus && seguimientoKimobill,
                )
              : false;

    const readyForPromotion =
        !alreadyManaged &&
        (sourceChannel === "mail"
            ? Boolean(procesoARealizar && observacionCooperativa)
            : sourceChannel === "rrss"
              ? Boolean(producto && observacionExterno && procesoARealizar)
              : false);

    const promotedAt = lead.promoted_at;
    const alreadyPromoted =
        Boolean(promotedAt) ||
        normalizeValue(lead.promotion_status).toLowerCase() === "promovido" ||
        normalizeValue(lead.workflow_status).toLowerCase() === "promovido";

    if (alreadyPromoted) {
        return {
            workflow_status: "promovido",
            promotion_status: "promovido",
            is_ready_for_promotion: 0,
        };
    }

    if (alreadyManaged) {
        return {
            workflow_status: "ya_gestionado",
            promotion_status: "ya_gestionado",
            is_ready_for_promotion: 0,
        };
    }

    if (readyForPromotion) {
        return {
            workflow_status: "listo_para_promocion",
            promotion_status: "listo",
            is_ready_for_promotion: 1,
        };
    }

    return {
        workflow_status: "pendiente_completar",
        promotion_status: "pendiente",
        is_ready_for_promotion: 0,
    };
}

function getActor(req) {
    return (
        req.user?.username ||
        req.user?.email ||
        req.user?.full_name ||
        String(req.user?.id || "")
    );
}

function isExpiredAssignment(lead = {}) {
    const workflowStatus = normalizeValue(lead.workflow_status).toLowerCase();
    if (workflowStatus !== "pendiente_completar") {
        return false;
    }

    const assignedAt = lead.assigned_at ? new Date(lead.assigned_at) : null;
    if (!assignedAt || Number.isNaN(assignedAt.getTime())) {
        return false;
    }

    return assignedAt.getTime() <= Date.now() - 24 * 60 * 60 * 1000;
}

function mapLeadForResponse(lead = {}) {
    if (!lead || typeof lead !== "object") {
        return lead;
    }

    if (isExpiredAssignment(lead)) {
        return {
            ...lead,
            workflow_status: "por_reasignar",
            base_workflow_status: normalizeValue(lead.workflow_status),
        };
    }

    return lead;
}

function canAccessLead(req, lead) {
    if (hasRole(req, "CONSULTOR_ADMIN")) {
        return true;
    }

    return normalizeValue(lead?.assigned_to) === getCurrentAssignee(req);
}

async function getConsultorPool() {
    const [activeRows] = await pool.query(
        `
        SELECT
            u.IdUser,
            CONCAT_WS(' ', u.Name1, u.Name2, u.Surname1, u.Surname2) AS full_name,
            u.Email,
            u.State
        FROM user u
        JOIN workgroup w ON w.Id = u.UserGroup
        WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
          AND TRIM(COALESCE(u.State, '')) = '1'
        ORDER BY u.IdUser ASC
        `,
    );

    if (activeRows.length > 0) {
        return activeRows.map((row) => ({
            id: normalizeValue(row.IdUser),
            name: normalizeValue(row.full_name) || normalizeValue(row.Email) || normalizeValue(row.IdUser),
        }));
    }

    const [fallbackRows] = await pool.query(
        `
        SELECT
            u.IdUser,
            CONCAT_WS(' ', u.Name1, u.Name2, u.Surname1, u.Surname2) AS full_name,
            u.Email
        FROM user u
        JOIN workgroup w ON w.Id = u.UserGroup
        WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
        ORDER BY u.IdUser ASC
        `,
    );

    return fallbackRows.map((row) => ({
        id: normalizeValue(row.IdUser),
        name: normalizeValue(row.full_name) || normalizeValue(row.Email) || normalizeValue(row.IdUser),
    }));
}

async function getConsultorAssignmentPool() {
    const [rows] = await pool.query(
        `
        SELECT
            u.IdUser,
            CONCAT_WS(' ', u.Name1, u.Name2, u.Surname1, u.Surname2) AS full_name,
            u.Email,
            u.State,
            COALESCE(cfg.assignment_percentage, 0) AS assignment_percentage,
            COALESCE(cfg.is_active, 0) AS is_active
        FROM user u
        JOIN workgroup w ON w.Id = u.UserGroup
        LEFT JOIN consultor_assignment_config cfg ON cfg.user_id = u.IdUser
        WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
        ORDER BY u.IdUser ASC
        `,
    );

    return rows.map((row) => ({
        id: normalizeValue(row.IdUser),
        name:
            normalizeValue(row.full_name) ||
            normalizeValue(row.Email) ||
            normalizeValue(row.IdUser),
        email: normalizeValue(row.Email),
        state: normalizeValue(row.State),
        assignment_percentage: Number(row.assignment_percentage || 0),
        is_active: Number(row.is_active || 0) === 1,
    }));
}

function hasWeightedConfiguration(pool = []) {
    const active = pool.filter(
        (item) => item.is_active && item.assignment_percentage > 0,
    );
    const total = active.reduce(
        (acc, item) => acc + Number(item.assignment_percentage || 0),
        0,
    );

    return active.length > 0 && Math.abs(total - 100) < 0.001;
}

function selectConsultorByWeight(pool = [], loads = new Map()) {
    const eligible = pool.filter(
        (item) => item.is_active && item.assignment_percentage > 0,
    );
    if (eligible.length === 0) {
        return null;
    }

    return eligible
        .slice()
        .sort((a, b) => {
            const aScore =
                (loads.get(a.id) || 0) / Number(a.assignment_percentage || 1);
            const bScore =
                (loads.get(b.id) || 0) / Number(b.assignment_percentage || 1);

            if (aScore !== bScore) {
                return aScore - bScore;
            }

            const loadDiff = (loads.get(a.id) || 0) - (loads.get(b.id) || 0);
            if (loadDiff !== 0) {
                return loadDiff;
            }

            return Number(a.id) - Number(b.id);
        })[0];
}

async function assignPendingLeadsRoundRobin() {
    const consultors = await getConsultorAssignmentPool();
    if (consultors.length === 0) {
        return { assigned: 0, consultors: 0 };
    }

    const [pendingRows] = await pool.query(
        `
        SELECT id
        FROM external_leads
        WHERE workflow_status = 'pendiente_completar'
          AND assigned_to IS NULL
        ORDER BY fecha_origen_dt ASC, id ASC
        `,
    );

    if (pendingRows.length === 0) {
        return { assigned: 0, consultors: consultors.length };
    }

    const [loadRows] = await pool.query(
        `
        SELECT assigned_to, COUNT(*) AS total
        FROM external_leads
        WHERE assigned_to IS NOT NULL
          AND workflow_status IN ('pendiente_completar', 'listo_para_promocion')
        GROUP BY assigned_to
        `,
    );

    const loads = new Map(consultors.map((consultor) => [consultor.id, 0]));

    loadRows.forEach((row) => {
        const assignee = normalizeValue(row.assigned_to);
        if (loads.has(assignee)) {
            loads.set(assignee, Number(row.total || 0));
        }
    });

    let assigned = 0;
    const canUseWeighted = hasWeightedConfiguration(consultors);

    for (const row of pendingRows) {
        const fallbackPool = consultors.filter(
            (item) => normalizeValue(item.state) === "1",
        );
        const nextConsultor = canUseWeighted
            ? selectConsultorByWeight(consultors, loads)
            : fallbackPool
                .slice()
                .sort((a, b) => {
                    const diff =
                        (loads.get(a.id) || 0) - (loads.get(b.id) || 0);
                    if (diff !== 0) return diff;
                    return Number(a.id) - Number(b.id);
                })[0] || consultors[0];

        if (!nextConsultor) {
            break;
        }

        await pool.query(
            `
            UPDATE external_leads
            SET
                assigned_to = ?,
                assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND assigned_to IS NULL
            `,
            [nextConsultor.id, row.id],
        );

        loads.set(nextConsultor.id, (loads.get(nextConsultor.id) || 0) + 1);
        assigned += 1;
    }

    return { assigned, consultors: consultors.length };
}

function buildLeadFilters(req, { includeWorkflow = true, includePromotion = true } = {}) {
    const isAdmin = hasRole(req, "CONSULTOR_ADMIN");
    const isConsultor = hasRole(req, "CONSULTOR") && !isAdmin;
    const sourceChannel = normalizeValue(req.query?.sourceChannel).toLowerCase();
    const workflowStatus = normalizeValue(req.query?.workflowStatus);
    const promotionStatus = normalizeValue(req.query?.promotionStatus);
    const identification = normalizeValue(req.query?.identification);
    const search = normalizeValue(req.query?.search);

    const where = [];
    const params = [];

    if (sourceChannel) {
        where.push("LOWER(el.source_channel) = ?");
        params.push(sourceChannel);
    }

    if (includeWorkflow && workflowStatus) {
        if (workflowStatus === "por_reasignar") {
            where.push(
                "el.workflow_status = 'pendiente_completar' AND el.assigned_at IS NOT NULL AND el.assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
            );
        } else {
            where.push("el.workflow_status = ?");
            params.push(workflowStatus);
        }
    }

    if (includePromotion && promotionStatus) {
        where.push("el.promotion_status = ?");
        params.push(promotionStatus);
    }

    if (identification) {
        where.push("el.identification LIKE ?");
        params.push(`%${identification}%`);
    }

    if (search) {
        where.push(
            "(el.full_name LIKE ? OR el.identification LIKE ? OR el.celular LIKE ?)",
        );
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (isConsultor) {
        where.push("el.assigned_to = ?");
        params.push(getCurrentAssignee(req));
    }

    return { where, params };
}

function buildAssignedDateRange(req, alias = "el") {
    const dateFrom = normalizeValue(req.query?.dateFrom);
    const dateTo = normalizeValue(req.query?.dateTo);
    const where = [];
    const params = [];

    if (dateFrom) {
        where.push(`${alias}.assigned_at >= ?`);
        params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
        where.push(`${alias}.assigned_at < DATE_ADD(?, INTERVAL 1 DAY)`);
        params.push(dateTo);
    }

    return { where, params };
}

router.get("/leads", async (req, res) => {
    try {
        const limit = Math.min(
            Math.max(Number(req.query?.limit || 200), 1),
            1000,
        );

        const { where, params } = buildLeadFilters(req);

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [rows] = await pool.query(
            `
            SELECT
                el.id,
                el.source_channel,
                el.identification,
                el.full_name,
                el.celular,
                el.city,
                el.province,
                el.external_status,
                el.external_substatus,
                el.workflow_status,
                el.promotion_status,
                el.is_ready_for_promotion,
                el.assigned_to,
                CONCAT_WS(' ', au.Name1, au.Name2, au.Surname1, au.Surname2) AS assigned_to_name,
                el.proceso_a_realizar,
                el.observacion_cooperativa,
                el.observacion_externo,
                el.producto,
                el.seguimiento_kimobill,
                el.assigned_at,
                el.fecha_origen_dt,
                el.updated_at,
                el.promoted_at
            FROM external_leads el
            LEFT JOIN user au ON au.IdUser = el.assigned_to
            ${whereSql}
            ORDER BY
                CASE el.workflow_status
                    WHEN 'pendiente_completar' THEN
                        CASE
                            WHEN el.assigned_at IS NOT NULL
                             AND el.assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                            THEN 0
                            ELSE 1
                        END
                    WHEN 'ya_gestionado' THEN 2
                    WHEN 'promovido' THEN 3
                    ELSE 4
                END ASC,
                el.updated_at DESC,
                el.id DESC
            LIMIT ?
            `,
            [...params, limit],
        );

        return res.json({ data: rows.map(mapLeadForResponse) });
    } catch (err) {
        console.error("Error GET /consultor/leads:", err);
        return res.status(500).json({
            error: "Error obteniendo leads externos",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/leads-stats", async (req, res) => {
    try {
        const { where, params } = buildLeadFilters(req, {
            includeWorkflow: false,
            includePromotion: false,
        });
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const [rows] = await pool.query(
            `
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE
                        WHEN el.workflow_status = 'pendiente_completar'
                         AND (el.assigned_at IS NULL OR el.assigned_at > DATE_SUB(NOW(), INTERVAL 24 HOUR))
                        THEN 1
                        ELSE 0
                    END
                ) AS pending,
                SUM(
                    CASE
                        WHEN el.workflow_status = 'pendiente_completar'
                         AND el.assigned_at IS NOT NULL
                         AND el.assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                        THEN 1
                        ELSE 0
                    END
                ) AS expired,
                SUM(CASE WHEN el.workflow_status = 'promovido' THEN 1 ELSE 0 END) AS promoted
            FROM external_leads el
            ${whereSql}
            `,
            params,
        );

        const stats = rows[0] || {};
        return res.json({
            data: {
                total: Number(stats.total || 0),
                pending: Number(stats.pending || 0),
                expired: Number(stats.expired || 0),
                promoted: Number(stats.promoted || 0),
            },
        });
    } catch (err) {
        console.error("Error GET /consultor/leads-stats:", err);
        return res.status(500).json({
            error: "Error obteniendo estadisticas de leads externos",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/performance-summary", async (req, res) => {
    try {
        if (!hasRole(req, "CONSULTOR_ADMIN")) {
            return res.status(403).json({
                error: "Solo CONSULTOR_ADMIN puede ver este resumen",
            });
        }

        const { where: dateWhere, params: dateParams } = buildAssignedDateRange(
            req,
            "el",
        );
        const joinDateSql = dateWhere.length
            ? ` AND ${dateWhere.join(" AND ")}`
            : "";

        const [rows] = await pool.query(
            `
            SELECT
                u.IdUser AS consultor_id,
                CONCAT_WS(' ', u.Name1, u.Name2, u.Surname1, u.Surname2) AS consultor_name,
                u.Email AS consultor_email,
                COUNT(el.id) AS total_assigned,
                SUM(CASE WHEN LOWER(el.source_channel) = 'mail' THEN 1 ELSE 0 END) AS assigned_mail,
                SUM(CASE WHEN LOWER(el.source_channel) = 'rrss' THEN 1 ELSE 0 END) AS assigned_rrss,
                SUM(
                    CASE
                        WHEN el.workflow_status = 'pendiente_completar'
                         AND (el.assigned_at IS NULL OR el.assigned_at > DATE_SUB(NOW(), INTERVAL 24 HOUR))
                        THEN 1
                        ELSE 0
                    END
                ) AS total_pending,
                SUM(
                    CASE
                        WHEN el.workflow_status = 'pendiente_completar'
                         AND el.assigned_at IS NOT NULL
                         AND el.assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                        THEN 1
                        ELSE 0
                    END
                ) AS total_expired,
                SUM(CASE WHEN el.workflow_status = 'promovido' THEN 1 ELSE 0 END) AS total_promoted,
                SUM(CASE WHEN el.workflow_status = 'ya_gestionado' THEN 1 ELSE 0 END) AS total_historical,
                SUM(
                    CASE
                        WHEN LOWER(el.source_channel) = 'mail'
                         AND el.workflow_status = 'pendiente_completar'
                         AND (el.assigned_at IS NULL OR el.assigned_at > DATE_SUB(NOW(), INTERVAL 24 HOUR))
                        THEN 1
                        ELSE 0
                    END
                ) AS pending_mail,
                SUM(
                    CASE
                        WHEN LOWER(el.source_channel) = 'rrss'
                         AND el.workflow_status = 'pendiente_completar'
                         AND (el.assigned_at IS NULL OR el.assigned_at > DATE_SUB(NOW(), INTERVAL 24 HOUR))
                        THEN 1
                        ELSE 0
                    END
                ) AS pending_rrss,
                SUM(
                    CASE
                        WHEN LOWER(el.source_channel) = 'mail'
                         AND el.workflow_status = 'pendiente_completar'
                         AND el.assigned_at IS NOT NULL
                         AND el.assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                        THEN 1
                        ELSE 0
                    END
                ) AS expired_mail,
                SUM(
                    CASE
                        WHEN LOWER(el.source_channel) = 'rrss'
                         AND el.workflow_status = 'pendiente_completar'
                         AND el.assigned_at IS NOT NULL
                         AND el.assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                        THEN 1
                        ELSE 0
                    END
                ) AS expired_rrss,
                SUM(CASE WHEN LOWER(el.source_channel) = 'mail' AND el.workflow_status = 'promovido' THEN 1 ELSE 0 END) AS promoted_mail,
                SUM(CASE WHEN LOWER(el.source_channel) = 'rrss' AND el.workflow_status = 'promovido' THEN 1 ELSE 0 END) AS promoted_rrss
            FROM user u
            JOIN workgroup w ON w.Id = u.UserGroup
            LEFT JOIN external_leads el
                ON el.assigned_to = CAST(u.IdUser AS CHAR)
                ${joinDateSql}
            WHERE UPPER(TRIM(w.Description)) = 'CONSULTOR'
            GROUP BY u.IdUser, consultor_name, consultor_email
            ORDER BY total_assigned DESC, consultor_name ASC, u.IdUser ASC
            `,
            dateParams,
        );

        const items = rows.map((row) => ({
            consultor_id: normalizeValue(row.consultor_id),
            consultor_name:
                normalizeValue(row.consultor_name) ||
                normalizeValue(row.consultor_email) ||
                normalizeValue(row.consultor_id),
            consultor_email: normalizeValue(row.consultor_email),
            total_assigned: Number(row.total_assigned || 0),
            assigned_mail: Number(row.assigned_mail || 0),
            assigned_rrss: Number(row.assigned_rrss || 0),
            total_pending: Number(row.total_pending || 0),
            total_expired: Number(row.total_expired || 0),
            total_promoted: Number(row.total_promoted || 0),
            total_historical: Number(row.total_historical || 0),
            pending_mail: Number(row.pending_mail || 0),
            pending_rrss: Number(row.pending_rrss || 0),
            expired_mail: Number(row.expired_mail || 0),
            expired_rrss: Number(row.expired_rrss || 0),
            promoted_mail: Number(row.promoted_mail || 0),
            promoted_rrss: Number(row.promoted_rrss || 0),
        }));

        const totals = items.reduce(
            (acc, row) => ({
                total_assigned: acc.total_assigned + row.total_assigned,
                assigned_mail: acc.assigned_mail + row.assigned_mail,
                assigned_rrss: acc.assigned_rrss + row.assigned_rrss,
                total_pending: acc.total_pending + row.total_pending,
                total_expired: acc.total_expired + row.total_expired,
                total_promoted: acc.total_promoted + row.total_promoted,
                total_historical: acc.total_historical + row.total_historical,
            }),
            {
                total_assigned: 0,
                assigned_mail: 0,
                assigned_rrss: 0,
                total_pending: 0,
                total_expired: 0,
                total_promoted: 0,
                total_historical: 0,
            },
        );

        return res.json({
            data: {
                items,
                totals,
            },
        });
    } catch (err) {
        console.error("Error GET /consultor/performance-summary:", err);
        return res.status(500).json({
            error: "Error obteniendo resumen por consultor",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/consultors", async (req, res) => {
    try {
        if (!hasRole(req, "CONSULTOR_ADMIN")) {
            return res.status(403).json({
                error: "Solo CONSULTOR_ADMIN puede ver consultores",
            });
        }

        const consultors = await getConsultorPool();
        return res.json({ data: consultors });
    } catch (err) {
        console.error("Error GET /consultor/consultors:", err);
        return res.status(500).json({
            error: "Error obteniendo consultores",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/assignment-config", async (req, res) => {
    try {
        if (!hasRole(req, "CONSULTOR_ADMIN")) {
            return res.status(403).json({
                error: "Solo CONSULTOR_ADMIN puede ver esta configuracion",
            });
        }

        const items = await getConsultorAssignmentPool();
        const totalPercentage = items
            .filter((item) => item.is_active)
            .reduce(
                (acc, item) => acc + Number(item.assignment_percentage || 0),
                0,
            );

        return res.json({
            data: {
                items,
                totalPercentage,
                isValid: Math.abs(totalPercentage - 100) < 0.001,
            },
        });
    } catch (err) {
        console.error("Error GET /consultor/assignment-config:", err);
        return res.status(500).json({
            error: "Error obteniendo configuracion de asignacion",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.put("/assignment-config", async (req, res) => {
    try {
        if (!hasRole(req, "CONSULTOR_ADMIN")) {
            return res.status(403).json({
                error: "Solo CONSULTOR_ADMIN puede actualizar esta configuracion",
            });
        }

        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (items.length === 0) {
            return res.status(400).json({
                error: "Debes enviar al menos un consultor para configurar",
            });
        }

        const normalizedItems = items.map((item) => ({
            user_id: normalizeValue(item.user_id),
            assignment_percentage: Number(item.assignment_percentage || 0),
            is_active:
                item.is_active === undefined
                    ? Number(item.assignment_percentage || 0) > 0
                    : Boolean(item.is_active),
        }));

        const totalPercentage = normalizedItems
            .filter((item) => item.is_active)
            .reduce((acc, item) => acc + item.assignment_percentage, 0);

        if (Math.abs(totalPercentage - 100) >= 0.001) {
            return res.status(400).json({
                error: "La suma de porcentajes activos debe ser exactamente 100",
            });
        }

        for (const item of normalizedItems) {
            await pool.query(
                `
                INSERT INTO consultor_assignment_config (
                    user_id,
                    assignment_percentage,
                    is_active
                ) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    assignment_percentage = VALUES(assignment_percentage),
                    is_active = VALUES(is_active),
                    updated_at = CURRENT_TIMESTAMP
                `,
                [
                    item.user_id,
                    item.assignment_percentage,
                    item.is_active ? 1 : 0,
                ],
            );
        }

        return res.json({
            message: "Configuracion de asignacion actualizada correctamente",
            data: {
                totalPercentage,
            },
        });
    } catch (err) {
        console.error("Error PUT /consultor/assignment-config:", err);
        return res.status(500).json({
            error: "Error actualizando configuracion de asignacion",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.post("/assign-pending", async (req, res) => {
    try {
        if (!hasRole(req, "CONSULTOR_ADMIN")) {
            return res.status(403).json({
                error: "Solo administracion puede ejecutar asignacion automatica",
            });
        }

        const result = await assignPendingLeadsRoundRobin();

        return res.json({
            message: "Asignacion automatica ejecutada",
            data: result,
        });
    } catch (err) {
        console.error("Error POST /consultor/assign-pending:", err);
        return res.status(500).json({
            error: "Error ejecutando asignacion automatica",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.post("/reassign-manual", async (req, res) => {
    try {
        if (!hasRole(req, "CONSULTOR_ADMIN")) {
            return res.status(403).json({
                error: "Solo CONSULTOR_ADMIN puede reasignar registros",
            });
        }

        const targetUserId = normalizeValue(req.body?.targetUserId);
        const sourceChannel = normalizeValue(req.body?.sourceChannel).toLowerCase();
        const quantity = Math.min(
            Math.max(Number(req.body?.quantity || 0), 1),
            500,
        );
        if (!targetUserId) {
            return res.status(400).json({ error: "Selecciona un consultor destino" });
        }

        const consultors = await getConsultorPool();
        const targetExists = consultors.some(
            (consultor) => consultor.id === targetUserId,
        );

        if (!targetExists) {
            return res.status(400).json({ error: "El consultor destino no es valido" });
        }

        const where = ["workflow_status = 'pendiente_completar'", "assigned_to IS NOT NULL"];
        const params = [];

        where.push(
            "assigned_at IS NOT NULL AND assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
        );

        if (sourceChannel) {
            where.push("LOWER(source_channel) = ?");
            params.push(sourceChannel);
        }

        where.push("assigned_to <> ?");
        params.push(targetUserId);

        const [rows] = await pool.query(
            `
            SELECT id
            FROM external_leads
            WHERE ${where.join(" AND ")}
            ORDER BY assigned_at ASC, id ASC
            LIMIT ?
            `,
            [...params, quantity],
        );

        const ids = rows.map((row) => Number(row.id)).filter(Boolean);
        if (ids.length === 0) {
            return res.json({
                message: "No se encontraron registros para reasignar",
                data: { reassigned: 0 },
            });
        }

        const placeholders = ids.map(() => "?").join(", ");
        await pool.query(
            `
            UPDATE external_leads
            SET
                assigned_to = ?,
                assigned_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${placeholders})
            `,
            [targetUserId, ...ids],
        );

        return res.json({
            message: `Se reasignaron ${ids.length} leads correctamente`,
            data: { reassigned: ids.length },
        });
    } catch (err) {
        console.error("Error POST /consultor/reassign-manual:", err);
        return res.status(500).json({
            error: "Error reasignando registros",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/leads/:id", async (req, res) => {
    try {
        const id = Number(req.params?.id || 0);
        if (!id) {
            return res.status(400).json({ error: "id invalido" });
        }

        const [rows] = await pool.query(
            "SELECT * FROM external_leads WHERE id = ? LIMIT 1",
            [id],
        );
        const lead = rows[0] || null;

        if (!lead) {
            return res.status(404).json({ error: "Lead externo no encontrado" });
        }

        if (!canAccessLead(req, lead)) {
            return res.status(403).json({ error: "No puedes acceder a este lead" });
        }

        return res.json({ data: mapLeadForResponse(lead) });
    } catch (err) {
        console.error("Error GET /consultor/leads/:id:", err);
        return res.status(500).json({
            error: "Error obteniendo lead externo",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.patch("/leads/:id", async (req, res) => {
    try {
        const id = Number(req.params?.id || 0);
        if (!id) {
            return res.status(400).json({ error: "id invalido" });
        }

        const [rows] = await pool.query(
            "SELECT * FROM external_leads WHERE id = ? LIMIT 1",
            [id],
        );
        const currentLead = rows[0] || null;

        if (!currentLead) {
            return res.status(404).json({ error: "Lead externo no encontrado" });
        }

        if (!canAccessLead(req, currentLead)) {
            return res.status(403).json({ error: "No puedes editar este lead" });
        }

        const input =
            req.body && typeof req.body === "object" && !Array.isArray(req.body)
                ? req.body
                : {};

        const nextLead = {
            ...currentLead,
            full_name: input.full_name ?? currentLead.full_name,
            celular: input.celular ?? currentLead.celular,
            city: input.city ?? currentLead.city,
            province: input.province ?? currentLead.province,
            estado_civil: input.estado_civil ?? currentLead.estado_civil,
            actividad_economica:
                input.actividad_economica ?? currentLead.actividad_economica,
            monto_solicitado:
                input.monto_solicitado ?? currentLead.monto_solicitado,
            monto_aplica: input.monto_aplica ?? currentLead.monto_aplica,
            autoriza_buro: input.autoriza_buro ?? currentLead.autoriza_buro,
            destino_credito:
                input.destino_credito ?? currentLead.destino_credito,
            ingreso_neto_recibir:
                input.ingreso_neto_recibir ?? currentLead.ingreso_neto_recibir,
            tipo_relacion_laboral:
                input.tipo_relacion_laboral ??
                currentLead.tipo_relacion_laboral,
            tipo_vivienda: input.tipo_vivienda ?? currentLead.tipo_vivienda,
            mantiene_hijos: input.mantiene_hijos ?? currentLead.mantiene_hijos,
            otros_ingresos: input.otros_ingresos ?? currentLead.otros_ingresos,
            producto: input.producto ?? currentLead.producto,
            observacion_externo:
                input.observacion_externo ?? currentLead.observacion_externo,
            observacion_cooperativa:
                input.observacion_cooperativa ??
                currentLead.observacion_cooperativa,
            proceso_a_realizar:
                input.proceso_a_realizar ?? currentLead.proceso_a_realizar,
            estatus: input.estatus ?? currentLead.estatus,
            agencia: input.agencia ?? currentLead.agencia,
            asesor_externo: input.asesor_externo ?? currentLead.asesor_externo,
            usuario_maquita: input.usuario_maquita ?? currentLead.usuario_maquita,
            seguimiento_kimobill:
                input.seguimiento_kimobill ?? currentLead.seguimiento_kimobill,
            workflow_substatus:
                input.workflow_substatus ?? currentLead.workflow_substatus,
        };

        const workflow = buildWorkflowSnapshot(nextLead);
        const autoPromote = workflow.is_ready_for_promotion === 1;
        const finalWorkflow = autoPromote
            ? {
                workflow_status: "promovido",
                promotion_status: "promovido",
                is_ready_for_promotion: 0,
            }
            : workflow;
        const actor = getActor(req);
        const assignee =
            hasRole(req, "CONSULTOR") &&
            !hasRole(req, "CONSULTOR_ADMIN")
                ? getCurrentAssignee(req)
                : normalizeValue(currentLead.assigned_to) || null;

        await pool.query(
            `
            UPDATE external_leads
            SET
                full_name = ?,
                celular = ?,
                city = ?,
                province = ?,
                estado_civil = ?,
                actividad_economica = ?,
                monto_solicitado = ?,
                monto_aplica = ?,
                autoriza_buro = ?,
                destino_credito = ?,
                ingreso_neto_recibir = ?,
                tipo_relacion_laboral = ?,
                tipo_vivienda = ?,
                mantiene_hijos = ?,
                otros_ingresos = ?,
                producto = ?,
                observacion_externo = ?,
                observacion_cooperativa = ?,
                proceso_a_realizar = ?,
                estatus = ?,
                agencia = ?,
                asesor_externo = ?,
                usuario_maquita = ?,
                seguimiento_kimobill = ?,
                workflow_status = ?,
                workflow_substatus = ?,
                is_ready_for_promotion = ?,
                promotion_status = ?,
                promoted_at = CASE WHEN ? = 1 THEN NOW() ELSE promoted_at END,
                promoted_by = CASE WHEN ? = 1 THEN ? ELSE promoted_by END,
                assigned_to = COALESCE(?, assigned_to),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                nextLead.full_name,
                nextLead.celular,
                nextLead.city,
                nextLead.province,
                nextLead.estado_civil,
                nextLead.actividad_economica,
                nextLead.monto_solicitado,
                nextLead.monto_aplica,
                nextLead.autoriza_buro,
                nextLead.destino_credito,
                nextLead.ingreso_neto_recibir,
                nextLead.tipo_relacion_laboral,
                nextLead.tipo_vivienda,
                nextLead.mantiene_hijos,
                nextLead.otros_ingresos,
                nextLead.producto,
                nextLead.observacion_externo,
                nextLead.observacion_cooperativa,
                nextLead.proceso_a_realizar,
                nextLead.estatus,
                nextLead.agencia,
                nextLead.asesor_externo,
                nextLead.usuario_maquita,
                nextLead.seguimiento_kimobill,
                finalWorkflow.workflow_status,
                nextLead.workflow_substatus,
                finalWorkflow.is_ready_for_promotion,
                finalWorkflow.promotion_status,
                autoPromote ? 1 : 0,
                autoPromote ? 1 : 0,
                actor,
                assignee,
                id,
            ],
        );

        const [updatedRows] = await pool.query(
            "SELECT * FROM external_leads WHERE id = ? LIMIT 1",
            [id],
        );

        return res.json({
            message: autoPromote
                ? "Lead calificado y promovido correctamente"
                : "Lead externo actualizado correctamente",
            data: mapLeadForResponse(updatedRows[0] || null),
        });
    } catch (err) {
        console.error("Error PATCH /consultor/leads/:id:", err);
        return res.status(500).json({
            error: "Error actualizando lead externo",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.post("/leads/:id/mark-promoted", async (req, res) => {
    try {
        const id = Number(req.params?.id || 0);
        if (!id) {
            return res.status(400).json({ error: "id invalido" });
        }

        const [rows] = await pool.query(
            "SELECT * FROM external_leads WHERE id = ? LIMIT 1",
            [id],
        );
        const lead = rows[0] || null;
        if (!lead) {
            return res.status(404).json({ error: "Lead externo no encontrado" });
        }

        if (!canAccessLead(req, lead)) {
            return res.status(403).json({ error: "No puedes promover este lead" });
        }

        const workflow = buildWorkflowSnapshot(lead);
        if (!workflow.is_ready_for_promotion) {
            return res.status(400).json({
                error: "El lead no cumple aun los campos requeridos para promocion",
            });
        }

        const actor = getActor(req);
        await pool.query(
            `
            UPDATE external_leads
            SET
                workflow_status = 'promovido',
                promotion_status = 'promovido',
                is_ready_for_promotion = 0,
                promoted_at = NOW(),
                promoted_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [actor, id],
        );

        const [updatedRows] = await pool.query(
            "SELECT * FROM external_leads WHERE id = ? LIMIT 1",
            [id],
        );

        return res.json({
            message: "Lead marcado como promovido",
            data: mapLeadForResponse(updatedRows[0] || null),
        });
    } catch (err) {
        console.error("Error POST /consultor/leads/:id/mark-promoted:", err);
        return res.status(500).json({
            error: "Error marcando lead como promovido",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

export default router;
