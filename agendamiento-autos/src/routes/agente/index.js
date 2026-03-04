// src/routes/agente.routes.js
import express from "express";
import pool from "../../services/db.js"; // conexión a MySQL
import { agenteQueries } from "../../services/queries/index.js";
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

/* ============================================================================
   1. TOMAR SIGUIENTE REGISTRO (auto-asignación)
============================================================================ */
router.post("/siguiente", ...agenteMiddlewares, async (req, res) => {
    try {
        const agenteActor = getAgentActor(req);
        const campaignFromBody = String(req.body?.campaignId || "").trim();

        console.log("[agente/siguiente] payload", {
            campaignId: campaignFromBody,
            agente: agenteActor,
        });

        if (!campaignFromBody) {
            return res.status(400).json({
                error: "Debes seleccionar una campaña para tomar registros",
            });
        }

        const campaignToUse = campaignFromBody;

        console.log("[agente/siguiente] campaignToUse", campaignToUse);

        const [assignedRows] = await pool.query(
            agenteQueries.getAssignedClientByAgentAndCampaignLike,
            [agenteActor, `${campaignToUse}%`],
        );

        console.log("[agente/siguiente] assignedRows", assignedRows.length);

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

            console.log("[agente/siguiente] detalle assigned", {
                id: assigned.ID,
                detalleEncontrado: clienteRows.length > 0,
            });

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

        console.log(
            "[agente/siguiente] latestImportRows",
            latestImportRows.length,
            latestImportRows[0]?.ImportId || null,
        );

        let latestImportId = latestImportRows[0]?.ImportId || null;

        if (!latestImportId) {
            const [fallbackImportRows] = await pool.query(
                agenteQueries.getLatestImportWithPendingByCampaign,
                [campaignToUse],
            );

            console.log(
                "[agente/siguiente] fallbackImportRows",
                fallbackImportRows.length,
                fallbackImportRows[0]?.ImportId || null,
            );

            latestImportId = fallbackImportRows[0]?.ImportId || null;

            if (!latestImportId) {
                return res.status(404).json({
                    error: "No hay registros pendientes para esta campaña",
                });
            }

            await pool.query(agenteQueries.upsertCampaignActiveBase, [
                campaignToUse,
                latestImportId,
                agenteActor,
            ]);
        }

        for (let intento = 0; intento < 5; intento++) {
            const [candidatos] = await pool.query(
                agenteQueries.getNextCandidateByCampaignAndImport,
                [campaignToUse, latestImportId],
            );

            console.log(
                "[agente/siguiente] candidatos intento",
                intento + 1,
                candidatos.length,
            );

            if (candidatos.length === 0) {
                break;
            }

            const candidato = candidatos[0];
            const assignAction = candidato.LastManagementResult
                ? "Reciclar Base"
                : "Asignar Base";

            const [updResult] = await pool.query(
                agenteQueries.takeCandidateForAgent,
                [
                    agenteActor,
                    assignAction,
                    agenteActor,
                    candidato.Id,
                    candidato.Campaign,
                ],
            );

            if (updResult.affectedRows > 0) {
                registroTomado = {
                    id: candidato.Id,
                    nombre_completo: candidato.Name,
                    placa: null,
                    telefono1: null,
                    telefono2: null,
                    modelo: null,
                    intentos_totales:
                        Number(candidato.intentos_totales || 0) + 1,
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

        console.log("[agente/siguiente] detalle tomado", {
            id: registroTomado.id,
            detalleEncontrado: clienteRows.length > 0,
        });

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
            `SELECT Id, Campaign, Number, Identification
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
            await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?
                   AND LastAgent = ?`,
                [agenteActor, registro_id, agenteActor],
            );
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
            await pool.query(
                `UPDATE contactimportcontact
                 SET LastAgent = 'Pendiente',
                     UserShift = ?,
                     TmStmpShift = NOW()
                 WHERE Id = ?
                   AND LastAgent = ?`,
                [actor, registro_id, actor],
            );
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

export default router;
