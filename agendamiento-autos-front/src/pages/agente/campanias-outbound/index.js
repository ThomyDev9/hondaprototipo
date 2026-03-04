import bvfPreAprobados from "./Banco-VisionFund/bvf-pre-aprobados";
import bvfEncuestasSatisfaccion from "./Banco-VisionFund/bvf-encuestas-satisfaccion";
import bvfEncuestasPostventa from "./Banco-VisionFund/bvf-encuestas-postventa";

const CAMPANIAS_OUTBOUND = [
    bvfEncuestasPostventa,
    bvfEncuestasSatisfaccion,
    bvfPreAprobados,
];

export function resolveDynamicFormConfig(campaignId) {
    const normalizedCampaign = String(campaignId || "").trim();
    return (
        CAMPANIAS_OUTBOUND.find((campaign) =>
            campaign.match.test(normalizedCampaign),
        )?.form2 || null
    );
}

export function resolveDynamicSurveyConfig(campaignId) {
    const normalizedCampaign = String(campaignId || "").trim();
    return (
        CAMPANIAS_OUTBOUND.find((campaign) =>
            campaign.match.test(normalizedCampaign),
        )?.form3 || null
    );
}

export { CAMPANIAS_OUTBOUND };

const outboundCampaignResolvers = {
    resolveDynamicFormConfig,
    resolveDynamicSurveyConfig,
    CAMPANIAS_OUTBOUND,
};

export default outboundCampaignResolvers;
