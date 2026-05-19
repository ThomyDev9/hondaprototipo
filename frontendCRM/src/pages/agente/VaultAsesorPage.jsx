import { useEffect, useMemo, useState } from "react";
import {
    listarCategoriasMenu,
    DEFAULT_MENU_CATEGORY_ID,
    obtenerCampaniasDetalladasDesdeMenu,
} from "../../services/campaign.service";
import {
    fetchCoopServices,
    revealCoopCredential,
    saveMyCoopCredential,
} from "../../services/dashboard.service";
import "./VaultAsesorPage.css";

function normalizeText(value) {
    return String(value || "").trim();
}

function normalizeLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function matchCampaign(left, right) {
    const a = normalizeLabel(left);
    const b = normalizeLabel(right);
    return a && b && (a === b || a.includes(b) || b.includes(a));
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
                    campaignId,
                    label: nodeLabel || campaignId,
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
        const key = `${item.campaignId}`;
        if (!dedup.has(key)) dedup.set(key, item);
    });

    return Array.from(dedup.values()).sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || ""), "es"),
    );
}

export default function VaultAsesorPage() {
    const [categories, setCategories] = useState([]);
    const [categoryId, setCategoryId] = useState(DEFAULT_MENU_CATEGORY_ID);
    const [campaignOptions, setCampaignOptions] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [revealedByCredential, setRevealedByCredential] = useState({});
    const [formByService, setFormByService] = useState({});
    const [selectedServiceId, setSelectedServiceId] = useState(0);

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
                setCategories([]);
            }
        };

        init();
    }, []);

    useEffect(() => {
        const loadCampaigns = async () => {
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
            loadCampaigns();
        }
    }, [categoryId]);

    const loadServices = async () => {
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const response = await fetchCoopServices({ campaignId: "" });
            if (!response?.ok) {
                throw new Error(
                    response?.json?.error || "No se pudo cargar servicios",
                );
            }
            const data = Array.isArray(response?.json?.data)
                ? response.json.data
                : [];
            const filtered = campaignId
                ? data.filter((item) =>
                      String(item?.accessScope || "campaign") ===
                          "all_advisors" ||
                      matchCampaign(item?.campaignId, campaignId),
                  )
                : data;
            setServices(filtered);
        } catch (err) {
            setError(err?.message || "No se pudo cargar servicios");
            setServices([]);
        } finally {
            setLoading(false);
        }
    };

    const groupedStats = useMemo(() => {
        const requiresOwn = services.filter(
            (item) => item?.requiresAdvisorCredential,
        );
        const total = requiresOwn.length;
        const withCredentials = requiresOwn.filter(
            (item) =>
                Array.isArray(item?.credentials) && item.credentials.length > 0,
        ).length;
        return { total, withCredentials };
    }, [services]);

    const advisorOnlyServices = useMemo(
        () => services.filter((item) => item?.requiresAdvisorCredential),
        [services],
    );

    const selectedService = useMemo(
        () =>
            advisorOnlyServices.find(
                (item) => Number(item.id) === Number(selectedServiceId),
            ) ||
            advisorOnlyServices[0] ||
            null,
        [advisorOnlyServices, selectedServiceId],
    );

    useEffect(() => {
        if (!advisorOnlyServices.length) {
            setSelectedServiceId(0);
            return;
        }
        const exists = advisorOnlyServices.some(
            (item) => Number(item.id) === Number(selectedServiceId),
        );
        if (!exists) {
            setSelectedServiceId(Number(advisorOnlyServices[0].id || 0));
        }
    }, [advisorOnlyServices, selectedServiceId]);

    const handleReveal = async (credentialId) => {
        const key = String(credentialId || "");
        if (!key) return;
        const response = await revealCoopCredential({
            credentialId,
            action: "reveal",
        });
        if (!response?.ok) {
            throw new Error(response?.json?.error || "No se pudo revelar");
        }
        setRevealedByCredential((prev) => ({
            ...prev,
            [key]: response?.json?.data || {},
        }));
    };

    const handleSaveMine = async (serviceId) => {
        const form = formByService[String(serviceId)] || {};
        const payload = {
            alias: normalizeText(form.alias),
            username: normalizeText(form.username),
            password: normalizeText(form.password),
            extra: normalizeText(form.extra),
        };
        if (!payload.alias || !payload.username || !payload.password) {
            setError(
                "Completa alias, usuario y clave para guardar tu credencial.",
            );
            setSuccess("");
            return;
        }

        const response = await saveMyCoopCredential({
            resourceId: serviceId,
            payload,
        });
        if (!response?.ok) {
            throw new Error(
                response?.json?.error || "No se pudo guardar tu credencial",
            );
        }
        setSuccess("Credencial personal guardada correctamente.");
        setError("");
        await loadServices();
    };

    const renderDetail = () => {
        if (!selectedService) {
            return (
                <p className="vault-asesor__muted">
                    No hay servicios de credencial propia por asesor para el
                    filtro actual.
                </p>
            );
        }

        const credential = (selectedService.credentials || [])[0] || null;
        const vmCredential = selectedService.vmCredential || null;
        const revealed = credential
            ? revealedByCredential[String(credential.id)] || {}
            : {};
        const revealedVm = vmCredential
            ? revealedByCredential[String(vmCredential.id)] || {}
            : {};
        const form = formByService[String(selectedService.id)] || {
            alias: "",
            username: "",
            password: "",
            extra: "",
        };

        return (
            <article className="vault-asesor__card" key={selectedService.id}>
                <div className="vault-asesor__card-head">
                    <div className="vault-asesor__title-row">
                        <h3>{selectedService.nombreServicio}</h3>
                        <small>
                            {String(selectedService?.accessScope || "campaign") ===
                            "all_advisors"
                                ? "Global (sin campana)"
                                : selectedService.campaignId}
                        </small>
                    </div>
                    <span className="vault-asesor__badge">
                        Propia por asesor
                    </span>
                </div>

                {selectedService.requiresVirtualMachine || vmCredential ? (
                    <div className="vault-asesor__resolved">
                        <strong>Maquina virtual (global)</strong>
                        {vmCredential?.alias ? (
                            <span>
                                <strong>Alias VM:</strong> {vmCredential.alias}
                            </span>
                        ) : null}
                        <span>
                            {String(
                                selectedService.virtualMachineNotes || "",
                            ).trim() ||
                                "Revisa las instrucciones de acceso virtual con tu supervisor."}
                        </span>
                        {vmCredential ? (
                            <>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await handleReveal(vmCredential.id);
                                        } catch (err) {
                                            setError(
                                                err?.message ||
                                                    "No se pudo revelar VM",
                                            );
                                        }
                                    }}
                                >
                                    Ver credencial VM global
                                </button>
                                {revealedVm?.username ||
                                revealedVm?.password ? (
                                    <pre>{`usuario VM: ${revealedVm?.username || ""}\nclave VM: ${revealedVm?.password || ""}`}</pre>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                ) : null}

                {credential ? (
                    <div className="vault-asesor__resolved">
                        <strong>
                            Mi credencial activa: {credential.alias}
                        </strong>
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await handleReveal(credential.id);
                                } catch (err) {
                                    setError(
                                        err?.message || "No se pudo revelar",
                                    );
                                }
                            }}
                        >
                            Ver mi credencial
                        </button>
                        {revealed?.username || revealed?.password ? (
                            <pre>{`usuario: ${revealed?.username || ""}\nclave: ${revealed?.password || ""}`}</pre>
                        ) : null}
                    </div>
                ) : (
                    <p className="vault-asesor__muted">
                        No tienes credencial configurada para este servicio.
                    </p>
                )}

                <div className="vault-asesor__form">
                    <h4>Configurar / actualizar mi credencial</h4>
                    <div className="vault-asesor__form-grid">
                        <input
                            value={form.alias}
                            onChange={(e) =>
                                setFormByService((prev) => ({
                                    ...prev,
                                    [String(selectedService.id)]: {
                                        ...form,
                                        alias: e.target.value,
                                    },
                                }))
                            }
                            placeholder="Alias"
                        />
                        <input
                            value={form.username}
                            onChange={(e) =>
                                setFormByService((prev) => ({
                                    ...prev,
                                    [String(selectedService.id)]: {
                                        ...form,
                                        username: e.target.value,
                                    },
                                }))
                            }
                            placeholder="Usuario"
                        />
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) =>
                                setFormByService((prev) => ({
                                    ...prev,
                                    [String(selectedService.id)]: {
                                        ...form,
                                        password: e.target.value,
                                    },
                                }))
                            }
                            placeholder="Clave"
                        />
                        <textarea
                            rows={2}
                            value={form.extra}
                            onChange={(e) =>
                                setFormByService((prev) => ({
                                    ...prev,
                                    [String(selectedService.id)]: {
                                        ...form,
                                        extra: e.target.value,
                                    },
                                }))
                            }
                            placeholder="Observacion opcional"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                await handleSaveMine(selectedService.id);
                            } catch (err) {
                                setError(err?.message || "No se pudo guardar");
                                setSuccess("");
                            }
                        }}
                    >
                        Guardar mi credencial
                    </button>
                </div>
            </article>
        );
    };

    return (
        <section className="vault-asesor">
            <header className="vault-asesor__header">
                <h2>Vault de credenciales</h2>
            </header>

            <div className="vault-asesor__toolbar">
                <label>
                    Categoria
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
                    Campana
                    <select
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                    >
                        <option value="">Selecciona campana</option>
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
                <button type="button" onClick={loadServices} disabled={loading}>
                    {loading ? "Cargando..." : "Cargar servicios"}
                </button>
            </div>

            <div className="vault-asesor__stats">
                <span>Total: {groupedStats.total}</span>
                <span>
                    Con credencial resoluble: {groupedStats.withCredentials}
                </span>
            </div>

            {error ? (
                <div className="vault-asesor__alert vault-asesor__alert--error">
                    {error}
                </div>
            ) : null}
            {success ? (
                <div className="vault-asesor__alert vault-asesor__alert--success">
                    {success}
                </div>
            ) : null}

            <div className="vault-asesor__workspace">
                <aside className="vault-asesor__services-nav">
                    {advisorOnlyServices.map((service) => {
                        const hasCred = Boolean(
                            (service.credentials || []).length,
                        );
                        return (
                            <button
                                key={service.id}
                                type="button"
                                className={`vault-asesor__service-item ${
                                    Number(selectedService?.id) ===
                                    Number(service.id)
                                        ? "is-active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setSelectedServiceId(Number(service.id))
                                }
                            >
                                <strong>{service.nombreServicio}</strong>
                                <small>
                                    {String(service?.accessScope || "campaign") ===
                                    "all_advisors"
                                        ? "Global (sin campana)"
                                        : service.campaignId}
                                </small>
                                <span>
                                    {hasCred ? "Configurada" : "Pendiente"}
                                </span>
                            </button>
                        );
                    })}
                </aside>

                <div className="vault-asesor__detail">{renderDetail()}</div>
            </div>
        </section>
    );
}
