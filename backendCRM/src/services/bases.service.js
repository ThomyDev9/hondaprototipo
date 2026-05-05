import pool from "./db.js";
import BasesDAO from "./dao/BasesDAO.js";
import fs from "node:fs";
import XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";

let campaignImportStatsInfraReady = false;
const basesDAO = new BasesDAO(pool);

async function ensureCampaignImportStatsInfrastructure(
    connectionOrPool = pool,
) {
    if (campaignImportStatsInfraReady) {
        return;
    }

    await basesDAO.ensureCampaignImportStatsTable(connectionOrPool);
    campaignImportStatsInfraReady = true;
}

export async function ensureImportStatsTable(connectionOrPool = pool) {
    await ensureCampaignImportStatsInfrastructure(connectionOrPool);
}

export async function recomputeImportStats(
    campaignId,
    importId,
    actor = "system",
    connectionOrPool = pool,
) {
    const campaign = String(campaignId || "").trim();
    const importRef = String(importId || "").trim();

    if (!campaign || !importRef) {
        return;
    }

    await ensureCampaignImportStatsInfrastructure(connectionOrPool);

    await basesDAO.upsertCampaignImportStats(
        campaign,
        importRef,
        actor,
        connectionOrPool,
    );
}

/**
 * BASES SERVICE
 * Centraliza la logica de negocio realmente usada por rutas del modulo bases.
 * El acceso SQL activo sale de BasesDAO.
 */

export async function obtenerBases() {
    try {
        return await basesDAO.getAllBasesSummary();
    } catch (error) {
        console.error("Error al obtener bases:", error);
        throw error;
    }
}

function mapBaseSummaryRow(row) {
    const totalRegistros = Number(row.total_registros || 0);
    const pendientes = Number(row.pendientes || 0);

    return {
        id: row.id || null,
        campaign_id: row.campaign_id,
        base: row.import_id,
        estado_base: String(row.base_state) === "1" ? "ACTIVO" : "INACTIVO",
        registros: totalRegistros,
        sin_gestionar: pendientes,
        pendientes_libres: Number(row.pendientes_libres || 0),
        pendientes_asignados_sin_gestion: Number(
            row.pendientes_asignados_sin_gestion || 0,
        ),
        avance:
            totalRegistros > 0
                ? Math.round(100 * (1 - pendientes / totalRegistros))
                : 0,
    };
}

export async function obtenerBasesActivasResumen({
    campaignId = "",
    importId = "",
} = {}) {
    try {
        const rows = await basesDAO.getAllBasesSummary({
            campaignId: String(campaignId || "").trim(),
            importId: String(importId || "").trim(),
        });
        return rows.map(mapBaseSummaryRow);
    } catch (error) {
        console.error("Error al obtener resumen de bases activas:", error);
        throw error;
    }
}

export async function obtenerBasesInactivasResumen({
    campaignId = "",
    importId = "",
} = {}) {
    try {
        const rows = await basesDAO.getAllInactiveBasesSummary({
            campaignId: String(campaignId || "").trim(),
            importId: String(importId || "").trim(),
        });
        return rows.map(mapBaseSummaryRow);
    } catch (error) {
        console.error("Error al obtener resumen de bases inactivas:", error);
        throw error;
    }
}

export async function obtenerResumenBases() {
    try {
        const rows = await basesDAO.getAllBasesSummary();
        return {
            total_bases: rows.length,
            bases_activas: rows.filter((row) => String(row.base_state) === "1").length,
            bases_inactivas: rows.filter((row) => String(row.base_state || "0") !== "1").length,
            total_registros: rows.reduce(
                (acc, row) => acc + Number(row.total_registros || 0),
                0,
            ),
            pendientes: rows.reduce(
                (acc, row) => acc + Number(row.pendientes || 0),
                0,
            ),
        };
    } catch (error) {
        console.error("Error al obtener resumen de bases:", error);
        throw error;
    }
}

export async function obtenerBasesActivas() {
    try {
        return await basesDAO.getActiveAgentBasesSummary();
    } catch (error) {
        console.error("Error al obtener bases activas:", error);
        throw error;
    }
}

export async function obtenerImportacionesConEstadoPorCampania(campaignId) {
    try {
        return await basesDAO.getImportsByCampaignWithState(campaignId);
    } catch (error) {
        console.error("Error al obtener importaciones con estado:", error);
        throw error;
    }
}

export async function obtenerCantidadReciclables(campaignId, importId) {
    try {
        return await basesDAO.getReciclablesCount(campaignId, importId);
    } catch (error) {
        console.error("Error al obtener cantidad de reciclables:", error);
        throw error;
    }
}

