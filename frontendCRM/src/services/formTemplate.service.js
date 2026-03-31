const API_BASE = import.meta.env.VITE_API_BASE;

export async function obtenerPlantillasDinamicas(campaignId, options = {}) {
    const normalizedCampaignId = String(campaignId || "").trim();
    const normalizedMenuItemId = String(options?.menuItemId || "").trim();
    const normalizedCategoryId = String(options?.categoryId || "").trim();

    if (!normalizedCampaignId && !normalizedMenuItemId) {
        return { form2: null, form3: null };
    }

    const token = localStorage.getItem("access_token") || "";
    const params = new URLSearchParams();

    if (normalizedCampaignId) {
        params.set("campaignId", normalizedCampaignId);
    }

    if (normalizedMenuItemId) {
        params.set("menuItemId", normalizedMenuItemId);
    }

    if (normalizedCategoryId) {
        params.set("categoryId", normalizedCategoryId);
    }

    const response = await fetch(
        `${API_BASE}/agente/form-templates?${params.toString()}`,
        {
            headers: {
                Authorization: token ? `Bearer ${token}` : "",
            },
        },
    );

    const json = await response.json();
    if (!response.ok) {
        throw new Error(json.error || "Error obteniendo plantillas dinámicas");
    }

    return {
        form2: json.form2 || null,
        form3: json.form3 || null,
    };
}

export default {
    obtenerPlantillasDinamicas,
};
