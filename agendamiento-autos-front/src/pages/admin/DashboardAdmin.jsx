import { useEffect, useMemo, useState } from "react";
import {
    Title,
    Button,
    Alert,
    Table,
    Select,
    PageContainer,
} from "../../components/common";
import { obtenerCampaniasActivas } from "../../services/campaign.service";
import "./DashboardAdmin.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function DashboardAdmin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [campaignId, setCampaignId] = useState("");
    const [baseName, setBaseName] = useState("");

    const [rows, setRows] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [basesByCampaign, setBasesByCampaign] = useState([]);

    const token = localStorage.getItem("access_token") || "";

    const campaignOptions = useMemo(
        () => campaigns.map((id) => ({ id, label: id })),
        [campaigns],
    );

    const baseOptions = useMemo(
        () => basesByCampaign.map((id) => ({ id, label: id })),
        [basesByCampaign],
    );

    const loadResumen = async (
        nextCampaignId = campaignId,
        nextBaseName = baseName,
    ) => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            if (nextCampaignId) params.set("campaignId", nextCampaignId);
            if (nextBaseName) params.set("baseName", nextBaseName);

            const response = await fetch(
                `${API_BASE}/admin/bases-resumen${
                    params.toString() ? `?${params.toString()}` : ""
                }`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            const json = await response.json();

            if (!response.ok) {
                throw new Error(
                    json.error || "No se pudo cargar la gestión de bases",
                );
            }

            setRows(json.bases || []);
            setBasesByCampaign(json.filtros?.basesByCampaign || []);
        } catch (err) {
            console.error(err);
            setError(err.message || "Error cargando datos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadCampaignOptions = async () => {
            try {
                const options = await obtenerCampaniasActivas();
                setCampaigns(options.map((opt) => opt.id));
            } catch (err) {
                console.error("Error cargando campañas activas:", err);
            }
        };

        loadCampaignOptions();
        loadResumen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCampaignChange = async (value) => {
        setCampaignId(value);
        setBaseName("");
        await loadResumen(value, "");
    };

    const handleBaseChange = async (value) => {
        setBaseName(value);
        await loadResumen(campaignId, value);
    };

    const handleClearFilters = async () => {
        setCampaignId("");
        setBaseName("");
        await loadResumen("", "");
    };

    const columns = [
        { key: "campaign_id", label: "Campaña" },
        { key: "base", label: "Base" },
        {
            key: "avance",
            label: "Avance",
            render: (value) => `${value || 0}%`,
        },
    ];

    return (
        <PageContainer fullWidth>
            <div className="bases-admin-container">
                <div className="bases-admin-header">
                    <Title level="h4">Ver bases</Title>

                    <div className="bases-admin-actions">
                        <Button
                            variant="secondary"
                            onClick={handleClearFilters}
                            disabled={loading}
                        >
                            Limpiar filtros
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => loadResumen()}
                            disabled={loading}
                        >
                            {loading ? "Actualizando..." : "Actualizar"}
                        </Button>
                    </div>
                </div>

                <div className="bases-admin-filters">
                    <Select
                        label="Campaña"
                        options={campaignOptions}
                        value={campaignId}
                        onChange={handleCampaignChange}
                        placeholder="Selecciona una campaña"
                    />

                    <Select
                        label="Base"
                        options={baseOptions}
                        value={baseName}
                        onChange={handleBaseChange}
                        placeholder={
                            campaignId
                                ? "Selecciona una base"
                                : "Primero selecciona campaña"
                        }
                        disabled={!campaignId}
                    />
                </div>

                {error && (
                    <Alert type="error" message={error} closable={false} />
                )}

                <Table
                    columns={columns}
                    data={rows}
                    keyField="base_id"
                    loading={loading}
                    noDataMessage="No hay datos para los filtros seleccionados."
                />
            </div>
        </PageContainer>
    );
}
