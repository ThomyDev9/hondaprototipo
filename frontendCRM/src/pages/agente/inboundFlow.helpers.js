export const SPECIAL_INBOUND_EDITABLE_TICKET_LABELS = [
    "kullki wasi",
    "atm",
    "oscus",
    "atm oscus",
];

export function normalizeInboundFlowLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

export function isEditableTicketInboundFlow(...values) {
    return values.some((value) =>
        SPECIAL_INBOUND_EDITABLE_TICKET_LABELS.includes(
            normalizeInboundFlowLabel(value),
        ),
    );
}
