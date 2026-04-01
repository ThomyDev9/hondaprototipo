import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { fetchBasesActivasPorCampania } from "../services/basesActivas.service";
import {
    DEFAULT_MENU_CATEGORY_ID,
    listarCategoriasMenu,
} from "../services/campaign.service";
import { esGestionOutbound } from "../utils/gestionOutbound";

const MENU_CACHE_TTL_MS = 60_000;
const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";

const styles = {
    menu: {
        listStyle: "none",
        width: "100%",
        maxHeight: "72vh",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "rgba(15, 23, 42, 0.16)",
        borderRadius: "0.6rem",
        border: "1px solid rgba(255,255,255,0.2)",
        padding: "0.28rem",
    },
    menuItem: {
        color: "#e2e8f0",
        fontWeight: 500,
        fontSize: "0.8rem",
        borderRadius: "0.45rem",
        cursor: "pointer",
        backgroundColor: "rgba(15, 23, 42, 0.08)",
        transition: "background 0.2s, border-color 0.2s",
        display: "block",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
        textAlign: "left",
    },
    menuItemActive: {
        backgroundColor: "rgba(59,130,246,0.22)",
        color: "#ffffff",
    },
    submenu: {
        listStyle: "none",
        paddingLeft: 0,
        marginTop: 4,
    },
};

const getMenuCacheKey = (categoryId) =>
    `menu_tree_cache_${String(categoryId || DEFAULT_MENU_CATEGORY_ID).trim()}`;

const getCachedTreeByCategory = (categoryId) => {
    try {
        const raw = sessionStorage.getItem(getMenuCacheKey(categoryId));
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const hasValidShape =
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.data) &&
            typeof parsed.savedAt === "number";

        if (!hasValidShape) return null;
        if (Date.now() - parsed.savedAt >= MENU_CACHE_TTL_MS) return null;

        return parsed.data;
    } catch {
        return null;
    }
};

function getAuthHeaders() {
    const token = localStorage.getItem("access_token") || "";
    return {
        Authorization: token ? `Bearer ${token}` : "",
    };
}

function getNodeLabel(node) {
    if (typeof node === "string") return node;
    return node?.campania || node?.subcampania || node?.nombre || node?.label || "";
}

function resolveCampaignId(leafLabel, node) {
    return String(
        node?.campaignId || node?.nombre || node?.subcampania || leafLabel || "",
    ).trim();
}

function getLevelBaseColor(level) {
    if (level === 0) return "rgba(59,130,246,0.28)";
    if (level === 1) return "rgba(30, 41, 59, 0.34)";
    return "rgba(51, 65, 85, 0.34)";
}

function getLevelHoverColor(level) {
    if (level === 0) return "rgba(59,130,246,0.34)";
    if (level === 1) return "rgba(30,41,59,0.44)";
    return "rgba(51,65,85,0.44)";
}

function getCategoryMarker(isActive) {
    return isActive ? "\u25BE" : "\u25B8";
}

function getNodeMarker(hasChildren, isOpen) {
    if (hasChildren) {
        return isOpen ? "\u25BE" : "\u25B8";
    }
    return "\u2022";
}

function isInboundCategory(categoryId = "") {
    return String(categoryId || "").trim() === INBOUND_MENU_CATEGORY_ID;
}

