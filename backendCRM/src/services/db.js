import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

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
});

export default pool;
