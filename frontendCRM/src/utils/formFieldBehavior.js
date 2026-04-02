function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function includesAny(text, patterns = []) {
    return patterns.some((pattern) => text.includes(pattern));
}

export function getFieldBehavior(field = {}) {
    const normalizedKey = normalizeText(field.key || field.name);
    const normalizedLabel = normalizeText(field.label);
    const combined = `${normalizedKey} ${normalizedLabel}`.trim();

    const numericOnly =
        Boolean(field.numericOnly) ||
        field.sanitize === "numeric" ||
        field.inputMode === "numeric" ||
        includesAny(combined, ["identificacion", "celular"]);

    const uppercase =
        Boolean(field.uppercase) ||
        field.sanitize === "uppercase" ||
        field.transform === "uppercase" ||
        includesAny(combined, [
            "apellidos y nombres",
            "apellidos nombres",
            "nombre cliente",
            "ciudad",
        ]);

    const suggestions = [];

    if (includesAny(combined, ["correo del cliente", "correo cliente", "correo"])) {
        suggestions.push("noaplica@gmail.com");
    }

    if (includesAny(combined, ["convencional"])) {
        suggestions.push("no aplica");
    }

    return {
        numericOnly,
        uppercase,
        inputMode: numericOnly ? "numeric" : field.inputMode,
        suggestions,
    };
}

export function transformFieldValue(field, rawValue, inputType) {
    if (inputType === "checkbox") {
        return Boolean(rawValue);
    }

    const behavior = getFieldBehavior(field);
    let nextValue = rawValue;

    if (behavior.numericOnly) {
        nextValue = String(nextValue ?? "").replace(/\D+/g, "");
    }

    if (behavior.uppercase) {
        nextValue = String(nextValue ?? "").toUpperCase();
    }

    return nextValue;
}