export async function reciclarBase(campaignId, importId, actor) {
    try {
        const maxIntentos = 6;
        const [result] = await basesDAO.recycleBaseContacts(
            actor,
            campaignId,
            importId,
            maxIntentos,
        );

        await recomputeImportStats(
            campaignId,
            importId,
            actor || "system",
            pool,
        );

        return {
            base_id: campaignId,
            import_id: importId,
            registros_reciclados: result.affectedRows,
        };
    } catch (error) {
        console.error("Error al reciclar base:", error);
        throw error;
    }
}

/**
 * Activar o desactivar base
 */
export async function administrarBase(
    campaignId,
    importDate,
    action,
    username,
    id,
) {
    try {
        const now = new Date();
        const dateNow = now.toISOString().slice(0, 19).replace("T", " ");

        await basesDAO.ensureCampaignActiveBaseInfrastructure();

        if (action === "activar") {
            const existing = await basesDAO.getCampaignActiveBaseRecord(
                campaignId,
                importDate,
            );

            if (existing?.id) {
                await basesDAO.reactivateCampaignActiveBaseRecord(
                    existing.id,
                    username,
                    dateNow,
                );
            } else {
                const totalRegistros =
                    await basesDAO.countContactsByCampaignAndImport(
                        campaignId,
                        importDate,
                    );

                await basesDAO.insertCampaignActiveBaseRecord(
                    campaignId,
                    importDate,
                    totalRegistros,
                    username,
                );
            }

            await basesDAO.activateBaseContacts(
                username,
                dateNow,
                importDate,
                campaignId,
            );

            await recomputeImportStats(
                campaignId,
                importDate,
                username || "system",
                pool,
            );

            return { message: "Se ha activado base exitosamente!" };
        }

        if (action === "desactivar") {
            await basesDAO.deactivateBaseContacts(
                username,
                dateNow,
                importDate,
                campaignId,
            );

            if (!id) throw new Error("Falta id de base a desactivar");

            await basesDAO.clearCampaignActiveBaseById(
                username,
                dateNow,
                id,
            );

            return { message: "Se ha cancelado base exitosamente!" };
        }

        throw new Error("Accion no valida");
    } catch (error) {
        console.error("Error al administrar base:", error);
        throw error;
    }
}

/**
 * Procesar archivo CSV y cargar datos
 * @param {string} filePath - Ruta del archivo CSV
 * @param {string} campaignId - ID de campaña
 * @param {string} importName - Nombre de la importación
 * @param {string} userId - ID del usuario que realiza la importación
 * @param {string} importCase - Caso de importación a ejecutar
 * @returns {Object} Resultado de la importación
 */
/**
 * Helper: Validates import metadata (campaign exists, import name not duplicate)
 */
async function validateImportMetadata(connCCK, campaignId, importName) {
    const campaigns = await basesDAO.checkCampaignForImport(campaignId, connCCK);

    if (campaigns.length === 0) {
        throw new Error("Campaña no encontrada");
    }

    const existingImport = await basesDAO.checkImportNameExists(
        importName,
        connCCK,
    );

    const existingImportControl = await basesDAO.checkImportNameExistsInControl(
        importName,
        connCCK,
    );

    const importExists =
        existingImport.length > 0 || existingImportControl.length > 0;

    if (importExists) {
        throw new Error(
            "El nombre de base/importación ya existe. Usa un nombre único para continuar.",
        );
    }

    return false;
}

/**
 * Helper: Reads CSV file and extracts rows
 */
function getRowsFromCSV(filePath) {
    const workbook = XLSX.readFile(filePath, {
        type: "file",
        raw: false,
        FS: ";",
    });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
    });

    // Algunos CSV con ';' pueden llegar como una sola columna por fila.
    // Si detectamos ese caso, hacemos split manual para preservar compatibilidad.
    return rows.map((row) => {
        if (!Array.isArray(row)) {
            return row;
        }

        if (
            row.length === 1 &&
            typeof row[0] === "string" &&
            row[0].includes(";")
        ) {
            return row[0].split(";").map((cell) => String(cell || "").trim());
        }

        return row;
    });
}

/**
 * Helper: Maps raw row data to lineaData object
 */
