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
    const base = String(API_BASE || "").replace(/\/+$/, "");
    const path = `${base}/agente/out-maquita-external-leads`;
    const params = new URLSearchParams();
    params.set("flow", String(flow || "").trim().toLowerCase());
    params.set("mode", String(mode || "").trim().toLowerCase());
    if (search) {
        params.set("search", String(search).trim());
    }
    params.set("limit", String(limit));
    const url = `${path}?${params.toString()}`;

    const token = getAuthToken();
    const res = await fetch(url, {
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
