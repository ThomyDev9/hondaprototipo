import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
    PageContainer,
    Tabs,
    Select,
    Button,
    Alert,
    Table,
    Badge,
} from "../../components/common";
import VerCampaniasActivas from "./VerCampaniasActivas";
import {
    DEFAULT_MENU_CATEGORY_ID,
    listarCategoriasMenu,
} from "../../services/campaign.service";
import "./CampaniasAdmin.css";

const API_BASE = import.meta.env.VITE_API_BASE;

async function parseJsonSafe(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error("Respuesta no válida del servidor");
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem("access_token") || "";
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

function buildCategoryBaseUrl(categoryId) {
    const normalizedCategoryId =
        String(categoryId || DEFAULT_MENU_CATEGORY_ID).trim() ||
        DEFAULT_MENU_CATEGORY_ID;
    return `${API_BASE}/api/menu/categories/${encodeURIComponent(normalizedCategoryId)}`;
}

function CrearCampaniaOSubcampaniaForm({
    categoryId,
    categoryLabel,
    reloadToken,
    onCreated,
}) {
    const [tipoCreacion, setTipoCreacion] = useState("");
    const [campaniasPadre, setCampaniasPadre] = useState([]);
    const [parentId, setParentId] = useState("");
    const [nombre, setNombre] = useState("");
    const [loadingParents, setLoadingParents] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [alert, setAlert] = useState(null);

    const isSubcampania = tipoCreacion === "subcampania";
    const creationLabel = isSubcampania ? "subcampaña" : "campaña";
    let submitLabel = "Crear campaña";
    if (loadingSubmit) {
        submitLabel = "Guardando...";
    } else if (isSubcampania) {
        submitLabel = "Crear subcampaña";
    }

    useEffect(() => {
        const loadParents = async () => {
            if (tipoCreacion !== "subcampania") {
                setCampaniasPadre([]);
                setParentId("");
                return;
            }

            try {
                setLoadingParents(true);
                const response = await fetch(
                    `${buildCategoryBaseUrl(categoryId)}/parents`,
                    {
                        headers: getAuthHeaders(),
                    },
                );

                const json = await parseJsonSafe(response);
                if (!response.ok) {
                    throw new Error(
                        json.error || "Error cargando campañas padre",
                    );
                }

                const options = (json.data || []).map((item) => ({
                    id: item.id,
                    label: item.nombre,
                }));
                setCampaniasPadre(options);
            } catch (err) {
                setAlert({
                    type: "error",
                    message: err.message || "Error cargando campañas padre",
                });
            } finally {
                setLoadingParents(false);
            }
        };

        loadParents();
    }, [categoryId, tipoCreacion, reloadToken]);

    const validateCreateForm = () => {
        if (!tipoCreacion) {
            return "Selecciona qué deseas crear";
        }

        const nombreLimpio = nombre.trim();
        if (!nombreLimpio) {
            return isSubcampania
                ? "Ingresa el nombre de la subcampaña"
                : "Ingresa el nombre de la campaña";
        }

        if (isSubcampania && !parentId) {
            return "Selecciona una campaña padre";
        }

        return "";
    };

    const buildCreatePayload = () => {
        const nombreLimpio = nombre.trim();
        const url = isSubcampania
            ? `${buildCategoryBaseUrl(categoryId)}/subcampaigns`
            : `${buildCategoryBaseUrl(categoryId)}/campaigns`;
        const body = isSubcampania
            ? { parentId, nombre: nombreLimpio }
            : { nombre: nombreLimpio };
        return { url, body };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAlert(null);

        const validationError = validateCreateForm();
        if (validationError) {
            setAlert({
                type: "error",
                message: validationError,
            });
            return;
        }

        try {
            setLoadingSubmit(true);
            const { url, body } = buildCreatePayload();

            const response = await fetch(url, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });

            const json = await parseJsonSafe(response);
            if (!response.ok) {
                throw new Error(json.error || `Error creando ${creationLabel}`);
            }

            setAlert({
                type: "success",
                message: json.message || `${creationLabel} creada`,
            });
            setNombre("");
            if (isSubcampania) {
                setParentId("");
            }
            onCreated?.();
        } catch (err) {
            setAlert({
                type: "error",
                message: err.message || `Error creando ${creationLabel}`,
            });
        } finally {
            setLoadingSubmit(false);
        }
    };

    return (
        <div className="wrapper">
            <form onSubmit={handleSubmit} className="form">
                <Select
                    label="Categoria"
                    options={[{ id: categoryId, label: categoryLabel }]}
                    value={categoryId}
                    onChange={() => {}}
                    disabled
                />

                <Select
                    label="Qué deseas crear"
                    options={[
                        { id: "campania", label: "Campaña" },
                        { id: "subcampania", label: "Subcampaña" },
                    ]}
                    value={tipoCreacion}
                    onChange={(value) => {
                        setTipoCreacion(value);
                        setParentId("");
                        setNombre("");
                        setAlert(null);
                    }}
                    placeholder="Seleccione opción"
                    required
                />

                {isSubcampania && (
                    <Select
                        label="Campaña padre"
                        options={campaniasPadre}
                        value={parentId}
                        onChange={setParentId}
                        placeholder="Seleccione campaña"
                        disabled={loadingParents}
                        required
                    />
                )}

                <label className="label" htmlFor="nombre-crear-item">
                    {isSubcampania ? "Nombre subcampaña" : "Nombre campaña"}
                </label>
                <input
                    id="nombre-crear-item"
                    type="text"
                    className="input"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={
                        isSubcampania
                            ? "Ej: BVF PRE APROBADOS - TRAMO 2"
                            : "Ej: BANCO PRUEBA OUTBOUND"
                    }
                />

                {alert && <Alert type={alert.type} message={alert.message} />}

                <Button
                    type="submit"
                    disabled={loadingSubmit || loadingParents || !tipoCreacion}
                >
                    {submitLabel}
                </Button>
            </form>
        </div>
    );
}

