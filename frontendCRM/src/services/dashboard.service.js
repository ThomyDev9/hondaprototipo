const API_BASE = import.meta.env.VITE_API_BASE;
const TICKET_API_URL =
    import.meta.env.VITE_TICKET_API_URL ||
    "http://192.168.1.83:2000/api";
const TICKET_API_LOGIN_PATH =
    import.meta.env.VITE_TICKET_API_LOGIN_PATH || "login";
const TICKET_API_USE_CREDENTIALS =
    String(import.meta.env.VITE_TICKET_API_USE_CREDENTIALS || "0").trim() ===
    "1";
const TICKET_API_USER = import.meta.env.VITE_TICKET_API_USER || "";
const TICKET_API_PASSWORD = import.meta.env.VITE_TICKET_API_PASSWORD || "";
const TICKET_API_STATIC_TOKEN = import.meta.env.VITE_TICKET_API_TOKEN || "";
const TICKET_API_CATALOGS_PATH =
    import.meta.env.VITE_TICKET_API_CATALOGS_PATH || "catalog";
const TICKET_API_TOKEN_STORAGE_KEY = "ticket_api_token";
const IS_TICKETS_PROXY = /\/tickets-proxy\/?$/i.test(TICKET_API_URL);

const getAuthToken = () => localStorage.getItem("access_token") || "";

const buildHeaders = (additional = {}) => {
    const token = getAuthToken();
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...additional,
    };
};

const request = async (path, options = {}) => {
    const resp = await fetch(`${API_BASE}/${path}`, {
        ...options,
        headers: buildHeaders(options.headers || {}),
    });
    let json;
    let text = "";
    try {
        text = await resp.text();
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = text || null;
        }
    } catch {
        json = null;
    }
    return {
        status: resp.status,
        ok: resp.ok,
        json,
        text,
        response: resp,
    };
};

const getTicketApiToken = () =>
    String(
        TICKET_API_STATIC_TOKEN ||
            localStorage.getItem(TICKET_API_TOKEN_STORAGE_KEY) ||
            "",
    ).trim();

const setTicketApiToken = (token = "") => {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) return;
    localStorage.setItem(TICKET_API_TOKEN_STORAGE_KEY, normalizedToken);
};

const extractTicketToken = (json = null) => {
    if (typeof json === "string") {
        return String(json || "").trim();
    }

    return String(
        json?.access_token ||
            json?.token ||
            json?.jwt ||
            json?.data?.access_token ||
            json?.data?.token ||
            json?.result?.access_token ||
            json?.result?.token ||
            "",
    ).trim();
};

