// src/routes/agente.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import { agenteQueries } from "../../services/queries/index.js";
import {
    ensureImportStatsTable,
    recomputeImportStats,
} from "../../services/bases.service.js";
import { linkManagementToRecording } from "../../services/recording-link.service.js";
import {
    appendOutMaquitaRrssDriveData,
    isOutMaquitaCampaign,
    syncOutMaquitaSheet,
} from "../../services/outMaquitaSheets.service.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    loadUserRoles,
    requireRole,
} from "../../middleware/role.middleware.js";

const router = express.Router();
const encuestaSchema =
    process.env.MYSQL_DB_ENCUESTA || "bancopichinchaencuesta_dev";

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

function buildOutboundQuestionPayload(entries = []) {
    const preguntas = Array.from({ length: 30 }, () => "");
    const respuestas = Array.from({ length: 30 }, () => "");

    entries.slice(0, 30).forEach((entry, index) => {
        preguntas[index] = String(entry?.label || "").trim();
        respuestas[index] = String(entry?.value || "").trim();
    });

    return { preguntas, respuestas };
}

function buildOutboundCampos(formData = {}) {
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

/* ============================================================================
   1. TOMAR SIGUIENTE REGISTRO (auto-asignación)
============================================================================ */
router.post("/siguiente", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);
        const campaignToUse = String(req.body?.campaignId || "").trim();
        const tabSessionId = String(req.body?.tabSessionId || "").trim();
        const importIdFromBody = String(req.body?.importId || "").trim();

        if (!campaignToUse) {
            return res.status(400).json({ error: "Campaign requerida" });
        }

        // Usar importId recibido si está presente, si no buscar la base activa
        let lastUpdate = importIdFromBody;
        if (!lastUpdate) {
            const [baseRows] = await pool.query(
                `
                SELECT ImportId
                FROM campaign_active_base
                WHERE CampaignId = ?
                AND state = 1
                LIMIT 1
                `,
                [campaignToUse],
            );
            if (!baseRows.length) {
                return res.status(404).json({
                    error: "No hay base activa para esta campaña",
                });
            }
            lastUpdate = baseRows[0].ImportId;
        }

        /* ============================================================
       2. VER SI YA TIENE REGISTRO ASIGNADO
    ============================================================ */

        const [assignedRows] = await pool.query(
            `
      SELECT 
        ID,
        Campaign,
        Name,
        Identification,
        LastUpdate,
        Number AS intentos_totales,
        LastAgent
      FROM contactimportcontact
      WHERE LastAgent = ?
      AND TabSessionId = ?
      AND Campaign = ?
      AND LastUpdate = ?
      AND Action = 'Asignar Base'
      LIMIT 1
      `,
            [agenteActor, tabSessionId, campaignToUse, lastUpdate],
        );

        let registro;

        if (assignedRows.length > 0) {
            registro = assignedRows[0];
        } else {
            /* ============================================================
         3. AUTO ASIGNAR REGISTRO
      ============================================================ */

            const [updateResult] = await pool.query(
                `
        UPDATE contactimportcontact
        SET 
          LastAgent = ?,
          TabSessionId = ?,
          Action = 'Asignar Base',
          TmStmpShift = NOW()
        WHERE Campaign = ?
        AND LastUpdate = ?
        AND LastAgent IN ('','Pendiente')
        AND Action NOT IN ('Cancelar base')
        AND (
              (LastManagementResult IS NULL OR LastManagementResult = '')
              OR
              (
                Action IN ('re_llamada','reciclable')
                AND LastManagementResult IN ('34','60','61','62','63','64')
              )
        )
        ORDER BY Number ASC, ID ASC
        LIMIT 1
        `,
                [agenteActor, tabSessionId, campaignToUse, lastUpdate],
            );

            if (updateResult.affectedRows === 0) {
                return res.status(404).json({
                    error: "No hay registros disponibles en la base activa",
                });
            }

            /* ============================================================
         4. OBTENER REGISTRO ASIGNADO
      ============================================================ */

            const [rows] = await pool.query(
                `
        SELECT 
          ID,
          Campaign,
          Name,
          Identification,
          LastUpdate,
          Number AS intentos_totales,
          LastAgent
        FROM contactimportcontact
        WHERE LastAgent = ?
        AND TabSessionId = ?
        AND Campaign = ?
        AND LastUpdate = ?
        ORDER BY TmStmpShift DESC
        LIMIT 1
        `,
                [agenteActor, tabSessionId, campaignToUse, lastUpdate],
            );

            registro = rows[0];
        }

        if (!registro) {
            return res.status(404).json({ error: "No se encontró registro" });
        }

        /* ============================================================
       5. TELEFONOS
    ============================================================ */

        const [phones] = await pool.query(agenteQueries.getPhonesByContactId, [
            registro.ID,
        ]);

        const numeros = phones
            .map((row) => row.NumeroMarcado)
            .filter(Boolean)
            .slice(0, 2);

        /* ============================================================
       6. CLIENTE DETALLE
    ============================================================ */

        let [clienteRows] = await pool.query(agenteQueries.getClienteById, [
            registro.ID,
        ]);

        if (clienteRows.length === 0 && registro.Identification) {
            [clienteRows] = await pool.query(
                agenteQueries.getClienteByIdentificationAndCampaign,
                [registro.Identification, `${campaignToUse}%`],
            );
        }

        return res.json({
            registro: {
                id: registro.ID,
                contact_id: clienteRows[0]?.ContactId || registro.ID,
                nombre_completo: registro.Name,
                telefono1: numeros[0] || null,
                telefono2: numeros[1] || null,
                intentos_totales: Number(registro.intentos_totales || 0),
                base_nombre: registro.LastUpdate || "Base activa",
                campaign_id: registro.Campaign,
                identification: registro.Identification || null,
                agente: registro.LastAgent,
            },
            detalleCliente: clienteRows[0] || null,
        });
    } catch (err) {
        console.error("Error en /agente/siguiente:", err);

        return res.status(500).json({
            error: "Error tomando siguiente registro",
        });
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
        return res.status(500).json({ error: "Error interno" });
    }
});

