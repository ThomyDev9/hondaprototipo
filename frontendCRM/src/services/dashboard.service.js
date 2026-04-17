const API_BASE = import.meta.env.VITE_API_BASE;

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
    try {
        json = await resp.json();
    } catch (err) {
        json = null;
    }
    return {
        status: resp.status,
        ok: resp.ok,
        json,
        response: resp,
    };
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

export const fetchAgentStatusOptions = () =>
    request("agente/estados-agente");

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
        const shouldTryDirectFallback =
            Boolean(directBaseFromEnv) || isLocalHost || isPrivateIpv4;

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
            } catch (_err) {
                directJson = null;
            }

            return {
                status: directResp.status,
                ok: directResp.ok,
                json: directJson,
                response: directResp,
            };
        } catch (_err) {
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
