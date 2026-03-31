const OUT_MAQUITA_CAMPAIGN = "out maquita cushunchic";
const OUT_MAQUITA_FLOW_MAIL = "mail";
const OUT_MAQUITA_FLOW_RRSS = "rrss";
const WEBHOOK_TIMEOUT_MS = 20000;

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function tryParseJson(rawText = "") {
    if (!rawText) return null;

    try {
        return JSON.parse(rawText);
    } catch {
        return null;
    }
}

async function postWebhookPayload(webhookUrl, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    let response;

    try {
        response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } catch (error) {
        const causeCode = error?.cause?.code || "";
        const isTimeout =
            error?.name === "AbortError" ||
            causeCode === "UND_ERR_CONNECT_TIMEOUT";

        if (isTimeout) {
            throw new Error(
                `Timeout conectando con el webhook de Google Sheets (${WEBHOOK_TIMEOUT_MS}ms)`,
            );
        }

        throw new Error(
            error?.message ||
                "No se pudo conectar con el webhook de Google Sheets",
        );
    } finally {
        clearTimeout(timeoutId);
    }

    const rawText = await response.text();
    const json = tryParseJson(rawText);

    if (!response.ok) {
        throw new Error(
            json?.error ||
                rawText ||
                `Webhook respondio con estado ${response.status}`,
        );
    }

    if (json && json.success === false) {
        throw new Error(
            json.error || "El webhook de Google Sheets respondio con error",
        );
    }

    return {
        skipped: false,
        status: response.status,
        data: json,
    };
}

export function isOutMaquitaCampaign(campaignId) {
    return normalizeText(campaignId) === OUT_MAQUITA_CAMPAIGN;
}

export function getOutMaquitaFlow(formData = {}) {
    return normalizeText(formData?.outboundFlow || formData?.flow || "") ===
        OUT_MAQUITA_FLOW_RRSS
        ? OUT_MAQUITA_FLOW_RRSS
        : OUT_MAQUITA_FLOW_MAIL;
}

export function buildOutMaquitaMailPayload(formData = {}, actor = "") {
    const identification = String(
        formData?.identificacion ||
            formData?.Identificacion ||
            formData?.["Nº de cédula"] ||
            formData?.["N° de cédula"] ||
            "",
    ).trim();
    const motivoInteraccion = String(
        formData?.motivoInteraccion || "",
    ).trim();
    const submotivoInteraccion = String(
        formData?.submotivoInteraccion || "",
    ).trim();
    const observaciones = String(
        formData?.observaciones || formData?.Observaciones || "",
    ).trim();

    return {
        identification,
        motivoInteraccion,
        submotivoInteraccion,
        observaciones,
        // Compatibilidad con webhooks que actualizan Google Sheets por letra
        // de columna en el flujo mail.
        K: motivoInteraccion,
        L: submotivoInteraccion,
        M: observaciones,
        estado: motivoInteraccion,
        subEstado: submotivoInteraccion,
        seguimiento: observaciones,
        updatedBy: String(actor || "").trim(),
    };
}

export function buildOutMaquitaRrssGestionPayload(formData = {}, actor = "") {
    return {
        identification: String(
            formData?.identificacion ||
                formData?.Identificacion ||
                formData?.identification ||
                formData?.["Número de Cedula"] ||
                formData?.["Numero de Cedula"] ||
                "",
        ).trim(),
        estado: String(formData?.motivoInteraccion || "").trim(),
        subEstado: String(formData?.submotivoInteraccion || "").trim(),
        seguimiento: String(
            formData?.observaciones || formData?.Observaciones || "",
        ).trim(),
        updatedBy: String(actor || "").trim(),
    };
}