const loginTicketApi = async () => {
    const username = String(TICKET_API_USER || "").trim();
    const password = String(TICKET_API_PASSWORD || "").trim();

    if (!username || !password) {
        return {
            ok: false,
            status: 400,
            json: {
                detail: "Faltan VITE_TICKET_API_USER y VITE_TICKET_API_PASSWORD.",
            },
        };
    }

    const payloadCandidates = [
        { username, password },
        { user: username, password },
        { email: username, password },
    ];

    let lastResponse = null;
    for (const payload of payloadCandidates) {
        const resp = await fetch(`${TICKET_API_URL}/${TICKET_API_LOGIN_PATH}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: TICKET_API_USE_CREDENTIALS ? "include" : "omit",
            body: JSON.stringify(payload),
        });

        let json = null;
        let rawText = "";
        try {
            rawText = await resp.text();
            try {
                json = rawText ? JSON.parse(rawText) : null;
            } catch {
                json = rawText || null;
            }
        } catch {
            json = null;
        }

        const authHeader = String(resp.headers.get("authorization") || "").trim();
        const tokenFromHeader = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
        const receivedToken = extractTicketToken(json) || tokenFromHeader;

        if (resp.ok && receivedToken) {
            setTicketApiToken(receivedToken);
        }

        lastResponse = {
            status: resp.status,
            ok: resp.ok,
            json,
            response: resp,
        };

        if (resp.ok) {
            return lastResponse;
        }
    }

    return (
        lastResponse || {
            status: 500,
            ok: false,
            json: { detail: "No se pudo autenticar en API de tickets." },
        }
    );
};

const buildTicketAuthHeaders = (token = "") => {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) {
        return {};
    }
    return { Authorization: `Bearer ${normalizedToken}` };
};

const requestTicketApi = async (path, options = {}) => {
    if (IS_TICKETS_PROXY) {
        const resp = await fetch(`${TICKET_API_URL}/${path}`, {
            ...options,
            credentials: TICKET_API_USE_CREDENTIALS ? "include" : "omit",
            headers: {
                ...buildHeaders(),
                ...(options.headers || {}),
            },
        });
        let json = null;
        let text = "";
        try {
            text = await resp.text();
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                json = text || null;
            }
        } catch {
            json = null;
        }
        return {
            status: resp.status,
            ok: resp.ok,
            json,
            text,
            response: resp,
        };
    }

    let token = getTicketApiToken();
    if (!token) {
        const loginResp = await loginTicketApi();
        if (!loginResp.ok) {
            return loginResp;
        }
        token = getTicketApiToken();
        if (!token) {
            return {
                ok: false,
                status: 401,
                json: {
                    detail: "No se obtuvo token del login del API de tickets.",
                    login_response: loginResp?.json || null,
                },
            };
        }
    }

    const makeRequest = async (authToken) => {
        const resp = await fetch(`${TICKET_API_URL}/${path}`, {
            ...options,
            credentials: TICKET_API_USE_CREDENTIALS ? "include" : "omit",
            headers: {
                ...buildTicketAuthHeaders(authToken),
                ...(options.headers || {}),
            },
        });
        let json = null;
        let text = "";
        try {
            text = await resp.text();
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                json = text || null;
            }
        } catch {
            json = null;
        }
        return {
            status: resp.status,
            ok: resp.ok,
            json,
            text,
            response: resp,
        };
    };

    let response = await makeRequest(token);
    if (response.status === 401) {
        const reloginResp = await loginTicketApi();
        if (!reloginResp.ok) {
            return response;
        }
        response = await makeRequest(getTicketApiToken());
    }

    return response;
};

export const fetchActiveBasesSummary = () =>
    request("agente/bases-activas-resumen");

export const fetchRegestionBasesSummary = () =>
    request("agente/bases-regestion-resumen");

export const releaseRegistro = (registroId) =>
    request("agente/liberar-registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registro_id: registroId }),
    });

export const updatePhoneStatus = (payload) =>
    request("agente/update-phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const fetchPhoneLastStatus = (contactId, telefono) =>
    request(
        `agente/ultimo-estado-telefono?contactId=${encodeURIComponent(
            contactId,
        )}&telefono=${encodeURIComponent(telefono)}`,
    );

export const fetchNextRegistro = ({ campaignId, importId, tabSessionId }) =>
    request("agente/siguiente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, importId, tabSessionId }),
    });

export const fetchFormCatalogos = ({
    campaignId,
    contactId = "",
    categoryId = "",
    menuItemId = "",
}) =>
    request(
        `agente/form-catalogos?campaignId=${encodeURIComponent(
            campaignId,
        )}&contactId=${encodeURIComponent(
            contactId,
        )}&categoryId=${encodeURIComponent(
            categoryId,
        )}&menuItemId=${encodeURIComponent(menuItemId)}`,
    );

export const fetchFormTemplates = ({ campaignId }) =>
    request(
        `agente/form-templates?campaignId=${encodeURIComponent(campaignId)}`,
    );

export const changeAgentStatus = ({
    estado,
    registroId,
    tabSessionId = "",
    agentNumber = "",
}) =>
    request("agente/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            estado,
            registro_id: registroId,
            tabSessionId,
            agentNumber,
        }),
    });

export const fetchAgentStatusOptions = () => request("agente/estados-agente");

export const fetchAgentSessionContext = (sessionId) =>
    request(
        `agente/session-context?sessionId=${encodeURIComponent(
            String(sessionId || "").trim(),
        )}`,
    );

export const fetchAgentMachineContext = (tokenOverride = "") =>
    (async () => {
        const authorizationToken = String(tokenOverride || "").trim();
        const authHeader = authorizationToken
            ? { Authorization: `Bearer ${authorizationToken}` }
            : {};

        const proxiedResponse = await request("agente/machine-context", {
            headers: authHeader,
        });

        const proxiedCode = String(
            proxiedResponse?.json?.data?.mappedZoiperCode || "",
        ).trim();
        if (proxiedResponse?.ok && proxiedCode) {
            return proxiedResponse;
        }

        // Fallback directo al backend para capturar IP real de la maquina cuando
        // el proxy devuelve una IP intermedia (docker/nginx).
        const directBaseFromEnv = String(
            import.meta.env.VITE_MACHINE_CONTEXT_DIRECT_BASE || "",
        ).trim();
        const directPort = String(
            import.meta.env.VITE_MACHINE_CONTEXT_DIRECT_PORT || "4005",
        ).trim();
        const currentHost =
            typeof window !== "undefined"
                ? String(window.location?.hostname || "").trim()
                : "";
        const isLocalHost =
            currentHost === "localhost" || currentHost === "127.0.0.1";
        const isPrivateIpv4 =
            /^10\./.test(currentHost) ||
            /^192\.168\./.test(currentHost) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(currentHost);
        const allowPublicDirectFallback =
            String(
                import.meta.env.VITE_MACHINE_CONTEXT_DIRECT_ALLOW_PUBLIC || "",
            ).trim() === "1";
        const shouldTryDirectFallback =
            isLocalHost || isPrivateIpv4 || allowPublicDirectFallback;

        const directBase =
            directBaseFromEnv ||
            (currentHost
                ? `${window.location.protocol}//${currentHost}:${directPort}`
                : "");

        if (!directBase || !shouldTryDirectFallback) {
            return proxiedResponse;
        }

        try {
            const directResp = await fetch(
                `${directBase}/agente/machine-context`,
                {
                    method: "GET",
                    headers: buildHeaders(authHeader),
                },
            );
            let directJson = null;
            try {
                directJson = await directResp.json();
            } catch {
                directJson = null;
            }

            return {
                status: directResp.status,
                ok: directResp.ok,
                json: directJson,
                response: directResp,
            };
        } catch {
            return proxiedResponse;
        }
    })();

