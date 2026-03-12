// API functions for agente endpoints
const API_BASE = import.meta.env.VITE_API_BASE;

export async function fetchSiguienteRegistro({
    campaignId,
    tabSessionId,
    token,
}) {
    const resp = await fetch(`${API_BASE}/agente/siguiente`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ campaignId, tabSessionId }),
    });
    return resp;
}

export async function fetchActiveBases(token) {
    const resp = await fetch(`${API_BASE}/agente/bases-activas-resumen`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
    });
    return resp;
}

export async function fetchFormCatalogos({ campaignId, contactId, token }) {
    const resp = await fetch(
        `${API_BASE}/agente/form-catalogos?campaignId=${encodeURIComponent(campaignId)}&contactId=${encodeURIComponent(contactId)}`,
        {
            headers: { Authorization: token ? `Bearer ${token}` : "" },
        },
    );
    return resp;
}

export async function updatePhoneStatus({ payload, token }) {
    const resp = await fetch(`${API_BASE}/agente/update-phones`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
    });
    return resp;
}
