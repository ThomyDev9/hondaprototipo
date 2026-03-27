// Servicio para obtener datos de Out Maquita Cushunchic desde Google Sheets CSV
import Papa from "papaparse";

function getFirstNonEmptyValue(source, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }

    return "";
}

export async function fetchOutMaquitaData() {
    // Reemplaza con tu URL CSV publicada
    const csvUrl = new URL(
        "https://docs.google.com/spreadsheets/d/1KkyVrWxpvjIPD6Rt-Oi68yXMQdnN_Zy5mKTGp16esCs/export",
    );
    csvUrl.searchParams.set("format", "csv");
    csvUrl.searchParams.set("gid", "676353334");
    csvUrl.searchParams.set("_ts", Date.now().toString());

    const res = await fetch(csvUrl.toString(), {
        cache: "no-store",
    });
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true });
    // Filtra solo los registros donde la columna 'Estado' esté vacía o solo espacios
    const disponibles = parsed.data
        .map((row, index) => ({
            ...row,
            __rowNumber: index + 2,
        }))
        .filter((row) => {
            const estado = getFirstNonEmptyValue(row, ["Estado", "Estado ", "J"]);
            return String(estado || "").trim() === "";
        });
    return disponibles;
}