export const startAgentSession = ({ sessionId, agentNumber = "" }) =>
    request("agente/session-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, agentNumber }),
    });

export const endAgentSession = ({ sessionId, agentNumber = "" }) =>
    request("agente/session-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, agentNumber }),
    });

export const upsertAgentSessionContext = ({
    sessionId,
    estado = "",
    agentNumber = "",
}) =>
    request("agente/session-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, estado, agentNumber }),
    });

export const guardarGestion = (payload) =>
    request("agente/guardar-gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const guardarGestionInbound = (payload) =>
    request("agente/guardar-gestion-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const guardarGestionRedes = (payload) =>
    request("agente/guardar-gestion-redes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const fetchInboundClientByIdentification = ({
    identification,
    campaignId = "",
}) =>
    request(
        `agente/buscar-cliente-inbound?identification=${encodeURIComponent(
            identification,
        )}&campaignId=${encodeURIComponent(campaignId)}`,
    );

export const fetchRedesClientByIdentification = ({
    identification,
    campaignId = "",
}) =>
    request(
        `agente/buscar-cliente-redes?identification=${encodeURIComponent(
            identification,
        )}&campaignId=${encodeURIComponent(campaignId)}`,
    );

export const fetchInboundCurrentCall = ({ agentNumber }) =>
    request(
        `agente/inbound-current-call?agentNumber=${encodeURIComponent(
            String(agentNumber || "").trim(),
        )}`,
    );

export const fetchInboundHistoricoClientes = ({ campaignId }) =>
    request(
        `agente/inbound-historico-clientes?campaignId=${encodeURIComponent(
            String(campaignId || "").trim(),
        )}`,
    );

export const fetchInboundHistorico = ({
    campaignId,
    advisor = "",
    clientName = "",
    searchText = "",
    startDate = "",
    endDate = "",
}) =>
    request(
        `agente/inbound-historico?campaignId=${encodeURIComponent(
            String(campaignId || "").trim(),
        )}&advisor=${encodeURIComponent(
            String(advisor || "").trim(),
        )}&clientName=${encodeURIComponent(
            String(clientName || "").trim(),
        )}&searchText=${encodeURIComponent(
            String(searchText || "").trim(),
        )}&startDate=${encodeURIComponent(
            String(startDate || "").trim(),
        )}&endDate=${encodeURIComponent(String(endDate || "").trim())}`,
    );

export const fetchInboundCorrectionContext = ({ gestionId }) =>
    request(
        `agente/inbound-correccion-contexto?gestionId=${encodeURIComponent(
            String(gestionId || "").trim(),
        )}`,
    );

export const saveInboundCorrection = ({ gestionId, interactionDetails }) =>
    request("agente/guardar-correccion-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            gestionId,
            interactionDetails,
        }),
    });

