import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { fetchBasesActivasPorCampania } from "../services/basesActivas.service";
import { esGestionOutbound } from "../utils/gestionOutbound";

const OUTBOUND_MENU_CACHE_KEY = "outbound_menu_tree_cache";
const OUTBOUND_MENU_CACHE_TTL_MS = 60_000;

const getCachedOutboundTree = () => {
    try {
        const raw = sessionStorage.getItem(OUTBOUND_MENU_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const hasValidShape =
            parsed &&
            typeof parsed === "object" &&
            Array.isArray(parsed.data) &&
            typeof parsed.savedAt === "number";

        if (!hasValidShape) return null;
        const isFresh =
            Date.now() - parsed.savedAt < OUTBOUND_MENU_CACHE_TTL_MS;
        if (!isFresh) return null;
        return parsed.data;
    } catch {
        return null;
    }
};

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

// Recibe un árbol de cualquier profundidad y lo renderiza como acordeón vertical
function AccordionMenu({ onLeafSelect }) {
    const [data, setData] = useState(() => getCachedOutboundTree() || []);
    const [open, setOpen] = useState({});
    const [loading, setLoading] = useState(() => !getCachedOutboundTree());
    const [loadError, setLoadError] = useState("");

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
        const setCache = (nextData) => {
            try {
                sessionStorage.setItem(
                    OUTBOUND_MENU_CACHE_KEY,
                    JSON.stringify({
                        savedAt: Date.now(),
                        data: Array.isArray(nextData) ? nextData : [],
                    }),
                );
            } catch {
                // Sin acción: cache opcional.
            }
        };

        const cachedData = getCachedOutboundTree();
        if (cachedData) {
            return;
        }

        const API_BASE = import.meta.env.VITE_API_BASE;
        const apiUrl = `${API_BASE}/api/menu/outbound`;

        fetch(apiUrl)
            .then((res) => res.json())
            .then((json) => {
                const nextData = Array.isArray(json) ? json : [];
                setData(nextData);
                setCache(nextData);
            })
            .catch(() => {
                setData([]);
                setLoadError("No se pudo cargar el menú outbound");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const getNodeLabel = (node) => {
        if (typeof node === "string") return node;
        return node?.campania || node?.subcampania || node?.label || "";
    };

    const resolveCampaignId = (_pathLabels, leafLabel, node) =>
        String(node?.campaignId || leafLabel || "").trim();

    const getLevelBaseColor = (level) => {
        if (level === 0) return "rgba(59,130,246,0.28)";
        if (level === 1) return "rgba(30, 41, 59, 0.34)";
        return "rgba(51, 65, 85, 0.34)";
    };

    const getLevelHoverColor = (level) => {
        if (level === 0) return "rgba(59,130,246,0.34)";
        if (level === 1) return "rgba(30,41,59,0.44)";
        return "rgba(51,65,85,0.44)";
    };

    // Estado para bases activas por campaña
    const [basesPorCampania, setBasesPorCampania] = useState({});
    const [loadingBases, setLoadingBases] = useState({});

    // Renderiza recursivamente el árbol
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
                    const campaignId = resolveCampaignId(pathLabels, label, node);
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
                                    if (hasChildren) {
                                        setOpen(toggleBranch(open, key, parentKey));
                                        return;
                                    }
                                    if (pathLabels.length < 1) {
                                        return;
                                    }
                                    if (!campaignId) return;
                                    // Si es gestión outbound, seleccionar directamente la campaña
                                    if (esGestionOutbound(campaignId)) {
                                        onLeafSelect && onLeafSelect({
                                            campaignId,
                                            leafLabel: label,
                                            parentLabel: pathLabels.at(-1) || "",
                                        });
                                        return;
                                    }
                                    setLoadingBases((prev) => ({ ...prev, [campaignId]: true }));
                                    const bases = await fetchBasesActivasPorCampania(campaignId);
                                    setLoadingBases((prev) => ({ ...prev, [campaignId]: false }));
                                    setBasesPorCampania((prev) => ({ ...prev, [campaignId]: bases }));
                                    if (bases.length === 1) {
                                        onLeafSelect && onLeafSelect({
                                            campaignId,
                                            importId: bases[0].importId,
                                            leafLabel: label,
                                            parentLabel: pathLabels.at(-1) || "",
                                        });
                                    } else if (bases.length > 1) {
                                        setOpen((prev) => ({ ...prev, [key + "-bases"]: true }));
                                    }
                                }}
                                title={node.campania || node}
                            >
                                <span
                                    style={{
                                        display: "block",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        textAlign: "left",
                                        letterSpacing: "0.01em",
                                        maxWidth: "calc(100vw - 120px)",
                                    }}
                                    title={label}
                                >
                                    {label}
                                </span>
                            </button>
                            {/* Submenú de bases activas si hay más de una */}
                            {isLoadingBases && (
                                <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginLeft: 16 }}>
                                    Cargando bases...
                                </div>
                            )}
                            {bases.length > 1 && open[key + "-bases"] && (
                                <ul style={{ ...styles.submenu, marginLeft: 16, maxWidth: "100%", overflowX: "auto" }}>
                                    {bases.map((base) => (
                                        <li key={base.importId} style={{ maxWidth: "100%" }}>
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
                                                    onLeafSelect && onLeafSelect({
                                                        campaignId,
                                                        importId: base.importId,
                                                        leafLabel: label,
                                                        parentLabel: pathLabels.at(-1) || "",
                                                    });
                                                }}
                                            >
                                                <span style={{
                                                    display: "inline-block",
                                                    maxWidth: 120,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    verticalAlign: "middle",
                                                }} title={base.importId}>
                                                    {base.importId}
                                                </span>
                                                <span style={{ color: "#94a3b8", marginLeft: 6, verticalAlign: "middle" }}>
                                                    ({base.pendientes} pendientes)
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {hasChildren && isOpen && (
                                <div>
                                    {renderTree(
                                        children,
                                        level + 1,
                                        key + "-",
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
                Cargando campañas...
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

    return renderTree(data);
}

export default AccordionMenu;

AccordionMenu.propTypes = {
    onLeafSelect: PropTypes.func,
};
