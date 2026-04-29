import { formatLocalDateTime } from "../../utils/dateTime.js";

export function registerGestionRoutes(
    router,
    {
        pool,
        agenteDAO,
        agenteMiddlewares,
        encuestaSchema,
        getAgentActor,
        recomputeImportStats,
        linkManagementToRecording,
        saveDynamicResponseIfTemplateActive,
    },
) {
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
                return res
                    .status(400)
                    .json({ error: "Faltan datos obligatorios" });
            }

            const clienteKeysRows =
                await agenteDAO.getClienteContactKeysByIdOrContactId(
                    registro_id,
                );

            const resolvedId = String(
                clienteKeysRows[0]?.Id || registro_id,
            ).trim();
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
            const observacionesToUse = String(
                comentarios || req.body?.observacion || "",
            ).trim();
            const level3ToUse = "";

            if (!level1ToUse || !level2ToUse || !observacionesToUse) {
                return res.status(400).json({
                    error: "Level1, Level2 y observacion son obligatorios",
                });
            }

            const estadoFinalToUse =
                String(estado_final || "").trim() ||
                level2ToUse ||
                level1ToUse ||
                "sin_gestion";

            let managementResultCode = "";
            if (campaignToUse && level1ToUse && level2ToUse) {
                const codeRow =
                    await agenteDAO.getManagementCodeByLevelsWithoutLevel3(
                        campaignToUse,
                        level1ToUse,
                        level2ToUse,
                    );
                managementResultCode = String(codeRow?.code || "").trim();
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

                    while (
                        fallbackIndex < 30 &&
                        usedIndexes.has(fallbackIndex)
                    ) {
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
            }

            const now = new Date();
            const startedManagement = formatLocalDateTime(now);
            const tmstmp = formatLocalDateTime(now);
            const intentosPrevios = Number(contactRows[0]?.Number || 0);
            const intentos = intentosPrevios + 1;

            const latestPhone =
                await agenteDAO.getLatestPhoneDataByContactId(
                    resolvedContactId,
                );

            const interactionIdOld = String(
                latestPhone.InteractionId || "",
            ).trim();
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
            const fechaAgendamientoToUse = String(
                fecha_agendamiento || respuestas[0] || "",
            ).trim();

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

            const [clienteUpdateResult] =
                await agenteDAO.updateClienteSurveyAndManagement([
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
                ]);

            if ((clienteUpdateResult?.affectedRows || 0) === 0) {
                console.warn("[agente/guardar-gestion] clientes sin actualizar", {
                    registro_id,
                    identificationToUse,
                    campaignLike,
                });
            }

            const gestionFinalRows =
                await agenteDAO.getGestionFinalByContactId(resolvedContactId);

            if (gestionFinalRows.length === 0) {
                const [insertGestionResult] =
                    await agenteDAO.insertGestionFinalFromCliente([
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
                    ]);

                if ((insertGestionResult?.affectedRows || 0) > 0) {
                    await pool.query(
                        `UPDATE contactimportcontact
                         SET Number = COALESCE(Number, 0) + 1
                         WHERE Id = ?`,
                        [resolvedId],
                    );
                } else {
                    return res.status(404).json({
                        error: "No se encontró cliente origen para insertar gestión",
                    });
                }
            } else {
                const [updateGestionResult] =
                    await agenteDAO.updateGestionFinalByContactId([
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
                    ]);

                if ((updateGestionResult?.affectedRows || 0) > 0) {
                    await pool.query(
                        `UPDATE contactimportcontact
                         SET Number = COALESCE(Number, 0) + 1
                         WHERE Id = ?`,
                        [resolvedId],
                    );
                }

                await agenteDAO.insertGestionHistoricaFromGestionFinal(
                    resolvedContactId,
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
                resumenHoy: {
                    total_gestionados,
                    total_citas,
                    total_rellamadas,
                },
            });
        } catch (err) {
            console.error("Error en /agente/guardar-gestion:", err);
            return res.status(500).json({
                error: "Error en /agente/guardar-gestion",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    });
}

export default registerGestionRoutes;

