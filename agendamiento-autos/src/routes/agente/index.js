// src/routes/agente.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import { agenteQueries } from "../../services/queries/index.js";
import {
    ensureImportStatsTable,
    recomputeImportStats,
} from "../../services/bases.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();

// Estados operativos válidos del agente
const ESTADOS_OPERATIVOS = new Set([
    "disponible",
    "baño",
    "consulta",
    "lunch",
    "reunion",
]);

/**
 * Middleware: verifica que el agente NO esté bloqueado
 */
async function requireNotBlocked(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Usuario no autenticado" });
        }

        const [rows] = await pool.query(agenteQueries.getUserStateByIdUser, [
            userId,
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const userState = String(rows[0].State || "").toUpperCase();
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

    const [rows] = await pool.query(
        `SELECT Campaign, LastUpdate
         FROM contactimportcontact
         WHERE Id = ?
         LIMIT 1`,
        [id],
    );

    const campaignId = String(rows[0]?.Campaign || "").trim();
    const importId = String(rows[0]?.LastUpdate || "").trim();

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
    formType,
    contactId,
    agentUser,
    payload,
}) {
    const campaignIdToUse = String(campaignId || "").trim();
    if (!campaignIdToUse) return;

    const [templateRows] = await pool.query(
        agenteQueries.getActiveTemplateByCampaignAndType,
        [formType, campaignIdToUse],
    );

    if (templateRows.length === 0) {
        return;
    }

    const template = templateRows[0];
    const payloadJson = JSON.stringify(payload || {});

    await pool.query(agenteQueries.insertDynamicFormResponse, [
        campaignIdToUse,
        formType,
        template.template_id,
        String(contactId || "").trim(),
        String(agentUser || "").trim(),
        payloadJson,
    ]);
}

