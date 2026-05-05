const API_BASE = import.meta.env.VITE_API_BASE;

export async function submitPublicRrssLead(payload) {
    const resp = await fetch(`${API_BASE}/public/rrss-leads`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    let json = null;
    try {
        json = await resp.json();
    } catch {
        json = null;
    }

    return {
        ok: resp.ok,
        status: resp.status,
        json,
    };
}

export async function checkPublicRrssLeadByCedula(cedula) {
    const normalized = String(cedula || "").replace(/\D/g, "");
    if (!normalized) {
        return { ok: false, status: 400, json: { exists: false } };
    }

    const resp = await fetch(
        `${API_BASE}/public/rrss-leads/check-identification/${normalized}`,
        {
            method: "GET",
        },
    );

    let json = null;
    try {
        json = await resp.json();
    } catch {
        json = null;
    }

    return {
        ok: resp.ok,
        status: resp.status,
        json,
    };
}
