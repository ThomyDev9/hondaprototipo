import { useState } from "react";
import { PageContainer, Tabs } from "../../components/common";
import CargarBases from "./CargarBases";
import GestionarEstadoBases from "./GestionarEstadoBases";

export default function AdministrarBases() {
    const [activeTab, setActiveTab] = useState("cargar");

    const tabs = [
        {
            id: "cargar",
            label: "Cargar Bases",
            content: <CargarBases />,
        },
        {
            id: "gestionar",
            label: "Activar/Desactivar",
            content: <GestionarEstadoBases />,
        },
    ];

    return (
        <PageContainer title="Administrar Bases" fullWidth>
            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="default"
            />
        </PageContainer>
    );
}
