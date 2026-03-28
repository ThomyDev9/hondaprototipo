const GESTION_OUTBOUND_ROOTS = ["gestion outbound"];

function normalizarTexto(text = "") {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

// Utilidad para saber si un campaignId pertenece a los flujos de outbound
export function esGestionOutbound(campaignId = "") {
    const lower = String(campaignId).toLowerCase();
    return (
        lower.includes("out maquita cushunchic") ||
        lower.includes("out cacpeco") ||
        lower.includes("out kullki wasi") ||
        lower.includes("out mutualista imbabura") ||
        lower.includes("out honda")
    );
}

export function esPadreGestionOutbound(campaignName = "") {
    const normalized = normalizarTexto(campaignName);
    return GESTION_OUTBOUND_ROOTS.some((term) =>
        normalized.includes(term),
    );
}

export function filtrarCampaniasGestionOutbound(menuCampanias = []) {
    if (!Array.isArray(menuCampanias)) return [];
    return menuCampanias.filter(
        (item) => !esPadreGestionOutbound(item?.campania),
    );
}
