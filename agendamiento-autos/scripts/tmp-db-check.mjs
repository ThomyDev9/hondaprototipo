import mysql from "mysql2/promise";

const tries = [
    { host: "host.docker.internal", port: 13306 },
    { host: "127.0.0.1", port: 13306 },
    { host: "localhost", port: 13306 },
    { host: "127.0.0.1", port: 3306 },
    { host: "localhost", port: 3306 },
];

for (const target of tries) {
    try {
        const connection = await mysql.createConnection({
            host: target.host,
            port: target.port,
            user: "kimobill",
            password: "sIst2m1s2020",
            database: "cck_dev",
            connectTimeout: 5000,
        });

        const [rows] = await connection.query("SELECT 1 AS ok");
        console.log("OK", target.host, target.port, rows);
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.log(
            "FAIL",
            target.host,
            target.port,
            error.code || error.message,
        );
    }
}

process.exit(1);
