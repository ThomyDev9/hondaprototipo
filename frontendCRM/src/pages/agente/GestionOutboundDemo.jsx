import React, { useState } from "react";
import { formF2Template } from "../../templates/formF2Template";
import FormularioDinamico from "../../components/FormularioDinamico";

export default function GestionOutboundDemo() {
    const [result, setResult] = useState(null);
    return (
        <div
            style={{
                maxWidth: 500,
                margin: "0 auto",
                background: "#fff",
                borderRadius: 8,
                padding: 24,
                boxShadow: "0 2px 8px #0001",
            }}
        >
            <h2>Gestión Outbound · Formulario F2</h2>
            <FormularioDinamico
                template={formF2Template}
                onSubmit={setResult}
            />
            {result && (
                <pre
                    style={{
                        background: "#f3f4f6",
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 6,
                    }}
                >
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    );
}