/* ============================================================================
   1. TOMAR SIGUIENTE REGISTRO (auto-asignación)
============================================================================ */
router.post("/siguiente", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);
        const campaignFromBody = String(req.body?.campaignId || "").trim();
        const tabSessionId = String(req.body?.tabSessionId || "").trim();
        const staleAssignmentMinutes = Number.parseInt(
            process.env.AGENT_ASSIGNMENT_TIMEOUT_MINUTES || "10",
            10,
        );

        console.log("[agente/siguiente] payload", {
            campaignId: campaignFromBody,
            agente: agenteActor,
            tabSessionId,
        });

        if (!campaignFromBody) {
            return res.status(400).json({
                error: "Debes seleccionar una campaña para tomar registros",
            });
        }
        if (!tabSessionId) {
            return res.status(400).json({
                error: "Falta el identificador de sesión de pestaña (tabSessionId)",
            });
        }

        const campaignToUse = campaignFromBody;

        await pool.query(agenteQueries.releaseStaleAutoAssignmentsByCampaign, [
            `${campaignToUse}%`,
            Number.isFinite(staleAssignmentMinutes)
                ? staleAssignmentMinutes
                : 30,
        ]);

        // Buscar si ya hay un registro asignado a este agente y tabSessionId
        const [assignedRows] = await pool.query(
            agenteQueries.getAssignedClientByAgentAndSessionAndCampaignLike,
            [agenteActor, tabSessionId, `${campaignToUse}%`],
        );

        if (assignedRows.length > 0) {
            const assigned = assignedRows[0];
            const [phones] = await pool.query(
                agenteQueries.getPhonesByContactId,
                [assigned.ID],
            );
            let [clienteRows] = await pool.query(agenteQueries.getClienteById, [
                assigned.ID,
            ]);

            if (clienteRows.length === 0 && assigned.IDENTIFICACION) {
                [clienteRows] = await pool.query(
                    agenteQueries.getClienteByIdentificationAndCampaign,
                    [assigned.IDENTIFICACION, `${campaignToUse}%`],
                );
            }

            const numeros = phones
                .map((row) => row.NumeroMarcado)
                .filter(Boolean)
                .slice(0, 2);

            return res.json({
                registro: {
                    id: assigned.ID,
                    contact_id: clienteRows[0]?.ContactId || assigned.ID,
                    nombre_completo: assigned.NOMBRE_CLIENTE,
                    placa: assigned.CAMPO1 || null,
                    telefono1: numeros[0] || null,
                    telefono2: numeros[1] || null,
                    modelo: assigned.CAMPO2 || null,
                    intentos_totales: Number(assigned.intentos_totales || 0),
                    base_nombre:
                        assigned.ImportId ||
                        assigned.LastUpdate ||
                        "Base activa",
                    campaign_id: assigned.CampaignId,
                    identification: assigned.IDENTIFICACION || null,
                    last_gestion: [assigned.ResultLevel1, assigned.ResultLevel2]
                        .filter(Boolean)
                        .join(" - "),
                    agente: assigned.Agent || agenteActor,
                },
                detalleCliente: clienteRows[0] || null,
            });
        }

        let registroTomado = null;

        const [latestImportRows] = await pool.query(
            agenteQueries.getActiveImportByCampaign,
            [campaignToUse],
        );

        let latestImportId = latestImportRows[0]?.ImportId || null;

        if (!latestImportId) {
            return res.status(404).json({
                error: "No hay base activa para esta campaña",
            });
        }

        for (let intento = 0; intento < 5; intento++) {
            const [candidatos] = await pool.query(
                agenteQueries.getNextCandidateByCampaignAndImport,
                [campaignToUse, latestImportId],
            );

            if (candidatos.length === 0) {
                break;
            }

            const candidato = candidatos[0];
            const isRecycleByAdmin =
                String(candidato.Action || "")
                    .trim()
                    .toLowerCase() === "re_llamada";

            const assignAction = isRecycleByAdmin
                ? "Reciclar Base"
                : "Asignar Base";

            // Asignar el registro a este agente y tabSessionId
            const [updResult] = await pool.query(
                agenteQueries.takeCandidateForAgentWithSession,
                [
                    agenteActor,
                    tabSessionId,
                    assignAction,
                    agenteActor,
                    candidato.Id,
                    candidato.Campaign,
                ],
            );

            if (updResult.affectedRows > 0) {
                await recomputeImportStats(
                    campaignToUse,
                    latestImportId,
                    agenteActor,
                    pool,
                );

                registroTomado = {
                    id: candidato.Id,
                    nombre_completo: candidato.Name,
                    placa: null,
                    telefono1: null,
                    telefono2: null,
                    modelo: null,
                    intentos_totales: Number(candidato.intentos_totales || 0),
                    base_nombre: candidato.LastUpdate || "Base activa",
                    campaign_id: candidato.Campaign,
                    identification: candidato.Identification || null,
                };
                break;
            }
        }

        if (!registroTomado) {
            return res
                .status(404)
                .json({ error: "No hay registros disponibles en tu cola" });
        }

        const [phones] = await pool.query(agenteQueries.getPhonesByContactId, [
            registroTomado.id,
        ]);

        const numeros = phones
            .map((row) => row.NumeroMarcado)
            .filter(Boolean)
            .slice(0, 2);

        registroTomado.telefono1 = numeros[0] || null;
        registroTomado.telefono2 = numeros[1] || null;

        let [clienteRows] = await pool.query(agenteQueries.getClienteById, [
            registroTomado.id,
        ]);

        if (clienteRows.length === 0 && registroTomado.identification) {
            [clienteRows] = await pool.query(
                agenteQueries.getClienteByIdentificationAndCampaign,
                [registroTomado.identification, `${campaignToUse}%`],
            );
        }

        return res.json({
            registro: {
                ...registroTomado,
                contact_id: clienteRows[0]?.ContactId || registroTomado.id,
            },
            detalleCliente: clienteRows[0] || null,
        });
    } catch (err) {
        console.error("Error en /agente/siguiente:", err);
        return res
            .status(500)
            .json({ error: "Error tomando siguiente registro" });
    }
});

router.get("/bases-activas-resumen", ...agenteMiddlewares, async (req, res) => {
    try {
        await ensureImportStatsTable(pool);

        const [rows] = await pool.query(agenteQueries.getActiveBasesSummary);

        const data = (rows || [])
            .map((row) => ({
                campaignId: String(row.campaign_id || "").trim(),
                importId: String(row.import_id || "").trim(),
                totalRegistros: Number(row.total_registros || 0),
                pendientes: Number(row.pendientes || 0),
                pendientesLibres: Number(row.pendientes_libres || 0),
                pendientesAsignadosSinGestion: Number(
                    row.pendientes_asignados_sin_gestion || 0,
                ),
            }))
            .filter((item) => item.campaignId && item.importId);

        return res.json({ data });
    } catch (err) {
        console.error("Error en /agente/bases-activas-resumen:", err);
        return res
            .status(500)
            .json({ error: "Error cargando resumen de bases activas" });
    }
});

