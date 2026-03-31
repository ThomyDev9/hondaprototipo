import { useEffect, useMemo, useState } from "react";
import { getAgentCampaignScript } from "../../../services/campaignScripts.service";
import {
    flattenDynamicFormFields,
    normalizeForComparison,
    resolveCampaignId,
} from "../components/agentGestionForm.helpers";

const SCRIPT_LABELS = {
    header: "Guia completa",
    greeting: "Saludo",
    security: "Seguridad",
    arcotel: "Arcotel",
    informative: "Informativo",
    farewell: "Despedida",
    objections: "Manejo de objeciones",
    additional: "Notas adicionales",
};

const ALLOWED_SCRIPT_KEYS = new Set(Object.keys(SCRIPT_LABELS));

function buildDynamicFieldSearchers(dynamicFormFields, dynamicFormDetail) {
    const findValueByLabel = (labelPatterns = []) => {
        if (!dynamicFormFields.length || !dynamicFormDetail) return "";

        for (const pattern of labelPatterns) {
            const normalizedPattern = normalizeForComparison(pattern);

            for (const field of dynamicFormFields) {
                const label = field?.label || field?.key || "";
                const normalizedLabel = normalizeForComparison(label);

                if (
                    normalizedPattern &&
                    normalizedLabel.includes(normalizedPattern)
                ) {
                    const value = dynamicFormDetail[field.key];
                    if (value !== undefined && value !== null && value !== "") {
                        return String(value).trim();
                    }
                }
            }
        }

        return "";
    };

    const findValueByPlaceholder = (placeholder) => {
        if (!placeholder || !dynamicFormFields.length || !dynamicFormDetail) {
            return "";
        }

        const normalizedPlaceholder = normalizeForComparison(placeholder);
        if (!normalizedPlaceholder) return "";

        for (const field of dynamicFormFields) {
            const label = field?.label || "";
            const key = field?.key || "";
            const normalizedLabel = normalizeForComparison(label);
            const normalizedKey = normalizeForComparison(key);

            if (
                normalizedPlaceholder === normalizedLabel ||
                normalizedPlaceholder === normalizedKey
            ) {
                const value = dynamicFormDetail[key];
                if (value !== undefined && value !== null && value !== "") {
                    return String(value).trim();
                }
            }
        }

        return "";
    };

    return { findValueByLabel, findValueByPlaceholder };
}

export default function useAgentCampaignScript({
    campaignId,
    menuItemId,
    categoryId,
    registro,
    user,
    dynamicFormConfig,
    dynamicFormDetail,
}) {
    const [remoteScriptContent, setRemoteScriptContent] = useState(null);
    const [activeScriptKey, setActiveScriptKey] = useState(null);

    const resolvedCampaignId = useMemo(
        () => resolveCampaignId(campaignId, registro),
        [campaignId, registro],
    );

    useEffect(() => {
        let cancelled = false;

        const loadRemoteScript = async () => {
            if (!resolvedCampaignId) {
                setRemoteScriptContent(null);
                return;
            }

            try {
                const data = await getAgentCampaignScript(resolvedCampaignId, {
                    menuItemId,
                    categoryId,
                });
                if (!cancelled) {
                    setRemoteScriptContent(data?.script || data || null);
                }
            } catch {
                if (!cancelled) {
                    setRemoteScriptContent(null);
                }
            }
        };

        loadRemoteScript();

        return () => {
            cancelled = true;
        };
    }, [resolvedCampaignId, menuItemId, categoryId]);

    const dynamicFormFields = useMemo(
        () => flattenDynamicFormFields(dynamicFormConfig),
        [dynamicFormConfig],
    );

    const { findValueByLabel, findValueByPlaceholder } = useMemo(
        () => buildDynamicFieldSearchers(dynamicFormFields, dynamicFormDetail),
        [dynamicFormFields, dynamicFormDetail],
    );

    const dynamicClienteNombre = findValueByLabel([
        "Nombre completo",
        "Nombre",
        "Cliente",
        "Titular",
        "Socio",
    ]);

    const clienteNombre =
        dynamicClienteNombre ||
        registro?.nombre ||
        registro?.nombreCompleto ||
        registro?.fullName ||
        registro?.cliente ||
        "titular";

    const asesorNombre =
        user?.full_name || user?.name || user?.username || "[Tu nombre]";

    const highlight = (value) =>
        `<strong class="agent-script-highlight">${value}</strong>`;

    const replacePlaceholders = (text) =>
        text.replace(/\{([^}]+)\}/g, (match, rawPlaceholder) => {
            const placeholder = String(rawPlaceholder || "").trim();
            const normalizedPlaceholder = normalizeForComparison(placeholder);

            if (normalizedPlaceholder === "cliente") {
                return highlight(clienteNombre);
            }

            if (normalizedPlaceholder === "asesor") {
                return highlight(asesorNombre);
            }

            const dynamicValue = findValueByPlaceholder(placeholder);
            return dynamicValue ? highlight(dynamicValue) : match;
        });

    const scriptEntries = useMemo(
        () =>
            Object.entries(remoteScriptContent || {})
                .filter(
                    ([key, text]) =>
                        ALLOWED_SCRIPT_KEYS.has(key) &&
                        key !== "header" &&
                        Boolean(text?.toString().trim()),
                )
                .map(([key, text]) => ({
                    key,
                    label: SCRIPT_LABELS[key] || key,
                    text: replacePlaceholders(text.toString()),
                })),
        [remoteScriptContent, clienteNombre, asesorNombre, findValueByPlaceholder],
    );

    useEffect(() => {
        setActiveScriptKey((current) =>
            scriptEntries.some((entry) => entry.key === current)
                ? current
                : (scriptEntries[0]?.key ?? null),
        );
    }, [scriptEntries]);

    return {
        scriptEntries,
        activeScriptKey,
        setActiveScriptKey,
    };
}
