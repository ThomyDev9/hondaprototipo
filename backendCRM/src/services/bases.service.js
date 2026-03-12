import pool from "./db.js";
import basesQueries from "./queries/bases.queries.js";
import fs from "node:fs";
import XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";

let campaignImportStatsInfraReady = false;

async function ensureCampaignImportStatsInfrastructure(
    connectionOrPool = pool,
) {
    if (campaignImportStatsInfraReady) {
        return;
    }

    await connectionOrPool.query(basesQueries.ensureCampaignImportStatsTable);
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

    await connectionOrPool.query(
        basesQueries.upsertCampaignImportStatsFromContact,
        [campaign, importRef, String(actor || "system"), campaign, importRef],
    );
}

/**
 * BASES SERVICE
 * Centraliza lógica de negocio para bases de datos
 * Usa sistema de queries centralizado
 */

export async function obtenerBases() {
    try {
        const [rows] = await pool.query(basesQueries.getAll);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases:", error);
        throw error;
    }
}

export async function obtenerBasePorId(id) {
    try {
        const [rows] = await pool.query(basesQueries.getById, [id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error al obtener base por ID:", error);
        throw error;
    }
}

export async function obtenerBasesPorMapeo(mapeoId) {
    try {
        const [rows] = await pool.query(basesQueries.getByMappeo, [mapeoId]);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases por mapeo:", error);
        throw error;
    }
}

export async function obtenerBasesPorCampania(campania) {
    try {
        const [rows] = await pool.query(basesQueries.getByCampania, [campania]);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases por campaña:", error);
        throw error;
    }
}

export async function buscarBases(searchTerm) {
    try {
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await pool.query(basesQueries.search, [
            searchPattern,
            searchPattern,
        ]);
        return rows;
    } catch (error) {
        console.error("Error al buscar bases:", error);
        throw error;
    }
}

export async function crearBase(baseData) {
    try {
        const { nombre, mapeo, campania, estado = 1 } = baseData;

        const [result] = await pool.query(basesQueries.create, [
            nombre,
            mapeo,
            campania,
            estado,
        ]);

        return {
            id: result.insertId,
            nombre,
            mapeo,
            campania,
            estado,
        };
    } catch (error) {
        console.error("Error al crear base:", error);
        throw error;
    }
}

export async function actualizarBase(id, baseData) {
    try {
        const { nombre, mapeo, campania, estado } = baseData;

        await pool.query(basesQueries.update, [
            nombre,
            mapeo,
            campania,
            estado,
            id,
        ]);

        return await obtenerBasePorId(id);
    } catch (error) {
        console.error("Error al actualizar base:", error);
        throw error;
    }
}

export async function cambiarEstadoBase(id) {
    try {
        await pool.query(basesQueries.updateState, [id]);
        return await obtenerBasePorId(id);
    } catch (error) {
        console.error("Error al cambiar estado de la base:", error);
        throw error;
    }
}

export async function contarBases() {
    try {
        const [rows] = await pool.query(basesQueries.count);
        return rows[0].total || 0;
    } catch (error) {
        console.error("Error al contar bases:", error);
        throw error;
    }
}

import agenteQueries from "./queries/agente.queries.js";

export async function obtenerBasesActivas() {
    try {
        // Usar la misma consulta que 'ver bases' para obtener el resumen real de bases activas
        const [rows] = await pool.query(agenteQueries.getActiveBasesSummary);
        return rows;
    } catch (error) {
        console.error("Error al obtener bases activas:", error);
        throw error;
    }
}

export async function obtenerResumenBases() {
    try {
        const [rows] = await pool.query(basesQueries.getSummary);
        return rows;
    } catch (error) {
        console.error("Error al obtener resumen de bases:", error);
        throw error;
    }
}



export async function obtenerImportacionesConEstadoPorCampania(campaignId) {
    try {
        const [rows] = await pool.query(
            basesQueries.getImportsByCampaignWithState,
            [campaignId],
        );
        return rows;
    } catch (error) {
        console.error("Error al obtener importaciones con estado:", error);
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

        await pool.query(basesQueries.ensureCampaignActiveBaseTable);
        await pool.query(
            basesQueries.ensureCampaignActiveBaseTotalRegistrosColumn,
        );

        if (action === "activar") {
            // Buscar si ya existe un registro en campaign_active_base para esta campaña/importación
            const [existing] = await pool.query(
                `SELECT id FROM campaign_active_base WHERE CampaignId = ? AND ImportId = ? LIMIT 1`,
                [campaignId, importDate],
            );
            if (existing.length > 0) {
                // Si existe, actualizar el estado
                await pool.query(
                    `UPDATE campaign_active_base SET State = '1', UserShift = ?, UpdatedAt = ? WHERE id = ?`,
                    [username, dateNow, existing[0].id],
                );
            } else {
                // Si no existe, insertar nuevo registro
                // Obtener total de registros para la base
                const [countRows] = await pool.query(
                    `SELECT COUNT(*) as total FROM contactimportcontact WHERE Campaign = ? AND LastUpdate = ?`,
                    [campaignId, importDate],
                );
                const totalRegistros = countRows[0]?.total || 0;
                await pool.query(basesQueries.insertCampaignActiveBase, [
                    campaignId,
                    importDate,
                    totalRegistros,
                    username,
                ]);
            }
            await pool.query(basesQueries.activateBase, [
                username,
                dateNow,
                importDate,
                campaignId,
            ]);
            await recomputeImportStats(
                campaignId,
                importDate,
                username || "system",
                pool,
            );
            return { message: "Se ha activado base exitosamente!" };
        } else if (action === "desactivar") {
            await pool.query(basesQueries.deactivateBase, [
                username,
                dateNow,
                importDate,
                campaignId,
            ]);
            // Se espera que el frontend envíe el id de la base a desactivar
            if (!id) throw new Error("Falta id de base a desactivar");
            await pool.query(basesQueries.clearCampaignActiveBaseById, [
                username,
                dateNow,
                id,
            ]);
            return { message: "Se ha cancelado base exitosamente!" };
        } else {
            throw new Error("Acción no válida");
        }
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
    const [campaigns] = await connCCK.query(
        basesQueries.checkCampaignForImport,
        [campaignId, campaignId],
    );

    if (campaigns.length === 0) {
        throw new Error("Campaña no encontrada");
    }

    const [existingImport] = await connCCK.query(
        basesQueries.checkImportNameExists,
        [importName],
    );

    const [existingImportControl] = await connCCK.query(
        basesQueries.checkImportNameExistsInControl,
        [importName],
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

    return XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
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

    await connCCK.query(basesQueries.insertContactImportContact, [
        vcc,
        contactId,
        contactName,
        identification,
        campaignId,
        LastManagementResult,
        importName,
    ]);

    await connCCK.query(basesQueries.insertClienteBancoPichincha, [
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
    ]);

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

        await connCCK.query(basesQueries.insertContactPhone, [
            contactId,
            "",
            telefono,
            "",
            "SG",
            dateNow,
            dateNow,
            telefonoKey,
            identification,
        ]);

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
        connCCK = await pool.getConnection();

        await connCCK.beginTransaction();

        const importNameDuplicado = await validateImportMetadata(
            connCCK,
            campaignId,
            importName,
        );

        const rawRows = getRowsFromCSV(filePath);
        const lineas = filterValidRows(rawRows);

        for (const value of lineas) {
            const ID = uuidv4();
            const Name = value.NOMBRE_CLIENTE;
            const Identification = value.IDENTIFICACION;

            const [existing] = await connCCK.query(
                basesQueries.checkContactDuplicateById,
                [ID],
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
                campaignId,
                importName,
                vcc,
                lineaData: value,
                dateNow,
            });

            ingresado++;
        }

        await connCCK.query(basesQueries.insertContactImportDetail, [
            vcc,
            importName,
            "1",
            dateNow,
            importUser || "system",
            ingresado,
            ingresado,
            "0",
            error,
            duplicado,
        ]);

        await connCCK.query(basesQueries.insertContactImport, [
            vcc,
            importName,
            importName,
            "1",
            error === 0 ? "COMPLETE" : "INCOMPLETE",
            null,
        ]);

        await recomputeImportStats(
            campaignId,
            importName,
            importUser || "system",
            connCCK,
        );

        await connCCK.commit();

        return {
            success: true,
            importCase,
            importName,
            campaignId,
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