// Endpoint para resumen de bases regestion (reciclables)
router.get(
    "/bases-regestion-resumen",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            console.log(
                "[DEBUG] /bases-regestion-resumen: ejecutando query getRegestionBasesSummary",
            );
            const [rows] = await pool.query(
                agenteQueries.getRegestionBasesSummary,
            );
            console.log(
                "[DEBUG] /bases-regestion-resumen: resultado query",
                rows,
            );
            const data = (rows || [])
                .map((row) => ({
                    campaignId: String(row.campaign_id || "").trim(),
                    importId: String(row.import_id || "").trim(),
                    totalReciclables: Number(row.total_reciclables || 0),
                }))
                .filter((item) => item.campaignId && item.importId);
            console.log("[DEBUG] /bases-regestion-resumen: data final", data);
            return res.json({ data });
        } catch (err) {
            console.error("Error en /agente/bases-regestion-resumen:", err);
            return res.status(500).json({ error: "Error interno" });
        }
    },
);

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
        const intentosPrevios = Number(contactRows[0]?.Number || 0);
        const intentos = intentosPrevios + 1;

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

        // Solo incrementar Number si se guarda una gestión (insert/update en gestionfinal)
        // Aquí solo actualizamos los campos de gestión, sin tocar Number
        await pool.query(
            `UPDATE contactimportcontact
             SET Action = ?,
                 LastManagementResult = ?,
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
                    identificationToUse,
                    ...preguntas,
                    ...respuestas,
                    resolvedId,
                    resolvedContactId,
                ],
            );
            // Solo si se insertó gestión, incrementamos Number
            if ((insertGestionResult?.affectedRows || 0) > 0) {
                await pool.query(
                    `UPDATE contactimportcontact SET Number = COALESCE(Number, 0) + 1 WHERE Id = ?`,
                    [resolvedId],
                );
            } else {
                return res.status(404).json({
                    error: "No se encontró cliente origen para insertar gestión",
                });
            }
        } else {
            const [updateGestionResult] = await pool.query(
                agenteQueries.updateGestionFinalByContactId,
                [
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
            // Solo si se actualizó gestión, incrementamos Number
            if ((updateGestionResult?.affectedRows || 0) > 0) {
                await pool.query(
                    `UPDATE contactimportcontact SET Number = COALESCE(Number, 0) + 1 WHERE Id = ?`,
                    [resolvedId],
                );
            }
            await pool.query(
                agenteQueries.insertGestionHistoricaFromGestionFinal,
                [resolvedContactId],
            );
        }

        let linkedRecording = null;
        try {
            linkedRecording = await linkManagementToRecording({
                schemaName: encuestaSchema,
                contactId: resolvedContactId,
                gestionRowId: resolvedId,
                interactionId: interactionIdToUse,
                campaignId: campaignToUse,
                agent: agenteActor,
                contactAddress: contactAddressToUse,
                managementTimestamp: tmstmp,
            });
        } catch (linkErr) {
            console.warn(
                "[agente/guardar-gestion] no se pudo enlazar grabacion",
                linkErr?.message || linkErr,
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
            recordingLinked: Boolean(linkedRecording?.recording_path),
            recordingfile: linkedRecording?.recording_path || null,
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
        const [f4TemplateRows] = await pool.query(
            agenteQueries.getActiveTemplateByCampaignAndType,
            ["F4", campaignId],
        );

        let form2 = null;
        let form3 = null;
        let form4 = null;

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

        if (f4TemplateRows.length > 0) {
            const f4Template = f4TemplateRows[0];
            const [f4FieldRows] = await pool.query(
                agenteQueries.getTemplateFieldsWithOptions,
                [f4Template.template_id],
            );

            form4 = {
                templateId: f4Template.template_id,
                templateName: f4Template.template_name,
                formType: f4Template.form_type,
                version: Number(f4Template.version || 1),
                fields: normalizeTemplateRows(f4FieldRows),
            };
        }

        return res.json({
            campaignId,
            form2,
            form3,
            form4,
        });
    } catch (err) {
        console.error("Error en /agente/form-templates:", err);
        return res
            .status(500)
            .json({ error: "Error cargando plantillas dinámicas" });
    }
});

router.get("/scripts", ...agenteMiddlewares, async (req, res) => {
    try {
        const campaignId = String(req.query?.campaignId || "").trim();

        if (!campaignId) {
            return res.status(400).json({ error: "campaignId es requerido" });
        }

        const [menuRows] = await pool.query(
            `
            SELECT id, nombre_item
            FROM menu_items
            WHERE nombre_item = ?
            ORDER BY CASE WHEN estado = 'activo' THEN 0 ELSE 1 END, id ASC
            LIMIT 1
            `,
            [campaignId],
        );

        if (menuRows.length === 0) {
            return res.json({ data: null });
        }

        const menuItemId = String(menuRows[0].id || "").trim();
        const [scriptRows] = await pool.query(
            `
            SELECT script_json, updated_by, updated_at
            FROM sub_campaign_scripts
            WHERE menu_item_id = ?
            LIMIT 1
            `,
            [menuItemId],
        );

        if (scriptRows.length === 0) {
            return res.json({
                data: {
                    menuItemId,
                    campaignId,
                    script: null,
                    updatedBy: "",
                    updatedAt: null,
                },
            });
        }

        let parsedScript = scriptRows[0].script_json;
        if (typeof parsedScript === "string") {
            try {
                parsedScript = JSON.parse(parsedScript);
            } catch {
                parsedScript = null;
            }
        }

        return res.json({
            data: {
                menuItemId,
                campaignId,
                script:
                    parsedScript &&
                    typeof parsedScript === "object" &&
                    !Array.isArray(parsedScript)
                        ? parsedScript
                        : null,
                updatedBy: scriptRows[0].updated_by || "",
                updatedAt: scriptRows[0].updated_at || null,
            },
        });
    } catch (err) {
        console.error("Error en /agente/scripts:", err);
        return res
            .status(500)
            .json({ error: "Error cargando scripts de campaña" });
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

/*
============================================================================
    LIBERAR REGISTRO ASIGNADO (usado por Cancelar, timeout, volver a inicio)
============================================================================
*/
router.post("/liberar-registro", ...agenteMiddlewares, async (req, res) => {
    try {
        const actor = getAgentActor(req);
        const { registro_id } = req.body || {};
        if (!registro_id) {
            return res.status(400).json({ error: "Falta registro_id" });
        }

        // Consultar el registro para saber si es reciclable
        const [rows] = await pool.query(
            `SELECT Id, LastAgent, Action, LastManagementResult FROM contactimportcontact WHERE Id = ? LIMIT 1`,
            [registro_id],
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }
        const reg = rows[0];

        // Determinar si es reciclable
        const reciclableCodes = [34, 60, 61, 62, 63, 64];
        const isReciclable = reciclableCodes.includes(
            Number(reg.LastManagementResult),
        );

        let updateSql = `UPDATE contactimportcontact SET LastAgent = 'Pendiente', TabSessionId = '', UserShift = ?, TmStmpShift = NOW()`;
        let params = [actor];
        if (isReciclable) {
            updateSql += `, Action = 'reciclable'`;
        }
        updateSql += ` WHERE Id = ? AND LastAgent = ?`;
        params.push(registro_id, reg.LastAgent);

        const [releaseResult] = await pool.query(updateSql, params);

        if ((releaseResult?.affectedRows || 0) > 0) {
            await recomputeStatsByContactId(registro_id, actor);
        }

        return res.json({ success: true, reciclable: isReciclable });
    } catch (err) {
        console.error("Error en /agente/liberar-registro:", err);
        return res.status(500).json({ error: "Error liberando registro" });
    }
});

// Endpoint para tipos de campaña dinámico para Out Maquita Cushunchic
router.get("/tipos-campania", requireAuth, async (req, res) => {
    let cliente = req.query.cliente;
    if (!cliente) {
        return res.status(400).json({ error: "Falta cliente" });
    }
    cliente = cliente.trim();
    try {
        // Usar pool directamente, suponiendo que la base campaniasoutbound está accesible
        console.log("cliente:", cliente);
        const [rows] = await pool.query(
            "select mi.nombre_item , tc.nombre  , tc.estado as estadoTipo from  cck_dev.menu_item_campania_tipo mct join cck_dev.menu_items mi on  mi.id = mct.menu_item_id join cck_dev.tipos_campania tc on tc.id = mct.tipo_id  where mi.nombre_item  = ? and  tc.estado  = 1",
            [cliente],
        );
        // Devolver solo los nombres de tipo de campaña como array de strings
        res.json({ data: rows.map((r) => r.nombre) });
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
            "SELECT * FROM campaniasoutbound_dev.trxout WHERE Identificacion = ? ORDER BY Id DESC LIMIT 1",
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
            `INSERT INTO campaniasoutbound_dev.trxout
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
            "SELECT IFNULL(MAX(ID), 0) AS maxId FROM campaniasoutbound_dev.trxouthistorico",
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
            `UPDATE campaniasoutbound_dev.trxout SET
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

router.get(
    "/buscar-gestion-outbound",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            const campaignId = String(req.query?.campaignId || "").trim();
            const identification = String(
                req.query?.identification || req.query?.identificacion || "",
            ).trim();

            if (!campaignId || !identification) {
                return res.status(400).json({
                    error: "campaignId e identification son requeridos",
                });
            }

            const campaignLike = `${campaignId}%`;
            const [rows] = await pool.query(
                agenteQueries.getClienteByIdentificationAndCampaign,
                [identification, campaignLike],
            );

            const row = rows[0];
            if (!row) {
                return res.status(404).json({ error: "Gestion no encontrada" });
            }

            let dynamicPayload = {};
            try {
                dynamicPayload = row.CamposAdicionalesJson
                    ? JSON.parse(row.CamposAdicionalesJson)
                    : {};
            } catch {
                dynamicPayload = {};
            }

            return res.json({
                success: true,
                data: {
                    ...dynamicPayload,
                    identificacion:
                        dynamicPayload.identificacion ||
                        dynamicPayload.Identificacion ||
                        row.IDENTIFICACION ||
                        "",
                    apellidosNombres:
                        dynamicPayload.apellidosNombres ||
                        dynamicPayload.NombreCliente ||
                        row.NOMBRE_CLIENTE ||
                        row.ContactName ||
                        "",
                    celular:
                        dynamicPayload.celular ||
                        dynamicPayload.Celular ||
                        row.ContactAddress ||
                        "",
                    tipoCampana:
                        dynamicPayload.tipoCampana ||
                        dynamicPayload.TipoCampania ||
                        row.CAMPO1 ||
                        "",
                    motivoInteraccion:
                        dynamicPayload.motivoInteraccion ||
                        dynamicPayload.MotivoLlamada ||
                        row.ResultLevel1 ||
                        "",
                    submotivoInteraccion:
                        dynamicPayload.submotivoInteraccion ||
                        dynamicPayload.SubmotivoLlamada ||
                        row.ResultLevel2 ||
                        "",
                    observaciones:
                        dynamicPayload.observaciones ||
                        dynamicPayload.Observaciones ||
                        row.Observaciones ||
                        "",
                },
            });
        } catch (err) {
            console.error("Error en /agente/buscar-gestion-outbound:", err);
            return res.status(500).json({
                error: "Error buscando gestion outbound",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/guardar-gestion-outbound",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            const agenteActor = getAgentActor(req);
            const campaignId = String(
                req.body?.campaignId || req.body?.campaign_id || "",
            ).trim();
            const formData =
                req.body?.formData && typeof req.body.formData === "object"
                    ? req.body.formData
                    : {};
            const fieldsMeta = Array.isArray(req.body?.fieldsMeta)
                ? req.body.fieldsMeta
                : [];
            const identification = String(
                formData?.identificacion ||
                    formData?.Identificacion ||
                    formData?.identification ||
                    formData?.["Identificaci�n"] ||
                    formData?.["Identificación"] ||
                    formData?.["N�mero de Cedula"] ||
                    formData?.["Numero de Cedula"] ||
                    "",
            ).trim();

            if (!campaignId || !identification) {
                return res.status(400).json({
                    error: "campaignId e identificacion son requeridos",
                });
            }

            const campaignLike = `${campaignId}%`;
            const [existingRows] = await pool.query(
                agenteQueries.getClienteByIdentificationAndCampaign,
                [identification, campaignLike],
            );

            const existingClient = existingRows[0] || null;
            const contactId =
                String(existingClient?.ContactId || "").trim() ||
                `OUT-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
            const now = new Date();
            const startedManagement = now;
            const tmstmp = now;
            const level1ToUse = String(
                formData?.motivoInteraccion || "",
            ).trim();
            const level2ToUse = String(
                formData?.submotivoInteraccion || "",
            ).trim();
            const estadoFinalToUse =
                level2ToUse || level1ToUse || "sin_gestion";
            const contactName = String(
                formData?.apellidosNombres ||
                    formData?.NombreCliente ||
                    "",
            ).trim();
            const contactAddress = String(formData?.celular || "").trim();
            const interactionId = `OUT-${Date.now()}`;
            const importId = String(
                formData?.Origen ||
                    (isOutMaquitaCampaign(campaignId)
                        ? formData?.outboundFlow === "rrss"
                            ? "OUTBOUND REDES"
                            : "OUTBOUND MAIL"
                        : "OUTBOUND"),
            ).trim();
            const tipoCampania = String(formData?.tipoCampana || "").trim();
            const observaciones = String(
                formData?.observaciones || "",
            ).trim();
            const fechaAgendamiento = String(
                formData?.FechaAgenda || "",
            ).trim();
            const campos = buildOutboundCampos(formData);
            const questionEntries = fieldsMeta.map((field) => ({
                label: field?.label || field?.name || "",
                value: formData?.[field?.name] ?? "",
            }));
            const { preguntas, respuestas } =
                buildOutboundQuestionPayload(questionEntries);

            let managementResultCode = "";
            if (campaignId && level1ToUse && level2ToUse) {
                const [codeRows] = await pool.query(
                    agenteQueries.getManagementCodeByLevelsWithoutLevel3,
                    [campaignId, level1ToUse, level2ToUse],
                );
                managementResultCode = String(codeRows[0]?.code || "").trim();
            }

            const payloadJson = JSON.stringify(formData || {});

            const nextIntentos = Math.max(
                Number(existingClient?.Intentos || 0),
                0,
            ) + 1;

            if (!existingClient) {
                await pool.query(
                    `
                    INSERT INTO ${encuestaSchema}.clientes
                    (
                        VCC, CampaignId, ContactId, ContactName, ContactAddress, InteractionId,
                        ImportId, LastAgent, ResultLevel1, ResultLevel2, ResultLevel3, ManagementResultCode,
                        ManagementResultDescription, TmStmp, Intentos,
                        ID, CODIGO_CAMPANIA, NOMBRE_CAMPANIA, IDENTIFICACION, NOMBRE_CLIENTE,
                        CAMPO1, CAMPO2, CAMPO3, CAMPO4, CAMPO5, CAMPO6, CAMPO7, CAMPO8, CAMPO9, CAMPO10,
                        CamposAdicionalesJson, UserShift, Action
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        "CCK",
                        campaignId,
                        contactId,
                        contactName,
                        contactAddress,
                        interactionId,
                        importId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        "",
                        managementResultCode || estadoFinalToUse,
                        "",
                        tmstmp,
                        nextIntentos,
                        identification,
                        campaignId,
                        campaignId,
                        identification,
                        contactName,
                        ...campos,
                        payloadJson,
                        agenteActor,
                        "Gestionado",
                    ],
                );
            } else {
                await pool.query(
                    `
                    UPDATE ${encuestaSchema}.clientes
                    SET ContactId = ?,
                        ContactName = ?,
                        ContactAddress = ?,
                        InteractionId = ?,
                        ImportId = ?,
                        LastAgent = ?,
                        ResultLevel1 = ?,
                        ResultLevel2 = ?,
                        ResultLevel3 = '',
                        ManagementResultCode = ?,
                        ManagementResultDescription = '',
                        TmStmp = ?,
                        Intentos = COALESCE(Intentos, 0) + 1,
                        NOMBRE_CLIENTE = ?,
                        CAMPO1 = ?, CAMPO2 = ?, CAMPO3 = ?, CAMPO4 = ?, CAMPO5 = ?,
                        CAMPO6 = ?, CAMPO7 = ?, CAMPO8 = ?, CAMPO9 = ?, CAMPO10 = ?,
                        CamposAdicionalesJson = ?,
                        UserShift = ?,
                        Action = 'Gestionado'
                    WHERE ContactId = ?
                       OR (IDENTIFICACION = ? AND CampaignId LIKE ?)
                    `,
                    [
                        contactId,
                        contactName,
                        contactAddress,
                        interactionId,
                        importId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        managementResultCode || estadoFinalToUse,
                        tmstmp,
                        contactName,
                        ...campos,
                        payloadJson,
                        agenteActor,
                        contactId,
                        identification,
                        campaignLike,
                    ],
                );
            }

            const [gestionFinalRows] = await pool.query(
                agenteQueries.getGestionFinalByContactId,
                [contactId],
            );

            if (gestionFinalRows.length === 0) {
                await pool.query(
                    agenteQueries.insertGestionFinalFromCliente,
                    [
                        contactId,
                        contactAddress,
                        interactionId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        "",
                        managementResultCode || estadoFinalToUse,
                        startedManagement,
                        tmstmp,
                        nextIntentos,
                        fechaAgendamiento,
                        contactAddress,
                        observaciones,
                        identification,
                        ...preguntas,
                        ...respuestas,
                        contactId,
                        contactId,
                    ],
                );
            } else {
                await pool.query(
                    agenteQueries.updateGestionFinalByContactId,
                    [
                        contactAddress,
                        interactionId,
                        agenteActor,
                        level1ToUse,
                        level2ToUse,
                        "",
                        managementResultCode || estadoFinalToUse,
                        startedManagement,
                        tmstmp,
                        nextIntentos,
                        fechaAgendamiento,
                        contactAddress,
                        observaciones,
                        ...preguntas,
                        ...respuestas,
                        contactId,
                    ],
                );

                await pool.query(
                    `
                    UPDATE ${encuestaSchema}.gestionfinal
                    SET ContactName = ?,
                        CampaignId = ?,
                        ImportId = ?,
                        IDENTIFICACION = ?,
                        NOMBRE_CLIENTE = ?,
                        CAMPO1 = ?, CAMPO2 = ?, CAMPO3 = ?, CAMPO4 = ?, CAMPO5 = ?,
                        CAMPO6 = ?, CAMPO7 = ?, CAMPO8 = ?, CAMPO9 = ?, CAMPO10 = ?
                    WHERE ContactId = ?
                    `,
                    [
                        contactName,
                        campaignId,
                        importId,
                        identification,
                        contactName,
                        ...campos,
                        contactId,
                    ],
                );

                await pool.query(
                    agenteQueries.insertGestionHistoricaFromGestionFinal,
                    [contactId],
                );
            }

            await saveDynamicResponseIfTemplateActive({
                campaignId,
                formType: "F3",
                contactId,
                agentUser: agenteActor,
                payload: formData,
            });

            let linkedRecording = null;
            try {
                linkedRecording = await linkManagementToRecording({
                    schemaName: encuestaSchema,
                    contactId,
                    gestionRowId: contactId,
                    interactionId,
                    campaignId,
                    agent: agenteActor,
                    contactAddress,
                    managementTimestamp: tmstmp,
                });
            } catch (linkErr) {
                console.warn(
                    "[agente/guardar-gestion-outbound] no se pudo enlazar grabacion",
                    linkErr?.message || linkErr,
                );
            }

            let outMaquitaSheetSync = null;
            if (isOutMaquitaCampaign(campaignId)) {
                try {
                    outMaquitaSheetSync = await syncOutMaquitaSheet(
                        formData,
                        agenteActor,
                    );
                } catch (sheetError) {
                    console.error(
                        "Error sincronizando Out Maquita con Google Sheets:",
                        sheetError,
                    );
                    return res.status(500).json({
                        error: "Gestion guardada en BD pero fallo la actualizacion del Drive",
                        detail:
                            sheetError?.message ||
                            "No se pudo actualizar Google Sheets",
                    });
                }
            }

            return res.json({
                success: true,
                contactId,
                outMaquitaSheetSync,
                recordingLinked: Boolean(linkedRecording?.recording_path),
                recordingfile: linkedRecording?.recording_path || null,
                message: "Gestion outbound guardada",
            });
        } catch (err) {
            console.error("Error en /agente/guardar-gestion-outbound:", err);
            return res.status(500).json({
                error: "Error guardando gestion outbound",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    },
);

router.post(
    "/guardar-out-maquita-rrss-drive",
    ...agenteMiddlewares,
    async (req, res) => {
        try {
            const agenteActor = getAgentActor(req);
            const campaignId = String(
                req.body?.campaignId || req.body?.campaign_id || "",
            ).trim();
            const formData =
                req.body?.formData && typeof req.body.formData === "object"
                    ? req.body.formData
                    : {};

            if (!isOutMaquitaCampaign(campaignId)) {
                return res.status(400).json({
                    error: "campaignId invalido para Out Maquita RRSS",
                });
            }

            const driveSync = await appendOutMaquitaRrssDriveData(
                formData,
                agenteActor,
            );

            return res.json({
                success: true,
                driveSync,
                message: "Datos RRSS enviados al Drive",
            });
        } catch (err) {
            console.error(
                "Error en /agente/guardar-out-maquita-rrss-drive:",
                err,
            );
            return res.status(500).json({
                error: "Error enviando datos RRSS al Drive",
                detail: err?.message || "",
            });
        }
    },
);
export default router;




