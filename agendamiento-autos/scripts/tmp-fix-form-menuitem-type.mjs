import mysql from "mysql2/promise";

const dbConfig = {
    host: "127.0.0.1",
    port: 13306,
    user: "kimobill",
    password: "sIst2m1s2020",
    database: "cck_dev",
};

const numericTypes = new Set([
    "bigint",
    "int",
    "integer",
    "smallint",
    "mediumint",
    "tinyint",
    "decimal",
    "numeric",
    "float",
    "double",
]);

async function alterIfNumeric(connection, tableName, columnName) {
    const [rows] = await connection.query(
        `SELECT DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
        [tableName, columnName],
    );

    if (!rows.length) {
        console.log(`No existe ${tableName}.${columnName}, se omite.`);
        return;
    }

    const dataType = String(rows[0].DATA_TYPE || "").toLowerCase();
    if (!numericTypes.has(dataType)) {
        console.log(
            `${tableName}.${columnName} ya es tipo texto (${dataType}), OK.`,
        );
        return;
    }

    console.log(
        `Alterando ${tableName}.${columnName} de ${dataType} a VARCHAR(36)...`,
    );
    await connection.query(
        `ALTER TABLE ${tableName}
     MODIFY COLUMN ${columnName} VARCHAR(36) NOT NULL`,
    );
}

async function main() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        await connection.beginTransaction();

        await alterIfNumeric(
            connection,
            "form_template_assignments",
            "menu_item_id",
        );
        await alterIfNumeric(connection, "form_responses", "menu_item_id");

        await connection.commit();
        console.log("Tipos de menu_item_id corregidos.");
    } catch (error) {
        await connection.rollback();
        console.error("Error corrigiendo tipos:", error.message);
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
}

main();
