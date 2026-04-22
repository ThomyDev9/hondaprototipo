const API_BASE = import.meta.env.VITE_API_BASE;

function getAuthHeaders() {
    const token = localStorage.getItem("access_token") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractFilename(contentDisposition = "") {
    const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
    return match?.[1] || "";
}

function sanitizeFileSegment(value = "") {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

export async function fetchSupervisorOutboundCampaigns() {
    const response = await fetch(
        `${API_BASE}/supervisor/reportes/outbound/campanias`,
        {
            headers: getAuthHeaders(),
        },
    );
    const json = await response.json();

    if (!response.ok) {
        throw new Error(json.error || "Error obteniendo campañas");
    }

    return Array.isArray(json?.data) ? json.data : [];
}

export async function fetchSupervisorRedesCampaigns() {
    const response = await fetch(
        `${API_BASE}/supervisor/reportes/redes/campanias`,
        {
            headers: getAuthHeaders(),
        },
    );
    const json = await response.json();

    if (!response.ok) {
        throw new Error(json.error || "Error obteniendo campanas");
    }

    return Array.isArray(json?.data) ? json.data : [];
}

export async function downloadSupervisorOutboundReport({
    campaignId,
    startDate,
    endDate,
}) {
    const params = new URLSearchParams({
        campaignId: String(campaignId || "").trim(),
        startDate: String(startDate || "").trim(),
        endDate: String(endDate || "").trim(),
    });

    const response = await fetch(
        `${API_BASE}/supervisor/reportes/outbound/export?${params.toString()}`,
        {
            headers: getAuthHeaders(),
        },
    );

    if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Error descargando reporte");
    }

    const blob = await response.blob();
    const fallbackFilename = `${
        sanitizeFileSegment(campaignId) || "campana"
    }_${sanitizeFileSegment(endDate) || "sin_fecha"}.xlsx`;

    return {
        blob,
        filename:
            extractFilename(response.headers.get("content-disposition")) ||
            fallbackFilename,
    };
}

export async function downloadSupervisorRedesReport({
    campaignId,
    startDate,
    endDate,
}) {
    const params = new URLSearchParams({
        campaignId: String(campaignId || "").trim(),
        startDate: String(startDate || "").trim(),
        endDate: String(endDate || "").trim(),
    });

    const response = await fetch(
        `${API_BASE}/supervisor/reportes/redes/export?${params.toString()}`,
        {
            headers: getAuthHeaders(),
        },
    );

    if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Error descargando reporte");
    }

    const blob = await response.blob();
    const fallbackFilename = `redes_${
        sanitizeFileSegment(campaignId) || "campana"
    }_${sanitizeFileSegment(endDate) || "sin_fecha"}.xlsx`;

    return {
        blob,
        filename:
            extractFilename(response.headers.get("content-disposition")) ||
            fallbackFilename,
    };
}

export default {
    fetchSupervisorOutboundCampaigns,
    fetchSupervisorRedesCampaigns,
    downloadSupervisorOutboundReport,
    downloadSupervisorRedesReport,
};
