import { desencriptar } from "./crypto.js";

function normalizarTexto(texto) {
    return texto
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "") // quitar tildes
        .replaceAll(/\s+/g, "")
        .toLowerCase();
}

export async function generarUsuarioSeguro(Name1, Surname1, connection) {
    const SurnameNorm = normalizarTexto(Surname1);
    const base = Name1.charAt(0).toUpperCase() + SurnameNorm;

    // Id se guarda cifrado con IV aleatorio, por eso no se puede validar
    // existencia comparando contra un nuevo cifrado del mismo texto.
    const [rows] = await connection.query("SELECT Id FROM user");
    const usernames = new Set();
    for (const row of rows || []) {
        const decrypted = String(desencriptar(row?.Id) || "").trim();
        if (decrypted) {
            usernames.add(decrypted.toLowerCase());
        }
    }

    let numero = 1;
    while (usernames.has(`${base}${numero}`.toLowerCase())) {
        numero++;
    }

    return `${base}${numero}`;
}
