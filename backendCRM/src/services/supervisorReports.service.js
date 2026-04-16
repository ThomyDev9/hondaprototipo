import XLSX from "xlsx";
import pool from "./db.js";

const outboundSchema =
    process.env.MYSQL_DB || process.env.MYSQL_DB_ENCUESTA || "cck_dev_pruebas";

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

const SPECIAL_REPORT_DEFINITIONS = {
    "out kullki wasi": {
        columnOrder: [
            "Cooperativa",
            "TipoCampania",
            "Identificacion",
            "NombreCliente",
            "Celular",
            "Agente",
            "Motivo",
            "Submotivo",
            "Observacion",
            "Fecha_gestion",
        ],
        selectClause: `
            CampaignId AS Cooperativa,
            RESPUESTA_3 AS TipoCampania,
            RESPUESTA_1 AS Identificacion,
            RESPUESTA_2 AS NombreCliente,
            RESPUESTA_4 AS Celular,
            Agent AS Agente,
            RESPUESTA_5 AS Motivo,
            RESPUESTA_6 AS Submotivo,
            RESPUESTA_7 AS Observacion,
            TmStmp AS Fecha_gestion
        `,
    },
    "out honda": {
        columnOrder: [
            "Cooperativa",
            "Identificacion",
            "NombreCliente",
            "Celular",
            "Agente",
            "Motivo",
            "Submotivo",
            "Observacion",
            "Respuesta_8",
            "Respuesta_9",
            "Respuesta_10",
            "Respuesta_11",
            "Respuesta_12",
            "Respuesta_13",
            "Respuesta_14",
            "Fecha_gestion",
        ],
        selectClause: `
            CampaignId AS Cooperativa,
            RESPUESTA_1 AS Identificacion,
            RESPUESTA_2 AS NombreCliente,
            RESPUESTA_4 AS Celular,
            Agent AS Agente,
            RESPUESTA_5 AS Motivo,
            RESPUESTA_6 AS Submotivo,
            RESPUESTA_7 AS Observacion,
            RESPUESTA_8 AS Respuesta_8,
            RESPUESTA_9 AS Respuesta_9,
            RESPUESTA_10 AS Respuesta_10,
            RESPUESTA_11 AS Respuesta_11,
            RESPUESTA_12 AS Respuesta_12,
            RESPUESTA_13 AS Respuesta_13,
            RESPUESTA_14 AS Respuesta_14,
            TmStmp AS Fecha_gestion
        `,
    },
};
const COBRANZA_CACPE_ZAMORA_KEY = "cobranza cacpe zamora";

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
    if (key === "TmStmp" || key === "Fecha_gestion") {
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

function buildExportRows(rows = [], forcedColumnOrder = null) {
    const columnOrder = forcedColumnOrder || buildColumnOrder(rows);

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

function normalizeEcuadorCellphone(rawValue) {
    const digits = String(rawValue || "").replace(/\D/g, "");

    if (digits.length === 9) {
        return `593${digits}`;
    }

    if (digits.length === 10) {
        return `593${digits.slice(1)}`;
    }

    return "";
}

async function getCobranzaCacpeZamoraAdditionalRows(
    { campaignId, startDateTime, endDateTime, importIdLike },
    executor = pool,
) {
    const [rows] = await executor.query(
        `
        SELECT
            CampaignId,
            NOMBRE_CLIENTE,
            ContactAddress,
            CAMPO2,
            CAMPO3,
            CAMPO4,
            CAMPO5,
            TmStmp
        FROM ${outboundSchema}.gestionfinal_outbound
        WHERE TRIM(CampaignId) = TRIM(?)
          AND ResultLevel1 LIKE '%NU1%'
          AND (ContactAddress LIKE '09%' OR ContactAddress LIKE '9%')
          AND TmStmp >= ?
          AND TmStmp < ?
          AND ImportId LIKE ?
        ORDER BY TmStmp DESC, ContactId DESC
        `,
        [campaignId, startDateTime, endDateTime, importIdLike],
    );

    const whatsappRows = rows.map((row) => ({
        CODIGO_CAMPANIA: normalizeCellValue(row.CampaignId),
        CAMPANIA: "COBRANZAS-WHATSAPP",
        NOMBRE_CLIENTE: normalizeCellValue(row.NOMBRE_CLIENTE),
        CELULAR: normalizeEcuadorCellphone(row.ContactAddress),
        MONTO: normalizeCellValue(row.CAMPO4),
        "FECHA VENCIMIENTO": normalizeCellValue(row.CAMPO2),
        DIAS: normalizeCellValue(row.CAMPO3),
        "VALOR A PAGAR": normalizeCellValue(row.CAMPO5),
        "FECHA ENVIO": formatExcelDate(
            row.TmStmp
                ? new Date(
                      new Date(String(row.TmStmp).replace(" ", "T")).getTime() +
                          24 * 60 * 60 * 1000,
                  )
                : "",
        ),
        ESTADO: "ENVIADO",
    }));

    const valorDiaRows = rows.map((row) => ({
        CELULAR: normalizeEcuadorCellphone(row.ContactAddress),
        NOMBRE_CLIENTE: normalizeCellValue(row.NOMBRE_CLIENTE),
        DIAS: normalizeCellValue(row.CAMPO3),
        "VALOR AL DÍA": normalizeCellValue(row.CAMPO5),
    }));

    return { whatsappRows, valorDiaRows };
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

    return rows
        .map((row) => String(row.CampaignId || "").trim())
        .filter(Boolean);
}

export async function getOutboundReportRows(
    { campaignId, startDate, endDate },
    executor = pool,
) {
    const normalizedCampaignId = String(campaignId || "").trim();
    const normalizedCampaignKey = normalizedCampaignId.toLowerCase();
    const specialDefinition = SPECIAL_REPORT_DEFINITIONS[normalizedCampaignKey];
    const campaignLike = `%${normalizedCampaignId}%`;
    const startDateTime = `${String(startDate || "").trim()} 00:00:00`;
    const endExclusive = new Date(`${String(endDate || "").trim()}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endDateTime = `${endExclusive.getFullYear()}-${String(
        endExclusive.getMonth() + 1,
    ).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(
        2,
        "0",
    )} 00:00:00`;

    if (specialDefinition) {
        const [rows] = await executor.query(
            `
            SELECT
                ${specialDefinition.selectClause}
            FROM ${outboundSchema}.gestionfinal_outbound
            WHERE TRIM(CampaignId) = TRIM(?)
              AND TmStmp >= ?
              AND TmStmp < ?
            ORDER BY TmStmp DESC, ContactId DESC
            `,
            [normalizedCampaignId, startDateTime, endDateTime],
        );

        return {
            rows,
            columnOrder: specialDefinition.columnOrder,
        };
    }

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
        WHERE CampaignId LIKE ?
          AND TmStmp >= ?
          AND TmStmp < ?
        ORDER BY TmStmp DESC, ContactId DESC
        `,
        [campaignLike, startDateTime, endDateTime],
    );

    return {
        rows,
        columnOrder: null,
    };
}

export async function buildOutboundReportWorkbook({
    campaignId,
    startDate,
    endDate,
    executor = pool,
}) {
    const reportData = await getOutboundReportRows(
        { campaignId, startDate, endDate },
        executor,
    );
    const rows = reportData.rows || [];
    const normalizedCampaignId = String(campaignId || "").trim();
    const normalizedCampaignKey = normalizedCampaignId.toLowerCase();
    const startDateTime = `${String(startDate || "").trim()} 00:00:00`;
    const endExclusive = new Date(`${String(endDate || "").trim()}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endDateTime = `${endExclusive.getFullYear()}-${String(
        endExclusive.getMonth() + 1,
    ).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(
        2,
        "0",
    )} 00:00:00`;
    const importIdLike = `%${String(endDate || "").trim()}%`;

    if (rows.length === 0) {
        return {
            rowCount: 0,
            buffer: null,
            filename: null,
        };
    }

    const exportRows = buildExportRows(rows, reportData.columnOrder);
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = buildSheetColumns(exportRows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        sanitizeSheetName(campaignId),
    );

    if (normalizedCampaignKey === COBRANZA_CACPE_ZAMORA_KEY) {
        const { whatsappRows, valorDiaRows } =
            await getCobranzaCacpeZamoraAdditionalRows(
                {
                    campaignId: normalizedCampaignId,
                    startDateTime,
                    endDateTime,
                    importIdLike,
                },
                executor,
            );

        const whatsappWorksheet = XLSX.utils.json_to_sheet(whatsappRows);
        whatsappWorksheet["!cols"] = buildSheetColumns(whatsappRows);
        XLSX.utils.book_append_sheet(
            workbook,
            whatsappWorksheet,
            sanitizeSheetName("Cobranza Whatsapp"),
        );

        const valorDiaWorksheet = XLSX.utils.json_to_sheet(valorDiaRows);
        valorDiaWorksheet["!cols"] = buildSheetColumns(valorDiaRows);
        XLSX.utils.book_append_sheet(
            workbook,
            valorDiaWorksheet,
            sanitizeSheetName("Cobranza Valor al Dia"),
        );
    }

    const fileCampaign = sanitizeFileSegment(campaignId) || "campana";
    const fileEndDate = sanitizeFileSegment(endDate) || "sin_fecha";
    const filename = `${fileCampaign}_${fileEndDate}.xlsx`;

    return {
        rowCount: rows.length,
        filename,
        buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    };
}
