import express from "express";
import multer from "multer";
import pool from "../services/db.js";
import { verificarToken } from "../utils/jwt.js";
import { desencriptar } from "../utils/crypto.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const TICKET_API = String(process.env.TICKET_API_URL || "").trim();
const TICKET_USER = String(process.env.TICKET_API_USER || "").trim();
const TICKET_PASSWORD = String(process.env.TICKET_API_PASSWORD || "").trim();
const TICKET_STATIC_TOKEN = String(process.env.TICKET_API_TOKEN || "").trim();

function getBearerTokenFromHeader(authorization = "") {
    const raw = String(authorization || "").trim();
    if (!raw.toLowerCase().startsWith("bearer ")) return "";
    return raw.slice(7).trim();
}

function getFirstValueByKeys(source = {}, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }
    return "";
}

async function resolveTicketCredentialsFromCrmToken(req) {
    const bearer = String(req.headers.authorization || "").trim();
    const crmJwt = getBearerTokenFromHeader(bearer);
    if (!crmJwt) return { username: "", password: "" };

    const verified = verificarToken(crmJwt);
    const userId = String(verified?.payload?.id || "").trim();
    if (!userId) return { username: "", password: "" };

    try {
        const [rows] = await pool.query(
            "SELECT * FROM user WHERE IdUser = ? LIMIT 1",
            [userId],
        );
        const user = rows?.[0] || null;
        if (!user) return { username: "", password: "" };

        const pqrsUser = getFirstValueByKeys(user, [
            "PqrsUser",
            "pqrs_user",
            "TicketApiUser",
            "ticket_api_user",
        ]);
        const rawPqrsPassword = getFirstValueByKeys(user, [
            "PqrsPassword",
            "pqrs_password",
            "TicketApiPassword",
            "ticket_api_password",
        ]);
        const pqrsPassword = rawPqrsPassword ? desencriptar(rawPqrsPassword) : "";
        return {
            username: pqrsUser,
            password: pqrsPassword,
        };
    } catch (error) {
        // Si aún no existen columnas PQRS, mantenemos fallback a .env
        console.log("[tickets-proxy] No se pudieron leer credenciales PQRS por usuario:", error.message);
        return { username: "", password: "" };
    }
}

function normalizeTokenFromLogin(payload) {
    const rawBase =
        typeof payload === "string"
            ? payload.trim()
            : String(
        payload?.access_token ||
            payload?.token ||
            payload?.jwt ||
            payload?.data?.access_token ||
            payload?.data?.token ||
            "",
              ).trim();

    const raw = rawBase.replace(/^"+|"+$/g, "").trim();
    return raw.toLowerCase().startsWith("bearer ")
        ? raw.slice(7).trim().replace(/^"+|"+$/g, "").trim()
        : raw;
}

function parseTextPayload(text = "") {
    const normalized = String(text || "");
    try {
        return normalized ? JSON.parse(normalized) : null;
    } catch {
        return normalized || null;
    }
}

function buildUpstreamAuthHeaders(token = "", asBearer = true) {
    const safe = String(token || "").trim().replace(/^"+|"+$/g, "");
    return {
        Authorization: asBearer ? `Bearer ${safe}` : safe,
        "x-access-token": safe,
        token: safe,
    };
}

async function fetchWithAuthRetry(url, options = {}, token = "") {
    const first = await fetch(url, {
        ...options,
        headers: {
            ...buildUpstreamAuthHeaders(token, true),
            ...(options.headers || {}),
        },
    });
    const firstText = await first.text();
    const firstJson = parseTextPayload(firstText);
    if (first.ok) {
        return { resp: first, data: firstJson, rawText: firstText };
    }

    const firstDetail = String(firstJson?.detail || firstJson?.message || "").toLowerCase();
    if (!firstDetail.includes("token")) {
        return { resp: first, data: firstJson, rawText: firstText };
    }

    const second = await fetch(url, {
        ...options,
        headers: {
            ...buildUpstreamAuthHeaders(token, false),
            ...(options.headers || {}),
        },
    });
    const secondText = await second.text();
    const secondJson = parseTextPayload(secondText);
    return { resp: second, data: secondJson, rawText: secondText };
}

async function upstreamGetWithToken(path, token) {
    return fetchWithAuthRetry(`${TICKET_API}${path}`, { method: "GET" }, token);
}

