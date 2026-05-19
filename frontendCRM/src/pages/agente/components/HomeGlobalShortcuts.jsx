import { useEffect, useMemo, useState } from "react";
import {
    fetchCoopServices,
    revealCoopCredential,
} from "../../../services/dashboard.service";

function normalizeText(value) {
    return String(value || "").trim();
}

export default function HomeGlobalShortcuts() {
    const [items, setItems] = useState([]);
    const [revealed, setRevealed] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetchCoopServices({
                    campaignId: "",
                    includeAllCredentials: true,
                });
                if (!response?.ok) return;
                const rows = Array.isArray(response?.json?.data)
                    ? response.json.data
                    : [];
                const filtered = rows.filter(
                    (item) =>
                        String(item?.accessScope || "campaign") ===
                            "all_advisors" &&
                        Number(item?.homeShortcut || 0) === 1,
                );
                if (!cancelled) setItems(filtered);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const sortedItems = useMemo(
        () =>
            [...items].sort(
                (a, b) =>
                    Number(a?.orden || 0) - Number(b?.orden || 0) ||
                    String(a?.nombreServicio || "").localeCompare(
                        String(b?.nombreServicio || ""),
                        "es",
                    ),
            ),
        [items],
    );

    const copyText = async (value = "") => {
        const text = normalizeText(value);
        if (!text) return;
        await navigator.clipboard.writeText(text);
    };

    const reveal = async (credentialId) => {
        const key = String(credentialId || "");
        if (!key) return null;
        const response = await revealCoopCredential({
            credentialId,
            action: "reveal",
        });
        if (!response?.ok) return null;
        const data = response?.json?.data || {};
        setRevealed((prev) => ({
            ...prev,
            [key]: data,
        }));
        return data;
    };

    const hideCredential = (credentialId) => {
        const key = String(credentialId || "");
        if (!key) return;
        setRevealed((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    if (loading && sortedItems.length === 0) {
        return <p className="agent-info-text">Cargando accesos globales...</p>;
    }
    if (!sortedItems.length) return null;

    return (
        <section className="agent-global-shortcuts">
            <div className="agent-global-shortcuts__grid">
                    {sortedItems.map((service) => {
                        const credentials = Array.isArray(service?.credentials)
                            ? service.credentials
                            : [];
                        return (
                            <article
                                className="agent-global-shortcuts__card"
                                key={service.id}
                            >
                                <div className="agent-global-shortcuts__service-row">
                                    <strong>{service.nombreServicio}</strong>
                                    <div className="agent-global-shortcuts__actions">
                                        {service.url ? (
                                            <>
                                                <a
                                                    href={service.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Abrir
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        copyText(service.url)
                                                    }
                                                >
                                                    Copiar link
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                {credentials.length > 0 ? (
                                    credentials.map((credential) => {
                                        const details =
                                            revealed[String(credential.id)] ||
                                            {};
                                        return (
                                            <div
                                                className="agent-global-shortcuts__cred"
                                                key={credential.id}
                                            >
                                                <div className="agent-global-shortcuts__cred-row">
                                                    <small className="agent-global-shortcuts__alias">
                                                        {credential.alias}
                                                    </small>
                                                    <div className="agent-global-shortcuts__actions agent-global-shortcuts__actions--inline">
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const current =
                                                                    (await reveal(
                                                                        credential.id,
                                                                    )) || details;
                                                                await copyText(
                                                                    current?.username,
                                                                );
                                                            }}
                                                        >
                                                            Copiar usuario
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                const current =
                                                                    (await reveal(
                                                                        credential.id,
                                                                    )) || details;
                                                                await copyText(
                                                                    current?.password,
                                                                );
                                                            }}
                                                        >
                                                            Copiar clave
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                reveal(
                                                                    credential.id,
                                                                )
                                                            }
                                                        >
                                                            Ver
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                hideCredential(
                                                                    credential.id,
                                                                )
                                                            }
                                                        >
                                                            Ocultar
                                                        </button>
                                                    </div>
                                                </div>
                                                {details?.username ||
                                                details?.password ? (
                                                    <div className="agent-global-shortcuts__inline-credentials">
                                                        {`usuario: ${details.username || ""} | clave: ${details.password || ""}`}
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <small>Sin credencial global activa</small>
                                )}
                            </article>
                        );
                    })}
            </div>
        </section>
    );
}
