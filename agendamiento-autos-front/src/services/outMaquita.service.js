// Servicio para obtener datos de Out Maquita Cushunchic desde Google Sheets CSV
import Papa from "papaparse";

export async function fetchOutMaquitaData() {
    // Reemplaza con tu URL CSV publicada
    const csvUrl =
        "https://docs.google.com/spreadsheets/d/1KkyVrWxpvjIPD6Rt-Oi68yXMQdnN_Zy5mKTGp16esCs/export?format=csv&gid=676353334";
    const res = await fetch(csvUrl);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true });
    // Filtra solo los registros donde la columna 'Estado' esté vacía o solo espacios
    const disponibles = parsed.data.filter(
        (row) => !row["Estado"] || String(row["Estado"]).trim() === "",
    );
    return disponibles;
}
