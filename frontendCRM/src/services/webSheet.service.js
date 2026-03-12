// Servicio para obtener datos de Google Sheets (hoja WEB)
// Llama al backend Express en /api/google-sheets/web?ci=IDENTIFICACION

export async function fetchDatosWebSheet(identificacion) {
    const API_URL = "http://localhost:4004/api/google-sheets/web";
    const resp = await fetch(
        `${API_URL}?ci=${encodeURIComponent(identificacion)}`,
    );
    if (!resp.ok) throw new Error("No se pudo obtener datos de Google Sheets");
    return await resp.json();
}

// Traer todos los registros de la hoja de Google Sheets
export async function fetchDatosWebSheetAll() {
    const API_URL = "http://localhost:4004/api/google-sheets/web/all";
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error("No se pudo obtener datos de Google Sheets");
    return await resp.json();
}

import Papa from "papaparse";

export async function fetchSheetAsJson() {
    const sheetId = "1jjAdbabvR1npg6jEwZ8DC1XanqULsF9QkOvuDMJWk9k";
    const gid = "980306475"; // GID de la pestaña ConsolidadoHonda
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(url);
    const csv = await response.text();

    return new Promise((resolve, reject) => {
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err),
        });
    });
}
