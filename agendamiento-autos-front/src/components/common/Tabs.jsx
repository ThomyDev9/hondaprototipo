import React from "react";
import "./Tabs.css";

export default function Tabs({
    tabs,
    activeTab,
    onChange,
    variant = "default",
}) {
    return (
        <div className={`tabs tabs--${variant}`}>
            <div className="tabs__nav">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tabs__button ${
                            activeTab === tab.id ? "tabs__button--active" : ""
                        }`.trim()}
                        onClick={() => onChange(tab.id)}
                        type="button"
                    >
                        {tab.label}
                        {tab.badge ? (
                            <span className="tabs__badge">{tab.badge}</span>
                        ) : null}
                    </button>
                ))}
            </div>
            <div className="tabs__content">
                {tabs.find((t) => t.id === activeTab)?.content}
            </div>
        </div>
    );
}
