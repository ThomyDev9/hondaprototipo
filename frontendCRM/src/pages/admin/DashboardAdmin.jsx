import { useEffect, useMemo, useState } from "react";
import { Button, Alert, Table, Select } from "../../components/common";
import { obtenerCampaniasDesdeMenu } from "../../services/campaign.service";
import "./DashboardAdmin.css";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function DashboardAdmin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [campaniaPadre, setCampaniaPadre] = useState("");
    const [campaignId, setCampaignId] = useState("");

    const [rows, setRows] = useState([]);
    const [menuCampanias, setMenuCampanias] = useState([]);

    const token = localStorage.getItem("access_token") || "";

    const campaniaPadreOptions = useMemo(
        () =>
            menuCampanias
                .map((item) => item.campania)
                .filter(Boolean)
                .map((nombre) => ({ id: nombre, label: nombre })),
        [menuCampanias],
    );

    const subcampaniaOptions = useMemo(
        () =>
            (
                menuCampanias.find((item) => item.campania === campaniaPadre)
                    ?.subcampanias || []
            ).map((nombre) => ({ id: nombre, label: nombre })),
        [menuCampanias, campaniaPadre],
    );

    const loadResumen = async (nextCampaignId = campaignId) => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            if (nextCampaignId) params.set("campaignId", nextCampaignId);

            const response = await fetch(
                `${API_BASE}/bases/bases-activas-resumen${
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

            setRows(json.data || []);
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
                const tree = await obtenerCampaniasDesdeMenu();
                setMenuCampanias(tree || []);
            } catch (err) {
                console.error("Error cargando campañas activas:", err);
            }
        };

        loadCampaignOptions();
        loadResumen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleParentCampaignChange = async (value) => {
        setCampaniaPadre(value);
        setCampaignId("");
        setRows([]);
    };

    const handleSubcampaignChange = async (value) => {
        setCampaignId(value);
        await loadResumen(value);
    };

    const handleClearFilters = async () => {
        setCampaniaPadre("");
        setCampaignId("");
        setRows([]);
    };

    const columns = [
        { key: "campaign_id", label: "Campaña" },
        { key: "base", label: "Base" },
        {
            key: "sin_gestionar",
            label: "Por gestionar",
        },
        {
            key: "registros",
            label: "Total registros",
        },
        {
            key: "estado_base",
            label: "Estado",
        },
        {
            key: "avance",
            label: "Avance",
            render: (value) => `${value || 0}%`,
        },
    ];

    return (
        <div className="bases-admin-container">
            <div className="bases-admin-filters">
                <Select
                    label="Campaña"
                    options={campaniaPadreOptions}
                    value={campaniaPadre}
                    onChange={handleParentCampaignChange}
                    placeholder="Selecciona una campaña"
                />

                <Select
                    label="Subcampaña"
                    options={subcampaniaOptions}
                    value={campaignId}
                    onChange={handleSubcampaignChange}
                    placeholder={
                        campaniaPadre
                            ? "Selecciona una subcampaña"
                            : "Primero selecciona campaña"
                    }
                    disabled={!campaniaPadre}
                />

                <Button
                    variant="secondary"
                    onClick={handleClearFilters}
                    disabled={loading}
                    className="bases-admin-filter-button"
                >
                    Limpiar filtros
                </Button>

                <Button
                    variant="primary"
                    onClick={() => loadResumen()}
                    disabled={loading}
                    className="bases-admin-filter-button"
                >
                    {loading ? "Actualizando..." : "Actualizar"}
                </Button>
            </div>

            {error && <Alert type="error" message={error} closable={false} />}

            <Table
                columns={columns}
                data={rows}
                keyField="base_id"
                loading={loading}
                noDataMessage="No hay datos para los filtros seleccionados."
            />
        </div>
    );
}
