export function chunkArray(items = [], size = 1) {
    if (!Array.isArray(items) || size <= 0) return [];

    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export function getDynamicWidth(value) {
    const text = String(value ?? "");
    const length = Math.max(text.length, 8);
    const estimated = Math.round(length * 8.5 + 56);
    return Math.min(Math.max(estimated, 140), 560);
}

export function normalizeForComparison(value) {
    return (
        value
            ?.toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .trim() || ""
    );
}

export function parseAdditionalFields(dynamicFormDetail) {
    if (!dynamicFormDetail?.CamposAdicionalesJson) {
        return {};
    }

    try {
        const parsed = JSON.parse(dynamicFormDetail.CamposAdicionalesJson);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function buildDynamicFormRows(dynamicFormConfig, dynamicFormDetail) {
    if (!dynamicFormConfig?.rows || !dynamicFormDetail) {
        return [];
    }

    const additionalFields = parseAdditionalFields(dynamicFormDetail);
    const allFields = dynamicFormConfig.rows.flat().filter((field) => {
        const value =
            dynamicFormDetail[field.key] ?? additionalFields?.[field.key];
        return value !== undefined && value !== null && value !== "";
    });

    return chunkArray(allFields, 6);
}

export function buildExtraFields(dynamicFormDetail, dynamicFormConfig) {
    const additionalFields = parseAdditionalFields(dynamicFormDetail);
    if (!Object.keys(additionalFields).length) {
        return [];
    }

    const configuredKeys = new Set(
        flattenDynamicFormFields(dynamicFormConfig).map((field) =>
            String(field?.key || "").trim(),
        ),
    );

    const normalizedFields = Object.entries(additionalFields)
        .filter(([key]) => !configuredKeys.has(String(key || "").trim()))
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => ({ key, label: key, value }));

    return chunkArray(normalizedFields, 6);
}

export function flattenDynamicFormFields(dynamicFormConfig) {
    if (!dynamicFormConfig?.rows?.length) return [];

    return dynamicFormConfig.rows.reduce((accumulator, row) => {
        if (Array.isArray(row)) {
            return accumulator.concat(row);
        }

        if (row) {
            accumulator.push(row);
        }

        return accumulator;
    }, []);
}

export function resolveCampaignId(campaignId, registro) {
    return (
        [
            campaignId,
            registro?.campaignId,
            registro?.campaign_id,
            registro?.Campaign,
            registro?.campaign,
        ]
            .map((value) => String(value || "").trim())
            .find(Boolean) || ""
    );
}
