import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import MailComposer from "nodemailer/lib/mail-composer/index.js";

let cachedTransporter = null;

function normalizeBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return ["1", "true", "yes", "si"].includes(
        String(value).trim().toLowerCase(),
    );
}

function getInboundMailConfig() {
    const host = String(
        process.env.INBOUND_EMAIL_SMTP_HOST || "smtp.office365.com",
    ).trim();
    const port = Number(process.env.INBOUND_EMAIL_SMTP_PORT || 587);
    const secure = normalizeBooleanEnv(
        process.env.INBOUND_EMAIL_SMTP_SECURE,
        false,
    );
    const user = String(process.env.INBOUND_EMAIL_USER || "").trim();
    const pass = String(process.env.INBOUND_EMAIL_PASSWORD || "").trim();
    const from = String(
        process.env.INBOUND_EMAIL_FROM || user || "",
    ).trim();
    const imapHost = String(
        process.env.INBOUND_EMAIL_IMAP_HOST || host,
    ).trim();
    const imapPort = Number(process.env.INBOUND_EMAIL_IMAP_PORT || 993);
    const imapSecure = normalizeBooleanEnv(
        process.env.INBOUND_EMAIL_IMAP_SECURE,
        true,
    );
    const sentMailbox = String(
        process.env.INBOUND_EMAIL_SENT_MAILBOX || "Sent",
    ).trim();

    return {
        host,
        port,
        secure,
        user,
        pass,
        from,
        imapHost,
        imapPort,
        imapSecure,
        sentMailbox,
    };
}

export function getInboundEmailLimits() {
    return {
        maxFiles: Number(process.env.INBOUND_EMAIL_MAX_ATTACHMENTS || 5),
        maxFileSizeBytes: Number(
            process.env.INBOUND_EMAIL_MAX_FILE_BYTES || 5 * 1024 * 1024,
        ),
        maxTotalSizeBytes: Number(
            process.env.INBOUND_EMAIL_MAX_TOTAL_BYTES || 15 * 1024 * 1024,
        ),
    };
}

export function getInboundMailTransporter() {
    if (cachedTransporter) {
        return cachedTransporter;
    }

    const config = getInboundMailConfig();
    if (!config.user || !config.pass || !config.from) {
        throw new Error(
            "Configuracion de correo inbound incompleta en variables de entorno",
        );
    }

    cachedTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });

    return cachedTransporter;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sectionToHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br />");
}

export function buildInboundEmailHtml({
    header = "",
    body = "",
    footer = "",
}) {
    const sections = [header, body, footer]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .map(
            (item) =>
                `<p style="margin:0 0 16px;line-height:1.6;color:#0f172a;font-family:Segoe UI,Arial,sans-serif;font-size:14px;">${sectionToHtml(
                    item,
                )}</p>`,
        )
        .join("");

    return `
        <div style="background:#eff6ff;padding:24px;">
            <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;">
                <div style="padding:18px 22px;background:linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%);border-bottom:1px solid #dbeafe;">
                    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:18px;font-weight:700;color:#1d4ed8;">Kimobill</div>
                </div>
                <div style="padding:22px;">
                    ${sections}
                </div>
            </div>
        </div>
    `;
}

export async function sendInboundEmail({
    to,
    subject,
    header,
    body,
    footer,
    attachments = [],
}) {
    const config = getInboundMailConfig();
    const transporter = getInboundMailTransporter();
    const text = [header, body, footer]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join("\n\n");

    return transporter.sendMail({
        from: config.from,
        to: String(to || "").trim(),
        subject: String(subject || "").trim(),
        text,
        html: buildInboundEmailHtml({ header, body, footer }),
        attachments,
    });
}

export function getInboundMailFromAddress() {
    return getInboundMailConfig().from;
}

async function createRawInboundMessage({
    from,
    to,
    subject,
    header,
    body,
    footer,
    attachments = [],
    date = new Date(),
    messageId = "",
}) {
    const text = [header, body, footer]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join("\n\n");

    const composer = new MailComposer({
        from,
        to,
        subject,
        text,
        html: buildInboundEmailHtml({ header, body, footer }),
        attachments,
        date,
        messageId: String(messageId || "").trim() || undefined,
    });

    return composer.compile().build();
}

export async function appendInboundEmailToSent({
    to,
    subject,
    header,
    body,
    footer,
    attachments = [],
    date = new Date(),
    messageId = "",
}) {
    const config = getInboundMailConfig();
    const client = new ImapFlow({
        host: config.imapHost,
        port: config.imapPort,
        secure: config.imapSecure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });

    const mailboxCandidates = [
        config.sentMailbox,
        "Sent",
        "Sent Items",
        "INBOX.Sent",
        "INBOX.Enviados",
        "Enviados",
    ]
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    try {
        await client.connect();

        let selectedMailbox = "";
        for (const candidate of mailboxCandidates) {
            try {
                await client.mailboxOpen(candidate);
                selectedMailbox = candidate;
                break;
            } catch {
                // Probar siguiente carpeta conocida
            }
        }

        if (!selectedMailbox) {
            selectedMailbox = config.sentMailbox || "Sent";
            try {
                await client.mailboxCreate(selectedMailbox);
            } catch {
                // Continuar y dejar que mailboxOpen reporte el error real
            }
            await client.mailboxOpen(selectedMailbox);
        }

        const rawMessage = await createRawInboundMessage({
            from: config.from,
            to,
            subject,
            header,
            body,
            footer,
            attachments,
            date,
            messageId,
        });

        await client.append(selectedMailbox, rawMessage, ["\\Seen"]);

        return {
            success: true,
            mailbox: selectedMailbox,
        };
    } finally {
        await client.logout().catch(() => {});
    }
}