CrearCampaniaOSubcampaniaForm.propTypes = {
    categoryId: PropTypes.string.isRequired,
    categoryLabel: PropTypes.string.isRequired,
    reloadToken: PropTypes.number.isRequired,
    onCreated: PropTypes.func,
};

function AdministrarEstadoCampanias({ categoryId, reloadToken }) {
    const [campaignRows, setCampaignRows] = useState([]);
    const [subcampaignMap, setSubcampaignMap] = useState({});
    const [adminTarget, setAdminTarget] = useState("campanias");
    const [selectedCampaignId, setSelectedCampaignId] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const loadTree = useCallback(async () => {
        try {
            setLoading(true);
            setAlert(null);
            const response = await fetch(
                `${buildCategoryBaseUrl(categoryId)}/admin-tree`,
                {
                    headers: getAuthHeaders(),
                },
            );

            const json = await parseJsonSafe(response);
            if (!response.ok) {
                throw new Error(json.error || "Error cargando campañas");
            }

            const nextCampaignRows = [];
            const nextSubcampaignMap = {};

            (json.data || []).forEach((campania) => {
                nextCampaignRows.push({
                    id: campania.id,
                    tipo: "Campaña",
                    nombre: campania.campania,
                    estado: campania.estado,
                });

                nextSubcampaignMap[campania.id] = (
                    campania.subcampanias || []
                ).map((sub) => ({
                    id: sub.id,
                    tipo: "Subcampaña",
                    nombre: sub.nombre,
                    estado: sub.estado,
                    parentId: campania.id,
                    parentNombre: campania.campania,
                }));
            });

            setCampaignRows(nextCampaignRows);
            setSubcampaignMap(nextSubcampaignMap);

            if (
                selectedCampaignId &&
                !nextCampaignRows.some((row) => row.id === selectedCampaignId)
            ) {
                setSelectedCampaignId("");
            }
        } catch (err) {
            setAlert({
                type: "error",
                message: err.message || "Error cargando campañas",
            });
        } finally {
            setLoading(false);
        }
    }, [categoryId, selectedCampaignId]);

    useEffect(() => {
        loadTree();
    }, [reloadToken, loadTree]);

    const handleToggleEstado = async (row) => {
        const nextEstado =
            String(row.estado).toLowerCase() === "activo"
                ? "inactivo"
                : "activo";

        try {
            setLoading(true);
            setAlert(null);
            const response = await fetch(
                `${buildCategoryBaseUrl(categoryId)}/items/${encodeURIComponent(row.id)}/status`,
                {
                    method: "PATCH",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ estado: nextEstado }),
                },
            );

            const json = await parseJsonSafe(response);
            if (!response.ok) {
                throw new Error(json.error || "Error actualizando estado");
            }

            const isCampaign = row.tipo === "Campaña";

            if (isCampaign) {
                setCampaignRows((prev) =>
                    prev.map((item) =>
                        item.id === row.id
                            ? { ...item, estado: nextEstado }
                            : item,
                    ),
                );

                if (nextEstado === "inactivo") {
                    setSubcampaignMap((prev) => ({
                        ...prev,
                        [row.id]: (prev[row.id] || []).map((sub) => ({
                            ...sub,
                            estado: "inactivo",
                        })),
                    }));
                }
            } else {
                const parentId = row.parentId;
                if (parentId) {
                    setSubcampaignMap((prev) => ({
                        ...prev,
                        [parentId]: (prev[parentId] || []).map((item) =>
                            item.id === row.id
                                ? { ...item, estado: nextEstado }
                                : item,
                        ),
                    }));
                }
            }

            setAlert({
                type: "success",
                message: json.message || "Estado actualizado",
            });

            await loadTree();
        } catch (err) {
            setAlert({
                type: "error",
                message: err.message || "Error actualizando estado",
            });
        } finally {
            setLoading(false);
        }
    };

    const campaignColumns = [
        { key: "nombre", label: "Nombre" },
        {
            key: "estado",
            label: "Estado",
            render: (estado) => (
                <Badge
                    variant={
                        String(estado).toLowerCase() === "activo"
                            ? "success"
                            : "danger"
                    }
                >
                    {String(estado).toLowerCase() === "activo"
                        ? "Activo"
                        : "Inactivo"}
                </Badge>
            ),
        },
    ];

    const subcampaignColumns = [
        { key: "nombre", label: "Subcampaña" },
        {
            key: "estado",
            label: "Estado",
            render: (estado) => (
                <Badge
                    variant={
                        String(estado).toLowerCase() === "activo"
                            ? "success"
                            : "danger"
                    }
                >
                    {String(estado).toLowerCase() === "activo"
                        ? "Activo"
                        : "Inactivo"}
                </Badge>
            ),
        },
    ];

    const campaignActions = [
        {
            label: "Cambiar estado",
            variant: "default",
            onClick: handleToggleEstado,
        },
    ];

    const subcampaignActions = [
        {
            label: "Cambiar estado",
            variant: "default",
            onClick: handleToggleEstado,
        },
    ];

    const selectedSubcampaigns = selectedCampaignId
        ? subcampaignMap[selectedCampaignId] || []
        : [];
    const campaignOptions = campaignRows.map((row) => ({
        id: row.id,
        label: row.nombre,
    }));

    const tableColumns =
        adminTarget === "campanias" ? campaignColumns : subcampaignColumns;
    const tableActions =
        adminTarget === "campanias" ? campaignActions : subcampaignActions;
    const tableData =
        adminTarget === "campanias" ? campaignRows : selectedSubcampaigns;
    const tableNoDataMessage =
        adminTarget === "campanias"
            ? "No hay campañas"
            : "No hay subcampañas para esta campaña";
    return (
        <div className="form manage-bases-compact-row">
            {alert && <Alert type={alert.type} message={alert.message} />}

            <Select
                label="Qué deseas administrar"
                options={[
                    { id: "campanias", label: "Campañas" },
                    { id: "subcampanias", label: "Subcampañas" },
                ]}
                value={adminTarget}
                onChange={(value) => {
                    setAdminTarget(value);
                    if (value === "campanias") {
                        setSelectedCampaignId("");
                    }
                }}
                placeholder="Selecciona opción"
                required
            />

            {adminTarget === "subcampanias" && (
                <Select
                    label="Campaña"
                    options={campaignOptions}
                    value={selectedCampaignId}
                    onChange={setSelectedCampaignId}
                    placeholder="Selecciona campaña"
                    required
                />
            )}

            {adminTarget === "subcampanias" && !selectedCampaignId ? (
                <div className="manage-bases-empty">
                    Selecciona una campaña para ver sus subcampañas.
                </div>
            ) : (
                <Table
                    columns={tableColumns}
                    data={tableData}
                    keyField="id"
                    actions={tableActions}
                    loading={loading}
                    noDataMessage={tableNoDataMessage}
                />
            )}
        </div>
    );
}

