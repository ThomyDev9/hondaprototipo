import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const MYSQL_TIMEZONE =
    String(process.env.MYSQL_TIMEZONE || "-05:00").trim() || "-05:00";

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST, // MySQL host
    port: Number(process.env.MYSQL_PORT), // 3306
    user: process.env.MYSQL_USER,
    password: String(process.env.MYSQL_PASSWORD),
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8",
    timezone: MYSQL_TIMEZONE,
});

pool.on("connection", (connection) => {
    connection.query("SET time_zone = ?", [MYSQL_TIMEZONE], (err) => {
        if (err) {
            console.error("No se pudo fijar time_zone en MySQL (db.js):", err);
        }
    });
});

export default pool;
