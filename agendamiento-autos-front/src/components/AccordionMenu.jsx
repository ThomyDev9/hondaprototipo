import { useEffect, useState } from "react";

const styles = {
    menu: {
        listStyle: "none",
        padding: 0,
        width: "100%",
        maxHeight: "60vh",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "transparent",
        borderRadius: "0.5rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    },
    menuItem: {
        position: "relative",
        color: "#090909",
        fontWeight: 500,
        fontSize: "0.93rem",
        borderRadius: "4px",
        cursor: "pointer",
        backgroundColor: "rgb(112, 111, 111)",
        transition: "background 0.2s",
        display: "flex",
        alignItems: "center",
        gap: "0.15rem",
        minWidth: 0,
        whiteSpace: "normal",
        overflow: "hidden",
        textOverflow: "clip",
        lineHeight: 1.1,
    },
    menuItemActive: {
        backgroundColor: "rgba(29,78,216,0.10)",
        color: "#2563EB",
    },
    submenu: {
        paddingLeft: 1,
    },
};

// Recibe un árbol de cualquier profundidad y lo renderiza como acordeón vertical
function AccordionMenu({ onLeafSelect }) {
    const [data, setData] = useState([]);
    const [open, setOpen] = useState({});

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

    useEffect(() => {
        const apiUrl =
            window.location.hostname === "localhost"
                ? "http://localhost:4004/api/menu/outbound"
                : "/api/menu/outbound";
        fetch(apiUrl)
            .then((res) => res.json())
            .then(setData);
    }, []);

    const getNodeLabel = (node) => {
        if (typeof node === "string") return node;
        return node?.campania || node?.subcampania || node?.label || "";
    };

    const resolveCampaignId = (_pathLabels, leafLabel, node) =>
        String(node?.campaignId || leafLabel || "").trim();

    // Renderiza recursivamente el árbol
    function renderTree(nodes, level = 0, parentKey = "", pathLabels = []) {
        if (!Array.isArray(nodes) || nodes.length === 0) return null;
        return (
            <ul style={level === 0 ? styles.menu : styles.submenu}>
                {nodes.map((node, idx) => {
                    const key = parentKey + idx;
                    const children = Array.isArray(node && node.subcampanias)
                        ? node.subcampanias
                        : [];
                    const hasChildren = children.length > 0;
                    const isOpen = open[key];
                    const label = getNodeLabel(node);
                    return (
                        <li
                            key={key}
                            style={{
                                minWidth: 0,
                                marginBottom: 1,
                                ...(level === 0
                                    ? { fontWeight: 600, fontSize: "0.5rem" }
                                    : {}),
                            }}
                        >
                            <div
                                style={{
                                    ...styles.menuItem,
                                    ...(isOpen ? styles.menuItemActive : {}),
                                    paddingLeft: 2 * level,
                                    userSelect: "none",
                                    border:
                                        level === 0
                                            ? "1.2px solid #2563EB"
                                            : "1px solid #e5e7eb",
                                    boxShadow:
                                        level === 0
                                            ? "0 1px 2px rgba(29,78,216,0.08)"
                                            : "0 1px 2px rgba(0,0,0,0.04)",
                                    marginBottom: 0,
                                    backgroundColor:
                                        level === 0
                                            ? "#f1f5fb"
                                            : styles.menuItem.backgroundColor,
                                }}
                                onClick={() => {
                                    if (hasChildren) {
                                        setOpen((prev) => {
                                            const willOpen = !prev[key];
                                            let next = { ...prev };

                                            if (!willOpen) {
                                                return closeBranch(next, key);
                                            }

                                            const keyDepth =
                                                key.split("-").length;
                                            Object.keys(next).forEach(
                                                (stateKey) => {
                                                    const sameDepth =
                                                        stateKey.split("-")
                                                            .length ===
                                                        keyDepth;
                                                    const sameParent =
                                                        stateKey.startsWith(
                                                            parentKey,
                                                        );
                                                    if (
                                                        sameDepth &&
                                                        sameParent &&
                                                        stateKey !== key
                                                    ) {
                                                        next = closeBranch(
                                                            next,
                                                            stateKey,
                                                        );
                                                    }
                                                },
                                            );

                                            next[key] = true;
                                            return next;
                                        });
                                        return;
                                    }

                                    if (pathLabels.length < 1) {
                                        return;
                                    }

                                    const campaignId = resolveCampaignId(
                                        pathLabels,
                                        label,
                                        node,
                                    );
                                    if (campaignId && onLeafSelect) {
                                        onLeafSelect({
                                            campaignId,
                                            leafLabel: label,
                                            parentLabel:
                                                pathLabels[
                                                    pathLabels.length - 1
                                                ] || "",
                                        });
                                    }
                                }}
                                title={node.campania || node}
                            >
                                <span
                                    style={{
                                        fontWeight: 500,
                                        color: hasChildren
                                            ? "#181817"
                                            : "#181817",
                                        display: "inline-block",
                                        textAlign: "center",
                                    }}
                                >
                                    {hasChildren ? (isOpen ? "▼" : "▶") : "•"}
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "clip",
                                        wordBreak: "break-word",
                                        whiteSpace: "normal",
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
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

    return renderTree(data);
}

export default AccordionMenu;
