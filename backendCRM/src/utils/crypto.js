import crypto from "crypto";

/**
 * PHP usa key = ''
 * OpenSSL la convierte en 32 bytes vacíos
 */
const KEY = Buffer.alloc(32); // ⭐ CLAVE REAL PHP

export function encriptar(texto) {
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv);

    let encrypted = cipher.update(texto, "utf8", "base64");
    encrypted += cipher.final("base64");

    return Buffer.from(
        encrypted + "::" + iv.toString("binary"),
        "binary",
    ).toString("base64");
}

export function desencriptar(texto) {
    if (!texto) return "";

    try {
        const decoded = Buffer.from(texto, "base64").toString("binary");

        const parts = decoded.split("::");
        if (parts.length !== 2) return texto;

        const encrypted = parts[0];
        const iv = Buffer.from(parts[1], "binary");

        const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, iv);

        let decrypted = decipher.update(encrypted, "base64", "utf8");

        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (err) {
        //console.log("❌ Error decrypt:", err.message);
        return texto;
    }
}

export function generarPassword() {
    return crypto.randomBytes(4).toString("hex");
}
