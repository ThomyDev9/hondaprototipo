import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/common/Button";
import { sendInboundEmail } from "../../services/dashboard.service";
import { getFixedCrmFromEmail } from "./crmEmailDraft.helpers";
import "./InboundEmailComposerPage.css";

const FIXED_FROM_EMAIL = getFixedCrmFromEmail();
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

function getDraftIdFromLocation() {
    if (typeof window === "undefined") {
        return "";
    }

    const searchParams = new URLSearchParams(window.location.search);
    return String(searchParams.get("draftId") || "").trim();
}

function buildPlainTextEmail({ header, body, footer }) {
    return [header, body, footer]
        .map((section) => String(section || "").trim())
        .filter(Boolean)
        .join("\n\n");
}

function hasHtmlMarkup(value) {
    return /<[^>]+>/.test(String(value || ""));
}

function sanitizePreviewHtml(value) {
    return String(value || "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
        .replace(/\son[a-z]+\s*=\s*[^ >]+/gi, "")
        .replace(/javascript:/gi, "")
        .trim();
}

function buildTableToken(index) {
    return `[TABLA ${index}]`;
}

function replaceTableTokens(body = "", tableBlocks = []) {
    return (Array.isArray(tableBlocks) ? tableBlocks : []).reduce(
        (accumulator, block) =>
            accumulator.split(String(block?.token || "")).join(
                String(block?.html || ""),
            ),
        String(body || ""),
    );
}

function cloneTableDraft(tableDraft) {
    const headers = Array.isArray(tableDraft?.headers)
        ? tableDraft.headers.map((header) => String(header || ""))
        : [];
    const rows = Array.isArray(tableDraft?.rows)
        ? tableDraft.rows.map((row) =>
              Array.isArray(row)
                  ? row.map((cell) => String(cell || ""))
                  : [],
          )
        : [];

    return { headers, rows };
}

function createTableDraft(rows = 2, columns = 2) {
    const safeRows = Math.max(1, Math.min(8, Number(rows || 1)));
    const safeColumns = Math.max(1, Math.min(6, Number(columns || 1)));

    return {
        headers: Array.from(
            { length: safeColumns },
            (_, index) => `Columna ${index + 1}`,
        ),
        rows: Array.from({ length: safeRows }, () =>
            Array.from({ length: safeColumns }, () => ""),
        ),
    };
}

function escapeTableCell(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildTableHtmlFromDraft(tableDraft) {
    const headers = Array.isArray(tableDraft?.headers) ? tableDraft.headers : [];
    const rows = Array.isArray(tableDraft?.rows) ? tableDraft.rows : [];

    if (headers.length === 0) {
        return "";
    }

    const headerHtml = headers
        .map(
            (header) =>
                `<th style="border:1px solid #cbd5e1;padding:10px 12px;background:#dbeafe;color:#1e3a8a;text-align:left;vertical-align:top;font-family:Segoe UI,Arial,sans-serif;font-size:14px;font-weight:700;">${escapeTableCell(header)}</th>`,
        )
        .join("");

    const rowsHtml = rows
        .map((row) => {
            const cells = Array.isArray(row) ? row : [];
            return `<tr>${cells
                .map(
                    (cell) =>
                        `<td style="border:1px solid #cbd5e1;padding:10px 12px;background:#ffffff;color:#0f172a;text-align:left;vertical-align:top;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;">${escapeTableCell(cell)}</td>`,
                )
                .join("")}</tr>`;
        })
        .join("\n");

    return [
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;background:#ffffff;">',
        `  <tr>${headerHtml}</tr>`,
        rowsHtml ? `  ${rowsHtml}` : "",
        "</table>",
    ]
        .filter(Boolean)
        .join("\n");
}

export default function InboundEmailComposerPage() {
    const [draft, setDraft] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [showTableBuilder, setShowTableBuilder] = useState(false);
    const [tableDraft, setTableDraft] = useState(() => createTableDraft(2, 2));
    const [tableBlocks, setTableBlocks] = useState([]);
    const [editingTableToken, setEditingTableToken] = useState("");
    const draftId = useMemo(() => getDraftIdFromLocation(), []);
    const bodyTextareaRef = useRef(null);

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
    const previewBodyHtml = useMemo(() => {
        const body = replaceTableTokens(
            String(draft?.body || "").trim(),
            tableBlocks,
        );
        if (!body) return "";
        if (hasHtmlMarkup(body)) {
            return sanitizePreviewHtml(body);
        }
        return body
            .split("\n")
            .filter(Boolean)
            .map((line) => `<p>${line}</p>`)
            .join("");
    }, [draft?.body, tableBlocks]);
    const contextLabel = String(draft?.contextLabel || "Correo CRM").trim();

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

    const insertBodyContent = (content) => {
        const normalizedContent = String(content || "");
        if (!normalizedContent) return;

        const textarea = bodyTextareaRef.current;
        const currentBody = String(draft?.body || "");

        if (!textarea) {
            handleFieldChange(
                "body",
                `${currentBody}${currentBody ? "\n\n" : ""}${normalizedContent}`,
            );
            return;
        }

        const selectionStart = Number(textarea.selectionStart || 0);
        const selectionEnd = Number(textarea.selectionEnd || 0);
        const nextBody = `${currentBody.slice(0, selectionStart)}${normalizedContent}${currentBody.slice(selectionEnd)}`;

        handleFieldChange("body", nextBody);

        window.setTimeout(() => {
            const nextPosition = selectionStart + normalizedContent.length;
            textarea.focus();
            textarea.setSelectionRange(nextPosition, nextPosition);
        }, 0);
    };

    const updateTableHeader = (columnIndex, value) => {
        setTableDraft((prev) => ({
            ...prev,
            headers: prev.headers.map((header, index) =>
                index === columnIndex ? value : header,
            ),
        }));
    };

    const updateTableCell = (rowIndex, columnIndex, value) => {
        setTableDraft((prev) => ({
            ...prev,
            rows: prev.rows.map((row, currentRowIndex) =>
                currentRowIndex === rowIndex
                    ? row.map((cell, currentColumnIndex) =>
                          currentColumnIndex === columnIndex ? value : cell,
                      )
                    : row,
            ),
        }));
    };

    const handleAddTableRow = () => {
        setTableDraft((prev) => {
            if (prev.rows.length >= 8) return prev;
            return {
                ...prev,
                rows: [
                    ...prev.rows,
                    Array.from({ length: prev.headers.length }, () => ""),
                ],
            };
        });
    };

    const handleRemoveTableRow = () => {
        setTableDraft((prev) => {
            if (prev.rows.length <= 1) return prev;
            return {
                ...prev,
                rows: prev.rows.slice(0, -1),
            };
        });
    };

    const handleAddTableColumn = () => {
        setTableDraft((prev) => {
            if (prev.headers.length >= 6) return prev;
            const nextColumnNumber = prev.headers.length + 1;
            return {
                headers: [...prev.headers, `Columna ${nextColumnNumber}`],
                rows: prev.rows.map((row) => [...row, ""]),
            };
        });
    };

    const handleRemoveTableColumn = () => {
        setTableDraft((prev) => {
            if (prev.headers.length <= 1) return prev;
            return {
                headers: prev.headers.slice(0, -1),
                rows: prev.rows.map((row) => row.slice(0, -1)),
            };
        });
    };

    const handleInsertBuiltTable = () => {
        const html = buildTableHtmlFromDraft(tableDraft);
        if (!html) return;
        const nextDraft = cloneTableDraft(tableDraft);

        if (editingTableToken) {
            setTableBlocks((prev) =>
                prev.map((block) =>
                    block.token === editingTableToken
                        ? {
                              ...block,
                              draft: nextDraft,
                              html,
                          }
                        : block,
                ),
            );
            setEditingTableToken("");
            setShowTableBuilder(false);
            return;
        }

        const token = buildTableToken(tableBlocks.length + 1);
        setTableBlocks((prev) => [
            ...prev,
            {
                token,
                draft: nextDraft,
                html,
            },
        ]);
        insertBodyContent(`${draft?.body ? "\n\n" : ""}${token}`);
        setTableDraft(createTableDraft(2, 2));
        setShowTableBuilder(false);
    };

    const handleEditTableBlock = (block) => {
        setTableDraft(cloneTableDraft(block?.draft || createTableDraft(2, 2)));
        setEditingTableToken(String(block?.token || ""));
        setShowTableBuilder(true);
    };

    const handleCancelTableBuilder = () => {
        setEditingTableToken("");
        setTableDraft(createTableDraft(2, 2));
        setShowTableBuilder(false);
    };

    const handleRemoveTableBlock = (block, index) => {
        setTableBlocks((prev) =>
            prev.filter((_item, itemIndex) => itemIndex !== index),
        );

        if (editingTableToken === block?.token) {
            setEditingTableToken("");
            setTableDraft(createTableDraft(2, 2));
            setShowTableBuilder(false);
        }

        handleFieldChange(
            "body",
            String(draft?.body || "")
                .replace(`${block.token}\n\n`, "")
                .replace(`\n\n${block.token}`, "")
                .replace(block.token, ""),
        );
    };

    const handleLoadTwoColumnTemplate = () => {
        setTableDraft({
            headers: ["Campo", "Valor"],
            rows: [
                ["Cliente", ""],
                ["Identificacion", ""],
                ["Telefono", ""],
            ],
        });
        setEditingTableToken("");
        setShowTableBuilder(true);
    };

    const handleSendEmail = async () => {
        if (!draft?.to || !draft?.subject || !String(draft?.body || "").trim()) {
            setErrorMessage(
                "Completa destinatario, asunto y body antes de enviar.",
            );
            setStatusMessage("");
            return;
        }

        const resolvedBody = replaceTableTokens(draft.body || "", tableBlocks);
        const formData = new FormData();
        formData.append("to", draft.to || "");
        formData.append("subject", draft.subject || "");
        formData.append("header", draft.header || "");
        formData.append("body", resolvedBody);
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

            if (draftId) {
                try {
                    localStorage.removeItem(`inbound-email-draft:${draftId}`);
                } catch (cleanupError) {
                    console.warn(
                        "No se pudo limpiar el borrador enviado:",
                        cleanupError,
                    );
                }
            }

            window.setTimeout(() => {
                window.close();
            }, 1800);
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
                    <h1>Correo CRM</h1>
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
                            {contextLabel}
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
                        <div className="inbound-email-page__field-grid inbound-email-page__field-grid--triple">
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
                        </div>

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
                            <small className="inbound-email-page__hint">
                                Las tablas insertadas se muestran como
                                marcadores simples para evitar confusion.
                            </small>
                        </label>

                        <label className="inbound-email-page__field">
                            <span>Body</span>
                            <div className="inbound-email-page__table-bar">
                                <span className="inbound-email-page__table-bar-label">
                                    Tablas
                                </span>
                                <div className="inbound-email-page__table-bar-actions">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="inbound-email-page__icon-button"
                                        onClick={() =>
                                            showTableBuilder
                                                ? handleCancelTableBuilder()
                                                : setShowTableBuilder(true)
                                        }
                                        title={
                                            showTableBuilder
                                                ? "Ocultar constructor"
                                                : "Crear tabla"
                                        }
                                        aria-label={
                                            showTableBuilder
                                                ? "Ocultar constructor"
                                                : "Crear tabla"
                                        }
                                    >
                                        ▦ Nueva
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="inbound-email-page__icon-button"
                                        onClick={handleLoadTwoColumnTemplate}
                                        title="Tabla campo valor"
                                        aria-label="Tabla campo valor"
                                    >
                                        ≡ Campo/Valor
                                    </Button>
                                </div>
                            </div>
                            {showTableBuilder ? (
                                <div className="inbound-email-page__table-builder">
                                    <div className="inbound-email-page__table-builder-head">
                                        <strong>
                                            {editingTableToken
                                                ? `Editando ${editingTableToken}`
                                                : "Nueva tabla"}
                                        </strong>
                                        <span className="inbound-email-page__hint">
                                            Usa los controles y luego guarda la
                                            tabla.
                                        </span>
                                    </div>
                                    <div className="inbound-email-page__table-builder-actions">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="inbound-email-page__icon-button"
                                            onClick={handleAddTableColumn}
                                            title="Agregar columna"
                                            aria-label="Agregar columna"
                                        >
                                            + Col
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="inbound-email-page__icon-button"
                                            onClick={handleRemoveTableColumn}
                                            title="Quitar columna"
                                            aria-label="Quitar columna"
                                        >
                                            - Col
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="inbound-email-page__icon-button"
                                            onClick={handleAddTableRow}
                                            title="Agregar fila"
                                            aria-label="Agregar fila"
                                        >
                                            + Fila
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="inbound-email-page__icon-button"
                                            onClick={handleRemoveTableRow}
                                            title="Quitar fila"
                                            aria-label="Quitar fila"
                                        >
                                            - Fila
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            className="inbound-email-page__icon-button inbound-email-page__icon-button--primary"
                                            onClick={handleInsertBuiltTable}
                                            title={
                                                editingTableToken
                                                    ? "Guardar tabla"
                                                    : "Insertar tabla"
                                            }
                                            aria-label={
                                                editingTableToken
                                                    ? "Guardar tabla"
                                                    : "Insertar tabla"
                                            }
                                        >
                                            ✓ Guardar
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="inbound-email-page__icon-button"
                                            onClick={handleCancelTableBuilder}
                                            title="Cancelar"
                                            aria-label="Cancelar"
                                        >
                                            ✕ Cerrar
                                        </Button>
                                    </div>

                                    <div className="inbound-email-page__table-builder-grid">
                                        <table className="inbound-email-page__builder-table">
                                            <thead>
                                                <tr>
                                                    {tableDraft.headers.map(
                                                        (
                                                            header,
                                                            columnIndex,
                                                        ) => (
                                                            <th
                                                                key={`builder-header-${columnIndex}`}
                                                            >
                                                                <input
                                                                    value={
                                                                        header
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        updateTableHeader(
                                                                            columnIndex,
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    placeholder={`Columna ${columnIndex + 1}`}
                                                                />
                                                            </th>
                                                        ),
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableDraft.rows.map(
                                                    (row, rowIndex) => (
                                                        <tr
                                                            key={`builder-row-${rowIndex}`}
                                                        >
                                                            {row.map(
                                                                (
                                                                    cell,
                                                                    columnIndex,
                                                                ) => (
                                                                    <td
                                                                        key={`builder-cell-${rowIndex}-${columnIndex}`}
                                                                    >
                                                                        <input
                                                                            value={
                                                                                cell
                                                                            }
                                                                            onChange={(
                                                                                event,
                                                                            ) =>
                                                                                updateTableCell(
                                                                                    rowIndex,
                                                                                    columnIndex,
                                                                                    event
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder={`Dato ${rowIndex + 1}.${columnIndex + 1}`}
                                                                        />
                                                                    </td>
                                                                ),
                                                            )}
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                            {tableBlocks.length > 0 ? (
                                <div className="inbound-email-page__table-reference-list">
                                    {tableBlocks.map((block, index) => (
                                        <div
                                            key={block.token}
                                            className="inbound-email-page__table-reference"
                                        >
                                            <span>{block.token}</span>
                                            <div className="inbound-email-page__table-reference-actions">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    className="inbound-email-page__icon-button"
                                                    onClick={() =>
                                                        handleEditTableBlock(
                                                            block,
                                                        )
                                                    }
                                                    title={`Editar ${block.token}`}
                                                    aria-label={`Editar ${block.token}`}
                                                >
                                                    ✎ Editar
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    className="inbound-email-page__icon-button"
                                                    onClick={() =>
                                                        handleRemoveTableBlock(
                                                            block,
                                                            index,
                                                        )
                                                    }
                                                    title={`Quitar ${block.token}`}
                                                    aria-label={`Quitar ${block.token}`}
                                                >
                                                    ✕ Quitar
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            <textarea
                                ref={bodyTextareaRef}
                                rows="10"
                                value={draft.body || ""}
                                onChange={(event) =>
                                    handleFieldChange("body", event.target.value)
                                }
                                placeholder="Escribe el mensaje del correo. Si insertas una tabla, aqui veras un marcador amigable como [TABLA 1]."
                            />
                            <small
                                className="inbound-email-page__hint"
                                style={{ display: "none" }}
                            >
                                Las tablas insertadas se muestran como
                                `&lt;table&gt;...&lt;/table&gt;`, se enviará
                                marcadores simples para evitar confusion.
                            </small>
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
                                {String(draft?.header || "").trim() ? (
                                    <p>{draft.header}</p>
                                ) : null}
                                {previewBodyHtml ? (
                                    <div
                                        className="inbound-email-card__html-preview"
                                        dangerouslySetInnerHTML={{
                                            __html: previewBodyHtml,
                                        }}
                                    />
                                ) : (
                                    previewBody
                                        .split("\n")
                                        .filter(Boolean)
                                        .map((line, index) => (
                                            <p key={`preview-line-${index}`}>
                                                {line}
                                            </p>
                                        ))
                                )}
                                {String(draft?.footer || "").trim() ? (
                                    <p>{draft.footer}</p>
                                ) : null}
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