export const fetchInboundMissingCalls = ({
    startDate = "",
    endDate = "",
    limit = 1200,
} = {}) =>
    request(
        `supervisor/llamadas-inbound-sin-gestion?startDate=${encodeURIComponent(
            String(startDate || "").trim(),
        )}&endDate=${encodeURIComponent(
            String(endDate || "").trim(),
        )}&limit=${encodeURIComponent(String(limit || "").trim())}`,
    );

export const fetchInboundUnregisteredByAdvisor = ({
    startDate = "",
    endDate = "",
    scope = "todo",
    limit = 1200,
} = {}) =>
    request(
        `supervisor/inbound-no-registradas?startDate=${encodeURIComponent(
            String(startDate || "").trim(),
        )}&endDate=${encodeURIComponent(
            String(endDate || "").trim(),
        )}&scope=${encodeURIComponent(
            String(scope || "todo")
                .trim()
                .toLowerCase(),
        )}&limit=${encodeURIComponent(String(limit || "").trim())}`,
    );

export const fetchInboundUnregisteredMine = ({
    startDate = "",
    endDate = "",
    scope = "todo",
    limit = 1200,
} = {}) =>
    request(
        `supervisor/inbound-no-registradas-mias?startDate=${encodeURIComponent(
            String(startDate || "").trim(),
        )}&endDate=${encodeURIComponent(
            String(endDate || "").trim(),
        )}&scope=${encodeURIComponent(
            String(scope || "todo")
                .trim()
                .toLowerCase(),
        )}&limit=${encodeURIComponent(String(limit || "").trim())}`,
    );

export const fetchSupervisorActiveAdvisors = () =>
    request("supervisor/asesores-activos");

export const assignInboundUnregisteredAdvisor = ({
    uniqueid = "",
    recordingfile = "",
    managementDateTime = "",
    advisorUserId = "",
    advisorName = "",
    advisorZoiper = "",
    notes = "",
} = {}) =>
    request("supervisor/inbound-no-registradas/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            uniqueid: String(uniqueid || "").trim(),
            recordingfile: String(recordingfile || "").trim(),
            managementDateTime: String(managementDateTime || "").trim(),
            advisorUserId:
                String(advisorUserId || "").trim() === ""
                    ? null
                    : Number(advisorUserId),
            advisorName: String(advisorName || "").trim(),
            advisorZoiper: String(advisorZoiper || "").trim(),
            notes: String(notes || "").trim(),
        }),
    });

export const runInboundGhostDepuration = ({
    startDate = "",
    endDate = "",
    thresholdSeconds = 40,
    limit = 5000,
} = {}) =>
    request("supervisor/depuracion-inbound-fantasma/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            startDate: String(startDate || "").trim(),
            endDate: String(endDate || "").trim(),
            thresholdSeconds: Number(thresholdSeconds) || 40,
            limit: Number(limit) || 5000,
        }),
    });

export const uploadInboundImages = (formData) =>
    request("agente/upload-inbound-images", {
        method: "POST",
        body: formData,
    });

export const sendInboundEmail = (formData) =>
    request("agente/send-inbound-email", {
        method: "POST",
        body: formData,
    });

export const guardarGestionOutbound = (payload) =>
    request("agente/guardar-gestion-outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const fetchGestionOutboundByIdentification = ({
    campaignId,
    identification,
}) =>
    request(
        `agente/buscar-gestion-outbound?campaignId=${encodeURIComponent(
            campaignId,
        )}&identification=${encodeURIComponent(identification)}`,
    );

export const fetchOutboundClientByIdentification = ({
    campaignId = "",
    identification,
}) =>
    request(
        `agente/buscar-cliente-outbound?campaignId=${encodeURIComponent(
            campaignId,
        )}&identification=${encodeURIComponent(identification)}`,
    );

export const fetchOutMaquitaDocumentos = ({ campaignId }) =>
    request(
        `agente/out-maquita-documentos?campaignId=${encodeURIComponent(
            campaignId,
        )}`,
    );

export const fetchOutMaquitaDocumentosSeguimiento = ({ campaignId }) =>
    request(
        `agente/out-maquita-documentos-seguimiento?campaignId=${encodeURIComponent(
            campaignId,
        )}`,
    );

