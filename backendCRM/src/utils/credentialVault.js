import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const DEFAULT_KEY_SOURCE = "crm-coop-services-default-key-change-me";

function resolveKeyFromSource(source) {
    const raw = String(source || "");
    return crypto.createHash("sha256").update(raw).digest();
}

function buildKeyCandidates() {
    const primary = String(process.env.CREDENTIALS_CRYPTO_KEY || "").trim();
    const previous = String(process.env.CREDENTIALS_CRYPTO_KEY_PREVIOUS || "")
        .split(",")
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    const jwtFallback = String(process.env.JWT_SECRET || "").trim();
    const defaultFallback = DEFAULT_KEY_SOURCE;

    const orderedSources = [
        primary,
        ...previous,
        jwtFallback,
        defaultFallback,
    ].filter(Boolean);
    const seen = new Set();

    return orderedSources
        .filter((source) => {
            if (seen.has(source)) return false;
            seen.add(source);
            return true;
        })
        .map(resolveKeyFromSource);
}

const KEY_CANDIDATES = buildKeyCandidates();
const PRIMARY_KEY = KEY_CANDIDATES[0];

export function encryptSecret(plainText = "") {
    const value = String(plainText || "");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, PRIMARY_KEY, iv);

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

    let lastError = null;
    for (const key of KEY_CANDIDATES) {
        try {
            const decipher = crypto.createDecipheriv(ALGO, key, iv);
            decipher.setAuthTag(tag);
            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final(),
            ]);
            return decrypted.toString("utf8");
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error("No se pudo descifrar el secreto");
}
