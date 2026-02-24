import pool from "./db.js";
import basesQueries from "./queries/bases.queries.js";
import fs from "fs";
import XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";

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

export async function obtenerBasesActivas() {
    try {
        const [rows] = await pool.query(basesQueries.getActive);
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
/**
 * Procesar archivo CSV y cargar datos
 * @param {string} filePath - Ruta del archivo CSV
 * @param {string} campaignId - ID de campaña
 * @param {string} importName - Nombre de la importación
 * @param {string} userId - ID del usuario que realiza la importación
 * @param {string} importCase - Caso de importación a ejecutar
 * @returns {Object} Resultado de la importación
 */
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
    const lineas = [];
    const now = new Date();
    const dateNow = now.toISOString().slice(0, 19).replace("T", " ");
    const vcc = process.env.VCC || "1";

    switch (importCase) {
        case "bancoPichinchaEncuestasGenericas":
            break;
        default:
            throw new Error(
                `Caso de importación no soportado: ${importCase}. Actualmente disponible: bancoPichinchaEncuestasGenericas`,
            );
    }

    try {
        connCCK = await pool.getConnection();

        await connCCK.beginTransaction();

        const [campaigns] = await connCCK.query(
            basesQueries.checkCampaignForImport,
            [campaignId],
        );

        if (campaigns.length === 0) {
            throw new Error("Campaña no encontrada");
        }

        const [existingImport] = await connCCK.query(
            basesQueries.checkImportNameExists,
            [importName],
        );
        const importNameDuplicado = existingImport.length > 0;

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

        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
            const datos = rows[rowIndex];

            if (!Array.isArray(datos) || datos.length === 0) {
                continue;
            }

            const lineaData = {
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
            };

            if (
                !lineaData.IDENTIFICACION?.toString().trim() &&
                !lineaData.NOMBRE_CLIENTE?.toString().trim()
            ) {
                continue;
            }

            lineas.push(lineaData);
        }

        for (const value of lineas) {
            const ID = uuidv4();
            const Name = value.NOMBRE_CLIENTE;
            const Identification = value.IDENTIFICACION;
            const LastManagementResult = "";

            const [existing] = await connCCK.query(
                basesQueries.checkContactDuplicateById,
                [ID],
            );

            if (existing.length > 0) {
                duplicado++;
                continue;
            }

            try {
                await connCCK.query(basesQueries.insertContactImportContact, [
                    vcc,
                    ID,
                    Name,
                    Identification,
                    campaignId,
                    LastManagementResult,
                    importName,
                ]);

                await connCCK.query(basesQueries.insertClienteBancoPichincha, [
                    vcc, // VCC
                    campaignId, // CampaignId
                    ID, // ContactId
                    value.NOMBRE_CLIENTE, // ContactName
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
                    ID, // ID
                    value.CODIGO_CAMPANIA, // CODIGO_CAMPANIA
                    value.NOMBRE_CAMPANIA, // NOMBRE_CAMPANIA
                    value.IDENTIFICACION, // IDENTIFICACION
                    value.NOMBRE_CLIENTE, // NOMBRE_CLIENTE
                    value.CAMPO1, // CAMPO1
                    value.CAMPO2, // CAMPO2
                    value.CAMPO3, // CAMPO3
                    value.CAMPO4, // CAMPO4
                    value.CAMPO5, // CAMPO5
                    value.CAMPO6, // CAMPO6
                    value.CAMPO7, // CAMPO7
                    value.CAMPO8, // CAMPO8
                    value.CAMPO9, // CAMPO9
                    value.CAMPO10, // CAMPO10
                    "", // UserShift (nueva)
                    "", // Action (nueva)
                ]);

                for (let i = 1; i <= 10; i++) {
                    const telefonoKey = `TELEFONO_${String(i).padStart(2, "0")}`;
                    const telefono = value[telefonoKey];

                    if (!telefono || !telefono.trim()) continue;

                    await connCCK.query(basesQueries.insertContactPhone, [
                        ID,
                        "",
                        telefono,
                        "",
                        "SG",
                        dateNow,
                        dateNow,
                        telefonoKey,
                        Identification,
                    ]);
                }

                ingresado++;
            } catch (insertError) {
                console.error("Error insertando contacto para ID:", ID);
                console.error("Detalles del error:", insertError.message);
                console.error("SQL Error Code:", insertError.code);
                console.error("Stack:", insertError.stack);
                error++;
            }
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
