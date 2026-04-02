import { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button";
import { sendInboundEmail } from "../../services/dashboard.service";
import "./InboundEmailComposerPage.css";

const FIXED_FROM_EMAIL = "ejecutivos@kimobill.com";
const DEFAULT_FOOTER = [
    "Saludos cordiales,",
    "Equipo Kimobill",
    FIXED_FROM_EMAIL,
].join("\n");

function readDraftFromStorage() {
    if (typeof window === "undefined") {
        return null;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const draftId = String(searchParams.get("draftId") || "").trim();
    if (!draftId) {
        return null;
    }

    try {
        const rawDraft = localStorage.getItem(`inbound-email-draft:${draftId}`);
        if (!rawDraft) {
            return null;
        }
        return JSON.parse(rawDraft);
    } catch (error) {
        console.error("No se pudo leer el borrador de correo inbound:", error);
        return null;
    }
}

function buildPlainTextEmail({ header, body, footer }) {
    return [header, body, footer]
        .map((section) => String(section || "").trim())
        .filter(Boolean)
        .join("\n\n");
}

export default function InboundEmailComposerPage() {
    const [draft, setDraft] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        setDraft(readDraftFromStorage());
    }, []);

    const plainTextBody = useMemo(
        () =>
            buildPlainTextEmail({
                header: draft?.header,
                body: draft?.body,
                footer: draft?.footer,
            }),
        [draft],
    );

    const previewBody = useMemo(
        () =>
            plainTextBody
                .split("\n")
                .map((line) => line.trim())
                .filter((line, index, array) => line || array[index - 1])
                .join("\n"),
        [plainTextBody],
    );

    const handleFieldChange = (field, value) => {
        setDraft((prev) => ({
            ...(prev || {}),
            [field]: value,
        }));
    };

    const handleAttachmentChange = (event) => {
        const nextFiles = Array.from(event.target.files || []);
        setAttachments(nextFiles);
    };

    const handleSendEmail = async () => {
        if (!draft?.to || !draft?.subject || !String(draft?.body || "").trim()) {
            setErrorMessage(
                "Completa destinatario, asunto y body antes de enviar.",
            );
            setStatusMessage("");
            return;
        }

        const formData = new FormData();
        formData.append("to", draft.to || "");
        formData.append("subject", draft.subject || "");
        formData.append("header", draft.header || "");
        formData.append("body", draft.body || "");
        formData.append("footer", draft.footer || "");
        attachments.forEach((file) => formData.append("attachments", file));

        setSending(true);
        setErrorMessage("");
        setStatusMessage("");

        try {
            const { ok, json } = await sendInboundEmail(formData);
            if (!ok) {
                throw new Error(
                    json?.error || "No se pudo enviar el correo desde el CRM",
                );
            }

            setStatusMessage(
                `Correo enviado correctamente a ${draft.to}. Adjuntos: ${json?.attachmentsSent || 0}${json?.savedToSent ? `. Copia guardada en ${json?.sentMailbox || "Sent"}` : json?.saveToSentError ? `. Se envio, pero no se pudo guardar copia en enviados` : ""}`,
            );
        } catch (error) {
            setErrorMessage(error.message || "No se pudo enviar el correo.");
        } finally {
            setSending(false);
        }
    };

    if (!draft) {
        return (
            <main className="inbound-email-page">
                <section className="inbound-email-page__empty">
                    <h1>Correo inbound</h1>
                    <p>
                        No se encontro un borrador para esta pestaña. Regresa a
                        la gestión inbound y vuelve a presionar `Enviar correo`.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="inbound-email-page">
            <section className="inbound-email-page__shell">
                <header className="inbound-email-page__header">
                    <div>
                        <p className="inbound-email-page__eyebrow">
                            Correo inbound
                        </p>
                    </div>
                    <div className="inbound-email-page__actions">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSendEmail}
                            disabled={sending}
                        >
                            {sending ? "Enviando..." : "Enviar desde CRM"}
                        </Button>
                    </div>
                </header>

                {statusMessage ? (
                    <div className="inbound-email-page__status inbound-email-page__status--success">
                        {statusMessage}
                    </div>
                ) : null}
                {errorMessage ? (
                    <div className="inbound-email-page__status inbound-email-page__status--error">
                        {errorMessage}
                    </div>
                ) : null}

                <div className="inbound-email-page__layout">
                    <section className="inbound-email-page__panel">
                        <div className="inbound-email-page__field-grid">
                            <label className="inbound-email-page__field">
                                <span>De</span>
                                <input value={FIXED_FROM_EMAIL} readOnly />
                            </label>
                            <label className="inbound-email-page__field">
                                <span>Para</span>
                                <input
                                    type="email"
                                    value={draft.to || ""}
                                    onChange={(event) =>
                                        handleFieldChange(
                                            "to",
                                            event.target.value,
                                        )
                                    }
                                    placeholder="cliente@correo.com"
                                />
                            </label>
                        </div>

                        <label className="inbound-email-page__field">
                            <span>Asunto</span>
                            <input
                                value={draft.subject || ""}
                                onChange={(event) =>
                                    handleFieldChange(
                                        "subject",
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="inbound-email-page__field">
                            <span>Header</span>
                            <textarea
                                rows="4"
                                value={draft.header || ""}
                                onChange={(event) =>
                                    handleFieldChange(
                                        "header",
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="inbound-email-page__field">
                            <span>Body</span>
                            <textarea
                                rows="10"
                                value={draft.body || ""}
                                onChange={(event) =>
                                    handleFieldChange("body", event.target.value)
                                }
                            />
                        </label>

                        <label className="inbound-email-page__field">
                            <span>Footer</span>
                            <textarea
                                rows="5"
                                value={draft.footer || DEFAULT_FOOTER}
                                onChange={(event) =>
                                    handleFieldChange(
                                        "footer",
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="inbound-email-page__field">
                            <span>Adjuntos</span>
                            <input
                                type="file"
                                multiple
                                onChange={handleAttachmentChange}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                            />
                            <small className="inbound-email-page__hint">
                                Puedes adjuntar PDF, Word, Excel, TXT e imagenes.
                            </small>
                            {attachments.length > 0 ? (
                                <div className="inbound-email-page__attachments">
                                    {attachments.map((file) => (
                                        <span
                                            key={`${file.name}-${file.size}`}
                                            className="inbound-email-page__attachment-chip"
                                        >
                                            {file.name}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </label>
                    </section>

                    <aside className="inbound-email-page__preview">
                        <div className="inbound-email-card">
                            <div className="inbound-email-card__meta">
                                <p>
                                    <strong>De:</strong> {FIXED_FROM_EMAIL}
                                </p>
                                <p>
                                    <strong>Para:</strong>{" "}
                                    {draft.to || "Sin destinatario"}
                                </p>
                                <p>
                                    <strong>Asunto:</strong>{" "}
                                    {draft.subject || "Sin asunto"}
                                </p>
                            </div>

                            <div className="inbound-email-card__content">
                                {previewBody
                                    .split("\n")
                                    .filter(Boolean)
                                    .map((line, index) => (
                                        <p key={`preview-line-${index}`}>
                                            {line}
                                        </p>
                                    ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
