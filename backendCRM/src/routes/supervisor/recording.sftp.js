import express from "express";
import SftpClient from "ssh2-sftp-client";
import path from "node:path";

const router = express.Router();

// Endpoint para descargar grabaciones por SFTP desde Issabel

// Permitir rutas relativas con subcarpetas (año/mes/día/archivo.wav)
import fs from "fs";

router.get("/*", async (req, res) => {
    const sftp = new SftpClient();
    const relativePath = req.params[0];
    const remotePath = `/var/spool/asterisk/monitor/${relativePath}`;
    const downloadName = relativePath.split("/").pop();

    // Extraer año, mes, día y archivo del path relativo
    // Esperado: 2026/03/17/archivo.wav
    const partes = relativePath.split("/");
    const [anio, mes, dia, ...resto] = partes;
    const archivo = resto.join("/");

    // Ruta local en red (Z: debe estar montado en el servidor Windows)
    let redPath = null;
    if (anio && mes && dia && archivo) {
        // Ejemplo: Z:\Grabaciones 2026\Elastix 40 out\03\17\archivo.wav
        redPath = `Z:\\Grabaciones ${anio}\\Elastix 40 out\\${mes}\\${dia}\\${archivo}`;
    }

    // 1. Intentar SFTP (Issabel)
    try {
        await sftp.connect({
            host: process.env.ISSABEL_HOST || "172.19.10.40",
            port: 5022,
            username: process.env.ISSABEL_SFTP_USER || "root",
            password: process.env.ISSABEL_SFTP_PASSWORD || "sIst2m1s2020.",
        });
        const exists = await sftp.exists(remotePath);
        if (exists) {
            let file;
            try {
                file = await sftp.get(remotePath);
            } catch (errGet) {
                await sftp.end();
                throw errGet;
            }
            res.setHeader("Content-Type", "audio/wav");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=\"${downloadName}\"`,
            );
            if (typeof file.pipe === "function") {
                let bytesSent = 0;
                file.on("data", (chunk) => {
                    bytesSent += chunk.length;
                });
                file.pipe(res);
                file.on("end", () => {
                    sftp.end();
                });
                file.on("error", (err) => {
                    sftp.end();
                    res.status(500).json({
                        error: "Error en la transmisión de la grabación",
                    });
                });
            } else {
                res.end(file);
                sftp.end();
            }
            return;
        } else {
            await sftp.end();
        }
    } catch (err) {
        // Si falla SFTP, intentar en red
        try {
            await sftp.end();
        } catch {}
        console.warn(
            `[SFTP] No encontrada en Issabel, probando en red: ${redPath}`,
        );
    }

    // 2. Intentar en carpeta de red
    if (redPath && fs.existsSync(redPath)) {
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=\"${downloadName}\"`,
        );
        const stream = fs.createReadStream(redPath);
        stream.pipe(res);
        stream.on("end", () => {
            console.log(`[RED] Descarga finalizada para: ${redPath}`);
        });
        stream.on("error", (err) => {
            console.error(`[RED] Error en stream:`, err);
            res.status(500).json({
                error: "Error en la transmisión de la grabación desde red",
            });
        });
        return;
    }

    // 3. No encontrada
    res.status(404).json({
        error: "Archivo no encontrado ni en Issabel ni en la carpeta de red",
        path: remotePath,
        redPath,
    });
});

export default router;