function mapDataToLineaData(datos) {
    return {
        CODIGO_CAMPANIA: datos[0] || "",
        NOMBRE_CAMPANIA: datos[1] || "",
        IDENTIFICACION: datos[2] || "",
        NOMBRE_CLIENTE: datos[3] || "",
        CAMPO1: datos[4] || "",
        CAMPO2: datos[5] || "",
        CAMPO3: datos[6] || "",
        CAMPO4: datos[7] || "",
        CAMPO5: datos[8] || "",
        CAMPO6: datos[9] || "",
        CAMPO7: datos[10] || "",
        CAMPO8: datos[11] || "",
        CAMPO9: datos[12] || "",
        CAMPO10: datos[13] || "",
        TELEFONO_01: datos[14] || "",
        TELEFONO_02: datos[15] || "",
        TELEFONO_03: datos[16] || "",
        TELEFONO_04: datos[17] || "",
        TELEFONO_05: datos[18] || "",
        TELEFONO_06: datos[19] || "",
        TELEFONO_07: datos[20] || "",
        TELEFONO_08: datos[21] || "",
        TELEFONO_09: datos[22] || "",
        TELEFONO_10: datos[23] || "",
        CAMPOS_ADICIONALES_JSON: "",
    };
}

function normalizeHeaderKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replaceAll(/[^A-Z0-9]+/g, "_")
        .replaceAll(/^_+/g, "")
        .replaceAll(/_+$/g, "");
}

function buildHeaderIndexMap(headers) {
    const map = new Map();
    for (let index = 0; index < headers.length; index++) {
        const key = normalizeHeaderKey(headers[index]);
        if (!key) continue;
        if (!map.has(key)) {
            map.set(key, index);
        }
    }
    return map;
}

function hasStructuredHeaders(headers) {
    const headerMap = buildHeaderIndexMap(headers);
    const markers = [
        "IDENTIFICACION",
        "NOMBRE_CLIENTE",
        "CAMPO1",
        "TELEFONO_01",
        "CODIGO_CAMPANIA",
    ];
    return markers.some((marker) => headerMap.has(marker));
}

function getHeaderValue(headerMap, rowData, key) {
    const index = headerMap.get(key);
    if (index === undefined) {
        return "";
    }
    return String(rowData[index] || "").trim();
}

function getHeaderValueOrPositional(
    headerMap,
    rowData,
    headerKey,
    positionalIndex,
) {
    const byHeader = getHeaderValue(headerMap, rowData, headerKey);
    if (byHeader) {
        return byHeader;
    }
    return String(rowData[positionalIndex] || "").trim();
}

function getPhoneHeaderValue(headerMap, rowData, phoneIndex) {
    const padded = String(phoneIndex).padStart(2, "0");
    const candidates = [
        `TELEFONO_${padded}`,
        `TELEFONO_${phoneIndex}`,
        `TELEFONO${padded}`,
        `TELEFONO${phoneIndex}`,
    ];

    for (const key of candidates) {
        const value = getHeaderValue(headerMap, rowData, key);
        if (value) {
            return value;
        }
    }

    for (const [headerKey, headerIndex] of headerMap.entries()) {
        const match = /^TELEFONO_?0?([1-9]|10)$/.exec(headerKey);
        if (!match) {
            continue;
        }

        if (Number(match[1]) !== phoneIndex) {
            continue;
        }

        return String(rowData[headerIndex] || "").trim();
    }

    return "";
}

function normalizePhoneValue(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) {
        return "";
    }

    const digitsOnly = raw.replaceAll(/\D+/g, "");

    if (digitsOnly.length < 7) {
        return "";
    }

    return digitsOnly;
}

function mapDataToLineaDataByHeaders(headers, rowData) {
    const headerMap = buildHeaderIndexMap(headers);
    const lineaData = {
        CODIGO_CAMPANIA: getHeaderValueOrPositional(
            headerMap,
            rowData,
            "CODIGO_CAMPANIA",
            0,
        ),
        NOMBRE_CAMPANIA: getHeaderValueOrPositional(
            headerMap,
            rowData,
            "NOMBRE_CAMPANIA",
            1,
        ),
        IDENTIFICACION: getHeaderValueOrPositional(
            headerMap,
            rowData,
            "IDENTIFICACION",
            2,
        ),
        NOMBRE_CLIENTE: getHeaderValueOrPositional(
            headerMap,
            rowData,
            "NOMBRE_CLIENTE",
            3,
        ),
        CAMPOS_ADICIONALES_JSON: "",
    };

    for (let index = 1; index <= 10; index++) {
        lineaData[`CAMPO${index}`] = getHeaderValueOrPositional(
            headerMap,
            rowData,
            `CAMPO${index}`,
            index + 3,
        );
    }

    for (let index = 1; index <= 10; index++) {
        const phoneKey = `TELEFONO_${String(index).padStart(2, "0")}`;
        lineaData[phoneKey] = getPhoneHeaderValue(headerMap, rowData, index);
    }

    const extras = {};
    for (const [headerKey, headerIndex] of headerMap.entries()) {
        const match = /^CAMPO(\d+)$/.exec(headerKey);
        if (!match) {
            continue;
        }

        const fieldNumber = Number(match[1]);
        if (!Number.isFinite(fieldNumber) || fieldNumber <= 10) {
            continue;
        }

        const value = String(rowData[headerIndex] || "").trim();
        if (!value) {
            continue;
        }

        extras[`CAMPO${fieldNumber}`] = value;
    }

    if (Object.keys(extras).length > 0) {
        lineaData.CAMPOS_ADICIONALES_JSON = JSON.stringify(extras);
    }

    return lineaData;
}

