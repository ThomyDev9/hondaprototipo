function getZonedParts(date = new Date(), timeZone = "America/Guayaquil") {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const byType = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );

    return {
        year: byType.year,
        month: byType.month,
        day: byType.day,
        hour: byType.hour,
        minute: byType.minute,
        second: byType.second,
    };
}

export function formatLocalDate(date = new Date(), timeZone = "America/Guayaquil") {
    const parts = getZonedParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatLocalDateTime(
    date = new Date(),
    timeZone = "America/Guayaquil",
) {
    const parts = getZonedParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