export function buildOutMaquitaRrssDrivePayload(formData = {}, actor = "") {
    return {
        asesor: String(formData?.asesor || actor || "").trim(),
        fecha: String(formData?.fecha || "").trim(),
        identification: String(
            formData?.identificacion ||
                formData?.Identificacion ||
                formData?.identification ||
                "",
        ).trim(),
        apellidosNombres: String(formData?.apellidosNombres || "").trim(),
        estadoCivil: String(formData?.estadoCivil || "").trim(),
        autorizaBuro: String(
            formData?.autorizaBuro ||
                formData?.["Autoriza Buró si / no"] ||
                formData?.["Autoriza Buro si / no"] ||
                "",
        ).trim(),
        tipoRelacionLaboral: String(
            formData?.tipoRelacionLaboral ||
                formData?.["Tipo de relación laboral"] ||
                formData?.["Tipo de relacion laboral"] ||
                "",
        ).trim(),
        ciudad: String(formData?.ciudad || "").trim(),
        celular: String(formData?.celular || "").trim(),
        montoSolicitado: String(
            formData?.montoSolicitadoRrss || formData?.montoSolicitado || "",
        ).trim(),
        destinoCredito: String(formData?.destinoCredito || "").trim(),
        actividadEconomicaTiempo: String(
            formData?.actividadEconomicaTiempo || "",
        ).trim(),
        ingresoNetoRecibir: String(formData?.ingresoNetoRecibir || "").trim(),
        tipoVivienda: String(formData?.tipoVivienda || "").trim(),
        mantieneHijos: String(formData?.mantieneHijos || "").trim(),
        otrosIngresos: String(formData?.otrosIngresos || "").trim(),
        updatedBy: String(actor || "").trim(),
    };
}

export async function syncOutMaquitaMailSheet(formData = {}, actor = "") {
    const webhookUrl = String(
        process.env.OUT_MAQUITA_SHEETS_WEBHOOK_URL || "",
    ).trim();

    if (!webhookUrl) {
        return {
            skipped: true,
            reason: "OUT_MAQUITA_SHEETS_WEBHOOK_URL no configurado",
        };
    }

    const payload = buildOutMaquitaMailPayload(formData, actor);

    if (!payload.identification) {
        return {
            skipped: true,
            reason: "Identificacion vacia",
        };
    }

    return postWebhookPayload(webhookUrl, payload);
}

export async function syncOutMaquitaRrssGestionSheet(
    formData = {},
    actor = "",
) {
    const webhookUrl = String(
        process.env.OUT_MAQUITA_RRSS_STATUS_WEBHOOK_URL || "",
    ).trim();

    if (!webhookUrl) {
        return {
            skipped: true,
            reason: "OUT_MAQUITA_RRSS_STATUS_WEBHOOK_URL no configurado",
        };
    }

    const payload = buildOutMaquitaRrssGestionPayload(formData, actor);

    if (!payload.identification) {
        return {
            skipped: true,
            reason: "Identificacion vacia",
        };
    }

    return postWebhookPayload(webhookUrl, payload);
}

export async function appendOutMaquitaRrssDriveData(
    formData = {},
    actor = "",
) {
    const webhookUrl = String(
        process.env.OUT_MAQUITA_RRSS_DRIVE_WEBHOOK_URL || "",
    ).trim();

    if (!webhookUrl) {
        return {
            skipped: true,
            reason: "OUT_MAQUITA_RRSS_DRIVE_WEBHOOK_URL no configurado",
        };
    }

    const payload = buildOutMaquitaRrssDrivePayload(formData, actor);

    if (!payload.identification) {
        return {
            skipped: true,
            reason: "Identificacion vacia",
        };
    }

    return postWebhookPayload(webhookUrl, payload);
}

export async function syncOutMaquitaSheet(formData = {}, actor = "") {
    const flow = getOutMaquitaFlow(formData);

    if (flow === OUT_MAQUITA_FLOW_RRSS) {
        return syncOutMaquitaRrssGestionSheet(formData, actor);
    }

    return syncOutMaquitaMailSheet(formData, actor);
}
