import Papa from "papaparse";

const SPREADSHEET_ID = "1KkyVrWxpvjIPD6Rt-Oi68yXMQdnN_Zy5mKTGp16esCs";

function getFirstNonEmptyValue(source, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }

    return "";
}

function getColumnLetter(index) {
    let current = index + 1;
    let label = "";

    while (current > 0) {
        const remainder = (current - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        current = Math.floor((current - 1) / 26);
    }

    return label;
}

function buildRowsFromCsv(csvText) {
    const parsed = Papa.parse(csvText, { header: false });
    const rows = Array.isArray(parsed?.data) ? parsed.data : [];
    if (rows.length === 0) return [];

    const headers = Array.isArray(rows[0]) ? rows[0] : [];

    return rows.slice(1).map((row, index) => {
        const sourceRow = Array.isArray(row) ? row : [];
        const record = {
            __rowNumber: index + 2,
        };

        sourceRow.forEach((value, colIndex) => {
            const letter = getColumnLetter(colIndex);
            const header = String(headers[colIndex] || "").trim();

            record[letter] = value;

            if (header && !(header in record)) {
                record[header] = value;
            }
        });

        return record;
    });
}

function shouldIncludeRow(
    row,
    { statusKeys = [], matchMode = "empty", matchValues = [] } = {},
) {
    if (!statusKeys.length) return true;

    const estado = String(getFirstNonEmptyValue(row, statusKeys) || "").trim();

    if (matchMode === "in") {
        const normalizedValues = matchValues.map((value) =>
            String(value || "").trim().toLowerCase(),
        );
        return normalizedValues.includes(estado.toLowerCase());
    }

    return estado === "";
}

export async function fetchOutMaquitaFlowData({
    gid,
    statusKeys = [],
    matchMode = "empty",
    matchValues = [],
} = {}) {
    const csvUrl = new URL(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
    );
    csvUrl.searchParams.set("format", "csv");
    csvUrl.searchParams.set("gid", String(gid || ""));
    csvUrl.searchParams.set("_ts", Date.now().toString());

    const res = await fetch(csvUrl.toString(), {
        cache: "no-store",
    });
    const csv = await res.text();
    const rows = buildRowsFromCsv(csv);

    return rows.filter((row) =>
        shouldIncludeRow(row, {
            statusKeys,
            matchMode,
            matchValues,
        }),
    );
}

export default {
    fetchOutMaquitaFlowData,
};
