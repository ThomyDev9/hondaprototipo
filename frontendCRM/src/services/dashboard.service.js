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

export const fetchFormCatalogos = ({ campaignId, contactId }) =>
    request(
        `agente/form-catalogos?campaignId=${encodeURIComponent(
            campaignId,
        )}&contactId=${encodeURIComponent(contactId)}`,
    );

export const fetchFormTemplates = ({ campaignId }) =>
    request(
        `agente/form-templates?campaignId=${encodeURIComponent(campaignId)}`,
    );

export const changeAgentStatus = ({ estado, registroId }) =>
    request("agente/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, registro_id: registroId }),
    });

export const guardarGestion = (payload) =>
    request("agente/guardar-gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