function AccordionMenu({ onLeafSelect }) {
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState(
        DEFAULT_MENU_CATEGORY_ID,
    );
    const [expandedCategoryId, setExpandedCategoryId] = useState("");
    const [data, setData] = useState(
        () => getCachedTreeByCategory(DEFAULT_MENU_CATEGORY_ID) || [],
    );
    const [open, setOpen] = useState({});
    const [loading, setLoading] = useState(
        () => !getCachedTreeByCategory(DEFAULT_MENU_CATEGORY_ID),
    );
    const [loadError, setLoadError] = useState("");
    const [basesPorCampania, setBasesPorCampania] = useState({});
    const [loadingBases, setLoadingBases] = useState({});
    const closeBranch = (stateMap, branchKey) => {
        const next = { ...stateMap };
        Object.keys(next).forEach((stateKey) => {
            if (
                stateKey === branchKey ||
                stateKey.startsWith(`${branchKey}-`)
            ) {
                next[stateKey] = false;
            }
        });
        return next;
    };

    const toggleBranch = (prevState, key, parentKey) => {
        const willOpen = !prevState[key];
        let next = { ...prevState };

        if (!willOpen) {
            return closeBranch(next, key);
        }

        const keyDepth = key.split("-").length;
        Object.keys(next).forEach((stateKey) => {
            const sameDepth = stateKey.split("-").length === keyDepth;
            const sameParent = stateKey.startsWith(parentKey);
            if (sameDepth && sameParent && stateKey !== key) {
                next = closeBranch(next, stateKey);
            }
        });

        next[key] = true;
        return next;
    };

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const rows = await listarCategoriasMenu();
                const options = rows
                    .filter((item) => item.id && item.nombre)
                    .map((item) => ({
                        id: item.id,
                        label: item.nombre,
                    }));

                setCategoryOptions(options);

                if (!options.some((item) => item.id === selectedCategoryId)) {
                    const fallbackCategoryId = String(
                        options[0]?.id || DEFAULT_MENU_CATEGORY_ID,
                    );
                    setSelectedCategoryId(fallbackCategoryId);
                }
            } catch {
                setCategoryOptions([]);
            }
        };

        loadCategories();
    }, []);

    useEffect(() => {
        const setCache = (nextData) => {
            try {
                sessionStorage.setItem(
                    getMenuCacheKey(selectedCategoryId),
                    JSON.stringify({
                        savedAt: Date.now(),
                        data: Array.isArray(nextData) ? nextData : [],
                    }),
                );
            } catch {
                // Cache opcional.
            }
        };

        const cachedData = getCachedTreeByCategory(selectedCategoryId);
        if (cachedData) {
            setData(cachedData);
            setLoadError("");
            setLoading(false);
            return;
        }

        const API_BASE = import.meta.env.VITE_API_BASE;
        const apiUrl = `${API_BASE}/api/menu/categories/${encodeURIComponent(selectedCategoryId)}/tree-detailed`;

        setLoading(true);
        setLoadError("");
        setOpen({});

        fetch(apiUrl, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                const nextData = Array.isArray(json?.data) ? json.data : [];
                setData(nextData);
                setCache(nextData);
            })
            .catch(() => {
                setData([]);
                setLoadError("No se pudo cargar el menÃƒÆ’Ã‚Âº de campaÃƒÆ’Ã‚Â±as");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedCategoryId]);

    function renderTree(nodes, level = 0, parentKey = "", pathLabels = []) {
        if (!Array.isArray(nodes) || nodes.length === 0) return null;

        return (
            <ul style={level === 0 ? styles.menu : styles.submenu}>
                {nodes.map((node, idx) => {
                    const key = parentKey + idx;
                    const children = Array.isArray(node?.subcampanias)
                        ? node.subcampanias
                        : [];
                    const hasChildren = children.length > 0;
                    const isOpen = open[key];
                    const label = getNodeLabel(node);
                    const campaignId = resolveCampaignId(label, node);
                    const menuItemId = String(node?.id || "").trim();
                    const categoryId = String(
                        node?.categoryId || selectedCategoryId || "",
                    ).trim();
                    const isInboundNode = isInboundCategory(categoryId);
                    const canExpand = hasChildren && !isInboundNode;
                    const bases = basesPorCampania[campaignId] || [];
                    const isLoadingBases = loadingBases[campaignId];

                    return (
                        <li
                            key={key}
                            style={{
                                minWidth: 0,
                                marginBottom: 3,
                                ...(level === 0
                                    ? {
                                          fontWeight: 600,
                                          fontSize: "0.77rem",
                                      }
                                    : {}),
                            }}
                        >
                            <button
                                type="button"
                                style={{
                                    ...styles.menuItem,
                                    ...(isOpen ? styles.menuItemActive : {}),
                                    paddingLeft: 8 + 8 * level,
                                    paddingRight: 8,
                                    paddingTop: 7,
                                    paddingBottom: 7,
                                    userSelect: "none",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    boxShadow: "none",
                                    marginBottom: 0,
                                    backgroundColor: getLevelBaseColor(level),
                                    width: "100%",
                                    borderRadius: "0.45rem",
                                    textAlign: "left",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        isOpen
                                            ? "rgba(59,130,246,0.26)"
                                            : getLevelHoverColor(level);
                                    e.currentTarget.style.borderColor =
                                        "rgba(255,255,255,0.24)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        getLevelBaseColor(level);
                                    if (isOpen) {
                                        e.currentTarget.style.backgroundColor =
                                            "rgba(59,130,246,0.22)";
                                    }
                                    e.currentTarget.style.borderColor =
                                        "rgba(255,255,255,0.12)";
                                }}
                                onClick={async () => {
                                    if (canExpand) {
                                        setOpen((prev) =>
                                            toggleBranch(prev, key, parentKey),
                                        );
                                        return;
                                    }

                                    if (isInboundNode) {
                                        onLeafSelect?.({
                                            campaignId,
                                            menuItemId,
                                            categoryId,
                                            leafLabel: label,
                                            parentLabel: pathLabels.at(-1) || "",
                                            manualFlow: true,
                                        });
                                        return;
                                    }

                                    if (pathLabels.length < 1 || !campaignId) {
                                        return;
                                    }

                                    if (esGestionOutbound(campaignId)) {
                                        onLeafSelect?.({
                                            campaignId,
                                            menuItemId,
                                            categoryId,
                                            leafLabel: label,
                                            parentLabel: pathLabels.at(-1) || "",
                                        });
                                        return;
                                    }

                                    setLoadingBases((prev) => ({
                                        ...prev,
                                        [campaignId]: true,
                                    }));

                                    const resolvedBases =
                                        await fetchBasesActivasPorCampania(campaignId);

                                    setLoadingBases((prev) => ({
                                        ...prev,
                                        [campaignId]: false,
                                    }));

                                    setBasesPorCampania((prev) => ({
                                        ...prev,
                                        [campaignId]: resolvedBases,
                                    }));

                                    if (resolvedBases.length === 1) {
                                        onLeafSelect?.({
                                            campaignId,
                                            menuItemId,
                                            categoryId,
                                            importId: resolvedBases[0].importId,
                                            leafLabel: label,
                                            parentLabel: pathLabels.at(-1) || "",
                                            manualFlow: false,
                                        });
                                    } else if (resolvedBases.length > 1) {
                                        setOpen((prev) => ({
                                            ...prev,
                                            [`${key}-bases`]: true,
                                        }));
                                    } else {
                                        onLeafSelect?.({
                                            campaignId,
                                            menuItemId,
                                            categoryId,
                                            leafLabel: label,
                                            parentLabel: pathLabels.at(-1) || "",
                                            manualFlow: true,
                                        });
                                    }
                                }}
                                title={label}
                            >
                                <span
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.45rem",
                                        minWidth: 0,
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: "0.9rem",
                                            flex: "0 0 0.9rem",
                                            textAlign: "center",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {getNodeMarker(canExpand, isOpen)}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            textAlign: "left",
                                            letterSpacing: "0.01em",
                                            maxWidth: "calc(100vw - 140px)",
                                        }}
                                        title={label}
                                    >
                                        {label}
                                    </span>
                                </span>
                            </button>

                            {isLoadingBases && (
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#cbd5e1",
                                        marginLeft: 16,
                                    }}
                                >
                                    Cargando bases...
                                </div>
                            )}

                            {bases.length > 1 && open[`${key}-bases`] && (
                                <ul
                                    style={{
                                        ...styles.submenu,
                                        marginLeft: 16,
                                        maxWidth: "100%",
                                        overflowX: "auto",
                                    }}
                                >
                                    {bases.map((base) => (
                                        <li
                                            key={base.importId}
                                            style={{ maxWidth: "100%" }}
                                        >
                                            <button
                                                type="button"
                                                style={{
                                                    ...styles.menuItem,
                                                    fontSize: "0.78em",
                                                    paddingLeft: 16,
                                                    maxWidth: "100%",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={base.importId}
                                                onClick={() => {
                                                    onLeafSelect?.({
                                                        campaignId,
                                                        menuItemId,
                                                        categoryId,
                                                        importId: base.importId,
                                                        leafLabel: label,
                                                        parentLabel:
                                                            pathLabels.at(-1) || "",
                                                    });
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        maxWidth: 120,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        verticalAlign: "middle",
                                                    }}
                                                    title={base.importId}
                                                >
                                                    {base.importId}
                                                </span>
                                                <span
                                                    style={{
                                                        color: "#94a3b8",
                                                        marginLeft: 6,
                                                        verticalAlign: "middle",
                                                    }}
                                                >
                                                    ({base.pendientes} pendientes)
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {canExpand && isOpen && (
                                <div>
                                    {renderTree(
                                        children,
                                        level + 1,
                                        `${key}-`,
                                        [...pathLabels, label],
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }

    if (loading) {
        return (
            <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
                Cargando campaÃƒÆ’Ã‚Â±as...
            </div>
        );
    }

    if (loadError) {
        return (
            <div style={{ fontSize: "0.75rem", color: "#fecaca" }}>
                {loadError}
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
                width: "100%",
            }}
        >
            {categoryOptions.map((item) => {
                const isActive =
                    String(item.id || "") === String(selectedCategoryId || "");
                const isExpanded =
                    String(item.id || "") === String(expandedCategoryId || "");

                return (
                    <div key={item.id} style={{ width: "100%" }}>
                        <button
                            type="button"
                            onClick={() => {
                                const nextId = String(item.id || "");

                                if (isExpanded) {
                                    setExpandedCategoryId("");
                                    setOpen({});
                                    return;
                                }

                                setExpandedCategoryId(nextId);
                                setOpen({});

                                if (!isActive) {
                                    setSelectedCategoryId(nextId);
                                }
                            }}
                            style={{
                                width: "100%",
                                padding: "0.75rem 1rem",
                                borderRadius: "0.6rem",
                                border: isActive
                                    ? "1px solid rgba(191, 219, 254, 0.9)"
                                    : "1px solid rgba(226, 232, 240, 0.18)",
                                backgroundColor: isActive
                                    ? "#0f172a"
                                    : "rgba(15, 23, 42, 0.22)",
                                color: "#ffffff",
                                fontSize: "0.88rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "0.2s",
                            }}
                            title={item.label}
                        >
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: "0.9rem",
                                        flex: "0 0 0.9rem",
                                        textAlign: "center",
                                        fontWeight: 700,
                                    }}
                                >
                                    {getCategoryMarker(isExpanded)}
                                </span>
                                <span>{item.label}</span>
                            </span>
                        </button>

                        {isActive && isExpanded && (
                            <div style={{ marginTop: "0.45rem" }}>
                                {renderTree(data)}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default AccordionMenu;

AccordionMenu.propTypes = {
    onLeafSelect: PropTypes.func,
};


