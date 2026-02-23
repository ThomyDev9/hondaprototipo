function normalizarTexto(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quitar tildes
        .replace(/\s+/g, "")
        .toLowerCase();
}

import { encriptar } from "./crypto.js";

export async function generarUsuarioSeguro(Name1, Surname1, connection) {
    const SurnameNorm = normalizarTexto(Surname1);
    const base = Name1.charAt(0).toUpperCase() + SurnameNorm;

    let numero = 1;
    let username = "";

    while (true) {
        username = base + numero;

        const usernameEncrypt = encriptar(username);

        const [rows] = await connection.query(
            "SELECT 1 FROM user WHERE Id = ? LIMIT 1",
            [usernameEncrypt],
        );

        if (rows.length === 0) break;

        numero++;
    }

    return username;
}
