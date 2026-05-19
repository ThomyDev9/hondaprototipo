import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import {
    fetchCoopServices,
    revealCoopCredential,
} from "../../../services/dashboard.service";

const CACHE_TTL_MS = 60 * 1000;
const CACHE_KEY_PREFIX = "inbound_quick_resources::";

function normalizeLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function matchCampaign(target, campaignId) {
    const left = normalizeLabel(target);
    const right = normalizeLabel(campaignId);
    return left && right && (left === right || left.includes(right) || right.includes(left));
}

export default function InboundQuickResources({
    campaignHints = [],
    allowGlobalOnEmpty = false,
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [revealed, setRevealed] = useState({});
    const [open, setOpen] = useState(false);
    const [activeServiceId, setActiveServiceId] = useState(0);

    const normalizedHints = useMemo(() => {
        return campaignHints
            .map((item) => String(item || "").trim())
            .filter(Boolean);
    }, [campaignHints]);
    const cacheKey = useMemo(
        () =>
            `${CACHE_KEY_PREFIX}${normalizedHints
                .map((item) => normalizeLabel(item))
                .sort()
                .join("|")}`,
        [normalizedHints],
    );

    const activeService = useMemo(
        () => items.find((item) => Number(item.id) === Number(activeServiceId)) || null,
        [items, activeServiceId],
    );
    const activeCredential = useMemo(
        () => (activeService?.credentials || [])[0] || null,
        [activeService],
    );
    const activeVmCredential = useMemo(
        () => activeService?.vmCredential || null,
        [activeService],
    );

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError("");

            try {
                // 1) Cache corto para evitar esperas en cambios frecuentes de vista.
                const cachedRaw = sessionStorage.getItem(cacheKey);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const age = Date.now() - Number(cached?.timestamp || 0);
                    if (
                        age >= 0 &&
                        age <= CACHE_TTL_MS &&
                        Array.isArray(cached?.items)
                    ) {
                        const cachedItems = cached.items;
                        if (!cancelled) {
                            setItems(cachedItems);
                            setActiveServiceId((prev) => {
                                if (!cachedItems.length) return 0;
                                const currentExists = cachedItems.some(
                                    (item) => Number(item.id) === Number(prev),
                                );
                                return currentExists
                                    ? prev
                                    : Number(cachedItems[0].id);
                            });
                        }
                        return;
                    }
                }

                // 2) Pedidos en paralelo por hint en lugar de secuencial.
                const responses =
                    normalizedHints.length > 0
                        ? await Promise.all(
                              normalizedHints.map((hint) =>
                                  fetchCoopServices({ campaignId: hint }),
                              ),
                          )
                        : allowGlobalOnEmpty
                          ? [await fetchCoopServices({ campaignId: "" })]
                          : [];

                const collected = responses.flatMap((response) => {
                    if (!response?.ok) return [];
                    const data = Array.isArray(response?.json?.data)
                        ? response.json.data
                        : [];
                    return data;
                });

                if (cancelled) return;

                // 3) Dedup por servicio para evitar repetidos cuando varios hints coinciden.
                const uniqueById = new Map();
                for (const service of collected) {
                    const key = Number(service?.id || 0);
                    if (!key) continue;
                    if (!uniqueById.has(key)) {
                        uniqueById.set(key, service);
                    }
                }
                const deduped = Array.from(uniqueById.values());

                const filtered = deduped.filter((service) => {
                    const isGlobal =
                        String(service?.accessScope || "campaign") ===
                        "all_advisors";
                    const inHints =
                        normalizedHints.length > 0 &&
                        normalizedHints.some((hint) =>
                            matchCampaign(service?.campaignId, hint),
                        );
                    if (allowGlobalOnEmpty && normalizedHints.length === 0) {
                        return (
                            isGlobal &&
                            Number(service?.homeShortcut || 0) === 1
                        );
                    }
                    return inHints;
                });

                setItems(filtered);
                setActiveServiceId((prev) => {
                    if (!filtered.length) return 0;
                    const currentExists = filtered.some(
                        (item) => Number(item.id) === Number(prev),
                    );
                    return currentExists ? prev : Number(filtered[0].id);
                });
                if (filtered.length === 0) setOpen(false);

                sessionStorage.setItem(
                    cacheKey,
                    JSON.stringify({
                        timestamp: Date.now(),
                        items: filtered,
                    }),
                );
            } catch (err) {
                if (!cancelled) {
                    setError(err?.message || "No se pudo cargar accesos");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [cacheKey, normalizedHints]);

    const copyText = async (value = "") => {
        const normalized = String(value || "").trim();
        if (!normalized) return;
        await navigator.clipboard.writeText(normalized);
    };

    const handleReveal = async (credentialId, action = "reveal") => {
        const key = String(credentialId || "");
        if (!key) return null;

        const { ok, json } = await revealCoopCredential({ credentialId, action });
        if (!ok) {
            throw new Error(json?.error || "No se pudo leer credencial");
        }

        const nextData = json?.data || {};
        setRevealed((prev) => ({
            ...prev,
            [key]: nextData,
        }));
        return nextData;
    };

    if (loading && items.length === 0) {
        return <div className="inbound-float-rail inbound-float-rail--loading">Cargando...</div>;
    }

    if (error && items.length === 0) {
        return <div className="inbound-float-rail inbound-float-rail--error">{error}</div>;
    }

    if (!items.length) return null;

    return (
        <div className="inbound-float-wrap">
            <div className="inbound-float-rail">
                <button
                    type="button"
                    className="inbound-float-rail__toggle"
                    onClick={() => setOpen((prev) => !prev)}
                    title="Accesos rápidos"
                >
                    {open ? "×" : "≡"}
                </button>

                {items.map((service) => (
                    <button
                        key={service.id}
                        type="button"
                        className={`inbound-float-rail__item ${
                            Number(activeServiceId) === Number(service.id) ? "is-active" : ""
                        }`}
                        onClick={() => {
                            setActiveServiceId(Number(service.id));
                            setOpen(true);
                        }}
                        title={service.nombreServicio}
                    >
                        {String(service.nombreServicio || "").slice(0, 2).toUpperCase()}
                    </button>
                ))}
            </div>

            {open && activeService ? (
                <aside className="inbound-float-card">
                    <div className="inbound-float-card__head">
                        <div className="inbound-float-card__inline-row">
                            <span className="inbound-float-card__section-title">
                                Servicio:
                            </span>
                            <strong>{activeService.nombreServicio}</strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)}>
                            Cerrar
                        </button>
                    </div>
                    <div className="inbound-float-card__inline-row inbound-float-card__inline-row--url">
                        <span className="inbound-float-card__section-title">URL:</span>
                        {activeService.url ? (
                            <div className="inbound-float-card__service-actions">
                                <a href={activeService.url} target="_blank" rel="noreferrer">
                                    Abrir enlace
                                </a>
                                <button
                                    type="button"
                                    onClick={async () => copyText(activeService.url)}
                                >
                                    Copiar link
                                </button>
                            </div>
                        ) : (
                            <span className="inbound-float-card__muted">Sin URL</span>
                        )}
                    </div>

                    <span className="inbound-float-card__section-title">
                        Credenciales
                    </span>
                    {activeService?.requiresAdvisorCredential && !activeCredential ? (
                        <div className="inbound-float-card__notes">
                            <p>
                                Este servicio usa credencial propia por asesor. Configúrala en el apartado "Vault de Credenciales".
                            </p>
                        </div>
                    ) : null}

                    <div className="inbound-float-card__credentials">
                        {(activeService.credentials || []).map((credential) => {
                            const key = String(credential.id);
                            const current = revealed[key] || {};
                            const hasRevealed = Boolean(current.username || current.password);

                            return (
                                <div key={credential.id} className="inbound-float-card__credential">
                                    <div className="inbound-float-card__credential-head">
                                        <strong>{credential.alias}</strong>
                                        <small>
                                            {credential.scopeType === "advisor"
                                                ? "Propia"
                                                : "Global"}
                                        </small>
                                    </div>
                                    <div className="inbound-float-card__actions">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const next = await handleReveal(credential.id, "copy");
                                                await copyText(next?.username || "");
                                            }}
                                        >
                                            Copiar usuario
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const next = await handleReveal(credential.id, "copy");
                                                await copyText(next?.password || "");
                                            }}
                                        >
                                            Copiar clave
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await handleReveal(credential.id, "reveal");
                                            }}
                                        >
                                            Ver
                                        </button>
                                    </div>
                                    {hasRevealed ? (
                                        <pre>
{`usuario: ${current.username || ""}\nclave: ${current.password || ""}`}
                                        </pre>
                                    ) : null}
                                    {hasRevealed && current?.extra ? (
                                        <div className="inbound-float-card__extra">
                                            <span className="inbound-float-card__extra-label">
                                                Observación credencial:
                                            </span>
                                            <p>{current.extra}</p>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    {activeService?.requiresVirtualMachine || activeService?.vmCredential ? (
                        <>
                            <span className="inbound-float-card__section-title">
                                Acceso a máquina virtual
                            </span>
                            <div className="inbound-float-card__notes">
                                {activeService?.vmCredential?.alias ? (
                                    <p>
                                        <strong>Alias VM:</strong>{" "}
                                        {activeService.vmCredential.alias}
                                    </p>
                                ) : null}
                                <p>
                                    {String(activeService?.virtualMachineNotes || "").trim() ||
                                        "Este servicio requiere acceso por máquina virtual. Revisa las instrucciones del servicio."}
                                </p>
                                {activeService?.vmCredential ? (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleReveal(activeService.vmCredential.id, "reveal");
                                        }}
                                    >
                                        Ver credencial VM global
                                    </button>
                                ) : null}
                                {activeVmCredential ? (
                                    (() => {
                                        const vmData =
                                            revealed[String(activeVmCredential.id)] || {};
                                        const hasVmData = Boolean(
                                            vmData?.username || vmData?.password,
                                        );
                                        if (!hasVmData) return null;
                                        return (
                                            <pre>
{`usuario VM: ${vmData.username || ""}\nclave VM: ${vmData.password || ""}`}
                                            </pre>
                                        );
                                    })()
                                ) : null}
                            </div>
                        </>
                    ) : null}

                    <span className="inbound-float-card__section-title">
                        Observaciones
                    </span>
                    <div className="inbound-float-card__notes">
                        <p>{String(activeService.notas || "").trim() || "Sin observaciones"}</p>
                    </div>
                </aside>
            ) : null}
        </div>
    );
}

InboundQuickResources.propTypes = {
    campaignHints: PropTypes.arrayOf(PropTypes.string),
    allowGlobalOnEmpty: PropTypes.bool,
};
