import PropTypes from "prop-types";

export default function AgentScriptTabs({
    scriptEntries,
    activeScriptKey,
    onChange,
}) {
    if (!scriptEntries.length) {
        return null;
    }

    return (
        <section className="agent-script-tabs">
            <div className="agent-script-tabs__header">
                <h3>Guiones de campana</h3>
            </div>
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