/* ============================================================================
    3. GUARDAR GESTIÓN (cck_dev)
============================================================================ */
router.post("/guardar-gestion", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);
        const {
            registro_id,
            estado_final,
            fecha_cita,
            agencia_cita,
            level1,
            level2,
            campaign_id,
            encuesta,
            contactAddress,
            interactionId,
            telefono_ad,
            comentarios,
            fecha_agendamiento,
            dynamicForm2Payload,
            dynamicForm3Payload,
        } = req.body;

        if (!registro_id) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        const [clienteKeysRows] = await pool.query(
            agenteQueries.getClienteContactKeysByIdOrContactId,
            [registro_id, registro_id],
        );

        const resolvedId = String(clienteKeysRows[0]?.Id || registro_id).trim();
        const resolvedContactId = String(
            clienteKeysRows[0]?.ContactId ||
                clienteKeysRows[0]?.Id ||
                registro_id,
        ).trim();

        const [contactRows] = await pool.query(
            `SELECT Id, Campaign, LastUpdate, Number, Identification
             FROM contactimportcontact
             WHERE Id = ?
             LIMIT 1`,
            [resolvedId],
        );

        if (contactRows.length === 0) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }

        const campaignToUse = String(
            campaign_id || contactRows[0]?.Campaign || "",
        ).trim();
        const importIdToUse = String(contactRows[0]?.LastUpdate || "").trim();
        const campaignLike = campaignToUse ? `${campaignToUse}%` : "%";
        const identificationToUse = String(
            contactRows[0]?.Identification || "",
        ).trim();
        const level1ToUse = String(level1 || "").trim();
        const level2ToUse = String(level2 || "").trim();
        const level3ToUse = "";
        const estadoFinalToUse =
            String(estado_final || "").trim() ||
            level2ToUse ||
            level1ToUse ||
            "sin_gestion";

        let managementResultCode = "";
        if (campaignToUse && level1ToUse && level2ToUse) {
            const [codeRows] = await pool.query(
                agenteQueries.getManagementCodeByLevelsWithoutLevel3,
                [campaignToUse, level1ToUse, level2ToUse],
            );

            managementResultCode = String(codeRows[0]?.code || "").trim();
        }

        const encuestaData =
            encuesta && typeof encuesta === "object" ? encuesta : {};

        const encuestaPreguntasInput = Array.isArray(
            req.body?.encuestaPreguntas,
        )
            ? req.body.encuestaPreguntas
            : [];
        const encuestaRespuestasInput = Array.isArray(
            req.body?.encuestaRespuestas,
        )
            ? req.body.encuestaRespuestas
            : [];
        const encuestaKeysInput = Array.isArray(req.body?.encuestaKeys)
            ? req.body.encuestaKeys
            : [];

        const preguntas = Array.from({ length: 30 }, () => "");
        const respuestas = Array.from({ length: 30 }, () => "");

        if (encuestaPreguntasInput.length > 0) {
            const usedIndexes = new Set();

            for (
                let index = 0;
                index < encuestaPreguntasInput.length;
                index++
            ) {
                const key = String(encuestaKeysInput[index] || "").trim();
                const explicitMatch = key.match(/^respuesta(\d{1,2})$/i);
                const explicitNumber = explicitMatch
                    ? Number(explicitMatch[1])
                    : NaN;
                const targetIndex =
                    Number.isInteger(explicitNumber) &&
                    explicitNumber >= 1 &&
                    explicitNumber <= 30
                        ? explicitNumber - 1
                        : -1;

                if (targetIndex >= 0) {
                    preguntas[targetIndex] = String(
                        encuestaPreguntasInput[index] || "",
                    ).trim();
                    respuestas[targetIndex] = String(
                        encuestaRespuestasInput[index] || "",
                    ).trim();
                    usedIndexes.add(targetIndex);
                }
            }

            let fallbackIndex = 0;
            for (
                let index = 0;
                index < encuestaPreguntasInput.length;
                index++
            ) {
                const key = String(encuestaKeysInput[index] || "").trim();
                const explicitMatch = key.match(/^respuesta(\d{1,2})$/i);
                if (explicitMatch) {
                    continue;
                }

                while (fallbackIndex < 30 && usedIndexes.has(fallbackIndex)) {
                    fallbackIndex += 1;
                }

                if (fallbackIndex >= 30) {
                    break;
                }

                preguntas[fallbackIndex] = String(
                    encuestaPreguntasInput[index] || "",
                ).trim();
                respuestas[fallbackIndex] = String(
                    encuestaRespuestasInput[index] || "",
                ).trim();
                usedIndexes.add(fallbackIndex);
                fallbackIndex += 1;
            }
        } else {
            const legacyPreguntas = [
                "Fecha y hora de visita",
                "Lugar visita",
                "Provincia",
                "Ciudad",
                "",
                "",
                "",
                "",
                "",
                "Opción de créditos seleccionada",
            ];

            const legacyRespuestas = [
                String(encuestaData.respuesta1 || "").trim(),
                String(encuestaData.respuesta2 || "").trim(),
                String(encuestaData.respuesta3 || "").trim(),
                String(encuestaData.respuesta4 || "").trim(),
                "",
                "",
                "",
                "",
                "",
                String(encuestaData.respuesta10 || "").trim(),
            ];

            for (let index = 0; index < legacyPreguntas.length; index++) {
                preguntas[index] = legacyPreguntas[index];
                respuestas[index] = legacyRespuestas[index];
            }
        }

        const now = new Date();
        const startedManagement = now;
        const tmstmp = now;
        const intentos = Number(contactRows[0]?.Number || 0);

        const [latestPhoneRows] = await pool.query(
            agenteQueries.getLatestPhoneDataByContactId,
            [resolvedContactId],
        );
        const latestPhone = latestPhoneRows[0] || {};

        const interactionIdOld = String(latestPhone.InteractionId || "").trim();
        const interactionIdNew = String(interactionId || "").trim();
        const isDadoDeBajaFlow =
            level1ToUse.toUpperCase() === "DB" &&
            level2ToUse.toUpperCase().startsWith("DADO DE BAJA");

        const contactAddressToUse = String(
            latestPhone.NumeroMarcado || contactAddress || telefono_ad || "",
        ).trim();
        const interactionIdToUse = isDadoDeBajaFlow
            ? interactionIdOld || interactionIdNew
            : interactionIdNew || interactionIdOld;

        const telefonoAdToUse = String(
            telefono_ad || encuestaData?.telefono_ad || "",
        ).trim();
        const observacionesToUse = String(
            comentarios || req.body?.observacion || "",
        ).trim();
        const fechaAgendamientoToUse = String(
            fecha_agendamiento || respuestas[0] || "",
        ).trim();

        await pool.query(
            `UPDATE contactimportcontact
             SET Action = ?,
                 LastManagementResult = ?,
                 Number = COALESCE(Number, 0) + 1,
                 LastAgent = ?,
                 UserShift = ?,
                 TmStmpShift = NOW()
             WHERE Id = ?`,
            [
                "Gestionado",
                managementResultCode || estadoFinalToUse,
                agenteActor,
                agenteActor,
                resolvedId,
            ],
        );

        await recomputeImportStats(
            campaignToUse,
            importIdToUse,
            agenteActor,
            pool,
        );

        const [clienteUpdateResult] = await pool.query(
            agenteQueries.updateClienteSurveyAndManagement,
            [
                agenteActor,
                level1ToUse,
                level2ToUse,
                level3ToUse,
                managementResultCode || estadoFinalToUse,
                contactAddressToUse,
                interactionIdToUse,
                intentos,
                "Gestionado",
                agenteActor,
                resolvedId,
                resolvedContactId,
                identificationToUse,
                campaignLike,
            ],
        );

        if ((clienteUpdateResult?.affectedRows || 0) === 0) {
            console.warn("[agente/guardar-gestion] clientes sin actualizar", {
                registro_id,
                identificationToUse,
                campaignLike,
            });
        }

        const [gestionFinalRows] = await pool.query(
            agenteQueries.getGestionFinalByContactId,
            [resolvedContactId],
        );

        if (gestionFinalRows.length === 0) {
            const [insertGestionResult] = await pool.query(
                agenteQueries.insertGestionFinalFromCliente,
                [
                    resolvedContactId,
                    contactAddressToUse,
                    interactionIdToUse,
                    agenteActor,
                    level1ToUse,
                    level2ToUse,
                    level3ToUse,
                    managementResultCode || estadoFinalToUse,
                    startedManagement,
                    tmstmp,
                    intentos,
                    fechaAgendamientoToUse,
                    telefonoAdToUse,
                    observacionesToUse,
                    ...preguntas,
                    ...respuestas,
                    resolvedId,
                    resolvedContactId,
                    identificationToUse,
                    campaignLike,
                ],
            );

            if ((insertGestionResult?.affectedRows || 0) === 0) {
                return res.status(404).json({
                    error: "No se encontró cliente origen para insertar gestión",
                });
            }
        } else {
            await pool.query(agenteQueries.updateGestionFinalByContactId, [
                contactAddressToUse,
                interactionIdToUse,
                agenteActor,
                level1ToUse,
                level2ToUse,
                level3ToUse,
                managementResultCode || estadoFinalToUse,
                startedManagement,
                tmstmp,
                intentos,
                fechaAgendamientoToUse,
                telefonoAdToUse,
                observacionesToUse,
                ...preguntas,
                ...respuestas,
                resolvedContactId,
            ]);
        }

        try {
            await pool.query(
                agenteQueries.insertGestionHistoricaFromGestionFinal,
                [resolvedContactId],
            );
        } catch (error_) {
            console.warn(
                "[agente/guardar-gestion] No se pudo insertar en gestionhistorica:",
                error_?.sqlMessage || error_?.message || error_,
            );
        }

        const citaCreada =
            estadoFinalToUse === "ub_exito_agendo_cita" &&
            Boolean(fecha_cita) &&
            Boolean(agencia_cita);

        const [rows] = await pool.query(
            `SELECT Action
             FROM contactimportcontact
             WHERE LastAgent = ?
               AND DATE(TmStmpShift) = CURDATE()
               AND Action IS NOT NULL
               AND Action <> ''`,
            [agenteActor],
        );

        const total_gestionados = rows.length;
        const total_citas = rows.filter(
            (g) => g.Action === "ub_exito_agendo_cita",
        ).length;
        const total_rellamadas = rows.filter(
            (g) => g.Action === "re_llamada",
        ).length;

        const form2Payload =
            dynamicForm2Payload && typeof dynamicForm2Payload === "object"
                ? dynamicForm2Payload
                : {};
        const form3Payload =
            dynamicForm3Payload && typeof dynamicForm3Payload === "object"
                ? dynamicForm3Payload
                : encuestaData;

        await saveDynamicResponseIfTemplateActive({
            campaignId: campaignToUse,
            formType: "F2",
            contactId: resolvedContactId,
            agentUser: agenteActor,
            payload: form2Payload,
        });

        await saveDynamicResponseIfTemplateActive({
            campaignId: campaignToUse,
            formType: "F3",
            contactId: resolvedContactId,
            agentUser: agenteActor,
            payload: form3Payload,
        });

        return res.json({
            message: "Gestión guardada",
            managementResultCode,
            cita_creada: citaCreada,
            resumenHoy: { total_gestionados, total_citas, total_rellamadas },
        });
    } catch (err) {
        console.error("Error en /agente/guardar-gestion:", err);
        return res.status(500).json({
            error: "Error en /agente/guardar-gestion",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

/* ============================================================================
   4. CAMBIO DE ESTADO DEL AGENTE (disponible, baño, lunch, etc.)
============================================================================ */
router.post("/estado", ...agenteMiddlewares, async (req, res) => {
    try {
        const { estado, registro_id } = req.body;
        const agenteActor = getAgentActor(req);

        if (!estado || !ESTADOS_OPERATIVOS.has(estado)) {
            return res
                .status(400)
                .json({ error: "Estado de agente no válido" });
        }

        const esPausa = ["baño", "consulta", "lunch", "reunion"].includes(
            estado,
        );

        // Si el agente estaba gestionando un registro y entra en pausa, liberamos el registro
        if (esPausa && registro_id) {
            const [releaseResult] = await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?
                   AND LastAgent = ?`,
                [agenteActor, registro_id, agenteActor],
            );

            if ((releaseResult?.affectedRows || 0) > 0) {
                await recomputeStatsByContactId(registro_id, agenteActor);
            }
        }

        return res.json({ estado });
    } catch (err) {
        console.error("Error en /agente/estado:", err);
        return res
            .status(500)
            .json({ error: "Error cambiando estado del agente" });
    }
});

/* ============================================================================
   5. CATÁLOGOS DEL FORMULARIO (criterios funcionesGenerales.js)
============================================================================ */
router.get("/form-catalogos", ...agenteMiddlewares, async (req, res) => {
    try {
        const campaignId = String(req.query?.campaignId || "").trim();
        const contactId = String(req.query?.contactId || "").trim();

        if (!campaignId) {
            return res.status(400).json({ error: "campaignId es requerido" });
        }

        const [levels] = await pool.query(
            agenteQueries.getManagementLevelsByCampaign,
            [campaignId],
        );

        const [phoneStates] = await pool.query(
            agenteQueries.getPhoneStatusCatalog,
        );

        const [otherAdvisors] = await pool.query(
            agenteQueries.getOtherAdvisors,
        );

        let phones = [];
        if (contactId) {
            const [phoneRows] = await pool.query(
                agenteQueries.getPhonesByContactId,
                [contactId],
            );
            phones = phoneRows.map((row) => row.NumeroMarcado).filter(Boolean);
        }

        const asesor =
            req.user?.name || req.user?.username || req.user?.email || "";

        return res.json({
            asesor,
            fechaServidor: new Date().toISOString(),
            levels,
            telefonos: phones,
            estadoTelefonos: phoneStates
                .map((row) => row.Descripcion)
                .filter(Boolean),
            otroAsesor: otherAdvisors.map((row) => row.Id).filter(Boolean),
        });
    } catch (err) {
        console.error("Error en /agente/form-catalogos:", err);
        return res
            .status(500)
            .json({ error: "Error cargando catálogos del formulario" });
    }
});

router.get("/form-templates", ...agenteMiddlewares, async (req, res) => {
    try {
        const campaignId = String(req.query?.campaignId || "").trim();

        if (!campaignId) {
            return res.status(400).json({ error: "campaignId es requerido" });
        }

        const [f2TemplateRows] = await pool.query(
            agenteQueries.getActiveTemplateByCampaignAndType,
            ["F2", campaignId],
        );
        const [f3TemplateRows] = await pool.query(
            agenteQueries.getActiveTemplateByCampaignAndType,
            ["F3", campaignId],
        );

        let form2 = null;
        let form3 = null;

        if (f2TemplateRows.length > 0) {
            const f2Template = f2TemplateRows[0];
            const [f2FieldRows] = await pool.query(
                agenteQueries.getTemplateFieldsWithOptions,
                [f2Template.template_id],
            );

            form2 = {
                templateId: f2Template.template_id,
                templateName: f2Template.template_name,
                formType: f2Template.form_type,
                version: Number(f2Template.version || 1),
                fields: normalizeTemplateRows(f2FieldRows),
            };
        }

        if (f3TemplateRows.length > 0) {
            const f3Template = f3TemplateRows[0];
            const [f3FieldRows] = await pool.query(
                agenteQueries.getTemplateFieldsWithOptions,
                [f3Template.template_id],
            );

            form3 = {
                templateId: f3Template.template_id,
                templateName: f3Template.template_name,
                formType: f3Template.form_type,
                version: Number(f3Template.version || 1),
                fields: normalizeTemplateRows(f3FieldRows),
            };
        }

        return res.json({
            campaignId,
            form2,
            form3,
        });
    } catch (err) {
        console.error("Error en /agente/form-templates:", err);
        return res
            .status(500)
            .json({ error: "Error cargando plantillas dinámicas" });
    }
});

router.get(
    "/ultimo-estado-telefono",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            const contactId = String(req.query?.contactId || "").trim();
            const telefono = String(req.query?.telefono || "").trim();

            if (!contactId || !telefono) {
                return res
                    .status(400)
                    .json({ error: "contactId y telefono son requeridos" });
            }

            const [rows] = await pool.query(
                agenteQueries.getLastPhoneStatusByContactAndNumber,
                [contactId, telefono],
            );

            return res.json({
                ultimoEstado: rows[0]?.Estado || "",
                interactionId: rows[0]?.InteractionId || "",
            });
        } catch (err) {
            console.error("Error en /agente/ultimo-estado-telefono:", err);
            return res
                .status(500)
                .json({ error: "Error consultando último estado de teléfono" });
        }
    },
);

router.post("/update-phones", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);

        const contactIdInput = String(
            req.body?.IDC || req.body?.contactId || "",
        ).trim();
        const phoneNumber = String(
            req.body?.fonos || req.body?.telefono || "",
        ).trim();
        const estadoTelefono = String(
            req.body?.estatusTel || req.body?.estadoTelefono || "",
        ).trim();
        const fechaInicioRaw = String(
            req.body?.horaInicioLlamada || req.body?.fechaInicio || "",
        ).trim();
        const interactionIdToUse = String(req.body?.interactionId || "").trim();
        const descripcionTelefono = String(
            req.body?.descripcionTelefono || "",
        ).trim();
        const identificacionCliente = String(
            req.body?.identificacionCliente || "",
        ).trim();

        if (!contactIdInput || !phoneNumber || !estadoTelefono) {
            return res.status(400).json({
                error: "IDC, fonos y estatusTel son requeridos",
            });
        }

        if (!interactionIdToUse) {
            return res.status(400).json({
                error: "interactionId es requerido",
            });
        }

        const [clienteKeysRows] = await pool.query(
            agenteQueries.getClienteContactKeysByIdOrContactId,
            [contactIdInput, contactIdInput],
        );

        const resolvedContactId = String(
            clienteKeysRows[0]?.ContactId ||
                clienteKeysRows[0]?.Id ||
                contactIdInput,
        ).trim();

        const nowIso = new Date().toISOString().slice(0, 19).replace("T", " ");
        const fechaInicio = fechaInicioRaw || nowIso;

        const [updatePhoneResult] = await pool.query(
            agenteQueries.updateContactPhoneByStatusChange,
            [
                interactionIdToUse,
                agenteActor,
                estadoTelefono,
                fechaInicio,
                nowIso,
                descripcionTelefono,
                identificacionCliente,
                resolvedContactId,
                phoneNumber,
            ],
        );

        if ((updatePhoneResult?.affectedRows || 0) === 0) {
            return res.status(404).json({
                error: "No existe el teléfono para el contacto indicado",
            });
        }

        return res.json({ message: "Teléfono gestionado con éxito" });
    } catch (err) {
        console.error("Error en /agente/update-phones:", err);
        return res.status(500).json({
            error: "Error: no se pudo almacenar la información",
            detail: err?.sqlMessage || err?.message || "",
        });
    }
});

router.get("/cliente-detalle/:id", ...agenteMiddlewares, async (req, res) => {
    try {
        const contactId = String(req.params?.id || "").trim();
        console.log("[agente/cliente-detalle] request", { contactId });

        if (!contactId) {
            return res.status(400).json({ error: "id inválido" });
        }

        const [rows] = await pool.query(agenteQueries.getClienteById, [
            contactId,
        ]);

        if (rows.length === 0) {
            console.log("[agente/cliente-detalle] sin resultado", {
                contactId,
            });
            return res.status(404).json({ error: "Cliente no encontrado" });
        }

        console.log("[agente/cliente-detalle] ok", {
            contactId,
            campaignId: rows[0]?.CampaignId || null,
        });

        return res.json({ detalle: rows[0] });
    } catch (err) {
        console.error("Error en /agente/cliente-detalle/:id:", err);
        return res
            .status(500)
            .json({ error: "Error cargando detalle del cliente" });
    }
});

/* ============================================================================
   6. LISTADO DE CITAS DEL AGENTE (no persistidas en cck_dev)
============================================================================ */
router.get("/citas", ...agenteMiddlewares, async (req, res) => {
    try {
        return res.json({ citas: [] });
    } catch (err) {
        console.error("Error en /agente/citas:", err);
        return res.status(500).json({ error: "Error consultando citas" });
    }
});

/* ============================================================================
    7. Bloquear agente (lo llama el front por inactividad)
      → LIBERA el registro en_gestion si viene registro_id
============================================================================ */
router.post("/bloquearme", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const actor = getAgentActor(req);
        const { registro_id } = req.body || {};

        // Si hay un registro en gestión, lo liberamos
        if (registro_id) {
            const [releaseResult] = await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?
                   AND LastAgent = ?`,
                [actor, registro_id, actor],
            );

            if ((releaseResult?.affectedRows || 0) > 0) {
                await recomputeStatsByContactId(registro_id, actor);
            }
        }

        // Marcar al agente como bloqueado
        const [updResult] = await pool.query(
            `UPDATE user
             SET State = '0',
                 UserShift = ?,
                 TmStmpShift = NOW()
             WHERE IdUser = ?`,
            [actor, userId],
        );

        if (updResult.affectedRows === 0) {
            const [fallbackUpdate] = await pool.query(
                `UPDATE user
                 SET State = '0',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?`,
                [actor, actor],
            );

            if (fallbackUpdate.affectedRows === 0) {
                return res
                    .status(500)
                    .json({ error: "No se pudo bloquear al usuario" });
            }
        }

        return res.json({ message: "Usuario bloqueado por inactividad" });
    } catch (err) {
        console.error("Error en /agente/bloquearme:", err);
        return res.status(500).json({ error: "Error bloqueando usuario" });
    }
});

/* ============================================================================
    8. LIMPIAR REGISTROS COLGADOS (ADMIN)
    Todos los contactos asignados más antiguos que X minutos
    se devuelven a 'Pendiente'.
============================================================================ */
router.post(
    "/limpiar-colgados",
    requireAuth,
    loadUserRoles,
    requireRole(["ADMINISTRADOR"]),
    async (req, res) => {
        try {
            const LIMITE_MINUTOS = 30;

            const [result] = await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = 'system',
                     TmStmpShift = NOW()
                 WHERE LastAgent IS NOT NULL
                   AND LastAgent <> ''
                   AND LastAgent <> 'Pendiente'
                   AND TmStmpShift IS NOT NULL
                   AND TmStmpShift < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
                [LIMITE_MINUTOS],
            );

            if ((result?.affectedRows || 0) > 0) {
                const [activeImports] = await pool.query(
                    `SELECT CampaignId, ImportId
                     FROM campaign_active_base
                     WHERE State = '1'`,
                );

                for (const row of activeImports) {
                    const campaignId = String(row?.CampaignId || "").trim();
                    const importId = String(row?.ImportId || "").trim();

                    if (!campaignId || !importId) {
                        continue;
                    }

                    await recomputeImportStats(
                        campaignId,
                        importId,
                        "system",
                        pool,
                    );
                }
            }

            return res.json({
                message: "Registros colgados limpiados correctamente",
                count: result.affectedRows || 0,
            });
        } catch (err) {
            console.error("Error en /agente/limpiar-colgados:", err);
            return res
                .status(500)
                .json({ error: "Error limpiando registros colgados" });
        }
    },
);

// Endpoint para tipos de campaña dinámico para Out Maquita Cushunchic
router.get("/tipos-campania", requireAuth, async (req, res) => {
    const cliente = req.query.cliente;
    if (!cliente) return res.status(400).json({ error: "Falta cliente" });
    try {
        // Usar pool directamente, suponiendo que la base campaniasoutbound está accesible
        const [rows] = await pool.query(
            "SELECT TipoCampania FROM campaniasoutbound.campañas WHERE cliente = ? AND estado = '1'",
            [cliente],
        );
        res.json({ data: rows });
    } catch (err) {
        console.error("Error en /agente/tipos-campania:", err);
        res.status(500).json({ error: "Error consultando tipos de campaña" });
    }
});

// Buscar registro en trxout por cédula
router.get("/trxout", requireAuth, async (req, res) => {
    const identificacion = req.query.identificacion;
    console.log(
        "[DEBUG] /agente/trxout llamado. identificacion:",
        identificacion,
    );
    if (!identificacion) {
        console.log("[DEBUG] Falta identificacion en query param");
        return res.status(400).json({ error: "Falta identificacion" });
    }
    try {
        const [rows] = await pool.query(
            "SELECT * FROM campaniasoutbound.trxout WHERE Identificacion = ? ORDER BY Id DESC LIMIT 1",
            [identificacion],
        );
        console.log("[DEBUG] Resultado SQL trxout:", rows);
        res.json({ data: rows[0] || null });
    } catch (err) {
        console.error("[ERROR] Error en /agente/trxout:", err);
        res.status(500).json({ error: "Error consultando trxout" });
    }
});

// Insertar registro en trxout
router.post("/trxout", requireAuth, async (req, res) => {
    const {
        Agent = "",
        StartedManagement = null,
        TmStmp = null,
        Cooperativa = "",
        TipoCampania = null,
        Identificacion = null,
        NombreCliente = null,
        Celular = null,
        MotivoLlamada = null,
        SubmotivoLlamada = null,
        Observaciones = null,
        AgentShift = "",
        TmStmpShift,
    } = req.body;
    // Si TmStmpShift no viene o es inválido, poner fecha actual
    const safeTmStmpShift =
        TmStmpShift && TmStmpShift !== "0000-00-00 00:00:00"
            ? TmStmpShift
            : new Date();
    try {
        // Insertar en trxout
        const [result] = await pool.query(
            `INSERT INTO campaniasoutbound.trxout
            (Agent, StartedManagement, TmStmp, Cooperativa, TipoCampania, Identificacion, NombreCliente, Celular, MotivoLlamada, SubmotivoLlamada, Observaciones, AgentShift, TmStmpShift)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                Agent,
                StartedManagement,
                TmStmp,
                Cooperativa,
                TipoCampania,
                Identificacion,
                NombreCliente,
                Celular,
                MotivoLlamada,
                SubmotivoLlamada,
                Observaciones,
                AgentShift,
                safeTmStmpShift,
            ],
        );
        // Insertar en trxouthistorico usando el siguiente ID disponible
        const [[{ maxId }]] = await pool.query(
            "SELECT IFNULL(MAX(ID), 0) AS maxId FROM campaniasoutbound.trxouthistorico",
        );
        const nextId = maxId + 1;
        console.log("[HISTORICO][POST] Insertando en trxouthistorico", {
            nextId,
            Agent,
            StartedManagement,
            TmStmp,
            Cooperativa,
            TipoCampania,
            Identificacion,
            NombreCliente,
            Celular,
            MotivoLlamada,
            SubmotivoLlamada,
            Observaciones,
            AgentShift,
            safeTmStmpShift,
        });
        res.json({ success: true, insertId: result.insertId });
    } catch (err) {
        console.error("[ERROR] Error en POST /agente/trxout:", err);
        res.status(500).json({ error: "Error insertando trxout" });
    }
});

// Actualizar registro en trxout por Identificacion
router.put("/trxout", requireAuth, async (req, res) => {
    const {
        Agent = "",
        StartedManagement = null,
        TmStmp = null,
        Cooperativa = "",
        TipoCampania = null,
        Identificacion = null,
        NombreCliente = null,
        Celular = null,
        MotivoLlamada = null,
        SubmotivoLlamada = null,
        Observaciones = null,
        AgentShift = "",
        TmStmpShift,
    } = req.body;
    // Si TmStmpShift no viene o es inválido, poner fecha actual
    const safeTmStmpShift =
        TmStmpShift && TmStmpShift !== "0000-00-00 00:00:00"
            ? TmStmpShift
            : new Date();
    if (!Identificacion) {
        return res
            .status(400)
            .json({ error: "Falta Identificacion para update" });
    }
    try {
        const [result] = await pool.query(
            `UPDATE campaniasoutbound.trxout SET
                Agent=?,
                StartedManagement=?,
                TmStmp=?,
                Cooperativa=?,
                TipoCampania=?,
                NombreCliente=?,
                Celular=?,
                MotivoLlamada=?,
                SubmotivoLlamada=?,
                Observaciones=?,
                AgentShift=?,
                TmStmpShift=?
            WHERE Identificacion=?`,
            [
                Agent,
                StartedManagement,
                TmStmp,
                Cooperativa,
                TipoCampania,
                NombreCliente,
                Celular,
                MotivoLlamada,
                SubmotivoLlamada,
                Observaciones,
                AgentShift,
                safeTmStmpShift,
                Identificacion,
            ],
        );
        res.json({ success: true, affectedRows: result.affectedRows });
    } catch (err) {
        console.error("[ERROR] Error en PUT /agente/trxout:", err);
        res.status(500).json({ error: "Error actualizando trxout" });
    }
});
export default router;
