
import { useEffect, useState } from "react";
import { FaChevronRight, FaChevronDown, FaRegDotCircle } from "react-icons/fa";

const styles = {
    menu: {
        listStyle: "none",
        margin: 0,
        padding: 0,
        width: "100%",
        maxWidth: 340,
        minWidth: 220,
        maxHeight: "60vh",
        overflowY: "auto",
        overflowX: "hidden",
        background: "#f8fafc",
        borderRadius: "0.5rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    },
    menuItem: {
        position: "relative",
        padding: "0.10rem 0.18rem 0.10rem 0.18rem",
        color: "#1D4ED8",
        fontWeight: 500,
        fontSize: "0.93rem",
        borderRadius: "4px",
        cursor: "pointer",
        background: "rgba(255,255,255,1)",
        marginBottom: "0.01rem",
        transition: "background 0.2s",
        display: "flex",
        alignItems: "center",
        gap: "0.10rem",
        minWidth: 0,
        width: "100%",
        whiteSpace: "normal",
        overflow: "hidden",
        textOverflow: "clip",
        lineHeight: 1.1,
    },
    menuItemActive: {
        background: "rgba(29,78,216,0.10)",
        color: "#2563EB",
    },
    submenu: {
        marginLeft: 4,
        borderLeft: "1px solid #e5e7eb",
        paddingLeft: 2,
    },
};

// Recibe un árbol de cualquier profundidad y lo renderiza como acordeón vertical
function AccordionMenu() {
    const [data, setData] = useState([]);
    const [open, setOpen] = useState({});

    useEffect(() => {
        const apiUrl =
            window.location.hostname === "localhost"
                ? "http://localhost:4004/api/menu/outbound"
                : "/api/menu/outbound";
        fetch(apiUrl)
            .then((res) => res.json())
            .then(setData);
    }, []);

    // Renderiza recursivamente el árbol
    function renderTree(nodes, level = 0, parentKey = "") {
        if (!Array.isArray(nodes) || nodes.length === 0) return null;
        return (
            <ul style={level === 0 ? styles.menu : styles.submenu}>
                {nodes.map((node, idx) => {
                    const key = parentKey + idx;
                    const children = Array.isArray(node && node.subcampanias)
                        ? node.subcampanias
                        : [];
                    const hasChildren = children.length > 0;
                    const isOpen = open[level] === key;
                    return (
                        <li
                            key={key}
                            style={{
                                minWidth: 0,
                                width: "100%",
                                marginBottom: 0,
                                ...(level === 0
                                    ? { fontWeight: 600, fontSize: "1rem" }
                                    : {}),
                            }}
                        >
                            <div
                                style={{
                                    ...styles.menuItem,
                                    ...(isOpen ? styles.menuItemActive : {}),
                                    paddingLeft: 4 + 8 * level,
                                    userSelect: "none",
                                    border:
                                        level === 0
                                            ? "1.2px solid #2563EB"
                                            : "1px solid #e5e7eb",
                                    boxShadow:
                                        level === 0
                                            ? "0 1px 4px rgba(29,78,216,0.08)"
                                            : "0 1px 2px rgba(0,0,0,0.04)",
                                    marginBottom: 0,
                                    background:
                                        level === 0
                                            ? "#f1f5fb"
                                            : styles.menuItem.background,
                                }}
                                onClick={() => {
                                    if (hasChildren) {
                                        setOpen((prev) => ({
                                            ...prev,
                                            [level]: isOpen ? null : key,
                                        }));
                                    }
                                }}
                                title={node.campania || node}
                            >
                                <span
                                    style={{
                                        marginRight: 4,
                                        fontWeight: 700,
                                        color: hasChildren
                                            ? "#2563EB"
                                            : "#9ca3af",
                                        minWidth: 16,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        fontSize: level === 0 ? 16 : 14,
                                    }}
                                >
                                    {hasChildren ? (
                                        isOpen ? (
                                            <FaChevronDown />
                                        ) : (
                                            <FaChevronRight />
                                        )
                                    ) : (
                                        <FaRegDotCircle />
                                    )}
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
                                    {node.campania || node}
                                </span>
                            </div>
                            {hasChildren && isOpen && (
                                <div
                                    style={{
                                        marginTop: "0.08rem",
                                        width: "100%",
                                        background: "#fff",
                                        borderRadius: "0.2rem",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                                        padding: "0.08rem 0.05rem",
                                    }}
                                >
                                    {renderTree(children, level + 1, key + "-")}
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