export const guardarOutMaquitaDocumentosSeguimiento = (payload) =>
    request("agente/guardar-out-maquita-documentos-seguimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const guardarOutMaquitaDocumentos = (formData) =>
    request("agente/guardar-out-maquita-documentos", {
        method: "POST",
        body: formData,
    });

export const fetchTicketCatalogs = async ({ page = 1, limit = 500 } = {}) => {
    if (IS_TICKETS_PROXY) {
        return requestTicketApi(
            `catalogs?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
            { method: "GET" },
        );
    }

    const queryCandidates = [
        `page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,
        `pageNumber=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(
            limit,
        )}`,
        `offset=${encodeURIComponent(
            (Number(page) - 1) * Number(limit),
        )}&limit=${encodeURIComponent(limit)}`,
        `limit=${encodeURIComponent(limit)}`,
        "",
    ];
    const configuredPath = String(TICKET_API_CATALOGS_PATH || "catalog").trim();
    const candidatePaths = [configuredPath].filter(Boolean);

    let lastResponse = null;
    for (const path of [...new Set(candidatePaths)]) {
        for (const query of queryCandidates) {
            const endpoint = query ? `${path}?${query}` : path;
            const response = await requestTicketApi(endpoint, {
                method: "GET",
            });
            lastResponse = response;
            if (response.ok) {
                return response;
            }
            if (response.status !== 404 && response.status !== 400) {
                return response;
            }
        }
    }

    // Swagger indica un endpoint específico para catálogo de tickets.
    const catalogTicketResp = await requestTicketApi("catalog/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    if (catalogTicketResp.ok) {
        return catalogTicketResp;
    }
    lastResponse = catalogTicketResp;

    return lastResponse || {
        ok: false,
        status: 404,
        json: { detail: "No se encontró un endpoint de catálogos válido." },
    };
};

export const createExternalTicket = async ({ ticketData, files = [] }) => {
    const formData = new FormData();
    formData.append("ticket", JSON.stringify(ticketData || {}));
    (files || []).forEach((file) => {
        if (file instanceof File) {
            formData.append("files", file);
        }
    });

    return requestTicketApi("tickets", {
        method: "POST",
        body: formData,
    });
};

export const fetchTicketClientByIdentification = async (identification = "") => {
    const normalized = String(identification || "").trim();
    if (!normalized) {
        return {
            ok: false,
            status: 400,
            json: { detail: "Identificacion requerida." },
        };
    }

    return requestTicketApi(
        `client/${encodeURIComponent(normalized)}`,
        { method: "GET" },
    );
};

export const createTicketClient = async (payload = {}) =>
    requestTicketApi("client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });

export const sendTicketCreateMail = async (ticketId, payload = {}) => {
    const normalized = String(ticketId || "").trim();
    if (!normalized) {
        return {
            ok: false,
            status: 400,
            json: { detail: "ticket_id requerido para enviar correo." },
        };
    }
    return requestTicketApi(`mail/create/${encodeURIComponent(normalized)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });
};

export const fetchTicketTypes = async () =>
    requestTicketApi("type", { method: "GET" });

export const fetchTicketProductsByType = async (typeId = "") =>
    requestTicketApi(`catalog/type/${encodeURIComponent(String(typeId || "").trim())}`, {
        method: "GET",
    });

export const fetchTicketTopProducts = async (payload = {}) =>
    requestTicketApi("catalog/top_product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });

export const fetchTicketReasons = async (payload = {}) =>
    requestTicketApi("catalog/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });

export const fetchTicketCatalogFromCascade = async (payload = {}) =>
    requestTicketApi("catalog/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });

export const fetchTicketCanalTypes = async () =>
    requestTicketApi("canal_type", { method: "GET" });

export const fetchTicketCanals = async () =>
    requestTicketApi("canal", { method: "GET" });

export const fetchTicketAgencies = async () =>
    requestTicketApi("agencia", { method: "GET" });

export const fetchTicketProvinces = async () =>
    requestTicketApi("province", { method: "GET" });

export const fetchTicketCantonsByProvince = async (provinceId = "") =>
    requestTicketApi(`canton/${encodeURIComponent(String(provinceId || "").trim())}`, {
        method: "GET",
    });

export const fetchTicketCurrentUser = async () =>
    requestTicketApi("validate_token", { method: "GET" });

export const createTicketLocation = async (payload = {}) =>
    requestTicketApi("ticket_location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
    });
