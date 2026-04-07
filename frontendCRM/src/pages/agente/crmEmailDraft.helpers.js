const FIXED_FROM_EMAIL = "ejecutivos@kimobill.com";

function buildDetailLines(lines = []) {
    return lines
        .map((line) => String(line || "").trim())
        .filter(Boolean);
}

export function buildCrmEmailDraft({
    contextLabel = "CRM",
    subjectPrefix = "Seguimiento",
    greetingName = "",
    to = "",
    bodyIntro = "",
    detailLines = [],
    advisorName = "",
}) {
    const normalizedGreetingName = String(greetingName || "").trim();
    const normalizedAdvisorName = String(advisorName || "").trim();
    const normalizedContextLabel = String(contextLabel || "CRM").trim();
    const normalizedSubjectPrefix = String(subjectPrefix || "Seguimiento").trim();
    const normalizedIntro = String(bodyIntro || "").trim();
    const normalizedDetails = buildDetailLines(detailLines);

    return {
        contextLabel: normalizedContextLabel,
        from: FIXED_FROM_EMAIL,
        to: String(to || "").trim(),
        subject: normalizedGreetingName
            ? `${normalizedSubjectPrefix} - ${normalizedGreetingName}`
            : normalizedSubjectPrefix,
        header: normalizedGreetingName
            ? `Estimado/a ${normalizedGreetingName},`
            : "Estimado/a cliente,",
        body: [
            "Reciba un cordial saludo.",
            "",
            normalizedIntro,
            ...(normalizedDetails.length > 0 ? ["", ...normalizedDetails] : []),
            "",
            "Quedamos atentos a su confirmacion o cualquier informacion adicional que desee compartir.",
        ]
            .filter(Boolean)
            .join("\n"),
        footer: [
            "Saludos cordiales,",
            normalizedAdvisorName || "Equipo Kimobill",
            FIXED_FROM_EMAIL,
        ].join("\n"),
    };
}

export function getFixedCrmFromEmail() {
    return FIXED_FROM_EMAIL;
}

