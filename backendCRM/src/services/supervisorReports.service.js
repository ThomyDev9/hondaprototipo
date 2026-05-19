import XLSX from "xlsx";
import pool from "./db.js";
import { callCenterPool } from "./db.multi.js";
import fs from "fs";
import path from "path";
import XlsxPopulate from "xlsx-populate";

const outboundSchema =
    process.env.MYSQL_DB || process.env.MYSQL_DB_ENCUESTA || "cck_dev_pruebas";
const REDES_PARENT_MENU_ITEM_ID = "b3d8324e-2c69-11f1-b790-000c2904c92f";

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
            COALESCE(NULLIF(TRIM(CAMPO1), ''), RESPUESTA_3) AS TipoCampania,
            COALESCE(NULLIF(TRIM(IDENTIFICACION), ''), RESPUESTA_1) AS Identificacion,
            COALESCE(NULLIF(TRIM(NOMBRE_CLIENTE), ''), RESPUESTA_2) AS NombreCliente,
            COALESCE(NULLIF(TRIM(ContactAddress), ''), RESPUESTA_4) AS Celular,
            Agent AS Agente,
            COALESCE(NULLIF(TRIM(ResultLevel1), ''), RESPUESTA_5) AS Motivo,
            COALESCE(NULLIF(TRIM(ResultLevel2), ''), RESPUESTA_6) AS Submotivo,
            COALESCE(NULLIF(TRIM(Observaciones), ''), RESPUESTA_7) AS Observacion,
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
const REDES_COLUMN_ORDER = [
    "Campana",
    "Agente",
    "Identificacion",
    "Nombres",
    "Celular",
    "TipoRedSocial",
    "EstadoConversacion",
    "CantidadMensajes",
    "Categorizacion",
    "Motivo",
    "Submotivo",
    "Observaciones",
    "Fecha_gestion",
];
const INBOUND_MONTHLY_FINAL_COLUMN_ORDER = [
    "USUARIO/AGENTE",
    "FECHA DE LLAMADA",
    "HORA DE LLAMADA",
    "HORA DE FIN",
    "TMO",
    "ESTADO DE LA LLAMADA",
    "NUMERO DE CEDULA",
    "APELLIDOS Y NOMBRES",
    "CIUDAD",
    "TELEFONO DE CONTACTO",
    "CELULAR DE CONTACTO",
    "CORREO",
    "ESTADO DEL CLIENTE",
    "MOTIVO DE LLAMADA",
    "SUBMOTIVO",
    "OBSERVACIONES",
    "CANALES DE COMUNICACION",
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

export async function listRedesReportCampaigns(executor = pool) {
    const [rows] = await executor.query(
        `
        SELECT campaign_id
        FROM (
            SELECT DISTINCT TRIM(mi.nombre_item) AS campaign_id
            FROM menu_items mi
            WHERE mi.id_padre = ?
              AND mi.estado = 'activo'
              AND COALESCE(TRIM(mi.nombre_item), '') <> ''

            UNION

            SELECT DISTINCT TRIM(gr.campaign_id) AS campaign_id
            FROM ${outboundSchema}.gestion_redes gr
            WHERE COALESCE(TRIM(gr.campaign_id), '') <> ''
        ) campaigns
        ORDER BY campaign_id ASC
        `,
        [REDES_PARENT_MENU_ITEM_ID],
    );

    return rows
        .map((row) => String(row.campaign_id || "").trim())
        .filter(Boolean);
}

export async function listInboundMonthlyFinalReportCampaigns(executor = pool) {
    const [rows] = await executor.query(
        `
        SELECT DISTINCT TRIM(campaign_id) AS campaign_id
        FROM gestionfinal_inbound
        WHERE COALESCE(TRIM(campaign_id), '') <> ''
        ORDER BY campaign_id ASC
        `,
    );

    return rows
        .map((row) => String(row.campaign_id || "").trim())
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

export async function getRedesReportRows(
    { campaignId, startDate, endDate },
    executor = pool,
) {
    const normalizedCampaignId = String(campaignId || "").trim();
    const startDateTime = `${String(startDate || "").trim()} 00:00:00`;
    const endExclusive = new Date(`${String(endDate || "").trim()}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endDateTime = `${endExclusive.getFullYear()}-${String(
        endExclusive.getMonth() + 1,
    ).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(
        2,
        "0",
    )} 00:00:00`;

    const [rows] = await executor.query(
        `
        SELECT
            campaign_id AS Campana,
            agent AS Agente,
            identification AS Identificacion,
            full_name AS Nombres,
            celular AS Celular,
            tipo_red_social AS TipoRedSocial,
            estado_conversacion AS EstadoConversacion,
            cantidad_mensajes AS CantidadMensajes,
            categorizacion AS Categorizacion,
            level1 AS Motivo,
            level2 AS Submotivo,
            observaciones AS Observaciones,
            tmstmp AS Fecha_gestion
        FROM ${outboundSchema}.gestion_redes
        WHERE TRIM(campaign_id) = TRIM(?)
          AND tmstmp >= ?
          AND tmstmp < ?
        ORDER BY tmstmp DESC, id DESC
        `,
        [normalizedCampaignId, startDateTime, endDateTime],
    );

    return {
        rows,
        columnOrder: REDES_COLUMN_ORDER,
    };
}

export async function buildRedesReportWorkbook({
    campaignId,
    startDate,
    endDate,
    executor = pool,
}) {
    const reportData = await getRedesReportRows(
        { campaignId, startDate, endDate },
        executor,
    );
    const rows = reportData.rows || [];

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
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName("Redes"));

    const fileCampaign = sanitizeFileSegment(campaignId) || "redes";
    const fileEndDate = sanitizeFileSegment(endDate) || "sin_fecha";
    const filename = `redes_${fileCampaign}_${fileEndDate}.xlsx`;

    return {
        rowCount: rows.length,
        filename,
        buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    };
}

export async function getInboundMonthlyFinalReportRows(
    { campaignId, startDate, endDate },
    executor = pool,
) {
    const normalizedCampaignId = String(campaignId || "").trim();
    const startDateTime = `${String(startDate || "").trim()} 00:00:00`;
    const endExclusive = new Date(`${String(endDate || "").trim()}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endDateTime = `${endExclusive.getFullYear()}-${String(
        endExclusive.getMonth() + 1,
    ).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(
        2,
        "0",
    )} 00:00:00`;

    const [rows] = await executor.query(
        `
        SELECT
            agent AS \`USUARIO/AGENTE\`,
            DATE(tmstmp) AS \`FECHA DE LLAMADA\`,
            DATE_FORMAT(started_management, '%Y-%m-%d %H:%i:%s') AS \`HORA DE LLAMADA\`,
            DATE_FORMAT(tmstmp, '%Y-%m-%d %H:%i:%s') AS \`HORA DE FIN\`,
            DATE_FORMAT(
                SEC_TO_TIME(
                    GREATEST(TIMESTAMPDIFF(SECOND, started_management, tmstmp), 0)
                ),
                '%H:%i:%s'
            ) AS TMO,
            CASE
                WHEN LOWER(COALESCE(categorizacion, '')) LIKE '%recuper%' THEN 'Recuperada'
                WHEN COALESCE(tmstmp, '') <> '' THEN 'Atendida'
                ELSE 'Sin estado'
            END AS \`ESTADO DE LA LLAMADA\`,
            identification AS \`NUMERO DE CEDULA\`,
            full_name AS \`APELLIDOS Y NOMBRES\`,
            city AS CIUDAD,
            convencional AS \`TELEFONO DE CONTACTO\`,
            celular AS \`CELULAR DE CONTACTO\`,
            email AS CORREO,
            tipo_cliente AS \`ESTADO DEL CLIENTE\`,
            result_level1 AS \`MOTIVO DE LLAMADA\`,
            result_level2 AS SUBMOTIVO,
            observaciones AS OBSERVACIONES,
            'Inbound' AS \`CANALES DE COMUNICACION\`
        FROM gestionfinal_inbound
        WHERE TRIM(campaign_id) = TRIM(?)
          AND tmstmp >= ?
          AND tmstmp < ?
        ORDER BY tmstmp DESC, id DESC
        `,
        [normalizedCampaignId, startDateTime, endDateTime],
    );

    return {
        rows,
        columnOrder: INBOUND_MONTHLY_FINAL_COLUMN_ORDER,
    };
}

function parseIsoLikeDate(value) {
    if (!value) return null;
    const parsed = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKeyFromValue(value) {
    const date = parseIsoLikeDate(value);
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildDateRange(startDate = "", endDate = "") {
    const list = [];
    const current = new Date(`${String(startDate || "").trim()}T00:00:00`);
    const end = new Date(`${String(endDate || "").trim()}T00:00:00`);

    if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
        return list;
    }

    while (current <= end) {
        const dateKey = `${current.getFullYear()}-${String(
            current.getMonth() + 1,
        ).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
        list.push(dateKey);
        current.setDate(current.getDate() + 1);
    }

    return list;
}

function formatDateForInformativeBlock(value = "") {
    const text = String(value || "").trim();
    if (!text) return "";
    const parts = text.split("-");
    if (parts.length !== 3) return text;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function buildInboundWorkbookAoa({
    campaignId,
    startDate,
    endDate,
    trxRows = [],
    gerencialRows = [],
}) {
    const normalizedCampaignId = normalizeCellValue(campaignId);
    const dateRange = buildDateRange(startDate, endDate);
    const totalLlamadas = trxRows.length;
    const totalRecuperadas = trxRows.filter(
        (row) =>
            normalizeCellValue(row["ESTADO DE LA LLAMADA"]).toLowerCase() ===
            "recuperada",
    ).length;
    const totalAbandonadas = trxRows.filter((row) =>
        normalizeCellValue(row["ESTADO DE LA LLAMADA"])
            .toLowerCase()
            .includes("abandon"),
    ).length;
    const totalContestadas = Math.max(totalLlamadas - totalAbandonadas, 0);
    const totalFantasma = trxRows.filter((row) =>
        normalizeCellValue(row["MOTIVO DE LLAMADA"])
            .toLowerCase()
            .includes("fantasma"),
    ).length;
    const totalSeguimiento = trxRows.filter((row) =>
        normalizeCellValue(row["SUBMOTIVO"]).toLowerCase().includes("seguim"),
    ).length;

    const byDate = new Map();
    for (const row of trxRows) {
        const dateKey = formatDateKeyFromValue(row["FECHA DE LLAMADA"]);
        if (!dateKey) continue;

        if (!byDate.has(dateKey)) {
            byDate.set(dateKey, { entrantes: 0, abandonadas: 0 });
        }

        const bucket = byDate.get(dateKey);
        bucket.entrantes += 1;

        const estado = normalizeCellValue(
            row["ESTADO DE LA LLAMADA"],
        ).toLowerCase();
        if (estado.includes("abandon")) bucket.abandonadas += 1;
    }

    const byMotivo = new Map();
    const bySubmotivo = new Map();
    const byCanal = new Map();

    for (const row of trxRows) {
        const motivo = normalizeCellValue(row["MOTIVO DE LLAMADA"]) || "SIN MOTIVO";
        const submotivo = normalizeCellValue(row.SUBMOTIVO) || "SIN SUBMOTIVO";
        const canal =
            normalizeCellValue(row["CANALES DE COMUNICACION"]) || "SIN CANAL";

        byMotivo.set(motivo, (byMotivo.get(motivo) || 0) + 1);
        bySubmotivo.set(submotivo, (bySubmotivo.get(submotivo) || 0) + 1);
        byCanal.set(canal, (byCanal.get(canal) || 0) + 1);
    }

    const formatPercent = (num, den) =>
        den > 0 ? `${Math.round((num / den) * 100)}%` : "0%";
    const parsePercentValue = (value) => {
        const numeric = Number(
            String(value || "")
                .replace("%", "")
                .replace(",", ".")
                .trim(),
        );
        return Number.isFinite(numeric) ? numeric : 0;
    };

    const portadaAoa = [
        ["", "", "", "INFORME GESTION INBOUND"],
        [],
        [],
        ["", "", "", "TIPO DE INFORME:", "", "", "", "FACTURACION"],
        ["", "", "", "ENTIDAD", "", "", "", normalizedCampaignId],
        ["", "", "", "DESDE:", "", "", "", startDate],
        ["", "", "", "HASTA:", "", "", "", endDate],
    ];

    const gerencialAoa = [
        ["", "", "", "INFORME GESTION INBOUND"],
        [],
        ["", "", "", "TIPO DE INFORME:", "", "", "MENSUAL"],
        ["", "", "", "INSTITUCION:", "", "", normalizedCampaignId],
        ["", "", "", "DESDE:", "", "", startDate],
        ["", "", "", "HASTA:", "", "", endDate],
        [],
        [
            "",
            "",
            "Fecha",
            "Llamadas entrantes",
            "Llamadas Contestadas",
            "Llamadas fantasma",
            "Llamadas Recuperadas",
            "Llamadas de Seguimiento",
            "Llamadas Abandonadas",
            "Nivel de servicio (SVL)",
            "Nivel de Abandono",
        ],
    ];

    const dailyGerencialRows = gerencialRows.filter(
        (row) =>
            normalizeCellValue(row.Fecha_de_Gestion).toLowerCase() !==
            "total del reporte",
    );
    const totalGerencialRow = gerencialRows.find(
        (row) =>
            normalizeCellValue(row.Fecha_de_Gestion).toLowerCase() ===
            "total del reporte",
    );

    for (const row of dailyGerencialRows) {
        gerencialAoa.push([
            "",
            "",
            normalizeCellValue(row.Fecha_de_Gestion),
            Number(row.Llamadas_entrantes || 0),
            Number(row.Contestadas || 0),
            0,
            0,
            0,
            Number(row.Abandonadas || 0),
            normalizeCellValue(row.Nivel_Servicio),
            normalizeCellValue(row.Nivel_Abandono),
        ]);
    }

    gerencialAoa.push([
        "",
        "",
        "Total del reporte:",
        Number(totalGerencialRow?.Llamadas_entrantes || 0),
        Number(totalGerencialRow?.Contestadas || 0),
        0,
        0,
        0,
        Number(totalGerencialRow?.Abandonadas || 0),
        normalizeCellValue(totalGerencialRow?.Nivel_Servicio),
        normalizeCellValue(totalGerencialRow?.Nivel_Abandono),
    ]);

    const totalContestadasGerencial = Number(totalGerencialRow?.Contestadas || 0);
    const totalAbandonadasGerencial = Number(totalGerencialRow?.Abandonadas || 0);
    const totalEntrantesGerencial = Number(
        totalGerencialRow?.Llamadas_entrantes || 0,
    );
    const maxNivelServicio = dailyGerencialRows.reduce((max, row) => {
        return Math.max(max, parsePercentValue(row?.Nivel_Servicio));
    }, 0);
    const maxNivelAbandono = dailyGerencialRows.reduce((max, row) => {
        return Math.max(max, parsePercentValue(row?.Nivel_Abandono));
    }, 0);

    gerencialAoa.push([]);
    gerencialAoa.push(["", "", "RESUMEN LLAMADAS", "VALOR"]);
    gerencialAoa.push(["", "", "Llamadas Contestadas", totalContestadasGerencial]);
    gerencialAoa.push(["", "", "Llamadas Abandonadas", totalAbandonadasGerencial]);
    gerencialAoa.push(["", "", "Llamadas Totales", totalEntrantesGerencial]);

    gerencialAoa.push([]);
    gerencialAoa.push(["", "", "DATOS GRAFICO PASTEL", "VALOR"]);
    gerencialAoa.push(["", "", "Contestadas", totalContestadasGerencial]);
    gerencialAoa.push(["", "", "Abandonadas", totalAbandonadasGerencial]);
    gerencialAoa.push(["", "", "Max Nivel Servicio", `${maxNivelServicio}%`]);
    gerencialAoa.push(["", "", "Max Nivel Abandono", `${maxNivelAbandono}%`]);

    const trxAoa = [
        ["REGISTRO DE LLAMADAS DEL MES"],
        [],
        INBOUND_MONTHLY_FINAL_COLUMN_ORDER,
    ];
    for (const row of trxRows) {
        trxAoa.push(
            INBOUND_MONTHLY_FINAL_COLUMN_ORDER.map((key) =>
                normalizeExportValue(key, row[key]),
            ),
        );
    }

    const resumenGestionAoa = [
        ["", "", "RESUMEN DE GESTION MES"],
        [],
        ["", "", "MOTIVO DE LA LLAMADA", "TOTAL", "%"],
    ];
    const motivoRows = [...byMotivo.entries()].sort((a, b) => b[1] - a[1]);
    for (const [motivo, count] of motivoRows) {
        resumenGestionAoa.push([
            "",
            "",
            motivo,
            count,
            totalLlamadas > 0 ? count / totalLlamadas : 0,
        ]);
    }
    resumenGestionAoa.push(["", "", "Total general", totalLlamadas, 1]);
    resumenGestionAoa.push([]);
    resumenGestionAoa.push([
        "",
        "",
        "CANAL DE COMUNICACION",
        "TOTAL",
        "%",
    ]);
    const canalRows = [...byCanal.entries()].sort((a, b) => b[1] - a[1]);
    for (const [canal, count] of canalRows) {
        resumenGestionAoa.push([
            "",
            "",
            canal,
            count,
            totalLlamadas > 0 ? count / totalLlamadas : 0,
        ]);
    }
    resumenGestionAoa.push(["", "", "Total general", totalLlamadas, 1]);

    const resumenGlobalAoa = [
        ["", "", "RESUMEN DE LLAMADAS DEL MES"],
        [],
        ["", "", "MOTIVO LLAMADA (TRX)", "TOTAL", "%"],
    ];
    for (const [motivo, count] of motivoRows) {
        resumenGlobalAoa.push([
            "",
            "",
            motivo,
            count,
            totalLlamadas > 0 ? count / totalLlamadas : 0,
        ]);
    }
    resumenGlobalAoa.push(["", "", "Total general", totalLlamadas, 1]);
    resumenGlobalAoa.push([]);
    resumenGlobalAoa.push(["", "", "SUB MOTIVO LLAMADA (TRX)", "TOTAL", "%"]);
    const submotivoRows = [...bySubmotivo.entries()].sort((a, b) => b[1] - a[1]);
    for (const [submotivo, count] of submotivoRows) {
        resumenGlobalAoa.push([
            "",
            "",
            submotivo,
            count,
            totalLlamadas > 0 ? count / totalLlamadas : 0,
        ]);
    }
    resumenGlobalAoa.push(["", "", "Total general", totalLlamadas, 1]);

    const llamadasDiariasAoa = [
        ["", "", "COMPARATIVO LLAMADAS CONTESTADAS Y ABANDONADAS"],
        [],
        [
            "Etiquetas de fila",
            "Numero de Llamadas entrantes",
            "Numero de Llamadas Abandonadas",
        ],
    ];
    for (const dateKey of dateRange) {
        const bucket = byDate.get(dateKey) || { entrantes: 0, abandonadas: 0 };
        llamadasDiariasAoa.push([dateKey, bucket.entrantes, bucket.abandonadas]);
    }
    llamadasDiariasAoa.push([
        "Total general",
        totalLlamadas,
        totalAbandonadas,
    ]);

    const gestionIvrAoa = [["IVR"], [], ["Sin informacion en fuente actual"]];

    return {
        portadaAoa,
        gerencialAoa,
        trxAoa,
        resumenGestionAoa,
        resumenGlobalAoa,
        llamadasDiariasAoa,
        gestionIvrAoa,
        totalLlamadas,
    };
}

async function getInboundQueueByCampaign(campaignId = "", executor = pool) {
    const normalizedCampaignId = String(campaignId || "").trim();
    if (!normalizedCampaignId) {
        return "";
    }

    const [rows] = await executor.query(
        `
        SELECT TRIM(inbound_queue) AS inbound_queue
        FROM menu_items
        WHERE COALESCE(TRIM(inbound_queue), '') <> ''
          AND TRIM(nombre_item) = TRIM(?)
        LIMIT 1
        `,
        [normalizedCampaignId],
    );

    return String(rows?.[0]?.inbound_queue || "").trim();
}

async function getInboundGerencialRowsByQueue({
    queue,
    startDate,
    endDate,
    executor = callCenterPool,
}) {
    const normalizedQueue = String(queue || "").trim();
    const startDateTime = `${String(startDate || "").trim()} 00:00:00`;
    const endDateTime = `${String(endDate || "").trim()} 23:59:59`;

    if (!normalizedQueue) {
        return [];
    }

    const [rows] = await executor.query(
        `
        SELECT
          CAST(t.fecha_gestion AS CHAR) AS Fecha_de_Gestion,
          t.Llamadas_entrantes,
          t.Contestadas,
          t.Abandonadas,
          CONCAT(
            ROUND(
              CASE
                WHEN t.Llamadas_entrantes = 0 THEN 0
                ELSE t.Contestadas * 100.0 / t.Llamadas_entrantes
              END,
              2
            ),
            '%'
          ) AS Nivel_Servicio,
          CONCAT(
            ROUND(
              CASE
                WHEN t.Llamadas_entrantes = 0 THEN 0
                ELSE t.Abandonadas * 100.0 / t.Llamadas_entrantes
              END,
              2
            ),
            '%'
          ) AS Nivel_Abandono
        FROM (
          SELECT
            DATE(c.datetime_entry_queue) AS fecha_gestion,
            COUNT(*) AS Llamadas_entrantes,
            SUM(CASE WHEN c.status = 'terminada' THEN 1 ELSE 0 END) AS Contestadas,
            SUM(CASE WHEN c.status = 'abandonada' THEN 1 ELSE 0 END) AS Abandonadas
          FROM call_entry c
          JOIN queue_call_entry q ON c.id_queue_call_entry = q.id
          WHERE c.status <> 'fin-monitoreo'
            AND q.queue NOT IN ('130000')
            AND c.datetime_entry_queue BETWEEN ? AND ?
            AND q.queue = ?
          GROUP BY DATE(c.datetime_entry_queue)
        ) t

        UNION ALL

        SELECT
          'Total del reporte' AS Fecha_de_Gestion,
          COUNT(*) AS Llamadas_entrantes,
          SUM(CASE WHEN c.status = 'terminada' THEN 1 ELSE 0 END) AS Contestadas,
          SUM(CASE WHEN c.status = 'abandonada' THEN 1 ELSE 0 END) AS Abandonadas,
          CONCAT(
            ROUND(
              CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE SUM(CASE WHEN c.status='terminada' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
              END,
              2
            ),
            '%'
          ) AS Nivel_Servicio,
          CONCAT(
            ROUND(
              CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE SUM(CASE WHEN c.status='abandonada' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
              END,
              2
            ),
            '%'
          ) AS Nivel_Abandono
        FROM call_entry c
        JOIN queue_call_entry q ON c.id_queue_call_entry = q.id
        WHERE c.status <> 'fin-monitoreo'
          AND q.queue NOT IN ('130000')
          AND c.datetime_entry_queue BETWEEN ? AND ?
          AND q.queue = ?
        `,
        [
            startDateTime,
            endDateTime,
            normalizedQueue,
            startDateTime,
            endDateTime,
            normalizedQueue,
        ],
    );

    return rows || [];
}

export async function buildInboundMonthlyFinalReportWorkbook({
    campaignId,
    startDate,
    endDate,
    executor = pool,
}) {
    const reportData = await getInboundMonthlyFinalReportRows(
        { campaignId, startDate, endDate },
        executor,
    );
    const rows = reportData.rows || [];
    const inboundQueue = await getInboundQueueByCampaign(campaignId, executor);
    const gerencialRows = await getInboundGerencialRowsByQueue({
        queue: inboundQueue,
        startDate,
        endDate,
        executor: callCenterPool,
    });

    if (rows.length === 0) {
        return {
            rowCount: 0,
            buffer: null,
            filename: null,
        };
    }

    const workbookAoa = buildInboundWorkbookAoa({
        campaignId,
        startDate,
        endDate,
        trxRows: buildExportRows(rows, reportData.columnOrder),
        gerencialRows,
    });

    const templatePath =
        String(process.env.INBOUND_MONTHLY_REPORT_TEMPLATE_PATH || "").trim() ||
        path.join(process.cwd(), "templates", "inbound_monthly_template.xlsx");

    if (fs.existsSync(templatePath)) {
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const portada = wb.sheet("PORTADA");
        const gerencial = wb.sheet("REPORTE GERENCIAL");
        const trx = wb.sheet("TRX");
        const resumenGestion = wb.sheet("RESUMEN DE GESTION");
        const resumenGlobal = wb.sheet("RESUMEN GLOBAL");
        const llamadasDiarias = wb.sheet("LLAMADAS DIARIAS");
        const gestionIvr = wb.sheet("GESTION IVR");

        const writeAoa = (sheet, startRow, startCol, aoa = []) => {
            if (!sheet || !Array.isArray(aoa)) return;
            aoa.forEach((row, rIdx) => {
                (Array.isArray(row) ? row : []).forEach((cell, cIdx) => {
                    sheet.cell(startRow + rIdx, startCol + cIdx).value(cell);
                });
            });
        };
        const clearRange = (sheet, startRow, endRow, startCol, endCol) => {
            if (!sheet) return;
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    sheet.cell(r, c).value(null);
                }
            }
        };

        // PORTADA
        if (portada) {
            const campaignLabel = normalizeCellValue(campaignId);
            // Respetar layout original de plantilla (bloque inicia en fila 10)
            portada.cell("D10").value("TIPO DE INFORME: ");
            portada.cell("H10").value("FACTURACIÓN");
            portada.cell("D11").value("ENTIDAD");
            portada.cell("H11").value(campaignLabel);
            portada.cell("D12").value("DESDE:");
            portada
                .cell("H12")
                .value(formatDateForInformativeBlock(String(startDate || "").trim()));
            portada.cell("H12").style("numberFormat", "@");
            portada.cell("D13").value("HASTA:");
            portada
                .cell("H13")
                .value(formatDateForInformativeBlock(String(endDate || "").trim()));
            portada.cell("H13").style("numberFormat", "@");
            // Limpiar bloque "contenido del informe" para evitar texto residual
            portada.cell("E16").value("");
            portada.cell("E17").value("");
            portada.cell("E18").value("");
            portada
                .cell("E16")
                .value(`INFORME DE LLAMADAS INBOUND ${campaignLabel}`);
            portada
                .cell("E17")
                .value(`RESUMEN DE GESTIÓN INBOUND ${campaignLabel}`);
        }

        // REPORTE GERENCIAL
        if (gerencial) {
            gerencial.cell("G5").value("MENSUAL");
            gerencial.cell("G6").value(normalizeCellValue(campaignId));
            gerencial
                .cell("G7")
                .value(formatDateForInformativeBlock(String(startDate || "").trim()));
            gerencial.cell("G7").style("numberFormat", "@");
            gerencial
                .cell("G8")
                .value(formatDateForInformativeBlock(String(endDate || "").trim()));
            gerencial.cell("G8").style("numberFormat", "@");
            clearRange(gerencial, 12, 400, 3, 12);

            const dailyRowsForTable = gerencialRows.filter(
                (row) =>
                    normalizeCellValue(row?.Fecha_de_Gestion).toLowerCase() !==
                    "total del reporte",
            );
            const totalRowForTable = gerencialRows.find(
                (row) =>
                    normalizeCellValue(row?.Fecha_de_Gestion).toLowerCase() ===
                    "total del reporte",
            );
            const gerencialHeader = [
                "Fecha",
                "Llamadas entrantes",
                "Llamadas Contestadas",
                "Llamadas fantasma",
                "Llamadas Recuperadas",
                "Llamadas de Seguimiento",
                "Llamadas Abandonadas",
                "Nivel de servicio (SVL)",
                "Nivel de Abandono",
            ];
            const gerencialBody = dailyRowsForTable.map((row) => [
                normalizeCellValue(row?.Fecha_de_Gestion),
                Number(row?.Llamadas_entrantes || 0),
                Number(row?.Contestadas || 0),
                0,
                0,
                0,
                Number(row?.Abandonadas || 0),
                normalizeCellValue(row?.Nivel_Servicio),
                normalizeCellValue(row?.Nivel_Abandono),
            ]);
            const gerencialTotal = [
                "Total del reporte",
                Number(totalRowForTable?.Llamadas_entrantes || 0),
                Number(totalRowForTable?.Contestadas || 0),
                0,
                0,
                0,
                Number(totalRowForTable?.Abandonadas || 0),
                normalizeCellValue(totalRowForTable?.Nivel_Servicio),
                normalizeCellValue(totalRowForTable?.Nivel_Abandono),
            ];
            writeAoa(gerencial, 12, 3, [
                gerencialHeader,
                ...gerencialBody,
                gerencialTotal,
            ]);

            const parsePercent = (value) => {
                const n = Number(
                    String(value || "").replace("%", "").replace(",", ".").trim(),
                );
                return Number.isFinite(n) ? n : 0;
            };
            const totalRow = gerencialRows.find(
                (row) =>
                    normalizeCellValue(row?.Fecha_de_Gestion).toLowerCase() ===
                    "total del reporte",
            );
            const dailyRows = gerencialRows.filter(
                (row) =>
                    normalizeCellValue(row?.Fecha_de_Gestion).toLowerCase() !==
                    "total del reporte",
            );
            const maxServicio = dailyRows.reduce(
                (max, row) => Math.max(max, parsePercent(row?.Nivel_Servicio)),
                0,
            );
            const maxAbandono = dailyRows.reduce(
                (max, row) => Math.max(max, parsePercent(row?.Nivel_Abandono)),
                0,
            );

            // Bloque fijo para tabla y grafico pastel (enlazar chart del template a M13:N14)
            gerencial.cell("M12").value("RESUMEN LLAMADAS");
            gerencial.cell("N12").value("VALOR");
            gerencial.cell("M13").value("Llamadas Contestadas");
            gerencial.cell("N13").value(Number(totalRow?.Contestadas || 0));
            gerencial.cell("M14").value("Llamadas Abandonadas");
            gerencial.cell("N14").value(Number(totalRow?.Abandonadas || 0));
            gerencial.cell("M15").value("Llamadas Totales");
            gerencial
                .cell("N15")
                .value(Number(totalRow?.Llamadas_entrantes || 0));
            gerencial.cell("M16").value("Max Nivel Servicio");
            gerencial.cell("N16").value(`${maxServicio}%`);
            gerencial.cell("M17").value("Max Nivel Abandono");
            gerencial.cell("N17").value(`${maxAbandono}%`);
        }

        // TRX
        if (trx) {
            clearRange(trx, 13, 4000, 1, 25);
            writeAoa(trx, 13, 1, workbookAoa.trxAoa.slice(2));
        }

        // RESUMEN DE GESTION
        if (resumenGestion) {
            clearRange(resumenGestion, 7, 400, 3, 15);
            writeAoa(
                resumenGestion,
                7,
                3,
                workbookAoa.resumenGestionAoa.slice(2),
            );
        }

        // RESUMEN GLOBAL
        if (resumenGlobal) {
            clearRange(resumenGlobal, 12, 500, 3, 20);
            writeAoa(
                resumenGlobal,
                12,
                3,
                workbookAoa.resumenGlobalAoa.slice(2),
            );
        }

        // LLAMADAS DIARIAS
        if (llamadasDiarias) {
            clearRange(llamadasDiarias, 7, 500, 1, 10);
            writeAoa(
                llamadasDiarias,
                7,
                1,
                workbookAoa.llamadasDiariasAoa.slice(2),
            );
        }

        // GESTION IVR
        if (gestionIvr) {
            clearRange(gestionIvr, 1, 50, 1, 10);
            writeAoa(gestionIvr, 1, 1, workbookAoa.gestionIvrAoa);
        }

        const fileCampaign = sanitizeFileSegment(campaignId) || "inbound";
        const fileEndDate = sanitizeFileSegment(endDate) || "sin_fecha";
        const filename = `reporte_final_mensual_inbound_${fileCampaign}_${fileEndDate}.xlsx`;
        const buffer = await wb.outputAsync();

        return {
            rowCount: rows.length,
            filename,
            buffer,
        };
    }

    const workbook = XLSX.utils.book_new();
    const portadaWs = XLSX.utils.aoa_to_sheet(workbookAoa.portadaAoa);
    const gerencialWs = XLSX.utils.aoa_to_sheet(workbookAoa.gerencialAoa);
    const trxWs = XLSX.utils.aoa_to_sheet(workbookAoa.trxAoa);
    const resumenGestionWs = XLSX.utils.aoa_to_sheet(workbookAoa.resumenGestionAoa);
    const resumenGlobalWs = XLSX.utils.aoa_to_sheet(workbookAoa.resumenGlobalAoa);
    const llamadasDiariasWs = XLSX.utils.aoa_to_sheet(workbookAoa.llamadasDiariasAoa);
    const gestionIvrWs = XLSX.utils.aoa_to_sheet(workbookAoa.gestionIvrAoa);

    trxWs["!cols"] = buildSheetColumns(
        workbookAoa.trxAoa.slice(2).map((row) =>
            Object.fromEntries(
                INBOUND_MONTHLY_FINAL_COLUMN_ORDER.map((key, index) => [
                    key,
                    row[index] ?? "",
                ]),
            ),
        ),
    );

    XLSX.utils.book_append_sheet(workbook, portadaWs, sanitizeSheetName("PORTADA"));
    XLSX.utils.book_append_sheet(
        workbook,
        gerencialWs,
        sanitizeSheetName("REPORTE GERENCIAL"),
    );
    XLSX.utils.book_append_sheet(workbook, trxWs, sanitizeSheetName("TRX"));
    XLSX.utils.book_append_sheet(
        workbook,
        resumenGestionWs,
        sanitizeSheetName("RESUMEN DE GESTION"),
    );
    XLSX.utils.book_append_sheet(
        workbook,
        resumenGlobalWs,
        sanitizeSheetName("RESUMEN GLOBAL"),
    );
    XLSX.utils.book_append_sheet(
        workbook,
        llamadasDiariasWs,
        sanitizeSheetName("LLAMADAS DIARIAS"),
    );
    XLSX.utils.book_append_sheet(
        workbook,
        gestionIvrWs,
        sanitizeSheetName("GESTION IVR"),
    );

    const fileCampaign = sanitizeFileSegment(campaignId) || "inbound";
    const fileEndDate = sanitizeFileSegment(endDate) || "sin_fecha";
    const filename = `reporte_final_mensual_inbound_${fileCampaign}_${fileEndDate}.xlsx`;

    return {
        rowCount: rows.length,
        filename,
        buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    };
}
