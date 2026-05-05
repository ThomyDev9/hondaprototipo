import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const MYSQL_TIMEZONE =
    String(process.env.MYSQL_TIMEZONE || "-05:00").trim() || "-05:00";
const ISABEL_TIMEZONE =
    String(process.env.ISABEL_TIMEZONE || MYSQL_TIMEZONE).trim() ||
    MYSQL_TIMEZONE;
const CL_TIMEZONE =
    String(process.env.CL_TIMEZONE || MYSQL_TIMEZONE).trim() || MYSQL_TIMEZONE;
const MYSQL_POOL_CONNECTION_LIMIT = Number(
    process.env.MYSQL_POOL_CONNECTION_LIMIT || 25,
);
const MYSQL_POOL_QUEUE_LIMIT = Number(process.env.MYSQL_POOL_QUEUE_LIMIT || 0);
const ISABEL_POOL_CONNECTION_LIMIT = Number(
    process.env.ISABEL_POOL_CONNECTION_LIMIT || 10,
);
const INBOUND_ISABEL_POOL_CONNECTION_LIMIT = Number(
    process.env.INBOUND_ISABEL_POOL_CONNECTION_LIMIT || 10,
);
const CL_POOL_CONNECTION_LIMIT = Number(
    process.env.CL_POOL_CONNECTION_LIMIT || 10,
);
const SHARED_POOL_QUEUE_LIMIT = Number(
    process.env.SHARED_POOL_QUEUE_LIMIT || 0,
);

// Pool para la base de datos principal (CRM)
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST, // MySQL host
    port: Number(process.env.MYSQL_PORT), // 3306
    user: process.env.MYSQL_USER,
    password: String(process.env.MYSQL_PASSWORD),
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: Number.isFinite(MYSQL_POOL_CONNECTION_LIMIT)
        ? MYSQL_POOL_CONNECTION_LIMIT
        : 25,
    queueLimit: Number.isFinite(MYSQL_POOL_QUEUE_LIMIT)
        ? MYSQL_POOL_QUEUE_LIMIT
        : 0,
    charset: "utf8",
    dateStrings: true,
    timezone: MYSQL_TIMEZONE,
});

// Pool para la base de datos de la PBX Isabel
const isabelPool = mysql.createPool({
    host: process.env.ISABEL_HOST || "172.19.10.40",
    port: Number(process.env.ISABEL_PORT) || 3306,
    user: process.env.ISABEL_USER || "kimobill",
    password: process.env.ISABEL_PASSWORD || "sIst2m1s2020",
    database: process.env.ISABEL_DB || "asteriskcdrdb",
    waitForConnections: true,
    connectionLimit: Number.isFinite(ISABEL_POOL_CONNECTION_LIMIT)
        ? ISABEL_POOL_CONNECTION_LIMIT
        : 10,
    queueLimit: Number.isFinite(SHARED_POOL_QUEUE_LIMIT)
        ? SHARED_POOL_QUEUE_LIMIT
        : 0,
    charset: "utf8",
    dateStrings: true,
    timezone: ISABEL_TIMEZONE,
});

const inboundIsabelPool = mysql.createPool({
    host:
        process.env.INBOUND_ISSABEL_HOST ||
        process.env.CL_HOST ||
        process.env.ISABEL_HOST ||
        "172.19.10.44",
    port: Number(
        process.env.INBOUND_ISSABEL_PORT ||
            process.env.CL_PORT ||
            process.env.ISABEL_PORT ||
            3306,
    ),
    user:
        process.env.INBOUND_ISSABEL_USER ||
        process.env.CL_USER ||
        process.env.ISABEL_USER ||
        "kimobill",
    password:
        process.env.INBOUND_ISSABEL_PASSWORD ||
        process.env.CL_PASSWORD ||
        process.env.ISABEL_PASSWORD ||
        "sIst2m1s2020",
    database:
        process.env.INBOUND_ISSABEL_DB ||
        process.env.ISABEL_DB ||
        "asteriskcdrdb",
    waitForConnections: true,
    connectionLimit: Number.isFinite(INBOUND_ISABEL_POOL_CONNECTION_LIMIT)
        ? INBOUND_ISABEL_POOL_CONNECTION_LIMIT
        : 10,
    queueLimit: Number.isFinite(SHARED_POOL_QUEUE_LIMIT)
        ? SHARED_POOL_QUEUE_LIMIT
        : 0,
    charset: "utf8",
    dateStrings: true,
    timezone: ISABEL_TIMEZONE,
});

const callCenterPool = mysql.createPool({
    host: process.env.CL_HOST || "172.19.10.44",
    port: Number(process.env.CL_PORT) || 3306,
    user: process.env.CL_USER || "kimobill",
    password: process.env.CL_PASSWORD || "sIst2m1s2020",
    database: process.env.CL_DB || "call_center",
    waitForConnections: true,
    connectionLimit: Number.isFinite(CL_POOL_CONNECTION_LIMIT)
        ? CL_POOL_CONNECTION_LIMIT
        : 10,
    queueLimit: Number.isFinite(SHARED_POOL_QUEUE_LIMIT)
        ? SHARED_POOL_QUEUE_LIMIT
        : 0,
    charset: "utf8",
    dateStrings: true,
    timezone: CL_TIMEZONE,
});

pool.on("connection", (connection) => {
    connection.query("SET time_zone = ?", [MYSQL_TIMEZONE], (err) => {
        if (err) {
            console.error(
                "No se pudo fijar time_zone en MySQL (db.multi.pool):",
                err,
            );
        }
    });
});

isabelPool.on("connection", (connection) => {
    connection.query("SET time_zone = ?", [ISABEL_TIMEZONE], (err) => {
        if (err) {
            console.error(
                "No se pudo fijar time_zone en MySQL (db.multi.isabelPool):",
                err,
            );
        }
    });
});

inboundIsabelPool.on("connection", (connection) => {
    connection.query("SET time_zone = ?", [ISABEL_TIMEZONE], (err) => {
        if (err) {
            console.error(
                "No se pudo fijar time_zone en MySQL (db.multi.inboundIsabelPool):",
                err,
            );
        }
    });
});

callCenterPool.on("connection", (connection) => {
    connection.query("SET time_zone = ?", [CL_TIMEZONE], (err) => {
        if (err) {
            console.error(
                "No se pudo fijar time_zone en MySQL (db.multi.callCenterPool):",
                err,
            );
        }
    });
});

export { pool, isabelPool, inboundIsabelPool, callCenterPool };