async function upstreamPostWithToken(path, body, token) {
    return fetchWithAuthRetry(
        `${TICKET_API}${path}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {}),
        },
        token,
    );
}

async function loginTicketApi(credentials = {}) {
    if (!TICKET_API) {
        return {
            ok: false,
            status: 500,
            json: { detail: "Falta TICKET_API_URL en backendCRM/.env" },
        };
    }

    const username = String(credentials?.username || TICKET_USER).trim();
    const password = String(credentials?.password || TICKET_PASSWORD).trim();
    const payload = { username, password };
    const resp = await fetch(`${TICKET_API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    let parsed = null;
    try {
        parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
        parsed = rawText || null;
    }

    const authHeader = String(resp.headers.get("authorization") || "").trim();
    const tokenFromHeader = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
    const token = normalizeTokenFromLogin(parsed) || tokenFromHeader;
    return {
        ok: resp.ok,
        status: resp.status,
        token,
        json: parsed,
    };
}

async function resolveProxyToken(req) {
    if (TICKET_STATIC_TOKEN) {
        return { ok: true, token: TICKET_STATIC_TOKEN };
    }

    const userCredentials = await resolveTicketCredentialsFromCrmToken(req);
    const login = await loginTicketApi(userCredentials);
    if (!login.ok || !login.token) {
        return {
            ok: false,
            status: login.status || 401,
            json: login.json || { detail: "No se pudo autenticar con API tickets." },
        };
    }
    return { ok: true, token: login.token };
}

// POST /tickets-proxy/login
router.post("/login", async (req, res) => {
    try {
        const fallbackCredentials = await resolveTicketCredentialsFromCrmToken(req);
        const username = String(
            req.body?.username || fallbackCredentials.username || TICKET_USER,
        ).trim();
        const password = String(
            req.body?.password || fallbackCredentials.password || TICKET_PASSWORD,
        ).trim();

        const r = await fetch(`${TICKET_API}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        const text = await r.text();
        const data = parseTextPayload(text);
        return res.status(r.status).json(data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

// GET /tickets-proxy/catalogs?page=1&limit=500
router.get("/catalogs", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok) {
            return res.status(tokenResult.status || 401).json(tokenResult.json);
        }
        if (!tokenResult.token) {
            return res.status(401).json({ detail: "Token is missing" });
        }

        const { page = 1, limit = 500 } = req.query;
        const endpoints = [
            `${TICKET_API}/api/catalog?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
            `${TICKET_API}/api/catalog_page`,
            `${TICKET_API}/api/catalog/ticket`,
        ];

        // Intento 1: GET /api/catalog
        const r1Result = await fetchWithAuthRetry(
            endpoints[0],
            {
            method: "GET",
            },
            tokenResult.token,
        );
        if (r1Result.resp.ok) {
            return res.status(r1Result.resp.status).json(r1Result.data);
        }

        // Intento 2: POST /api/catalog_page
        const r2Result = await fetchWithAuthRetry(
            endpoints[1],
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: Number(page) || 1,
                    limit: Number(limit) || 500,
                }),
            },
            tokenResult.token,
        );
        if (r2Result.resp.ok) {
            return res.status(r2Result.resp.status).json(r2Result.data);
        }

        // Intento 3: POST /api/catalog/ticket
        const r3Result = await fetchWithAuthRetry(
            endpoints[2],
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            },
            tokenResult.token,
        );
        return res.status(r3Result.resp.status).json(r3Result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

// POST /tickets-proxy/tickets  (multipart: ticket + files[])
router.post("/tickets", upload.array("files"), async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok) {
            return res.status(tokenResult.status || 401).json(tokenResult.json);
        }
        if (!tokenResult.token) {
            return res.status(401).json({ detail: "Token is missing" });
        }

        const rawTicket = req.body?.ticket;
        let parsedTicket = {};
        if (rawTicket && typeof rawTicket === "object") {
            parsedTicket = rawTicket;
        } else if (typeof rawTicket === "string" && rawTicket.trim()) {
            try {
                parsedTicket = JSON.parse(rawTicket);
            } catch {
                parsedTicket = {};
            }
        }

        const files = req.files || [];
        console.log("[VisionFund Debug][Proxy] /tickets received", {
            hasRawTicket: rawTicket !== undefined,
            rawTicketType: typeof rawTicket,
            filesCount: files.length,
            parsedTicket,
        });

        // Prefer JSON when there are no files. Some upstream validators expect a dict in body.
        if (files.length === 0) {
            const directJsonResult = await upstreamPostWithToken(
                "/api/ticket",
                parsedTicket,
                tokenResult.token,
            );
            console.log("[VisionFund Debug][Proxy] upstream direct JSON result", {
                status: directJsonResult?.resp?.status,
                ok: directJsonResult?.resp?.ok,
                data: directJsonResult?.data,
            });
            if (directJsonResult.resp.ok) {
                res.status(directJsonResult.resp.status);
                res.set(
                    "Content-Type",
                    directJsonResult.resp.headers.get("content-type") ||
                        "application/json",
                );
                return res.send(
                    directJsonResult.rawText ??
                        JSON.stringify(directJsonResult.data ?? {}),
                );
            }

            const wrappedJsonResult = await upstreamPostWithToken(
                "/api/ticket",
                { ticket: parsedTicket },
                tokenResult.token,
            );
            console.log("[VisionFund Debug][Proxy] upstream wrapped JSON result", {
                status: wrappedJsonResult?.resp?.status,
                ok: wrappedJsonResult?.resp?.ok,
                data: wrappedJsonResult?.data,
            });
            if (wrappedJsonResult.resp.ok) {
                res.status(wrappedJsonResult.resp.status);
                res.set(
                    "Content-Type",
                    wrappedJsonResult.resp.headers.get("content-type") ||
                        "application/json",
                );
                return res.send(
                    wrappedJsonResult.rawText ??
                        JSON.stringify(wrappedJsonResult.data ?? {}),
                );
            }
        }

        const fd = new FormData();
        fd.append("ticket", JSON.stringify(parsedTicket || {}));
        for (const f of files) {
            const blob = new Blob([f.buffer], { type: f.mimetype });
            fd.append("files", blob, f.originalname || "archivo");
        }

        const ticketResult = await fetchWithAuthRetry(
            `${TICKET_API}/api/ticket`,
            {
            method: "POST",
            body: fd,
        },
            tokenResult.token,
        );
        console.log("[VisionFund Debug][Proxy] upstream multipart result", {
            status: ticketResult?.resp?.status,
            ok: ticketResult?.resp?.ok,
            data: ticketResult?.data,
        });
        res.status(ticketResult.resp.status);
        res.set(
            "Content-Type",
            ticketResult.resp.headers.get("content-type") || "application/json",
        );
        return res.send(
            ticketResult.rawText ?? JSON.stringify(ticketResult.data ?? {}),
        );
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/client/:clientIdentification", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }

        const identification = encodeURIComponent(
            String(req.params?.clientIdentification || "").trim(),
        );
        const result = await fetchWithAuthRetry(
            `${TICKET_API}/api/client/${identification}`,
            { method: "GET" },
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.post("/client", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamPostWithToken(
            "/api/client",
            req.body || {},
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.post("/mail/create/:ticketId", async (req, res) => {
    try {
        const ticketId = String(req.params?.ticketId || "").trim();
        let auth = String(req.headers.authorization || "").trim();
        if (!auth) {
            const tokenResult = await resolveProxyToken(req);
            if (!tokenResult.ok || !tokenResult.token) {
                return res.status(tokenResult.status || 401).json(
                    tokenResult.json || { detail: "Token is missing" },
                );
            }
            auth = `Bearer ${String(tokenResult.token || "").trim()}`;
        }

        const upstreamResp = await fetch(
            `${TICKET_API}/api/mail/create/${encodeURIComponent(ticketId)}`,
            {
                method: "POST",
            headers: {
                    Authorization: auth,
                },
            },
        );
        const rawText = await upstreamResp.text();
        console.log("[Proxy][mail/create] upstream", {
            ticketId,
            status: upstreamResp.status,
            ok: upstreamResp.ok,
            body: rawText,
        });
        res.status(upstreamResp.status);
        res.set(
            "Content-Type",
            upstreamResp.headers.get("content-type") || "application/json",
        );
        return res.send(rawText);
    } catch (e) {
        console.error("[Proxy][mail/create] error", e);
        return res
            .status(500)
            .json({ detail: "Proxy mail error", error: String(e) });
    }
});

router.get("/validate_token", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamGetWithToken(
            "/api/validate_token",
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/type", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamGetWithToken("/api/type", tokenResult.token);
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/catalog/type/:typeId", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const typeId = encodeURIComponent(String(req.params?.typeId || "").trim());
        const result = await upstreamGetWithToken(
            `/api/catalog/type/${typeId}`,
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.post("/catalog/top_product", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamPostWithToken(
            "/api/catalog/top_product",
            req.body || {},
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.post("/catalog/product", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamPostWithToken(
            "/api/catalog/product",
            req.body || {},
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.post("/catalog/ticket", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamPostWithToken(
            "/api/catalog/ticket",
            req.body || {},
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.post("/ticket_location", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamPostWithToken(
            "/api/ticket_location",
            req.body || {},
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/canal_type", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamGetWithToken("/api/canal_type", tokenResult.token);
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/canal", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamGetWithToken("/api/canal", tokenResult.token);
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/agencia", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const firstTry = await upstreamGetWithToken("/api/agencia", tokenResult.token);
        if (firstTry.resp.ok) {
            return res.status(firstTry.resp.status).json(firstTry.data);
        }
        const secondTry = await upstreamGetWithToken("/api/agency", tokenResult.token);
        return res.status(secondTry.resp.status).json(secondTry.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/province", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const result = await upstreamGetWithToken("/api/province", tokenResult.token);
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

router.get("/canton/:provinceId", async (req, res) => {
    try {
        const tokenResult = await resolveProxyToken(req);
        if (!tokenResult.ok || !tokenResult.token) {
            return res.status(tokenResult.status || 401).json(
                tokenResult.json || { detail: "Token is missing" },
            );
        }
        const provinceId = encodeURIComponent(String(req.params?.provinceId || "").trim());
        const result = await upstreamGetWithToken(
            `/api/canton/${provinceId}`,
            tokenResult.token,
        );
        return res.status(result.resp.status).json(result.data);
    } catch (e) {
        return res.status(500).json({ detail: e.message });
    }
});

export default router;