AdministrarEstadoCampanias.propTypes = {
    categoryId: PropTypes.string.isRequired,
    reloadToken: PropTypes.number.isRequired,
};

export default function CampaniasAdmin() {
    const [activeTab, setActiveTab] = useState("ver-campanias");
    const [reloadToken, setReloadToken] = useState(0);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState(
        DEFAULT_MENU_CATEGORY_ID,
    );
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [categoryAlert, setCategoryAlert] = useState(null);

    useEffect(() => {
        const loadCategories = async () => {
            try {
                setLoadingCategories(true);
                setCategoryAlert(null);
                const rows = await listarCategoriasMenu();
                const options = rows
                    .filter((item) => item.id && item.nombre)
                    .map((item) => ({
                        id: item.id,
                        label: item.nombre,
                    }));

                setCategoryOptions(options);

                const exists = options.some(
                    (item) => item.id === selectedCategoryId,
                );
                if (!exists) {
                    setSelectedCategoryId(
                        String(options[0]?.id || DEFAULT_MENU_CATEGORY_ID),
                    );
                }
            } catch (err) {
                setCategoryAlert({
                    type: "error",
                    message: err.message || "Error cargando categorias",
                });
            } finally {
                setLoadingCategories(false);
            }
        };

        loadCategories();
    }, [selectedCategoryId]);

    const selectedCategoryLabel = useMemo(() => {
        return (
            categoryOptions.find((item) => item.id === selectedCategoryId)
                ?.label || "Categoria seleccionada"
        );
    }, [categoryOptions, selectedCategoryId]);

    const tabs = [
        {
            id: "ver-campanias",
            label: "Ver Campañas",
            content: <VerCampaniasActivas categoryId={selectedCategoryId} />,
        },
        {
            id: "crear",
            label: "Crear",
            content: (
                <CrearCampaniaOSubcampaniaForm
                    categoryId={selectedCategoryId}
                    categoryLabel={selectedCategoryLabel}
                    reloadToken={reloadToken}
                    onCreated={() => setReloadToken(Date.now())}
                />
            ),
        },
        {
            id: "administrar-estado",
            label: "Activar/Desactivar",
            content: (
                <AdministrarEstadoCampanias
                    categoryId={selectedCategoryId}
                    reloadToken={reloadToken}
                />
            ),
        },
    ];

    return (
        <PageContainer fullWidth>
            {categoryAlert && (
                <Alert
                    type={categoryAlert.type}
                    message={categoryAlert.message}
                />
            )}

            <div className="form" style={{ marginBottom: "1rem" }}>
                <Select
                    label="Categoria de campañas"
                    options={categoryOptions}
                    value={selectedCategoryId}
                    onChange={(value) => {
                        setSelectedCategoryId(value);
                        setReloadToken(Date.now());
                    }}
                    placeholder="Seleccione categoria"
                    disabled={loadingCategories || categoryOptions.length === 0}
                    required
                />
            </div>

            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="default"
            />
        </PageContainer>
    );
}
