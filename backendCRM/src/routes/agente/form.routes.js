export function registerFormRoutes(
    router,
    {
        pool,
        agenteDAO,
        agenteMiddlewares,
        requireAuth,
        normalizeTemplateRows,
        getAgentActor,
    },
) {
    const REDES_PARENT_MENU_ITEM_ID = "b3d8324e-2c69-11f1-b790-000c2904c92f";
    const REDES_SHARED_LABEL = "gestion redes";

    const normalizeFlowLabel = (value) =>
        String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();

    router.get("/form-catalogos", ...agenteMiddlewares, async (req, res) => {
        try {
            const campaignId = String(req.query?.campaignId || "").trim();
            const contactId = String(req.query?.contactId || "").trim();
            const categoryId = String(req.query?.categoryId || "").trim();
            const menuItemId = String(req.query?.menuItemId || "").trim();

            const isRedesFlow =
                menuItemId === REDES_PARENT_MENU_ITEM_ID ||
                normalizeFlowLabel(campaignId) === REDES_SHARED_LABEL ||
                normalizeFlowLabel(menuItemId) === REDES_SHARED_LABEL ||
                normalizeFlowLabel(categoryId) === REDES_SHARED_LABEL;

            if (!campaignId) {
                return res.status(400).json({ error: "campaignId es requerido" });
            }

            const levels = isRedesFlow
                ? await agenteDAO.getRedesManagementLevels()
                : await agenteDAO.getManagementLevelsByCampaign(campaignId);
            const phoneStates = await agenteDAO.getPhoneStatusCatalog();
            const otherAdvisors = await agenteDAO.getOtherAdvisors();

            let phones = [];
            if (contactId) {
                const phoneRows = await agenteDAO.getPhonesByContactId(contactId);
                phones = phoneRows
                    .map((row) => row.NumeroMarcado)
                    .filter(Boolean);
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
            return res.status(500).json({
                error: "Error cargando catalogos del formulario",
            });
        }
    });

    router.get("/form-templates", ...agenteMiddlewares, async (req, res) => {
        try {
            const campaignId = String(req.query?.campaignId || "").trim();
            const categoryId = String(req.query?.categoryId || "").trim();
            const menuItemId = String(req.query?.menuItemId || "").trim();

            if (!campaignId && !menuItemId) {
                return res.status(400).json({
                    error: "campaignId o menuItemId es requerido",
                });
            }

            const loadTemplateRows = (formType) =>
                menuItemId
                    ? agenteDAO.getActiveTemplateByMenuItemAndType(
                          formType,
                          menuItemId,
                      )
                    : agenteDAO.getActiveTemplateByCampaignAndType(
                          formType,
                          campaignId,
                          categoryId,
                      );

            const f2TemplateRows = await loadTemplateRows("F2");
            const f3TemplateRows = await loadTemplateRows("F3");
            const f4TemplateRows = await loadTemplateRows("F4");

            let form2 = null;
            let form3 = null;
            let form4 = null;

            if (f2TemplateRows.length > 0) {
                const f2Template = f2TemplateRows[0];
                const f2FieldRows = await agenteDAO.getTemplateFieldsWithOptions(
                    f2Template.template_id,
                );

                form2 = {
                    menuItemId: String(f2Template.menu_item_id || "").trim(),
                    categoryId: String(f2Template.category_id || "").trim(),
                    templateId: f2Template.template_id,
                    templateName: f2Template.template_name,
                    formType: f2Template.form_type,
                    version: Number(f2Template.version || 1),
                    fields: normalizeTemplateRows(f2FieldRows),
                };
            }

            if (f3TemplateRows.length > 0) {
                const f3Template = f3TemplateRows[0];
                const f3FieldRows = await agenteDAO.getTemplateFieldsWithOptions(
                    f3Template.template_id,
                );

                form3 = {
                    menuItemId: String(f3Template.menu_item_id || "").trim(),
                    categoryId: String(f3Template.category_id || "").trim(),
                    templateId: f3Template.template_id,
                    templateName: f3Template.template_name,
                    formType: f3Template.form_type,
                    version: Number(f3Template.version || 1),
                    fields: normalizeTemplateRows(f3FieldRows),
                };
            }

            if (f4TemplateRows.length > 0) {
                const f4Template = f4TemplateRows[0];
                const f4FieldRows = await agenteDAO.getTemplateFieldsWithOptions(
                    f4Template.template_id,
                );

                form4 = {
                    menuItemId: String(f4Template.menu_item_id || "").trim(),
                    categoryId: String(f4Template.category_id || "").trim(),
                    templateId: f4Template.template_id,
                    templateName: f4Template.template_name,
                    formType: f4Template.form_type,
                    version: Number(f4Template.version || 1),
                    fields: normalizeTemplateRows(f4FieldRows),
                };
            }

            return res.json({
                campaignId,
                menuItemId,
                categoryId,
                form2,
                form3,
                form4,
            });
        } catch (err) {
            console.error("Error en /agente/form-templates:", err);
            return res.status(500).json({
                error: "Error cargando plantillas dinamicas",
            });
        }
    });

    router.get("/scripts", ...agenteMiddlewares, async (req, res) => {
        try {
            const campaignId = String(req.query?.campaignId || "").trim();
            const categoryId = String(req.query?.categoryId || "").trim();
            const menuItemId = String(req.query?.menuItemId || "").trim();

            if (!campaignId && !menuItemId) {
                return res.status(400).json({
                    error: "campaignId o menuItemId es requerido",
                });
            }

            const scriptRow = menuItemId
                ? await agenteDAO.getSubcampaignScriptByMenuItem(menuItemId)
                : await agenteDAO.getSubcampaignScriptByCampaign(
                      campaignId,
                      categoryId,
                  );

            if (!scriptRow) {
                return res.json({ data: null });
            }

            let parsedScript = scriptRow.script_json;
            if (typeof parsedScript === "string") {
                try {
                    parsedScript = JSON.parse(parsedScript);
                } catch {
                    parsedScript = null;
                }
            }

            return res.json({
                data: {
                    menuItemId: String(scriptRow.menu_item_id || "").trim(),
                    categoryId: String(scriptRow.category_id || "").trim(),
                    campaignId:
                        campaignId || String(scriptRow.campaign_id || "").trim(),
                    script:
                        parsedScript &&
                        typeof parsedScript === "object" &&
                        !Array.isArray(parsedScript)
                            ? parsedScript
                            : null,
                    updatedBy: scriptRow.updated_by || "",
                    updatedAt: scriptRow.updated_at || null,
                },
            });
        } catch (err) {
            console.error("Error en /agente/scripts:", err);
            return res.status(500).json({
                error: "Error cargando scripts de campana",
            });
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
                    return res.status(400).json({
                        error: "contactId y telefono son requeridos",
                    });
                }

                const row = await agenteDAO.getLastPhoneStatusByContactAndNumber(
                    contactId,
                    telefono,
                );

                return res.json({
                    ultimoEstado: row?.Estado || "",
                    interactionId: row?.InteractionId || "",
                });
            } catch (err) {
                console.error("Error en /agente/ultimo-estado-telefono:", err);
                return res.status(500).json({
                    error: "Error consultando ultimo estado de telefono",
                });
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
            const interactionIdToUse = String(
                req.body?.interactionId || "",
            ).trim();
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

            const clienteKeysRows =
                await agenteDAO.getClienteContactKeysByIdOrContactId(
                    contactIdInput,
                );

            const resolvedContactId = String(
                clienteKeysRows[0]?.ContactId ||
                    clienteKeysRows[0]?.Id ||
                    contactIdInput,
            ).trim();

            const nowIso = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
            const fechaInicio = fechaInicioRaw || nowIso;

            const [updatePhoneResult] =
                await agenteDAO.updateContactPhoneByStatusChange(
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
                    error: "No existe el telefono para el contacto indicado",
                });
            }

            return res.json({ message: "Telefono gestionado con exito" });
        } catch (err) {
            console.error("Error en /agente/update-phones:", err);
            return res.status(500).json({
                error: "Error: no se pudo almacenar la informacion",
                detail: err?.sqlMessage || err?.message || "",
            });
        }
    });

    router.get(
        "/cliente-detalle/:id",
        ...agenteMiddlewares,
        async (req, res) => {
            try {
                const contactId = String(req.params?.id || "").trim();

                if (!contactId) {
                    return res.status(400).json({ error: "id invalido" });
                }

                const clienteRow = await agenteDAO.getClienteById(contactId);

                if (!clienteRow) {
                    return res
                        .status(404)
                        .json({ error: "Cliente no encontrado" });
                }

                return res.json({ detalle: clienteRow });
            } catch (err) {
                console.error("Error en /agente/cliente-detalle/:id:", err);
                return res.status(500).json({
                    error: "Error cargando detalle del cliente",
                });
            }
        },
    );

    router.get("/tipos-campania", requireAuth, async (req, res) => {
        let cliente = req.query.cliente;
        if (!cliente) {
            return res.status(400).json({ error: "Falta cliente" });
        }

        cliente = cliente.trim();

        try {
            const rows = await agenteDAO.getCampaignTypes(cliente);

            return res.json({ data: rows.map((row) => row.tipo_nombre) });
        } catch (err) {
            console.error("Error en /agente/tipos-campania:", err);
            return res.status(500).json({
                error: "Error consultando tipos de campania",
            });
        }
    });
}

export default registerFormRoutes;
