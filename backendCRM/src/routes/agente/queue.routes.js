export function registerQueueRoutes(
    router,
    {
        pool,
        agenteDAO,
        agenteMiddlewares,
        ensureImportStatsTable,
        recomputeStatsByContactId,
        getAgentActor,
        ESTADOS_OPERATIVOS,
        requireAuth,
    },
) {
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
            const agenteActor = getAgentActor(req);

            if (!estado || !ESTADOS_OPERATIVOS.has(estado)) {
                return res
                    .status(400)
                    .json({ error: "Estado de agente no valido" });
            }

            const esPausa = ["baño", "consulta", "lunch", "reunion"].includes(
                estado,
            );

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
