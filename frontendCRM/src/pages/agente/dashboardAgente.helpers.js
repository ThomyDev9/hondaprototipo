import { uuidv4 } from "../../utils/uuid";

const AGENTE_TAB_SESSION_KEY = "agente_tab_session_id";

export function getOrCreateTabSessionId() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("newtab") === "1") {
        const newId = uuidv4();
        sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, newId);
        return newId;
    }

    let id = sessionStorage.getItem(AGENTE_TAB_SESSION_KEY);
    if (!id) {
        id = uuidv4();
        sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, id);
    }

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            const newId = uuidv4();
            sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, newId);
        }
    });

    return sessionStorage.getItem(AGENTE_TAB_SESSION_KEY);
}

export function getCurrentTabSessionId() {
    return String(sessionStorage.getItem(AGENTE_TAB_SESSION_KEY) || "").trim();
}

export function resetTabSessionId() {
    const newId = uuidv4();
    sessionStorage.setItem(AGENTE_TAB_SESSION_KEY, newId);
    return newId;
}

export function buildInitialSurveyAnswers(surveyConfig) {
    if (!surveyConfig?.fields?.length) return {};
    return surveyConfig.fields.reduce((acc, field) => {
        acc[field.key] = "";
        return acc;
    }, {});
}

export function chunkFields(fields = [], perRow = 5) {
    const rows = [];
    for (let index = 0; index < fields.length; index += perRow) {
        rows.push(fields.slice(index, index + perRow));
    }
    return rows;
}

export function mapTemplateToForm2Config(form2Template) {
    if (!form2Template?.fields?.length) return null;

    return {
        title: form2Template.templateName || "Formulario 2",
        rows: chunkFields(
            form2Template.fields.map((field) => ({
                key: field.key,
                label: field.label,
                type: field.type || "text",
                options: Array.isArray(field.options) ? field.options : [],
                maxLength: field.maxLength || undefined,
            })),
            5,
        ),
    };
}

export function mapTemplateToSurveyConfig(form3Template) {
    if (!form3Template?.fields?.length) return null;

    return {
        title: form3Template.templateName || "Formulario 3",
        fields: form3Template.fields.map((field) => ({
            key: field.key,
            label: field.label,
            type: field.type || "text",
            options: Array.isArray(field.options) ? field.options : [],
            maxLength: field.maxLength || undefined,
        })),
    };
}

export function findOptionIgnoreCase(options, target) {
    const normalizedTarget = String(target || "").trim().toLowerCase();
    if (!normalizedTarget) return "";

    return (
        options.find(
            (option) =>
                String(option || "").trim().toLowerCase() ===
                normalizedTarget,
        ) || ""
    );
}

export function buildInteractionId() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const micro = String(
        now.getMilliseconds() * 1000 + Math.floor(Math.random() * 1000),
    ).padStart(6, "0");
    const rand8 = String(Math.floor(Math.random() * 100000000)).padStart(
        8,
        "0",
    );
    const yyyy = String(now.getFullYear());
    const mon = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${hh}${mm}${ss}${micro}-${rand8}-${yyyy}${mon}${dd}`;
}

export function formatNowForMysql() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
