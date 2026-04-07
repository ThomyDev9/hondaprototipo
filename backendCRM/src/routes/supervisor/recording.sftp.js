import express from "express";
import SftpClient from "ssh2-sftp-client";
import fs from "fs";

const router = express.Router();

function buildNetworkFallbackPaths(relativePath) {
    const partes = String(relativePath || "").split("/");
    const [anio, mes, dia, ...resto] = partes;
    const archivo = resto.join("/");

    if (!anio || !mes || !dia || !archivo) {
        return [];
    }

    const networkRoot =
        process.env.RECORDINGS_NETWORK_ROOT || `Z:\\Grabaciones ${anio}`;
    const folderCandidates = [
        process.env.RECORDINGS_INBOUND_FOLDER,
        "Elastix 40 in",
        "Elastix 40 inbound",
        process.env.RECORDINGS_OUTBOUND_FOLDER,
        "Elastix 40 out",
        "Elastix 40 outbound",
    ].filter(Boolean);

    return Array.from(
        new Set(
            folderCandidates.map(
                (folder) =>
                    `${networkRoot}\\${folder}\\${mes}\\${dia}\\${archivo}`,
            ),
        ),
    );
}

function buildRemotePathCandidates(relativePath) {
    const normalizedRelativePath = String(relativePath || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    const remoteRoot = String(
        process.env.ISSABEL_RECORDINGS_ROOT || "/var/spool/asterisk/monitor",
    )
        .replace(/\\/g, "/")
        .replace(/\/+$/, "");

    return Array.from(
        new Set(
            [
                `${remoteRoot}/${normalizedRelativePath}`,
                normalizedRelativePath,
                `/${normalizedRelativePath}`,
            ].filter(Boolean),
        ),
    );
}

function getSftpConfig(flow = "") {
    const normalizedFlow = String(flow || "").trim().toLowerCase();
    const isInbound = normalizedFlow === "inbound";

    if (isInbound) {
        return {
            host:
                process.env.INBOUND_ISSABEL_HOST ||
                process.env.CL_HOST ||
                process.env.ISSABEL_HOST ||
                "172.19.10.44",
            port: Number(
                process.env.INBOUND_ISSABEL_SFTP_PORT ||
                    process.env.CL_SFTP_PORT ||
                    process.env.ISSABEL_SFTP_PORT ||
                    5022,
            ),
            username:
                process.env.INBOUND_ISSABEL_SFTP_USER ||
                process.env.CL_SFTP_USER ||
                process.env.ISSABEL_SFTP_USER ||
                "root",
            password:
                process.env.INBOUND_ISSABEL_SFTP_PASSWORD ||
                process.env.CL_SFTP_PASSWORD ||
                process.env.ISSABEL_SFTP_PASSWORD ||
                "sIst2m1s2020.",
        };
    }

    return {
        host: process.env.ISSABEL_HOST || "172.19.10.40",
        port: Number(process.env.ISSABEL_SFTP_PORT || 5022),
        username: process.env.ISSABEL_SFTP_USER || "root",
        password: process.env.ISSABEL_SFTP_PASSWORD || "sIst2m1s2020.",
    };
}

router.get("/*", async (req, res) => {
    const sftp = new SftpClient();
    const relativePath = req.params[0];
    const flow = String(req.query.flow || "").trim().toLowerCase();
    const remotePaths = buildRemotePathCandidates(relativePath);
    const remotePath = remotePaths[0];
    const downloadName = String(relativePath || "").split("/").pop();
    const redPaths = buildNetworkFallbackPaths(relativePath);
    const sftpConfig = getSftpConfig(flow);

    try {
        await sftp.connect(sftpConfig);

        let file = null;
        let matchedRemotePath = "";

        for (const candidatePath of remotePaths) {
            let exists = false;
            try {
                const existsResult = await sftp.exists(candidatePath);
                exists = Boolean(existsResult);
                console.log(
                    `[SFTP] exists(${candidatePath}) => ${String(existsResult)}`,
                );
            } catch (existsErr) {
                console.warn(
                    `[SFTP] exists fallo para ${candidatePath}: ${existsErr.message}`,
                );
            }

            if (exists) {
                try {
                    file = await sftp.get(candidatePath);
                    matchedRemotePath = candidatePath;
                    break;
                } catch (getErr) {
                    console.warn(
                        `[SFTP] get fallo para ${candidatePath}: ${getErr.message}`,
                    );
                }
            }

            try {
                const parentPath = candidatePath.substring(
                    0,
                    candidatePath.lastIndexOf("/"),
                );
                const listedFiles = await sftp.list(parentPath);
                const matched = listedFiles.find(
                    (item) => String(item?.name || "") === downloadName,
                );

                if (matched) {
                    console.log(
                        `[SFTP] Archivo encontrado por list() en ${parentPath}: ${downloadName}`,
                    );
                    file = await sftp.get(candidatePath);
                    matchedRemotePath = candidatePath;
                    break;
                }
            } catch (listErr) {
                console.warn(
                    `[SFTP] list fallo para ${candidatePath}: ${listErr.message}`,
                );
            }

            try {
                file = await sftp.get(candidatePath);
                matchedRemotePath = candidatePath;
                console.log(
                    `[SFTP] Descarga directa exitosa con ${candidatePath}`,
                );
                break;
            } catch (directGetErr) {
                console.warn(
                    `[SFTP] get directo fallo para ${candidatePath}: ${directGetErr.message}`,
                );
            }
        }

        if (file) {
            console.log(`[SFTP] Usando ruta remota: ${matchedRemotePath}`);

            res.setHeader("Content-Type", "audio/wav");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${downloadName}"`,
            );

            if (typeof file.pipe === "function") {
                file.pipe(res);
                file.on("end", () => {
                    sftp.end();
                });
                file.on("error", () => {
                    sftp.end();
                    res.status(500).json({
                        error: "Error en la transmision de la grabacion",
                    });
                });
            } else {
                res.end(file);
                await sftp.end();
            }
            return;
        }

        await sftp.end();
    } catch (err) {
        try {
            await sftp.end();
        } catch {}
        console.warn(
            `[SFTP] Error descargando ${remotePath} en ${sftpConfig.host}:${sftpConfig.port} con ${sftpConfig.username}: ${err.message}`,
        );
        console.warn(
            `[SFTP] No encontrada en Issabel, probando en red: ${redPaths.join(" | ")}`,
        );
    }

    for (const redPath of redPaths) {
        if (!fs.existsSync(redPath)) {
            continue;
        }

        res.setHeader("Content-Type", "audio/wav");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${downloadName}"`,
        );
        const stream = fs.createReadStream(redPath);
        stream.pipe(res);
        stream.on("end", () => {
            console.log(`[RED] Descarga finalizada para: ${redPath}`);
        });
        stream.on("error", (streamErr) => {
            console.error("[RED] Error en stream:", streamErr);
            res.status(500).json({
                error: "Error en la transmision de la grabacion desde red",
            });
        });
        return;
    }

    res.status(404).json({
        error: "Archivo no encontrado ni en Issabel ni en la carpeta de red",
        path: remotePath,
        remotePaths,
        redPaths,
    });
});

export default router;
