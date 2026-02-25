const net = require("net");

const LISTEN_HOST = process.env.PROXY_LISTEN_HOST || "0.0.0.0";
const LISTEN_PORT = Number(process.env.PROXY_LISTEN_PORT || 13306);
const TARGET_HOST = process.env.PROXY_TARGET_HOST || "172.19.10.78";
const TARGET_PORT = Number(process.env.PROXY_TARGET_PORT || 3306);

const server = net.createServer((clientSocket) => {
    const targetSocket = net.connect(TARGET_PORT, TARGET_HOST);

    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);

    const closeBoth = () => {
        try {
            clientSocket.destroy();
        } catch {}
        try {
            targetSocket.destroy();
        } catch {}
    };

    clientSocket.on("error", closeBoth);
    targetSocket.on("error", closeBoth);
    clientSocket.on("close", closeBoth);
    targetSocket.on("close", closeBoth);
});

server.on("error", (error) => {
    console.error("[mysql-proxy] Error:", error.message);
    process.exit(1);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
    console.log(
        `[mysql-proxy] Listening on ${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`,
    );
});
