const API_BASE = import.meta.env.VITE_API_BASE;

function getAuthToken() {
    return localStorage.getItem("access_token") || "";
}

export async function fetchOutMaquitaFlowData({
    flow = "mail",
    mode = "gestion",
    search = "",
    limit = 300,
} = {}) {
    const url = new URL(`${API_BASE}/agente/out-maquita-external-leads`);
    url.searchParams.set("flow", String(flow || "").trim().toLowerCase());
    url.searchParams.set("mode", String(mode || "").trim().toLowerCase());
    if (search) {
        url.searchParams.set("search", String(search).trim());
    }
    url.searchParams.set("limit", String(limit));

    const token = getAuthToken();
    const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(
            json?.error || "No se pudo obtener datos de Out Maquita",
        );
    }

    return Array.isArray(json?.data) ? json.data : [];
}

export default {
    fetchOutMaquitaFlowData,
};
