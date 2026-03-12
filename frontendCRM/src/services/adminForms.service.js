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
        throw new Error("Respuesta no válida del servidor");
    }
}

export async function listarSubcampaniasActivas(
    formType,
    scope = "without-template",
) {
    const normalizedFormType = String(formType || "")
        .trim()
        .toUpperCase();
    const normalizedScope = String(scope || "without-template")
        .trim()
        .toLowerCase();
    const response = await fetch(
        `${API_BASE}/admin/forms/subcampaigns?formType=${encodeURIComponent(normalizedFormType)}&scope=${encodeURIComponent(normalizedScope)}`,
        {
            headers: getAuthHeaders(),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error cargando subcampañas");
    }

    return json.data || [];
}

export async function obtenerPlantillaAsignada(menuItemId, formType) {
    const response = await fetch(
        `${API_BASE}/admin/forms/template?menuItemId=${encodeURIComponent(menuItemId)}&formType=${encodeURIComponent(formType)}`,
        {
            headers: getAuthHeaders(),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error cargando plantilla");
    }

    return json.data || null;
}

export async function guardarPlantillaDinamica(payload) {
    const response = await fetch(`${API_BASE}/admin/forms/template`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error guardando plantilla");
    }

    return json;
}

export default {
    listarSubcampaniasActivas,
    obtenerPlantillaAsignada,
    guardarPlantillaDinamica,
};
