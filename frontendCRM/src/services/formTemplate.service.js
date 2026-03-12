const API_BASE = import.meta.env.VITE_API_BASE;

export async function obtenerPlantillasDinamicas(campaignId) {
    const normalizedCampaignId = String(campaignId || "").trim();
    if (!normalizedCampaignId) {
        return { form2: null, form3: null };
    }

    const token = localStorage.getItem("access_token") || "";
    const response = await fetch(
        `${API_BASE}/agente/form-templates?campaignId=${encodeURIComponent(normalizedCampaignId)}`,
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
