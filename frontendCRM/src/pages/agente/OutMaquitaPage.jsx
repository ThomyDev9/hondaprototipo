import React from "react";
import OutMaquitaMailFlow from "./OutMaquitaMailFlow";
import OutMaquitaRrssFlow from "./OutMaquitaRrssFlow";
import { OUT_MAQUITA_FLOW_OPTIONS } from "./outMaquitaConfig";
import "./OutMaquitaPage.css";

export default function OutMaquitaPage() {
    const [selectedFlow, setSelectedFlow] = React.useState("");

    if (selectedFlow === "mail") {
        return <OutMaquitaMailFlow onBack={() => setSelectedFlow("")} />;
    }

    if (selectedFlow === "rrss") {
        return <OutMaquitaRrssFlow onBack={() => setSelectedFlow("")} />;
    }

    return (
        <div className="outmaquita-selector-page">
            <div className="outmaquita-selector-shell">
                <h1 className="outmaquita-selector-title">
                    Out Maquita Cushunchic
                </h1>
                <p className="outmaquita-selector-subtitle">
                    Selecciona el origen antes de abrir el formulario.
                </p>
                <div className="outmaquita-selector-grid">
                    {OUT_MAQUITA_FLOW_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className="outmaquita-selector-card"
                            onClick={() => setSelectedFlow(option.id)}
                        >
                            <span className="outmaquita-selector-card__eyebrow">
                                Out Maquita
                            </span>
                            <strong>{option.title}</strong>
                            <span>{option.description}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
