import { useEffect, useMemo, useState } from "react";
import { Button, PageContainer } from "../../components/common";
import {
    DEFAULT_MENU_CATEGORY_ID,
    listarCategoriasMenu,
    obtenerCampaniasDetalladasDesdeMenu,
} from "../../services/campaign.service";
import {
    createCoopCredentialAdmin,
    createCoopServiceAdmin,
    listCoopServicesAdmin,
    updateCoopCredentialAdmin,
    updateCoopServiceAdmin,
} from "../../services/coopServicesAdmin.service";
import "./ConfiguracionAplicativosAdmin.css";

const EMPTY_SERVICE = {
    campaignId: "",
    accessScope: "campaign",
    nombreServicio: "",
    url: "",
    notas: "",
    homeShortcut: 0,
    requiresVirtualMachine: 0,
    virtualMachineNotes: "",
    orden: 0,
    activo: 1,
};

const EMPTY_CREDENTIAL = {
    alias: "",
    scopeType: "global",
    credentialKind: "app",
    username: "",
    password: "",
    extra: "",
    priority: 0,
    activo: 1,
};

function normalizeText(value) {
    return String(value || "").trim();
}

function getScopeLabel(accessScope) {
    return String(accessScope || "campaign") === "all_advisors"
        ? "Global (sin campana)"
        : "Por campana";
}

function flattenSubcampaigns(nodes = []) {
    const result = [];

    const visit = (node, parentLabel = "") => {
        if (!node || typeof node !== "object") return;

        const nodeLabel = normalizeText(
            node.label ||
                node.nombre ||
                node.nombre_item ||
                node.campania ||
                "",
        );
        const campaignId = normalizeText(node.campaignId || nodeLabel);

        const children = Array.isArray(node.subcampanias)
            ? node.subcampanias
            : [];

        if (children.length === 0) {
            if (campaignId) {
                result.push({
                    id: normalizeText(node.id || campaignId),
                    label: nodeLabel || campaignId,
                    campaignId,
                    parentLabel: normalizeText(parentLabel),
                });
            }
            return;
        }

        children.forEach((child) => visit(child, nodeLabel || parentLabel));
    };

    (Array.isArray(nodes) ? nodes : []).forEach((node) => visit(node));

    const dedup = new Map();
    result.forEach((item) => {
        const key = `${item.id}::${item.campaignId}`;
        if (!dedup.has(key)) dedup.set(key, item);
    });

    return Array.from(dedup.values()).sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || ""), "es"),
    );
}

