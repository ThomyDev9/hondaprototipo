const API_BASE = import.meta.env.VITE_API_BASE;

function getAuthHeaders() {
    const token = localStorage.getItem("access_token") || "";
    return {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
    };
}

async function parseJson(response) {
    const text = await response.text();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        throw new Error("Respuesta inválida del servidor");
    }
}

export async function listScriptSubcampaigns() {
    const response = await fetch(`${API_BASE}/admin/scripts/subcampaigns`, {
        headers: getAuthHeaders(),
    });
    const json = await parseJson(response);

    if (!response.ok) {
        throw new Error(json.error || "No se pudo cargar subcampañas");
    }

    return json.data || [];
}

export async function getAdminCampaignScript(menuItemId) {
    const response = await fetch(
        `${API_BASE}/admin/scripts/${encodeURIComponent(menuItemId)}`,
        {
            headers: getAuthHeaders(),
        },
    );
    const json = await parseJson(response);

    if (!response.ok) {
        throw new Error(json.error || "No se pudo cargar el script");
    }

    return json.data || null;
}

export async function saveAdminCampaignScript(menuItemId, script) {
    const response = await fetch(
        `${API_BASE}/admin/scripts/${encodeURIComponent(menuItemId)}`,
        {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ script }),
        },
    );
    const json = await parseJson(response);

    if (!response.ok) {
        throw new Error(json.error || "No se pudo guardar el script");
    }

    return json;
}

export async function getAgentCampaignScript(campaignId) {
    const response = await fetch(
        `${API_BASE}/agente/scripts?campaignId=${encodeURIComponent(campaignId)}`,
        {
            headers: getAuthHeaders(),
        },
    );
    const json = await parseJson(response);

    if (!response.ok) {
        throw new Error(json.error || "No se pudo cargar el script");
    }

    return json.data || null;
}

export default {
    listScriptSubcampaigns,
    getAdminCampaignScript,
    saveAdminCampaignScript,
    getAgentCampaignScript,
};