/**
 * Helper: Filters valid rows from CSV (non-empty identification and name)
 */
function filterValidRows(rawRows) {
    const lineas = [];
    const headers = Array.isArray(rawRows[0]) ? rawRows[0] : [];
    const useHeaderParser = hasStructuredHeaders(headers);

    for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
        const datos = rawRows[rowIndex];

        if (!Array.isArray(datos) || datos.length === 0) {
            continue;
        }

        const lineaData = useHeaderParser
            ? mapDataToLineaDataByHeaders(headers, datos)
            : mapDataToLineaData(datos);

        if (
            !lineaData.IDENTIFICACION?.toString().trim() &&
            !lineaData.NOMBRE_CLIENTE?.toString().trim()
        ) {
            continue;
        }

        lineas.push(lineaData);
    }

    return lineas;
}

function summarizeHeaders(rawRows = []) {
    const headers = Array.isArray(rawRows[0]) ? rawRows[0] : [];
    return headers
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .slice(0, 30);
}

/**
 * Helper: Inserts a single contact with its phone numbers
 * @param {Object} context - Context object containing all required data
 * @param {Object} context.connCCK - Database connection
 * @param {string} context.contactId - Contact ID (UUID)
 * @param {string} context.contactName - Contact name
 * @param {string} context.identification - Contact identification
 * @param {string} context.campaignId - Campaign ID
 * @param {string} context.importName - Import name
 * @param {string} context.vcc - VCC value
 * @param {Object} context.lineaData - Raw line data with all fields
 * @param {string} context.dateNow - Current date timestamp
 */
async function insertContactWithPhones(context) {
    const {
        connCCK,
        contactId,
        contactName,
        identification,
        campaignId,
        importName,
        vcc,
        lineaData,
        dateNow,
    } = context;

    const LastManagementResult = "";

    await basesDAO.insertContactImportContact([
        vcc,
        contactId,
        contactName,
        identification,
        campaignId,
        LastManagementResult,
        importName,
    ], connCCK);

    await basesDAO.insertClienteBancoPichincha([
        vcc, // VCC
        campaignId, // CampaignId
        contactId, // ContactId
        lineaData.NOMBRE_CLIENTE, // ContactName
        "", // ContactAddress (nueva)
        "", // InteractionId
        importName, // ImportId
        "Pendiente", // LastAgent
        "Pendiente", // ResultLevel1
        "Pendiente", // ResultLevel2
        "Pendiente", // ResultLevel3
        "0", // ManagementResultCode
        "Pendiente", // ManagementResultDescription
        "", // TmStmp
        0, // Intentos (nueva)
        contactId, // ID
        lineaData.CODIGO_CAMPANIA, // CODIGO_CAMPANIA
        lineaData.NOMBRE_CAMPANIA, // NOMBRE_CAMPANIA
        lineaData.IDENTIFICACION, // IDENTIFICACION
        lineaData.NOMBRE_CLIENTE, // NOMBRE_CLIENTE
        lineaData.CAMPO1, // CAMPO1
        lineaData.CAMPO2, // CAMPO2
        lineaData.CAMPO3, // CAMPO3
        lineaData.CAMPO4, // CAMPO4
        lineaData.CAMPO5, // CAMPO5
        lineaData.CAMPO6, // CAMPO6
        lineaData.CAMPO7, // CAMPO7
        lineaData.CAMPO8, // CAMPO8
        lineaData.CAMPO9, // CAMPO9
        lineaData.CAMPO10, // CAMPO10
        lineaData.CAMPOS_ADICIONALES_JSON || "", // CamposAdicionalesJson
        "", // UserShift (nueva)
        "", // Action (nueva)
    ], connCCK);

    let rawPhoneCount = 0;
    let insertedPhoneCount = 0;

    // Insert phone numbers
    for (let i = 1; i <= 10; i++) {
        const telefonoKey = `TELEFONO_${String(i).padStart(2, "0")}`;
        const telefonoRaw = String(lineaData[telefonoKey] || "").trim();
        if (telefonoRaw) {
            rawPhoneCount += 1;
        }

        const telefono = normalizePhoneValue(telefonoRaw);

        if (!telefono) continue;

        await basesDAO.insertContactPhone([
            contactId,
            "",
            telefono,
            "",
            "SG",
            dateNow,
            dateNow,
            telefonoKey,
            identification,
        ], connCCK);

        insertedPhoneCount += 1;
    }

    if (rawPhoneCount > 0 && insertedPhoneCount === 0) {
        throw new Error(
            `Teléfonos inválidos para contacto ${identification || contactId}: se detectaron valores en columnas TELEFONO pero ninguno es numérico válido`,
        );
    }
}

