import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const DEFAULT_KEY_SOURCE = "crm-coop-services-default-key-change-me";

function resolveKey() {
    const raw = String(
        process.env.CREDENTIALS_CRYPTO_KEY ||
            process.env.JWT_SECRET ||
            DEFAULT_KEY_SOURCE,
    );

    return crypto.createHash("sha256").update(raw).digest();
}

const KEY = resolveKey();

export function encryptSecret(plainText = "") {
    const value = String(plainText || "");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
        encrypted: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
    };
}

export function decryptSecret(payload = {}) {
    const encrypted = Buffer.from(String(payload?.encrypted || ""), "base64");
    const iv = Buffer.from(String(payload?.iv || ""), "base64");
    const tag = Buffer.from(String(payload?.tag || ""), "base64");

    if (!encrypted.length || !iv.length || !tag.length) {
        return "";
    }

    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}
