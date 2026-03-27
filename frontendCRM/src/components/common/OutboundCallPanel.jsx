import React from "react";
import "./OutboundCallPanel.css";

function uniquePhones(phones = []) {
    return Array.from(
        new Set(
            phones
                .map((phone) => String(phone || "").trim())
                .filter(Boolean),
        ),
    );
}

export default function OutboundCallPanel({
    phones = [],
    title = "Llamadas",
    emptyMessage = "No hay telefonos disponibles para marcar.",
}) {
    const availablePhones = React.useMemo(() => uniquePhones(phones), [phones]);
    const [selectedPhone, setSelectedPhone] = React.useState("");
    const [dialerFeedback, setDialerFeedback] = React.useState("");

    React.useEffect(() => {
        setSelectedPhone((current) => {
            if (current && availablePhones.includes(current)) {
                return current;
            }
            return availablePhones[0] || "";
        });
    }, [availablePhones]);

    React.useEffect(() => {
        if (!selectedPhone) return;

        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(selectedPhone).catch(() => {});
            return;
        }

        const tempInput = document.createElement("input");
        tempInput.value = selectedPhone;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
    }, [selectedPhone]);

    const openDialProtocol = (protocol) => {
        const phone = String(selectedPhone || "").trim();
        if (!phone) return;

        if (protocol === "sip-server") {
            window.location.href = `sip:${phone}@172.19.10.40`;
            return;
        }

        if (protocol === "sip") {
            window.location.href = `sip:${phone}`;
            return;
        }

        window.location.href = `${protocol}:${phone}`;
    };

    const handleZoiperBridgeDial = async () => {
        const phone = String(selectedPhone || "").trim();
        if (!phone) return;

        try {
            setDialerFeedback("");

            const response = await fetch("http://127.0.0.1:49321/dial", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: phone }),
            });
            const json = await response.json().catch(() => null);

            if (!response.ok || !json?.ok) {
                throw new Error(
                    json?.error ||
                        "El bridge local no respondio correctamente.",
                );
            }

            setDialerFeedback(
                `Dialer local OK. URI: ${json?.sipUri || "N/D"} | PID: ${
                    json?.pid || "N/D"
                }`,
            );
        } catch (error) {
            console.error(error);
            setDialerFeedback(
                `No se pudo conectar con el dialer local. ${
                    error?.message || ""
                }`,
            );
        }
    };

    return (
        <section className="outbound-call-panel">
            <div className="outbound-call-panel__header">
                <h3 className="outbound-call-panel__title">{title}</h3>
                {selectedPhone ? (
                    <span className="outbound-call-panel__hint">
                        Numero copiado al portapapeles
                    </span>
                ) : null}
            </div>

            {availablePhones.length ? (
                <>
                    <div className="outbound-call-panel__controls">
                        <label className="outbound-call-panel__field">
                            <span>Telefono a marcar</span>
                            <select
                                value={selectedPhone}
                                onChange={(event) =>
                                    setSelectedPhone(event.target.value)
                                }
                                className="outbound-call-panel__select"
                            >
                                {availablePhones.map((phone) => (
                                    <option key={phone} value={phone}>
                                        {phone}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="outbound-call-panel__actions">
                            <button
                                type="button"
                                className="outbound-call-panel__button"
                                onClick={handleZoiperBridgeDial}
                            >
                                Marcar en Zoiper
                            </button>
                            <button
                                type="button"
                                className="outbound-call-panel__button outbound-call-panel__button--alt"
                                onClick={() => openDialProtocol("sip-server")}
                            >
                                Probar SIP directo
                            </button>
                        </div>
                    </div>
                    {dialerFeedback ? (
                        <div className="outbound-call-panel__feedback">
                            {dialerFeedback}
                        </div>
                    ) : null}
                </>
            ) : (
                <div className="outbound-call-panel__empty">{emptyMessage}</div>
            )}
        </section>
    );
}
