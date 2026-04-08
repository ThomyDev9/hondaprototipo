import XLSX from "xlsx";
import pool from "./db.js";

const outboundSchema =
    process.env.MYSQL_DB ||
    process.env.MYSQL_DB_ENCUESTA ||
    "cck_dev_pruebas";

const BASE_COLUMNS = [
    "CampaignId",
    "ImportId",
    "IDENTIFICACION",
    "NOMBRE_CLIENTE",
];

const TRAILING_COLUMNS = [
    "ContactAddress",
    "Agent",
    "Intentos",
    "Observaciones",
    "TmStmp",
    "ResultLevel1",
    "ResultLevel2",
];

function normalizeCellValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

function formatExcelDate(value) {
    if (!value) {
        return "";
    }

    const date =
        value instanceof Date
            ? value
            : new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
        return normalizeCellValue(value);
    }

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function normalizeExportValue(key, value) {
    if (key === "TmStmp") {
        return formatExcelDate(value);
    }

    if (key === "ResultLevel1") {
        return normalizeCellValue(value).slice(0, 4);
    }

    return normalizeCellValue(value);
}

function sanitizeSheetName(value = "") {
    const sanitized = String(value || "")
        .replace(/[\\/?*\[\]:]/g, " ")
        .trim();

    return (sanitized || "Reporte").slice(0, 31);
}

function sanitizeFileSegment(value = "") {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function hasAnyValue(rows = [], key = "") {
    return rows.some((row) => normalizeCellValue(row?.[key]));
}

function buildCampoColumns(rows = []) {
    const columns = [];

    for (let index = 1; index <= 10; index++) {
        const key = `CAMPO${index}`;
        if (hasAnyValue(rows, key)) {
            columns.push(key);
        }
    }

    return columns;
}

function buildRespuestaColumns(rows = []) {
    const columns = [];

    for (let index = 1; index <= 30; index++) {
        const key = `RESPUESTA_${index}`;
        if (hasAnyValue(rows, key)) {
            columns.push(key);
        }
    }

    return columns;
}

function buildColumnOrder(rows = []) {
    return [
        ...BASE_COLUMNS,
        ...buildCampoColumns(rows),
        ...TRAILING_COLUMNS,
        ...buildRespuestaColumns(rows),
    ];
}

function buildExportRows(rows = []) {
    const columnOrder = buildColumnOrder(rows);

    return rows.map((row) => {
        const exportRow = {};

        for (const key of columnOrder) {
            exportRow[key] = normalizeExportValue(key, row[key]);
        }

        return exportRow;
    });
}

function buildSheetColumns(rows = []) {
    if (!rows.length) {
        return [];
    }

    const headers = Object.keys(rows[0]);

    return headers.map((header) => {
        const widestCell = rows.reduce((max, row) => {
            const length = String(row?.[header] ?? "").length;
            return Math.max(max, length);
        }, header.length);

        return { wch: Math.min(Math.max(widestCell + 2, 12), 40) };
    });
}

export async function listOutboundReportCampaigns(executor = pool) {
    const [rows] = await executor.query(
        `
        SELECT DISTINCT CampaignId
        FROM ${outboundSchema}.gestionfinal_outbound
        WHERE COALESCE(TRIM(CampaignId), '') <> ''
        ORDER BY CampaignId ASC
        `,
    );

    return rows.map((row) => String(row.CampaignId || "").trim()).filter(Boolean);
}

export async function getOutboundReportRows(
    { campaignId, startDate, endDate },
    executor = pool,
) {
    const [rows] = await executor.query(
        `
        SELECT
            CampaignId,
            ImportId,
            IDENTIFICACION,
            NOMBRE_CLIENTE,
            CAMPO1,
            CAMPO2,
            CAMPO3,
            CAMPO4,
            CAMPO5,
            CAMPO6,
            CAMPO7,
            CAMPO8,
            CAMPO9,
            CAMPO10,
            ContactAddress,
            Agent,
            Intentos,
            Observaciones,
            TmStmp,
            ResultLevel1,
            ResultLevel2,
            RESPUESTA_1, RESPUESTA_2, RESPUESTA_3, RESPUESTA_4, RESPUESTA_5,
            RESPUESTA_6, RESPUESTA_7, RESPUESTA_8, RESPUESTA_9, RESPUESTA_10,
            RESPUESTA_11, RESPUESTA_12, RESPUESTA_13, RESPUESTA_14, RESPUESTA_15,
            RESPUESTA_16, RESPUESTA_17, RESPUESTA_18, RESPUESTA_19, RESPUESTA_20,
            RESPUESTA_21, RESPUESTA_22, RESPUESTA_23, RESPUESTA_24, RESPUESTA_25,
            RESPUESTA_26, RESPUESTA_27, RESPUESTA_28, RESPUESTA_29, RESPUESTA_30
        FROM ${outboundSchema}.gestionfinal_outbound
        WHERE CampaignId = ?
          AND TmStmp > ?
          AND TmStmp < ?
        ORDER BY TmStmp DESC, ContactId DESC
        `,
        [campaignId, startDate, endDate],
    );

    return rows;
}

export async function buildOutboundReportWorkbook({
    campaignId,
    startDate,
    endDate,
    executor = pool,
}) {
    const rows = await getOutboundReportRows(
        { campaignId, startDate, endDate },
        executor,
    );

    if (rows.length === 0) {
        return {
            rowCount: 0,
            buffer: null,
            filename: null,
        };
    }

    const exportRows = buildExportRows(rows);
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = buildSheetColumns(exportRows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        sanitizeSheetName(campaignId),
    );

    const fileCampaign = sanitizeFileSegment(campaignId) || "campana";
    const fileEndDate = sanitizeFileSegment(endDate) || "sin_fecha";
    const filename = `${fileCampaign}_${fileEndDate}.xlsx`;

    return {
        rowCount: rows.length,
        filename,
        buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    };
}
