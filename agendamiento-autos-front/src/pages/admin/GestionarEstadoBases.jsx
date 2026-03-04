import { useState, useEffect } from "react";
import { Select, Alert, Table, Badge } from "../../components/common";
import { obtenerCampaniasDesdeMenu } from "../../services/campaign.service";
import "./CargarBases.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function GestionarEstadoBases() {
    const [menuCampanias, setMenuCampanias] = useState([]);
    const [campaniaPadreSeleccionada, setCampaniaPadreSeleccionada] =
        useState("");
    const [subcampaniaSeleccionada, setSubcampaniaSeleccionada] = useState("");
    const [importacionesConEstado, setImportacionesConEstado] = useState([]);
    const [filtroEstado, setFiltroEstado] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    useEffect(() => {
        cargarCampanias();
    }, []);

    useEffect(() => {
        if (subcampaniaSeleccionada) {
            cargarImportacionesConEstado(subcampaniaSeleccionada);
        } else {
            setImportacionesConEstado([]);
        }
    }, [subcampaniaSeleccionada]);

    const cargarCampanias = async () => {
        try {
            const tree = await obtenerCampaniasDesdeMenu();
            setMenuCampanias(tree);
        } catch (err) {
            console.error("Error cargando campañas:", err);
            setAlert({
                type: "error",
                message: "Error al cargar campañas y subcampañas",
            });
        }
    };

    const campaniaPadreOptions = menuCampanias
        .map((item) => item.campania)
        .filter(Boolean)
        .map((nombre) => ({ id: nombre, label: nombre }));

    const subcampaniaOptions = (
        menuCampanias.find(
            (item) => item.campania === campaniaPadreSeleccionada,
        )?.subcampanias || []
    ).map((nombre) => ({ id: nombre, label: nombre }));

    const cargarImportacionesConEstado = async (campaignId) => {
        try {
            setLoading(true);
            setAlert(null);
            const token = localStorage.getItem("access_token");

            const response = await fetch(
                `${API_BASE}/bases/importaciones-estado/${encodeURIComponent(campaignId)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const json = await response.json();
            const rows = (json.importaciones || []).map((imp) => ({
                LastUpdate: imp.LastUpdate,
                BaseState: String(imp.BaseState ?? "1").trim() || "1",
            }));

            setImportacionesConEstado(rows);

            if (rows.length === 0) {
                setAlert({
                    type: "error",
                    message: "No hay importaciones para esta subcampaña",
                });
            }
        } catch (err) {
            console.error("Error cargando importaciones:", err);
            setAlert({
                type: "error",
                message: `Error al cargar importaciones: ${err.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    const ejecutarAccionBase = async (row) => {
        if (!subcampaniaSeleccionada || !row?.LastUpdate) return;
        if (!filtroEstado) return;

        const action =
            String(row.BaseState).trim() === "1" ? "desactivar" : "activar";

        try {
            setLoading(true);
            setAlert(null);
            const token = localStorage.getItem("access_token");

            const response = await fetch(`${API_BASE}/bases/administrar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    campaignId: subcampaniaSeleccionada,
                    importDate: row.LastUpdate,
                    action,
                }),
            });

            const json = await response.json();
            if (!response.ok) {
                throw new Error(json.error || "Error al administrar base");
            }

            setAlert({
                type: "success",
                message: json.message || "Operación exitosa",
            });

            const nextState = action === "desactivar" ? "0" : "1";
            setImportacionesConEstado((prev) =>
                prev.map((item) =>
                    item.LastUpdate === row.LastUpdate
                        ? { ...item, BaseState: nextState }
                        : item,
                ),
            );

            await cargarImportacionesConEstado(subcampaniaSeleccionada);
        } catch (err) {
            console.error("Error administrando base:", err);
            setAlert({
                type: "error",
                message: err.message || "Error al administrar base",
            });
        } finally {
            setLoading(false);
        }
    };

    const tableColumns = [
        {
            key: "LastUpdate",
            label: "Importación",
        },
        {
            key: "BaseState",
            label: "Estado",
            render: (value) => {
                const isActive = String(value).trim() === "1";
                return (
                    <Badge variant={isActive ? "success" : "secondary"}>
                        {isActive ? "Activa" : "Inactiva"}
                    </Badge>
                );
            },
        },
    ];

    let targetState = null;
    if (filtroEstado === "activas") {
        targetState = "1";
    } else if (filtroEstado === "inactivas") {
        targetState = "0";
    }
    const importacionesFiltradas = importacionesConEstado.filter(
        (item) =>
            targetState !== null &&
            String(item?.BaseState ?? "1").trim() === targetState,
    );

    const tableActions =
        filtroEstado === "activas" || filtroEstado === "inactivas"
            ? [
                  {
                      label:
                          filtroEstado === "activas" ? "Desactivar" : "Activar",
                      variant: "default",
                      onClick: ejecutarAccionBase,
                  },
              ]
            : [];

    return (
        <div className="wrapper manage-bases-wrapper">
            <div className="form manage-bases-compact-row">
                <Select
                    label="Seleccionar Campaña"
                    options={campaniaPadreOptions}
                    value={campaniaPadreSeleccionada}
                    onChange={(value) => {
                        setCampaniaPadreSeleccionada(value);
                        setSubcampaniaSeleccionada("");
                    }}
                    placeholder="Seleccione campaña"
                    disabled={loading}
                    required
                />

                <Select
                    label="Seleccionar Subcampaña"
                    options={subcampaniaOptions}
                    value={subcampaniaSeleccionada}
                    onChange={setSubcampaniaSeleccionada}
                    placeholder={
                        campaniaPadreSeleccionada
                            ? "Seleccione subcampaña..."
                            : "Primero campaña"
                    }
                    disabled={!campaniaPadreSeleccionada || loading}
                    required
                />

                <Select
                    label="Filtrar Estado"
                    options={[
                        { id: "activas", label: "Bases Activas" },
                        { id: "inactivas", label: "Bases Inactivas" },
                    ]}
                    value={filtroEstado}
                    onChange={setFiltroEstado}
                    placeholder="Seleccione filtro"
                    required
                />

                <div className="manage-bases-full-row manage-bases-content-panel">
                    {subcampaniaSeleccionada && filtroEstado ? (
                        <Table
                            columns={tableColumns}
                            data={importacionesFiltradas}
                            actions={tableActions}
                            keyField="LastUpdate"
                            noDataMessage="No hay bases para mostrar"
                        />
                    ) : (
                        <div className="manage-bases-empty">
                            {subcampaniaSeleccionada
                                ? "Selecciona un filtro de estado para ver las bases."
                                : "Selecciona una subcampaña para ver las bases y su estado."}
                        </div>
                    )}
                </div>

                {alert && (
                    <div className="manage-bases-full-row">
                        <Alert type={alert.type} message={alert.message} />
                    </div>
                )}
            </div>
        </div>
    );
}
