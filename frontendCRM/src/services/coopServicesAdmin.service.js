const API_BASE = import.meta.env.VITE_API_BASE;

function buildHeaders() {
    const token = localStorage.getItem("access_token") || "";
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function request(path, options = {}) {
    const resp = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            ...buildHeaders(),
            ...(options.headers || {}),
        },
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(json?.error || "Error de solicitud");
    }
    return json;
}

export async function listCoopServicesAdmin(campaignId = "") {
    const qs = campaignId
        ? `?campaignId=${encodeURIComponent(String(campaignId || "").trim())}`
        : "";
    return request(`/admin/coop-services${qs}`);
}

export async function createCoopServiceAdmin(payload) {
    return request("/admin/coop-services", {
        method: "POST",
        body: JSON.stringify(payload || {}),
    });
}

export async function updateCoopServiceAdmin(resourceId, payload) {
    return request(
        `/admin/coop-services/${encodeURIComponent(String(resourceId || "").trim())}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload || {}),
        },
    );
}

export async function createCoopCredentialAdmin(resourceId, payload) {
    return request(
        `/admin/coop-services/${encodeURIComponent(String(resourceId || "").trim())}/credentials`,
        {
            method: "POST",
            body: JSON.stringify(payload || {}),
        },
    );
}

export async function updateCoopCredentialAdmin(credentialId, payload) {
    return request(
        `/admin/coop-services/credentials/${encodeURIComponent(String(credentialId || "").trim())}`,
        {
            method: "PATCH",
            body: JSON.stringify(payload || {}),
        },
    );
}