export async function procesarCSV(
    filePath,
    campaignId,
    importName,
    importUser,
    importCase = "bancoPichinchaEncuestasGenericas",
) {
    let connCCK;
    let ingresado = 0;
    let duplicado = 0;
    let error = 0;
    const now = new Date();
    const dateNow = now.toISOString().slice(0, 19).replace("T", " ");
    const vcc = process.env.VCC || "1";

    // Validate import case
    if (importCase !== "bancoPichinchaEncuestasGenericas") {
        throw new Error(
            `Caso de importación no soportado: ${importCase}. Actualmente disponible: bancoPichinchaEncuestasGenericas`,
        );
    }

    try {
        const normalizedCampaignId = String(campaignId || "").trim();
        const normalizedImportName = String(importName || "").trim();

        if (!normalizedCampaignId) {
            throw new Error("campaignId vacio al iniciar importacion");
        }
        if (!normalizedImportName) {
            throw new Error("importName vacio al iniciar importacion");
        }

        connCCK = await pool.getConnection();

        await connCCK.beginTransaction();

        const importNameDuplicado = await validateImportMetadata(
            connCCK,
            normalizedCampaignId,
            normalizedImportName,
        );

        const rawRows = getRowsFromCSV(filePath);
        const lineas = filterValidRows(rawRows);

        if (lineas.length === 0) {
            const headerPreview = summarizeHeaders(rawRows);
            throw new Error(
                `No se encontraron filas válidas para importar. Verifica que el CSV tenga columnas reconocibles como IDENTIFICACION y/o NOMBRE_CLIENTE, o el formato posicional esperado. Encabezados detectados: ${headerPreview.join(" | ") || "(sin encabezados)"}`,
            );
        }

        for (const value of lineas) {
            const ID = uuidv4();
            const Name = value.NOMBRE_CLIENTE;
            const Identification = value.IDENTIFICACION;

            const existing = await basesDAO.checkContactDuplicateById(
                ID,
                connCCK,
            );

            if (existing.length > 0) {
                duplicado++;
                continue;
            }

            await insertContactWithPhones({
                connCCK,
                contactId: ID,
                contactName: Name,
                identification: Identification,
                campaignId: normalizedCampaignId,
                importName: normalizedImportName,
                vcc,
                lineaData: value,
                dateNow,
            });

            ingresado++;
        }

        if (ingresado === 0) {
            const headerPreview = summarizeHeaders(rawRows);
            const firstParsedRow =
                lineas.length > 0 ? JSON.stringify(lineas[0]) : "(sin filas)";
            throw new Error(
                `Importacion sin inserciones: se procesaron ${lineas.length} filas validas pero ingresado=0. CampaignId='${normalizedCampaignId}', ImportName='${normalizedImportName}', Headers='${headerPreview.join(" | ")}', PrimeraFila='${firstParsedRow}'`,
            );
        }

        await basesDAO.insertContactImportDetail([
            vcc,
            normalizedImportName,
            "1",
            dateNow,
            importUser || "system",
            ingresado,
            ingresado,
            "0",
            error,
            duplicado,
        ], connCCK);

        await basesDAO.insertContactImport([
            vcc,
            normalizedImportName,
            normalizedImportName,
            "1",
            error === 0 ? "COMPLETE" : "INCOMPLETE",
            null,
        ], connCCK);

        await recomputeImportStats(
            normalizedCampaignId,
            normalizedImportName,
            importUser || "system",
            connCCK,
        );

        await connCCK.commit();

        return {
            success: true,
            importCase,
            importName: normalizedImportName,
            campaignId: normalizedCampaignId,
            importNameDuplicado,
            resumen: {
                ingresado,
                duplicado,
                error,
            },
        };
    } catch (err) {
        if (connCCK) await connCCK.rollback();
        console.error("Error procesando CSV:", err);
        throw err;
    } finally {
        if (connCCK) connCCK.release();
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.error("Error eliminando archivo temporal:", e);
        }
    }
}
