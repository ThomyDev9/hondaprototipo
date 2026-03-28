import PropTypes from "prop-types";
import { useState } from "react";

export default function AgentScriptTabs({
    scriptEntries,
    activeScriptKey,
    onChange,
}) {
    if (!scriptEntries.length) {
        return null;
    }

    const [collapsed, setCollapsed] = useState(false);

    return (
        <section
            className={`agent-script-tabs ${
                collapsed ? "agent-script-tabs--collapsed" : ""
            }`}
        >
            <div className="agent-script-tabs__header">
                <h3>Guiones de campaña</h3>
                <button
                    type="button"
                    className="agent-script-tabs__toggle"
                    onClick={() => setCollapsed((prev) => !prev)}
                >
                    {collapsed ? "Mostrar" : "Ocultar"}
                </button>
            </div>
            {!collapsed && (
                <>
                    <div className="agent-script-tabs__nav">
                        {scriptEntries.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                className={`agent-script-tabs__button ${
                                    activeScriptKey === key ? "is-active" : ""
                                }`}
                                onClick={() => onChange(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="agent-script-tabs__content">
                        {scriptEntries
                            .filter(({ key }) => key === activeScriptKey)
                            .map(({ key, text }) => (
                                <p
                                    className="agent-script-card__text"
                                    key={key}
                                    dangerouslySetInnerHTML={{ __html: text }}
                                />
                            ))}
                    </div>
                </>
            )}
        </section>
    );
}

AgentScriptTabs.propTypes = {
    scriptEntries: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            text: PropTypes.string.isRequired,
        }),
    ).isRequired,
    activeScriptKey: PropTypes.string,
    onChange: PropTypes.func.isRequired,
};
