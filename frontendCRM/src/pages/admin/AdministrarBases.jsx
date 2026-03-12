import { useState } from "react";
import { PageContainer, Tabs } from "../../components/common";
import CargarBases from "./CargarBases";
import GestionarEstadoBases from "./GestionarEstadoBases";
import DashboardAdmin from "./DashboardAdmin";
import ReciclarBases from "./ReciclarBases";

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
        {
            id: "ver-bases",
            label: "Ver bases",
            content: <DashboardAdmin />,
        },
        {
            id: "reciclar-bases",
            label: "Reciclar bases",
            content: <ReciclarBases />,
        },
    ];

    return (
        <PageContainer fullWidth>
            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="default"
            />
        </PageContainer>
    );
}
