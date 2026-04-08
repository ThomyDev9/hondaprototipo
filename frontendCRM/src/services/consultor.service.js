const API_BASE = import.meta.env.VITE_API_BASE;

const getAuthToken = () => localStorage.getItem("access_token") || "";

const buildHeaders = (additional = {}) => {
    const token = getAuthToken();
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...additional,
    };
};

const request = async (path, options = {}) => {
    const resp = await fetch(`${API_BASE}/${path}`, {
        ...options,
        headers: buildHeaders(options.headers || {}),
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
};

export const fetchConsultorLeads = ({
    sourceChannel = "",
    workflowStatus = "",
    promotionStatus = "",
    identification = "",
    search = "",
    limit = 200,
} = {}) => {
    const params = new URLSearchParams();
    if (sourceChannel) params.set("sourceChannel", sourceChannel);
    if (workflowStatus) params.set("workflowStatus", workflowStatus);
    if (promotionStatus) params.set("promotionStatus", promotionStatus);
    if (identification) params.set("identification", identification);
    if (search) params.set("search", search);
    params.set("limit", String(limit));

    return request(`consultor/leads?${params.toString()}`);
};

export const fetchConsultorLeadStats = ({
    sourceChannel = "",
    identification = "",
    search = "",
} = {}) => {
    const params = new URLSearchParams();
    if (sourceChannel) params.set("sourceChannel", sourceChannel);
    if (identification) params.set("identification", identification);
    if (search) params.set("search", search);

    return request(`consultor/leads-stats?${params.toString()}`);
};

export const fetchConsultorPerformanceSummary = ({
    dateFrom = "",
    dateTo = "",
} = {}) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    return request(`consultor/performance-summary?${params.toString()}`);
};

export const fetchConsultorUsers = () => request("consultor/consultors");

export const reassignConsultorLeads = (payload) =>
    request("consultor/reassign-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const fetchConsultorAssignmentConfig = () =>
    request("consultor/assignment-config");

export const updateConsultorAssignmentConfig = (payload) =>
    request("consultor/assignment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const fetchConsultorLeadById = (id) =>
    request(`consultor/leads/${encodeURIComponent(String(id || "").trim())}`);

export const updateConsultorLead = (id, payload) =>
    request(`consultor/leads/${encodeURIComponent(String(id || "").trim())}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

export const markConsultorLeadPromoted = (id) =>
    request(
        `consultor/leads/${encodeURIComponent(String(id || "").trim())}/mark-promoted`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        },
    );

export const assignPendingConsultorLeads = () =>
    request("consultor/assign-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