export default function ConfiguracionAplicativosAdmin() {
    const [categories, setCategories] = useState([]);
    const [categoryId, setCategoryId] = useState(DEFAULT_MENU_CATEGORY_ID);
    const [campaignOptions, setCampaignOptions] = useState([]);

    const [campaignFilter, setCampaignFilter] = useState("");
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [selectedServiceId, setSelectedServiceId] = useState(0);
    const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);

    const [selectedCredentialId, setSelectedCredentialId] = useState(0);
    const [credentialForm, setCredentialForm] = useState(EMPTY_CREDENTIAL);

    const selectedService = useMemo(
        () =>
            services.find(
                (item) => Number(item.id) === Number(selectedServiceId),
            ) || null,
        [services, selectedServiceId],
    );

    const selectedCredential = useMemo(() => {
        if (!selectedService) return null;
        return (
            (selectedService.credentials || []).find(
                (item) => Number(item.id) === Number(selectedCredentialId),
            ) || null
        );
    }, [selectedCredentialId, selectedService]);

    const clearMessages = () => {
        setError("");
        setSuccess("");
    };

    const loadServices = async (
        nextFilter = campaignFilter,
        preserveSelection = true,
    ) => {
        setLoading(true);
        setError("");
        try {
            const result = await listCoopServicesAdmin(nextFilter);
            const data = Array.isArray(result?.data) ? result.data : [];
            setServices(data);

            if (!preserveSelection) {
                setSelectedServiceId(0);
                setSelectedCredentialId(0);
                return data;
            }

            const hasSelectedService = data.some(
                (item) => Number(item.id) === Number(selectedServiceId),
            );
            if (!hasSelectedService) {
                setSelectedServiceId(0);
                setSelectedCredentialId(0);
            } else if (selectedCredentialId) {
                const currentService = data.find(
                    (item) => Number(item.id) === Number(selectedServiceId),
                );
                const hasSelectedCredential = (
                    currentService?.credentials || []
                ).some(
                    (item) => Number(item.id) === Number(selectedCredentialId),
                );
                if (!hasSelectedCredential) {
                    setSelectedCredentialId(0);
                }
            }

            return data;
        } catch (err) {
            setError(err?.message || "No se pudo cargar servicios");
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                const rows = await listarCategoriasMenu();
                const options = (rows || []).map((item) => ({
                    value: normalizeText(item?.id),
                    label: normalizeText(item?.nombre),
                }));
                setCategories(options);
                if (!options.some((item) => item.value === categoryId)) {
                    setCategoryId(
                        options[0]?.value || DEFAULT_MENU_CATEGORY_ID,
                    );
                }
            } catch {
                // no-op
            }
        };

        init();
        loadServices();
    }, []);

    useEffect(() => {
        const loadCampaignCombos = async () => {
            try {
                const nodes =
                    await obtenerCampaniasDetalladasDesdeMenu(categoryId);
                const options = flattenSubcampaigns(nodes).map((item) => ({
                    value: item.campaignId,
                    label: item.parentLabel
                        ? `${item.parentLabel} > ${item.label}`
                        : item.label,
                }));
                setCampaignOptions(options);
            } catch {
                setCampaignOptions([]);
            }
        };

        if (categoryId) {
            loadCampaignCombos();
        }
    }, [categoryId]);

    const resetServiceForm = () => {
        setServiceForm({ ...EMPTY_SERVICE, campaignId: campaignFilter || "" });
        setSelectedServiceId(0);
    };

    const resetCredentialForm = () => {
        setCredentialForm(EMPTY_CREDENTIAL);
        setSelectedCredentialId(0);
    };

    const handleSelectService = (service) => {
        clearMessages();
        setSelectedServiceId(Number(service?.id || 0));
        setServiceForm({
            campaignId: normalizeText(service?.campaignId),
            accessScope: normalizeText(service?.accessScope) || "campaign",
            nombreServicio: normalizeText(service?.nombreServicio),
            url: normalizeText(service?.url),
            notas: normalizeText(service?.notas),
            homeShortcut: service?.homeShortcut ? 1 : 0,
            requiresVirtualMachine: service?.requiresVirtualMachine ? 1 : 0,
            virtualMachineNotes: normalizeText(service?.virtualMachineNotes),
            orden: Number(service?.orden || 0),
            activo: service?.activo ? 1 : 0,
        });
        resetCredentialForm();
    };

    const handleSelectCredential = (credential) => {
        clearMessages();
        setSelectedCredentialId(Number(credential?.id || 0));
        setCredentialForm({
            alias: normalizeText(credential?.alias),
            scopeType: normalizeText(credential?.scopeType) || "global",
            credentialKind: normalizeText(credential?.credentialKind) || "app",
            username: "",
            password: "",
            extra: "",
            priority: Number(credential?.priority || 0),
            activo: credential?.activo ? 1 : 0,
        });
    };

    const handleDuplicateCredential = () => {
        if (!selectedCredential) {
            setError("Selecciona una credencial para duplicar.");
            return;
        }

        clearMessages();
        setSelectedCredentialId(0);
        setCredentialForm({
            alias: `${normalizeText(selectedCredential.alias)} (copia)`,
            scopeType: normalizeText(selectedCredential.scopeType) || "global",
            credentialKind:
                normalizeText(selectedCredential.credentialKind) || "app",
            username: "",
            password: "",
            extra: "",
            priority: Number(selectedCredential.priority || 0),
            activo: selectedCredential.activo ? 1 : 0,
        });
    };

    const handleSaveService = async () => {
        clearMessages();
        const isCampaignScope = serviceForm.accessScope === "campaign";
        if (!serviceForm.nombreServicio) {
            setError("Nombre de servicio es requerido.");
            return;
        }
        if (isCampaignScope && !serviceForm.campaignId) {
            setError("Campaña es requerida cuando el alcance es por campaña.");
            return;
        }

        try {
            if (selectedServiceId) {
                await updateCoopServiceAdmin(selectedServiceId, {
                    ...serviceForm,
                    orden: Number(serviceForm.orden || 0),
                });
                setSuccess("Servicio actualizado.");
                await loadServices(campaignFilter, true);
            } else {
                const autoOrder = Number(services.length || 0) + 1;
                const created = await createCoopServiceAdmin({
                    ...serviceForm,
                    orden: autoOrder,
                });
                const createdId = Number(created?.data?.id || 0);
                setSuccess("Servicio creado.");
                const data = await loadServices(campaignFilter, false);
                if (createdId) {
                    const newService = data.find(
                        (item) => Number(item.id) === createdId,
                    );
                    if (newService) {
                        handleSelectService(newService);
                    }
                }
            }
        } catch (err) {
            setError(err?.message || "No se pudo guardar servicio");
        }
    };

    const handleSaveCredential = async () => {
        clearMessages();
        if (!selectedServiceId) {
            setError("Selecciona un servicio primero.");
            return;
        }
        if (!credentialForm.alias) {
            setError("Alias es requerido.");
            return;
        }

        try {
            if (selectedCredentialId) {
                const payload = {
                    alias: credentialForm.alias,
                    scopeType: credentialForm.scopeType || "global",
                    credentialKind: credentialForm.credentialKind || "app",
                    priority: Number(credentialForm.priority || 0),
                    activo: credentialForm.activo,
                };
                if (normalizeText(credentialForm.username))
                    payload.username = credentialForm.username;
                if (normalizeText(credentialForm.password))
                    payload.password = credentialForm.password;
                if (normalizeText(credentialForm.extra))
                    payload.extra = credentialForm.extra;

                await updateCoopCredentialAdmin(selectedCredentialId, payload);
                setSuccess("Credencial actualizada.");
                await loadServices(campaignFilter, true);
            } else {
                if (
                    credentialForm.scopeType === "global" &&
                    (!credentialForm.username || !credentialForm.password)
                ) {
                    setError(
                        "Para credencial global, usuario y clave son requeridos.",
                    );
                    return;
                }
                const nextPriority =
                    Number((selectedService?.credentials || []).length || 0) +
                    1;
                await createCoopCredentialAdmin(selectedServiceId, {
                    ...credentialForm,
                    scopeType:
                        credentialForm.credentialKind === "vm"
                            ? "global"
                            : credentialForm.scopeType,
                    priority: nextPriority,
                });
                setSuccess("Credencial creada.");
                await loadServices(campaignFilter, true);
                resetCredentialForm();
            }
        } catch (err) {
            setError(err?.message || "No se pudo guardar credencial");
        }
    };

    return (
        <PageContainer>
            <section className="config-apps">
                <header className="config-apps__header">
                    <h2>Configuración aplicativos</h2>
                </header>

                <div className="config-apps__toolbar">
                    <label>
                        Categoría
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                        >
                            {categories.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Campaña (filtro)
                        <select
                            value={campaignFilter}
                            onChange={(e) => {
                                const next = e.target.value;
                                setCampaignFilter(next);
                                setServiceForm((prev) => ({
                                    ...prev,
                                    campaignId: next || prev.campaignId,
                                }));
                            }}
                        >
                            <option value="">Todas</option>
                            {campaignOptions.map((item) => (
                                <option
                                    key={`${item.value}-${item.label}`}
                                    value={item.value}
                                >
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button
                        type="button"
                        onClick={() => loadServices(campaignFilter, true)}
                        disabled={loading}
                    >
                        {loading ? "Cargando..." : "Buscar"}
                    </Button>
                </div>

                {error ? (
                    <div className="config-apps__alert config-apps__alert--error">
                        {error}
                    </div>
                ) : null}
                {success ? (
                    <div className="config-apps__alert config-apps__alert--success">
                        {success}
                    </div>
                ) : null}

                <div className="config-apps__layout">
                    <aside className="config-apps__list">
                        <div className="config-apps__list-head">
                            <strong>Servicios</strong>
                            <button type="button" onClick={resetServiceForm}>
                                Nuevo
                            </button>
                        </div>
                        <div className="config-apps__cards">
                            {services.map((service) => (
                                <button
                                    key={service.id}
                                    type="button"
                                    className={`config-apps__card ${Number(selectedServiceId) === Number(service.id) ? "is-active" : ""}`}
                                    onClick={() => handleSelectService(service)}
                                >
                                    <strong>{service.nombreServicio}</strong>
                                    <span>
                                        {service.accessScope === "all_advisors"
                                            ? "Sin campana"
                                            : service.campaignId}
                                    </span>
                                    <small>
                                        {getScopeLabel(service.accessScope)}
                                    </small>
                                    <small>
                                        {(service.credentials || []).length}{" "}
                                        credenciales
                                    </small>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="config-apps__forms">
                        <section className="config-apps__panel">
                            <h3>
                                {selectedServiceId
                                    ? "Editar servicio"
                                    : "Nuevo servicio"}
                            </h3>
                            <div className="config-apps__grid">
                                <label>
                                    Alcance
                                    <select
                                        value={String(
                                            serviceForm.accessScope ||
                                                "campaign",
                                        )}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                accessScope:
                                                    e.target.value ===
                                                    "all_advisors"
                                                        ? "all_advisors"
                                                        : "campaign",
                                            }))
                                        }
                                    >
                                        <option value="campaign">
                                            Por campaña
                                        </option>
                                        <option value="all_advisors">
                                            Todos los asesores
                                        </option>
                                    </select>
                                </label>
                                <label>
                                    Campaña
                                    <select
                                        value={serviceForm.campaignId}
                                        disabled={
                                            serviceForm.accessScope ===
                                            "all_advisors"
                                        }
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                campaignId: e.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">
                                            Selecciona campaña
                                        </option>
                                        {campaignOptions.map((item) => (
                                            <option
                                                key={`${item.value}-${item.label}`}
                                                value={item.value}
                                            >
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Acceso rápido en inicio
                                    <select
                                        value={String(
                                            serviceForm.homeShortcut || 0,
                                        )}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                homeShortcut: Number(
                                                    e.target.value || 0,
                                                ),
                                            }))
                                        }
                                    >
                                        <option value="0">No</option>
                                        <option value="1">Sí</option>
                                    </select>
                                </label>
                                <label>
                                    Nombre servicio
                                    <input
                                        value={serviceForm.nombreServicio}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                nombreServicio: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    URL
                                    <input
                                        value={serviceForm.url}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                url: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    Activo
                                    <select
                                        value={String(serviceForm.activo)}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                activo: Number(e.target.value),
                                            }))
                                        }
                                    >
                                        <option value="1">Sí</option>
                                        <option value="0">No</option>
                                    </select>
                                </label>
                                <label>
                                    Requiere VM
                                    <select
                                        value={String(
                                            serviceForm.requiresVirtualMachine ||
                                                0,
                                        )}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                requiresVirtualMachine: Number(
                                                    e.target.value || 0,
                                                ),
                                            }))
                                        }
                                    >
                                        <option value="0">No</option>
                                        <option value="1">Sí</option>
                                    </select>
                                </label>
                                <label className="full">
                                    Observaciones
                                    <textarea
                                        rows={3}
                                        value={serviceForm.notas}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                notas: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="full">
                                    Instrucciones de máquina virtual
                                    <textarea
                                        rows={3}
                                        value={serviceForm.virtualMachineNotes}
                                        onChange={(e) =>
                                            setServiceForm((prev) => ({
                                                ...prev,
                                                virtualMachineNotes:
                                                    e.target.value,
                                            }))
                                        }
                                        placeholder="Ej: Conectarse a RDP 172.x.x.x, usuario VM..., luego abrir URL..."
                                    />
                                </label>
                            </div>
                            <div className="config-apps__actions">
                                <Button
                                    type="button"
                                    onClick={handleSaveService}
                                >
                                    Guardar servicio
                                </Button>
                            </div>
                        </section>

                        <section className="config-apps__panel">
                            <div className="config-apps__list-head">
                                <h3>Credenciales</h3>
                                <button
                                    type="button"
                                    onClick={resetCredentialForm}
                                >
                                    Nueva
                                </button>
                            </div>
                            <p className="config-apps__hint">
                                Usa tipo Global para claves compartidas, o
                                Propia por asesor para obligar que cada asesor
                                cargue su propia clave.
                            </p>

                            {selectedService ? (
                                <>
                                    <div className="config-apps__credentials-list">
                                        {(
                                            selectedService.credentials || []
                                        ).map((credential) => (
                                            <button
                                                key={credential.id}
                                                type="button"
                                                className={`config-apps__credential-item ${Number(selectedCredentialId) === Number(credential.id) ? "is-active" : ""}`}
                                                onClick={() =>
                                                    handleSelectCredential(
                                                        credential,
                                                    )
                                                }
                                            >
                                                <strong>
                                                    {credential.alias}
                                                </strong>
                                                <span>
                                                    Prioridad:{" "}
                                                    {credential.priority}
                                                </span>
                                                <small>
                                                    Tipo credencial:{" "}
                                                    {credential.credentialKind ===
                                                    "vm"
                                                        ? "Máquina virtual"
                                                        : "Aplicativo"}
                                                </small>
                                                <small>
                                                    Tipo:{" "}
                                                    {credential.scopeType ===
                                                    "advisor"
                                                        ? "Propia por asesor"
                                                        : "Global"}
                                                </small>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="config-apps__grid">
                                        <label>
                                            Clase credencial
                                            <select
                                                value={String(
                                                    credentialForm.credentialKind ||
                                                        "app",
                                                )}
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            credentialKind:
                                                                e.target
                                                                    .value ===
                                                                "vm"
                                                                    ? "vm"
                                                                    : "app",
                                                            scopeType:
                                                                e.target
                                                                    .value ===
                                                                "vm"
                                                                    ? "global"
                                                                    : prev.scopeType ||
                                                                      "advisor",
                                                        }),
                                                    )
                                                }
                                            >
                                                <option value="app">
                                                    Aplicativo
                                                </option>
                                                <option value="vm">
                                                    Máquina virtual (global)
                                                </option>
                                            </select>
                                        </label>
                                        <label>
                                            Tipo credencial
                                            <select
                                                value={String(
                                                    credentialForm.scopeType ||
                                                        "global",
                                                )}
                                                disabled={
                                                    credentialForm.credentialKind ===
                                                    "vm"
                                                }
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            scopeType:
                                                                e.target
                                                                    .value ===
                                                                "advisor"
                                                                    ? "advisor"
                                                                    : "global",
                                                        }),
                                                    )
                                                }
                                            >
                                                <option value="global">
                                                    Global (compartida)
                                                </option>
                                                <option value="advisor">
                                                    Propia por asesor
                                                </option>
                                            </select>
                                        </label>
                                        <label>
                                            Alias
                                            <input
                                                value={credentialForm.alias}
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            alias: e.target
                                                                .value,
                                                        }),
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            Activo
                                            <select
                                                value={String(
                                                    credentialForm.activo,
                                                )}
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            activo: Number(
                                                                e.target.value,
                                                            ),
                                                        }),
                                                    )
                                                }
                                            >
                                                <option value="1">Sí</option>
                                                <option value="0">No</option>
                                            </select>
                                        </label>
                                        <label>
                                            Usuario
                                            <input
                                                value={credentialForm.username}
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            username:
                                                                e.target.value,
                                                        }),
                                                    )
                                                }
                                                placeholder={
                                                    credentialForm.scopeType ===
                                                    "advisor"
                                                        ? "Opcional (plantilla)"
                                                        : selectedCredential
                                                          ? "Opcional en edición"
                                                          : "Requerido"
                                                }
                                            />
                                        </label>
                                        <label>
                                            Clave
                                            <input
                                                value={credentialForm.password}
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            password:
                                                                e.target.value,
                                                        }),
                                                    )
                                                }
                                                placeholder={
                                                    credentialForm.scopeType ===
                                                    "advisor"
                                                        ? "Opcional (plantilla)"
                                                        : selectedCredential
                                                          ? "Opcional en edición"
                                                          : "Requerido"
                                                }
                                            />
                                        </label>
                                        <label className="full">
                                            Observación credencial
                                            <textarea
                                                rows={3}
                                                value={credentialForm.extra}
                                                onChange={(e) =>
                                                    setCredentialForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            extra: e.target
                                                                .value,
                                                        }),
                                                    )
                                                }
                                                placeholder="VPN, máquina virtual, oficina, etc."
                                            />
                                        </label>
                                    </div>

                                    <div className="config-apps__actions">
                                        {selectedCredential ? (
                                            <Button
                                                type="button"
                                                variant="default"
                                                onClick={
                                                    handleDuplicateCredential
                                                }
                                            >
                                                Duplicar credencial
                                            </Button>
                                        ) : null}
                                        <Button
                                            type="button"
                                            onClick={handleSaveCredential}
                                        >
                                            Guardar credencial
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p>
                                    Selecciona un servicio para administrar
                                    credenciales.
                                </p>
                            )}
                        </section>
                    </div>
                </div>
            </section>
        </PageContainer>
    );
}
