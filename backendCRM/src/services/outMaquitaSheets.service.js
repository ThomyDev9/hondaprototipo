const OUT_MAQUITA_CAMPAIGN = "out maquita cushunchic";

export function isOutMaquitaCampaign(campaignId) {
    return String(campaignId || "").trim().toLowerCase() === OUT_MAQUITA_CAMPAIGN;
}
