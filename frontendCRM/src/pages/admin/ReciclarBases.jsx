import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Select } from "../../components/common";
import { obtenerCampaniasDesdeMenu } from "../../services/campaign.service";
import "./ReciclarBases.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function ReciclarBases() {
    const [menuCampanias, setMenuCampanias] = useState([]);
    const [loadingCampanias, setLoadingCampanias] = useState(false);
    const [loadingBases, setLoadingBases] = useState(false);
    const [loadingReciclar, setLoadingReciclar] = useState(false);
    const [campaniaPadreSeleccionada, setCampaniaPadreSeleccionada] =
        useState("");
    const [subcampaniaSeleccionada, setSubcampaniaSeleccionada] = useState("");
    const [baseSeleccionada, setBaseSeleccionada] = useState("");
    const [basesOptions, setBasesOptions] = useState([]);
    const [alert, setAlert] = useState(null);

    const isBusy = loadingCampanias || loadingBases || loadingReciclar;

    const cargarCampanias = async () => {
        try {
            setLoadingCampanias(true);
            setAlert(null);
            const tree = await obtenerCampaniasDesdeMenu();
            setMenuCampanias(Array.isArray(tree) ? tree : []);
        } catch (err) {
            console.error("Error cargando campañas:", err);
            setAlert({
                type: "error",
                message: "No se pudo cargar campañas y subcampañas",
            });
        } finally {
            setLoadingCampanias(false);
        }
    };

    useEffect(() => {
        cargarCampanias();
    }, []);

    useEffect(() => {
        const cargarBasesPorSubcampania = async () => {
            if (!subcampaniaSeleccionada) {
                setBasesOptions([]);
                setBaseSeleccionada("");
                return;
            }

            try {
                setLoadingBases(true);
                const token = localStorage.getItem("access_token") || "";
                const response = await fetch(
                    `${API_BASE}/bases/importaciones/${encodeURIComponent(subcampaniaSeleccionada)}`,
                    {
                        headers: {
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                    },
                );

                const json = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(
                        json.error || "No se pudieron cargar las bases",
                    );
                }

                // Nueva lógica: consultar el endpoint de reciclables-count para cada base
                const options = await Promise.all(
                    (json.importaciones || []).map(async (item) => {
                        const importId = String(item?.LastUpdate || "").trim();
                        if (!importId) return null;
                        try {
                            const token =
                                localStorage.getItem("access_token") || "";
                            const resp = await fetch(
                                `${API_BASE}/bases/${encodeURIComponent(subcampaniaSeleccionada)}/${encodeURIComponent(importId)}/reciclables-count`,
                                {
                                    headers: {
                                        Authorization: token
                                            ? `Bearer ${token}`
                                            : "",
                                    },
                                },
                            );
                            const data = await resp.json().catch(() => ({}));
                            const reciclables = Number(data?.reciclables || 0);
                            if (reciclables > 0) {
                                return {
                                    id: importId,
                                    label: `${importId} (${reciclables} reciclables)`,
                                };
                            }
                        } catch (e) {
                            // Si falla, no mostrar la base
                        }
                        return null;
                    }),
                );
                setBasesOptions(options.filter(Boolean));

                let stillExists = false;
                for (const option of options) {
                    if (option && option.id === baseSeleccionada) {
                        stillExists = true;
                        break;
                    }
                }
                const nextBase = stillExists
                    ? baseSeleccionada
                    : String(options[0]?.id || "");
                setBaseSeleccionada(nextBase);
            } catch (err) {
                console.error("Error cargando bases de subcampaña:", err);
                setBasesOptions([]);
                setBaseSeleccionada("");
                setAlert({
                    type: "error",
                    message:
                        err.message ||
                        "No se pudieron cargar bases para reciclar",
                });
            } finally {
                setLoadingBases(false);
            }
        };

        cargarBasesPorSubcampania();
    }, [subcampaniaSeleccionada, baseSeleccionada]);

    let basePlaceholder = "Primero subcampaña";
    if (subcampaniaSeleccionada && loadingBases) {
        basePlaceholder = "Cargando bases...";
    } else if (subcampaniaSeleccionada) {
        basePlaceholder = "Seleccione base";
    }

    const campaniaPadreOptions = useMemo(
        () =>
            (menuCampanias || [])
                .map((item) => String(item?.campania || "").trim())
                .filter(Boolean)
                .map((nombre) => ({ id: nombre, label: nombre })),
        [menuCampanias],
    );

    const subcampaniaOptions = useMemo(() => {
        const selectedParent = (menuCampanias || []).find(
            (item) => item.campania === campaniaPadreSeleccionada,
        );

        return (selectedParent?.subcampanias || [])
            .map((nombre) => String(nombre || "").trim())
            .filter(Boolean)
            .map((nombre) => ({ id: nombre, label: nombre }));
    }, [menuCampanias, campaniaPadreSeleccionada]);

    const handleReciclar = async () => {
        if (!subcampaniaSeleccionada) {
            setAlert({
                type: "error",
                message: "Selecciona una subcampaña",
            });
            return;
        }

        if (!baseSeleccionada) {
            setAlert({
                type: "error",
                message: "Selecciona la base a reciclar",
            });
            return;
        }

        const confirmReciclar = globalThis.confirm(
            `¿Seguro que deseas reciclar la base ${baseSeleccionada}?`,
        );
        if (!confirmReciclar) {
            return;
        }

        try {
            setLoadingReciclar(true);
            setAlert(null);
            const token = localStorage.getItem("access_token") || "";

            const response = await fetch(
                `${API_BASE}/admin/bases/${encodeURIComponent(subcampaniaSeleccionada)}/reciclar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                    body: JSON.stringify({
                        importId: baseSeleccionada,
                    }),
                },
            );

            const json = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(json.error || "No se pudo ejecutar reciclaje");
            }

            setAlert({
                type: "success",
                message: `Reciclaje ejecutado. Registros reciclados: ${Number(json.registros_reciclados || 0)}`,
            });
        } catch (err) {
            console.error("Error ejecutando reciclaje:", err);
            setAlert({
                type: "error",
                message: err.message || "Error ejecutando reciclaje",
            });
        } finally {
            setLoadingReciclar(false);
        }
    };

    return (
        <div className="wrapper manage-bases-wrapper">
            <div className="reciclar-bases-form">
                <Select
                    label="Campaña"
                    options={campaniaPadreOptions}
                    value={campaniaPadreSeleccionada}
                    onChange={(value) => {
                        setCampaniaPadreSeleccionada(value);
                        setSubcampaniaSeleccionada("");
                        setBaseSeleccionada("");
                    }}
                    placeholder="Seleccione campaña"
                    disabled={isBusy}
                    required
                />

                <Select
                    label="Subcampaña"
                    options={subcampaniaOptions}
                    value={subcampaniaSeleccionada}
                    onChange={setSubcampaniaSeleccionada}
                    placeholder={
                        campaniaPadreSeleccionada
                            ? "Seleccione subcampaña"
                            : "Primero campaña"
                    }
                    disabled={isBusy || !campaniaPadreSeleccionada}
                    required
                />

                <Select
                    label="Base a reciclar"
                    options={basesOptions}
                    value={baseSeleccionada}
                    onChange={setBaseSeleccionada}
                    placeholder={basePlaceholder}
                    disabled={!subcampaniaSeleccionada || isBusy}
                    required
                />

                <Button
                    type="button"
                    variant="secondary"
                    onClick={cargarCampanias}
                    disabled={isBusy}
                    className="reciclar-bases-button"
                >
                    {loadingCampanias ? "Cargando..." : "Actualizar campañas"}
                </Button>

                <Button
                    type="button"
                    variant="primary"
                    onClick={handleReciclar}
                    disabled={
                        isBusy || !subcampaniaSeleccionada || !baseSeleccionada
                    }
                    className="reciclar-bases-button"
                >
                    {loadingReciclar ? "Reciclando..." : "Ejecutar reciclaje"}
                </Button>

                {alert && (
                    <div className="manage-bases-full-row">
                        <Alert type={alert.type} message={alert.message} />
                    </div>
                )}
            </div>
        </div>
    );
}
