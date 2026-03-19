// Utilidad para saber si una campaña es de Gestión Outbound
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
