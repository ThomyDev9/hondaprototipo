export function registerQueueRoutes(
    router,
    {
        pool,
        agenteDAO,
        agenteMiddlewares,
        ensureImportStatsTable,
        recomputeStatsByContactId,
        getAgentActor,
        requireAuth,
    },
) {
    const normalizeMachineIp = (rawIp = "") => {
        const value = String(rawIp || "").trim();
        if (!value) return "";
        if (value.startsWith("::ffff:")) {
            return value.slice(7).trim();
        }
        return value;
    };

    const resolveRequesterMachineIp = (req) => {
        const forwardedRaw =
            req.headers?.["x-forwarded-for"] ||
            req.headers?.["x-client-ip"] ||
            req.headers?.["x-real-ip"] ||
            "";
        const forwardedIp = String(forwardedRaw || "")
            .split(",")[0]
            .trim();
        const socketIp =
            req.socket?.remoteAddress ||
            req.connection?.remoteAddress ||
            req.ip ||
            "";
        return normalizeMachineIp(forwardedIp || socketIp);
    };

    const resolveAgentNumberFromMachineIp = async (req) => {
        const machineIp = resolveRequesterMachineIp(req);
        if (!machineIp) {
            return "";
        }

        const row = await agenteDAO.getMachineZoiperByIp(machineIp);
        return String(row?.zoiper_code || "").trim();
    };

    const normalizeAgentStatusOptions = (rows = []) =>
        (Array.isArray(rows) ? rows : [])
            .map((row) => {
                const entries = Object.entries(row || {});
                const readValue = (...keys) => {
                    for (const key of keys) {
                        const match = entries.find(
                            ([entryKey, entryValue]) =>
                                String(entryKey || "")
                                    .trim()
                                    .toLowerCase() ===
                                    String(key || "")
                                        .trim()
                                        .toLowerCase() &&
                                entryValue !== undefined &&
                                entryValue !== null &&
                                String(entryValue).trim() !== "",
                        );
                        if (match) {
                            return String(match[1]).trim();
                        }
                    }
                    return "";
                };

                const fallbackValues = entries
                    .map(([, entryValue]) => String(entryValue || "").trim())
                    .filter(Boolean);

                const value =
                    readValue("State", "Estado", "Code", "Codigo", "Id") ||
                    fallbackValues[0] ||
                    "";
                const label =
                    readValue(
                        "Description",
                        "Descripcion",
                        "Label",
                        "Nombre",
                    ) ||
                    fallbackValues[1] ||
                    value;

                return { value, label };
            })
            .filter((item) => item.value);

    const resolveSessionStatus = async (requestedEstado = "") => {
        const normalizedRequestedEstado = String(requestedEstado || "").trim();
        const statusOptions = normalizeAgentStatusOptions(
            await agenteDAO.getAgentStatusCatalog(),
        );
        const allowedStatusValues = new Set(
            statusOptions.map((item) => item.value),
        );

        if (normalizedRequestedEstado) {
            return {
                estado: normalizedRequestedEstado,
                allowedStatusValues,
                isValid: allowedStatusValues.has(normalizedRequestedEstado),
            };
        }

        return {
            estado:
                String(statusOptions[0]?.value || "").trim() || "Disponible",
            allowedStatusValues,
            isValid: true,
        };
    };

    const syncAgentSessionState = async ({
        sessionId,
        agent,
        agentNumber = "",
        estado,
        loginAt = null,
        logoutAt = null,
    }) => {
        const normalizedSessionId = String(sessionId || "").trim();
        const normalizedEstado = String(estado || "").trim();

        if (!normalizedSessionId || !normalizedEstado) {
            return null;
        }

        const changedAt = new Date();
        await agenteDAO.closeOtherOpenAgentContexts({
            agent,
            currentSessionId: normalizedSessionId,
        });
        const existingSession =
            await agenteDAO.getAgentSessionById(normalizedSessionId);
        const openStateLog =
            await agenteDAO.getOpenAgentSessionStateLog(normalizedSessionId);
        const sameEstado =
            String(existingSession?.Estado || "").trim() === normalizedEstado;

        if (openStateLog && !sameEstado) {
            await agenteDAO.closeAgentSessionStateLog({
                id: openStateLog.id,
            });
        }

        await agenteDAO.upsertAgentSessionContext({
            sessionId: normalizedSessionId,
            agent,
            agentNumber,
            estado: normalizedEstado,
            estadoInicio: sameEstado
                ? existingSession?.EstadoInicio || changedAt
                : changedAt,
            estadoFin: sameEstado ? existingSession?.EstadoFin || null : null,
            loginAt: loginAt || existingSession?.LoginAt || null,
            logoutAt,
            tmstmp: changedAt,
        });

        if (!openStateLog || !sameEstado) {
            await agenteDAO.insertAgentSessionStateLog({
                sessionId: normalizedSessionId,
                agent,
                agentNumber,
                estado: normalizedEstado,
            });
        }

        return agenteDAO.getAgentSessionById(normalizedSessionId);
    };

    router.get("/estados-agente", ...agenteMiddlewares, async (_req, res) => {
        try {
            const rows = await agenteDAO.getAgentStatusCatalog();
            return res.json({ data: normalizeAgentStatusOptions(rows) });
        } catch (err) {
            console.error("Error en /agente/estados-agente:", err);
            return res.status(500).json({
                error: "Error cargando estados del agente",
            });
        }
    });

    router.get("/session-context", ...agenteMiddlewares, async (req, res) => {
        try {
            const sessionId = String(req.query?.sessionId || "").trim();

            if (!sessionId) {
                return res.status(400).json({ error: "SessionId requerido" });
            }

            const sessionRow = await agenteDAO.getAgentSessionById(sessionId);
            return res.json({ data: sessionRow || null });
        } catch (err) {
            console.error("Error en /agente/session-context:", err);
            return res.status(500).json({
                error: "Error consultando contexto de sesion",
            });
        }
    });

    router.get("/machine-context", ...agenteMiddlewares, async (req, res) => {
        try {
            const machineIp = resolveRequesterMachineIp(req);
            const mapped = machineIp
                ? await agenteDAO.getMachineZoiperByIp(machineIp)
                : null;

            return res.json({
                data: {
                    machineIp,
                    mappedZoiperCode: String(mapped?.zoiper_code || "").trim(),
                    mapped: Boolean(mapped?.zoiper_code),
                },
            });
        } catch (err) {
            console.error("Error en /agente/machine-context:", err);
            return res.status(500).json({
                error: "Error consultando contexto de maquina",
            });
        }
    });

    router.post("/session-start", ...agenteMiddlewares, async (req, res) => {
        try {
            const sessionId = String(req.body?.sessionId || "").trim();
            const requestedAgentNumber = String(
                req.body?.agentNumber || "",
            ).trim();
            const agenteActor = getAgentActor(req);

            if (!sessionId) {
                return res.status(400).json({ error: "SessionId requerido" });
            }

            const machineMappedAgentNumber =
                await resolveAgentNumberFromMachineIp(req);
            const agentNumber =
                requestedAgentNumber || machineMappedAgentNumber || "";
            const startedAt = new Date();

            await agenteDAO.closeOtherOpenAgentContexts({
                agent: agenteActor,
                currentSessionId: sessionId,
            });

            const existingSession =
                await agenteDAO.getAgentSessionById(sessionId);

            if (existingSession && !existingSession.LogoutAt) {
                const existingAgentNumber = String(
                    existingSession.AgentNumber || "",
                ).trim();

                if (agentNumber && existingAgentNumber !== agentNumber) {
                    await agenteDAO.upsertAgentSessionContext({
                        sessionId,
                        agent: String(existingSession.Agent || agenteActor).trim(),
                        agentNumber,
                        estado: String(existingSession.Estado || "Login").trim(),
                        estadoInicio:
                            existingSession.EstadoInicio ||
                            existingSession.LoginAt ||
                            startedAt,
                        estadoFin: existingSession.EstadoFin || null,
                        loginAt: existingSession.LoginAt || startedAt,
                        logoutAt: existingSession.LogoutAt || null,
                        tmstmp: startedAt,
                    });
                    const refreshedSession =
                        await agenteDAO.getAgentSessionById(sessionId);
                    return res.json({ data: refreshedSession || existingSession });
                }

                return res.json({ data: existingSession });
            }

            await agenteDAO.upsertAgentSessionContext({
                sessionId,
                agent: agenteActor,
                agentNumber,
                estado: "Login",
                estadoInicio: startedAt,
                estadoFin: null,
                loginAt: startedAt,
                logoutAt: null,
                tmstmp: startedAt,
            });

            await agenteDAO.insertAgentSessionStateLog({
                sessionId,
                agent: agenteActor,
                agentNumber,
                estado: "Login",
            });

            const sessionRow = await agenteDAO.getAgentSessionById(sessionId);
            return res.json({ data: sessionRow || null });
        } catch (err) {
            console.error("Error en /agente/session-start:", err);
            return res.status(500).json({
                error: "Error iniciando sesion del agente",
            });
        }
    });

    router.post("/session-end", ...agenteMiddlewares, async (req, res) => {
        try {
            const sessionId = String(req.body?.sessionId || "").trim();
            const agentNumber = String(req.body?.agentNumber || "").trim();
            const agenteActor = getAgentActor(req);

            if (!sessionId) {
                return res.status(400).json({ error: "SessionId requerido" });
            }

            const existingSession =
                await agenteDAO.getAgentSessionById(sessionId);

            if (!existingSession) {
                return res.json({ data: null });
            }

            const endedAt = new Date();
            const openStateLog =
                await agenteDAO.getOpenAgentSessionStateLog(sessionId);

            if (openStateLog) {
                await agenteDAO.closeAgentSessionStateLog({
                    id: openStateLog.id,
                });
            }

            await agenteDAO.upsertAgentSessionContext({
                sessionId,
                agent: agenteActor,
                agentNumber,
                estado: String(existingSession.Estado || "Logout").trim(),
                estadoInicio: existingSession.EstadoInicio || existingSession.LoginAt || endedAt,
                estadoFin: endedAt,
                loginAt: existingSession.LoginAt || endedAt,
                logoutAt: endedAt,
                tmstmp: endedAt,
            });

            const sessionRow = await agenteDAO.getAgentSessionById(sessionId);
            return res.json({ data: sessionRow || null });
        } catch (err) {
            console.error("Error en /agente/session-end:", err);
            return res.status(500).json({
                error: "Error cerrando sesion del agente",
            });
        }
    });

    router.post("/session-context", ...agenteMiddlewares, async (req, res) => {
        try {
            const sessionId = String(req.body?.sessionId || "").trim();
            const agentNumber = String(req.body?.agentNumber || "").trim();
            const agenteActor = getAgentActor(req);

            if (!sessionId) {
                return res.status(400).json({ error: "SessionId requerido" });
            }

            const existingSession =
                await agenteDAO.getAgentSessionById(sessionId);
            const {
                estado: resolvedEstado,
                allowedStatusValues,
                isValid,
            } = await resolveSessionStatus(
                req.body?.estado || existingSession?.Estado || "",
            );

            if (!isValid || !allowedStatusValues.has(resolvedEstado)) {
                return res
                    .status(400)
                    .json({ error: "Estado de agente no valido" });
            }

            const sessionRow = await syncAgentSessionState({
                sessionId,
                agent: String(existingSession?.Agent || agenteActor).trim(),
                agentNumber,
                estado: resolvedEstado,
            });
            return res.json({ data: sessionRow || null });
        } catch (err) {
            console.error("Error en /agente/session-context POST:", err);
            return res.status(500).json({
                error: "Error guardando contexto de sesion",
            });
        }
    });

    router.post("/siguiente", ...agenteMiddlewares, async (req, res) => {
        try {
            const agenteActor = getAgentActor(req);
            const campaignToUse = String(req.body?.campaignId || "").trim();
            const tabSessionId = String(req.body?.tabSessionId || "").trim();
            const importIdFromBody = String(req.body?.importId || "").trim();

            if (!campaignToUse) {
                return res.status(400).json({ error: "Campaign requerida" });
            }

            // Resolver la base activa de la campana si el frontend no manda importId.
            let lastUpdate = importIdFromBody;
            if (!lastUpdate) {
                const activeImport =
                    await agenteDAO.getActiveImportByCampaign(campaignToUse);
                if (!activeImport?.ImportId) {
                    return res.status(404).json({
                        error: "No hay base activa para esta campana",
                    });
                }
                lastUpdate = activeImport.ImportId;
            }

            let registro = await agenteDAO.getAssignedContactForAgent(
                agenteActor,
                tabSessionId,
                campaignToUse,
                lastUpdate,
            );

            if (!registro) {
                const updateResult = await agenteDAO.assignNextContactForAgent(
                    agenteActor,
                    tabSessionId,
                    campaignToUse,
                    lastUpdate,
                );

                if (updateResult.affectedRows === 0) {
                    return res.status(404).json({
                        error: "No hay registros disponibles en la base activa",
                    });
                }

                registro = await agenteDAO.getLatestAssignedContactForAgent(
                    agenteActor,
                    tabSessionId,
                    campaignToUse,
                    lastUpdate,
                );
            }

            if (!registro) {
                return res.status(404).json({ error: "No se encontro registro" });
            }

            const phones = await agenteDAO.getPhonesByContactId(registro.ID);
            const numeros = phones
                .map((row) => row.NumeroMarcado)
                .filter(Boolean)
                .slice(0, 2);

            let clienteRow = await agenteDAO.getClienteById(registro.ID);

            if (!clienteRow && registro.Identification) {
                clienteRow =
                    await agenteDAO.getClienteByIdentificationAndCampaign(
                        registro.Identification,
                        `${campaignToUse}%`,
                    );
            }

            return res.json({
                registro: {
                    id: registro.ID,
                    contact_id: clienteRow?.ContactId || registro.ID,
                    nombre_completo: registro.Name,
                    telefono1: numeros[0] || null,
                    telefono2: numeros[1] || null,
                    intentos_totales: Number(registro.intentos_totales || 0),
                    base_nombre: registro.LastUpdate || "Base activa",
                    campaign_id: registro.Campaign,
                    identification: registro.Identification || null,
                    agente: registro.LastAgent,
                },
                detalleCliente: clienteRow || null,
            });
        } catch (err) {
            console.error("Error en /agente/siguiente:", err);
            return res.status(500).json({
                error: "Error tomando siguiente registro",
            });
        }
    });

    router.get(
        "/bases-activas-resumen",
        ...agenteMiddlewares,
        async (_req, res) => {
            try {
                await ensureImportStatsTable(pool);

                const rows = await agenteDAO.getActiveBasesSummary();
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
        },
    );

    router.get(
        "/bases-regestion-resumen",
        ...agenteMiddlewares,
        async (_req, res) => {
            try {
                const rows = await agenteDAO.getRegestionBasesSummary();
                const data = (rows || [])
                    .map((row) => ({
                        campaignId: String(row.campaign_id || "").trim(),
                        importId: String(row.import_id || "").trim(),
                        totalReciclables: Number(row.total_reciclables || 0),
                    }))
                    .filter((item) => item.campaignId && item.importId);

                return res.json({ data });
            } catch (err) {
                console.error("Error en /agente/bases-regestion-resumen:", err);
                return res.status(500).json({ error: "Error interno" });
            }
        },
    );

    router.post("/estado", ...agenteMiddlewares, async (req, res) => {
        try {
            const { estado, registro_id } = req.body;
            const tabSessionId = String(req.body?.tabSessionId || "").trim();
            const agentNumber = String(req.body?.agentNumber || "").trim();
            const agenteActor = getAgentActor(req);
            const {
                estado: resolvedEstado,
                allowedStatusValues: estadosOperativos,
                isValid,
            } = await resolveSessionStatus(estado);

            if (!resolvedEstado || !isValid || !estadosOperativos.has(resolvedEstado)) {
                return res
                    .status(400)
                    .json({ error: "Estado de agente no valido" });
            }

            const esPausa = resolvedEstado !== "Disponible";

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

            if (tabSessionId) {
                await syncAgentSessionState({
                    sessionId: tabSessionId,
                    agent: agenteActor,
                    agentNumber,
                    estado: resolvedEstado,
                });
            }

            return res.json({ estado: resolvedEstado });
        } catch (err) {
            console.error("Error en /agente/estado:", err);
            return res
                .status(500)
                .json({ error: "Error cambiando estado del agente" });
        }
    });

    router.get("/citas", ...agenteMiddlewares, async (_req, res) => {
        try {
            return res.json({ citas: [] });
        } catch (err) {
            console.error("Error en /agente/citas:", err);
            return res.status(500).json({ error: "Error consultando citas" });
        }
    });

    router.post("/bloquearme", requireAuth, async (req, res) => {
        try {
            const userId = req.user.id;
            const actor = getAgentActor(req);
            const { registro_id } = req.body || {};

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

    router.post("/liberar-registro", ...agenteMiddlewares, async (req, res) => {
        try {
            const actor = getAgentActor(req);
            const { registro_id } = req.body || {};

            if (!registro_id) {
                return res.status(400).json({ error: "Falta registro_id" });
            }

            const [rows] = await pool.query(
                `SELECT Id, LastAgent, Action, LastManagementResult
                 FROM contactimportcontact
                 WHERE Id = ?
                 LIMIT 1`,
                [registro_id],
            );

            if (!rows.length) {
                return res.status(404).json({ error: "Registro no encontrado" });
            }

            const reg = rows[0];
            const reciclableCodes = [34, 60, 61, 62, 63, 64];
            const isReciclable = reciclableCodes.includes(
                Number(reg.LastManagementResult),
            );

            let updateSql =
                "UPDATE contactimportcontact SET LastAgent = 'Pendiente', TabSessionId = '', UserShift = ?, TmStmpShift = NOW()";
            const params = [actor];

            if (isReciclable) {
                updateSql += ", Action = 'reciclable'";
            }

            updateSql += " WHERE Id = ? AND LastAgent = ?";
            params.push(registro_id, reg.LastAgent);

            const [releaseResult] = await pool.query(updateSql, params);

            if ((releaseResult?.affectedRows || 0) > 0) {
                await recomputeStatsByContactId(registro_id, actor);
            }

            return res.json({ success: true, reciclable: isReciclable });
        } catch (err) {
            console.error("Error en /agente/liberar-registro:", err);
            return res
                .status(500)
                .json({ error: "Error liberando registro" });
        }
    });
}

export default registerQueueRoutes;
