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

export async function listarCampaniasParaNiveles(categoryId) {
    const response = await fetch(
        `${API_BASE}/admin/management-levels/campaigns?categoryId=${encodeURIComponent(String(categoryId || "").trim())}`,
        {
            headers: getAuthHeaders(),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error cargando campañas");
    }

    return json.data || [];
}

export async function listarSugerenciasNivelesGestion() {
    const response = await fetch(
        `${API_BASE}/admin/management-levels/suggestions`,
        {
            headers: getAuthHeaders(),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error cargando sugerencias de niveles");
    }

    return {
        level1: json?.data?.level1 || [],
        level2: json?.data?.level2 || [],
    };
}

export async function listarArbolCampaniasPorCategoria(categoryId) {
    const normalizedCategoryId = String(categoryId || "").trim();
    const response = await fetch(
        `${API_BASE}/api/menu/categories/${encodeURIComponent(normalizedCategoryId)}/admin-tree`,
        {
        headers: getAuthHeaders(),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error cargando árbol de campañas");
    }

    return json.data || [];
}

export async function listarNivelesGestion(campaignId, state = "1") {
    const params = new URLSearchParams({ campaignId, state });
    const response = await fetch(
        `${API_BASE}/admin/management-levels?${params.toString()}`,
        {
            headers: getAuthHeaders(),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error cargando niveles");
    }

    return json.data || [];
}

export async function crearNivelGestion(payload) {
    const response = await fetch(`${API_BASE}/admin/management-levels`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error creando nivel de gestión");
    }

    return json;
}

export async function crearNivelesGestionMasivo(payload) {
    const response = await fetch(`${API_BASE}/admin/management-levels/bulk`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error creando niveles de gestión");
    }

    return json;
}

export async function crearNivelesGestionMasivoPorPares(payload) {
    const response = await fetch(
        `${API_BASE}/admin/management-levels/bulk-pairs`,
        {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error creando niveles por pares");
    }

    return json;
}

export async function actualizarNivelGestion(id, payload) {
    const response = await fetch(
        `${API_BASE}/admin/management-levels/${encodeURIComponent(id)}`,
        {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        },
    );

    const json = await parseJson(response);
    if (!response.ok) {
        throw new Error(json.error || "Error actualizando nivel de gestión");
    }

    return json;
}

export default {
    listarCampaniasParaNiveles,
    listarSugerenciasNivelesGestion,
    listarArbolCampaniasPorCategoria,
    listarNivelesGestion,
    crearNivelGestion,
    crearNivelesGestionMasivo,
    crearNivelesGestionMasivoPorPares,
    actualizarNivelGestion,
};
