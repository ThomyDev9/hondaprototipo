import { useCallback, useEffect, useMemo, useState } from "react";
import "./NivelesGestionAdmin.css";
import {
    PageContainer,
    Alert,
    Button,
    Select,
    Table,
    Tabs,
    TwoSelectRow,
} from "../../components/common";
import {
    listarArbolCampaniasPorCategoria,
    listarNivelesGestion,
    crearNivelesGestionMasivo,
    actualizarNivelGestion,
    listarSugerenciasNivelesGestion,
} from "../../services/managementLevels.service";
import {
    DEFAULT_MENU_CATEGORY_ID,
    listarCategoriasMenu,
} from "../../services/campaign.service";

function isFlexibleManagementCategoryLabel(label = "") {
    const normalized = String(label || "")
        .trim()
        .toLowerCase();
    return normalized.includes("inbound") || normalized.includes("redes");
}

export default function NivelesGestionAdmin() {
    const [activeTab, setActiveTab] = useState("view");
    const [categoryId, setCategoryId] = useState(DEFAULT_MENU_CATEGORY_ID);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [campaignTree, setCampaignTree] = useState([]);
    const [selectedCampaignParentId, setSelectedCampaignParentId] =
        useState("");
    const [selectedSubcampaignId, setSelectedSubcampaignId] = useState("");
    const [rows, setRows] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [loadingRows, setLoadingRows] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rowActionLoadingId, setRowActionLoadingId] = useState("");
    const [alert, setAlert] = useState(null);
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [level1, setLevel1] = useState("");
    const [level2, setLevel2] = useState("");
    const [level2Pool, setLevel2Pool] = useState([]);
    const [level1Suggestions, setLevel1Suggestions] = useState([]);
    const [level2Suggestions, setLevel2Suggestions] = useState([]);
    const [descriptionSuggestions, setDescriptionSuggestions] = useState([]);
    const [nextFlexibleCode, setNextFlexibleCode] = useState(null);
    const [editingId, setEditingId] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editLevel1, setEditLevel1] = useState("");
    const [editLevel2, setEditLevel2] = useState("");
    const effectiveCampaignId = String(selectedSubcampaignId || "").trim();
    const selectedCategory = categoryOptions.find(
        (item) => String(item?.id || "") === String(categoryId || "").trim(),
    );
    const isFlexibleCategory = isFlexibleManagementCategoryLabel(
        selectedCategory?.label,
    );

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const rows = await listarCategoriasMenu();
                const options = rows
                    .filter((item) => item.id && item.nombre)
                    .map((item) => ({
                        id: item.id,
                        label: item.nombre,
                    }));
                setCategoryOptions(options);
                if (!options.some((item) => item.id === categoryId)) {
                    setCategoryId(
                        String(options[0]?.id || DEFAULT_MENU_CATEGORY_ID),
                    );
                }
            } catch (error) {
                setAlert({
                    type: "error",
                    message:
                        error.message || "No se pudieron cargar categorias",
                });
            }
        };

        loadCategories();
    }, []);
    const campaignOptions = useMemo(
        () =>
            (campaignTree || [])
                .filter(
                    (item) =>
                        String(item?.estado || "").toLowerCase() === "activo",
                )
                .map((item) => ({
                    id: String(item.id || ""),
                    label: String(item.campania || "").trim(),
                }))
                .filter((item) => item.id && item.label),
        [campaignTree],
    );

    const subcampaignOptions = useMemo(() => {
        const parent = (campaignTree || []).find(
            (item) =>
                String(item.id || "") === String(selectedCampaignParentId),
        );

        return (parent?.subcampanias || [])
            .filter(
                (item) => String(item?.estado || "").toLowerCase() === "activo",
            )
            .map((item) => {
                const name = String(item?.nombre || "").trim();
                return {
                    id: name,
                    label: name,
                };
            })
            .filter((item) => item.id && item.label);
    }, [campaignTree, selectedCampaignParentId]);

    const tableColumns = useMemo(
        () => [
            { key: "CampaignId", label: "CampaignId" },
            { key: "Description", label: "Categorización" },
            { key: "Code", label: "Code", width: "90px" },
            { key: "Level1", label: "Level1" },
            { key: "Level2", label: "Level2" },
            { key: "State", label: "State" },
        ],
        [],
    );

    const activeRows = useMemo(
        () => (rows || []).filter((row) => String(row?.State || "") === "1"),
        [rows],
    );

    const selectedEditRow = useMemo(
        () =>
            (rows || []).find(
                (row) => String(row?.Id || "") === String(editingId),
            ) || null,
        [rows, editingId],
    );

    const level1Options = useMemo(
        () =>
            (level1Suggestions || [])
                .map((item) => ({
                    id: String(item?.level1 || "").trim(),
                    label: `${String(item?.level1 || "").trim()} Â· Code ${String(
                        item?.code ?? "",
                    )}`,
                    code: String(item?.code ?? "").trim(),
                }))
                .filter((item) => item.id && item.code),
        [level1Suggestions],
    );

    const selectedLevel1Option = useMemo(
        () =>
            level1Options.find(
                (item) => String(item.id) === String(level1 || "").trim(),
            ) || null,
        [level1Options, level1],
    );

    const level2SuggestedValues = useMemo(() => {
        const currentCode = String(code || "").trim();
        if (!currentCode) {
            return [];
        }

        const values = (level2Suggestions || [])
            .filter((item) => String(item?.code ?? "").trim() === currentCode)
            .map((item) => String(item?.level2 || "").trim())
            .filter(Boolean);

        return [...new Set(values)];
    }, [level2Suggestions, code]);

    const descriptionSuggestionOptions = useMemo(
        () =>
            (descriptionSuggestions || [])
                .map((item) => ({
                    description: String(item?.description || "").trim(),
                    code: Number(item?.code),
                }))
                .filter(
                    (item) => item.description && Number.isFinite(item.code),
                ),
        [descriptionSuggestions],
    );

    const codeByDescription = useMemo(() => {
        const map = new Map();
        for (const item of descriptionSuggestionOptions) {
            const key = item.description.toLowerCase();
            if (!map.has(key)) {
                map.set(key, item.code);
            }
        }
        return map;
    }, [descriptionSuggestionOptions]);

    const level2PoolRows = useMemo(
        () =>
            level2Pool.map((value, index) => ({
                id: `${index}-${value}`,
                level2: value,
            })),
        [level2Pool],
    );

    const level2PoolColumns = [
        { key: "level2", label: "Level2" },
        {
            key: "actions",
            label: "AcciÃ³n",
            width: "130px",
            render: (_, row) => (
                <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveLevel2FromPool(row?.level2)}
                    disabled={saving}
                >
                    Quitar
                </Button>
            ),
        },
    ];

    const tableColumnsEdit = [
        { key: "Description", label: "Categorización" },
        { key: "Level1", label: "Level1" },
        { key: "Level2", label: "Level2" },
        {
            key: "State",
            label: "State",
            width: "110px",
            render: (value) => (String(value || "") === "1" ? "1" : "0"),
        },
        {
            key: "actions",
            label: "Acciones",
            width: "230px",
            render: (_, row) => {
                const rowId = String(row?.Id || "");
                const isInactive = String(row?.State || "") === "0";
                const isBusyEdit = rowActionLoadingId === `edit-${rowId}`;
                const isBusyDeactivate =
                    rowActionLoadingId === `deactivate-${rowId}`;

                return (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={isBusyEdit || isBusyDeactivate}
                            onClick={() => handleStartEdit(row)}
                        >
                            {isBusyEdit ? "..." : "Editar"}
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            disabled={
                                isInactive || isBusyEdit || isBusyDeactivate
                            }
                            onClick={() => handleDeactivate(row)}
                        >
                            {isBusyDeactivate ? "..." : "Desactivar"}
                        </Button>
                    </div>
                );
            },
        },
    ];

    const tabs = [
        {
            id: "view",
            label: "Ver niveles",
            content: (
                <div className="niveles-gestion-wrapper">
                    <div className="niveles-gestion-maxwidth">
                        <TwoSelectRow
                            marginBottom="0"
                            first={{
                                label: "Campaña",
                                options: campaignOptions,
                                value: selectedCampaignParentId,
                                onChange: setSelectedCampaignParentId,
                                placeholder: "Selecciona campaña",
                                disabled: loadingCampaigns,
                                required: true,
                            }}
                            second={{
                                label: "Subcampaña",
                                options: subcampaignOptions,
                                value: selectedSubcampaignId,
                                onChange: setSelectedSubcampaignId,
                                placeholder: "Selecciona subcampaña",
                                disabled:
                                    loadingCampaigns ||
                                    !selectedCampaignParentId,
                                required: true,
                            }}
                        />
                    </div>

                    <h3 style={{ marginTop: 0 }}>Niveles activos (State=1)</h3>
                    <Table
                        columns={tableColumns}
                        data={activeRows}
                        keyField="Id"
                        loading={loadingRows}
                        noDataMessage={
                            effectiveCampaignId
                                ? "No hay niveles activos para esta campaña"
                                : "Selecciona una campaña para ver niveles"
                        }
                    />
                </div>
            ),
        },
        {
            id: "create",
            label: "Crear niveles",
            content: (
                <div className="niveles-gestion-wrapper">
                    <TwoSelectRow
                        first={{
                            label: "Campaña",
                            options: campaignOptions,
                            value: selectedCampaignParentId,
                            onChange: setSelectedCampaignParentId,
                            placeholder: "Selecciona campaña",
                            disabled: loadingCampaigns,
                            required: true,
                        }}
                        second={{
                            label: "Subcampaña",
                            options: subcampaignOptions,
                            value: selectedSubcampaignId,
                            onChange: setSelectedSubcampaignId,
                            placeholder: "Selecciona subcampaña",
                            disabled:
                                loadingCampaigns || !selectedCampaignParentId,
                            required: true,
                        }}
                    />

                    <div className="niveles-gestion-wrapper">
                        <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                            Crear pool dinÃ¡mico de Level2
                        </h3>

                        <div className="niveles-gestion-grid">
                            {isFlexibleCategory && (
                                <label className="label">
                                    <span>Categorización</span>
                                    <input
                                        className="input"
                                        list="description-suggestions"
                                        value={description}
                                        onChange={(e) =>
                                            setDescription(e.target.value)
                                        }
                                        placeholder="Ej: Información general"
                                    />
                                    <datalist id="description-suggestions">
                                        {descriptionSuggestionOptions.map(
                                            (item) => (
                                                <option
                                                    key={`${item.description}-${item.code}`}
                                                    value={item.description}
                                                />
                                            ),
                                        )}
                                    </datalist>
                                </label>
                            )}

                            {isFlexibleCategory ? (
                                <label className="label">
                                    <span>Level1</span>
                                    <input
                                        className="input"
                                        list="level1-suggestions"
                                        value={level1}
                                        onChange={(e) =>
                                            setLevel1(e.target.value)
                                        }
                                        placeholder="Escribe el motivo"
                                    />
                                    <datalist id="level1-suggestions">
                                        {level1Options.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            />
                                        ))}
                                    </datalist>
                                </label>
                            ) : (
                                <Select
                                    label="Level1"
                                    options={level1Options}
                                    value={level1}
                                    onChange={setLevel1}
                                    placeholder={
                                        loadingSuggestions
                                            ? "Cargando Level1..."
                                            : "Selecciona Level1"
                                    }
                                    disabled={loadingSuggestions}
                                />
                            )}

                            <label className="label">
                                <span>Code</span>
                                <input
                                    className="input"
                                    type="number"
                                    min="0"
                                    value={code}
                                    readOnly
                                    placeholder={
                                        isFlexibleCategory
                                            ? "Automático por categorización"
                                            : "Se asigna por Level1"
                                    }
                                />
                            </label>

                            <label className="label">
                                <span>Level2 (nuevo o sugerido)</span>
                                <input
                                    className="input"
                                    list="level2-suggestions"
                                    value={level2}
                                    onChange={(e) => setLevel2(e.target.value)}
                                    placeholder="Ej: No contesta"
                                />
                                <datalist id="level2-suggestions">
                                    {level2SuggestedValues.map((item) => (
                                        <option key={item} value={item} />
                                    ))}
                                </datalist>
                            </label>

                            <Button
                                type="button"
                                onClick={handleCreate}
                                disabled={
                                    saving ||
                                    !effectiveCampaignId ||
                                    (!isFlexibleCategory &&
                                        !selectedLevel1Option)
                                }
                            >
                                Agregar al pool
                            </Button>
                        </div>

                        {/* <div className="niveles-gestion-fileInfo">
                            Ejemplos antiguos para este Level1:
                        </div>
                        <div className="niveles-gestion-pool">
                            {level2SuggestedValues.length > 0 ? (
                                level2SuggestedValues
                                    .slice(0, 12)
                                    .map((item) => (
                                        <Button
                                            key={item}
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            disabled={saving}
                                            onClick={() =>
                                                handleAddLevel2ToPool(item)
                                            }
                                        >
                                            {item}
                                        </Button>
                                    ))
                            ) : (
                                <span className="niveles-gestion-fileInfo">
                                    Sin ejemplos para este Level1
                                </span>
                            )}
                        </div> */}

                        <div className="niveles-gestion-fileInfo">
                            Pool actual: {level2Pool.length} Level2
                        </div>

                        <Table
                            columns={level2PoolColumns}
                            data={level2PoolRows}
                            keyField="id"
                            loading={false}
                            noDataMessage="AÃºn no agregas Level2 al pool"
                        />

                        <div className="niveles-gestion-actions">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={saving || level2Pool.length === 0}
                                onClick={() => setLevel2Pool([])}
                            >
                                Limpiar pool
                            </Button>

                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleCreateBulk}
                                disabled={
                                    saving ||
                                    !effectiveCampaignId ||
                                    (!isFlexibleCategory &&
                                        !selectedLevel1Option) ||
                                    level2Pool.length === 0
                                }
                            >
                                {saving
                                    ? "Guardando..."
                                    : "Guardar todo el pool"}
                            </Button>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: "edit",
            label: "Editar niveles",
            content: (
                <div className="niveles-gestion-wrapper">
                    <TwoSelectRow
                        first={{
                            label: "Campaña",
                            options: campaignOptions,
                            value: selectedCampaignParentId,
                            onChange: setSelectedCampaignParentId,
                            placeholder: "Selecciona campaña",
                            disabled: loadingCampaigns,
                            required: true,
                        }}
                        second={{
                            label: "Subcampaña",
                            options: subcampaignOptions,
                            value: selectedSubcampaignId,
                            onChange: setSelectedSubcampaignId,
                            placeholder: "Selecciona subcampaña",
                            disabled:
                                loadingCampaigns || !selectedCampaignParentId,
                            required: true,
                        }}
                    />

                    <div className="niveles-gestion-wrapper">
                        {!editingId && (
                            <Table
                                columns={tableColumnsEdit}
                                data={rows}
                                keyField="Id"
                                loading={loadingRows}
                                noDataMessage={
                                    effectiveCampaignId
                                        ? "No hay niveles para esta subcampaña"
                                        : "Selecciona una subcampaña para editar"
                                }
                            />
                        )}

                        {editingId && (
                            <div
                                style={{
                                    width: "100%",
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: "0.75rem",
                                    alignItems: "end",
                                }}
                            >
                                {isFlexibleCategory && (
                                    <label className="label">
                                        <span>Categorización</span>
                                        <input
                                            className="input"
                                            value={editDescription}
                                            onChange={(e) =>
                                                setEditDescription(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Ej: Información general"
                                        />
                                    </label>
                                )}

                                <label className="label">
                                    <span>Level1</span>
                                    <input
                                        className="input"
                                        value={editLevel1}
                                        onChange={(e) =>
                                            setEditLevel1(e.target.value)
                                        }
                                        placeholder="Ej: NU1 REGESTIONABLES"
                                    />
                                </label>

                                <label className="label">
                                    <span>Level2</span>
                                    <input
                                        className="input"
                                        value={editLevel2}
                                        onChange={(e) =>
                                            setEditLevel2(e.target.value)
                                        }
                                        placeholder="Ej: No contesta"
                                    />
                                </label>

                                <Button
                                    type="button"
                                    variant="primary"
                                    disabled={saving || !selectedEditRow}
                                    onClick={handleUpdate}
                                >
                                    {saving
                                        ? "Guardando..."
                                        : "Guardar ediciÃ³n"}
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={saving}
                                    onClick={handleCancelEdit}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
    ];

    const loadCampaigns = useCallback(async () => {
        try {
            setLoadingCampaigns(true);
            const data = await listarArbolCampaniasPorCategoria(categoryId);
            setCampaignTree(Array.isArray(data) ? data : []);

            const activeCampaigns = (Array.isArray(data) ? data : []).filter(
                (item) => String(item?.estado || "").toLowerCase() === "activo",
            );

            if (activeCampaigns.length > 0 && !selectedCampaignParentId) {
                setSelectedCampaignParentId(
                    String(activeCampaigns[0].id || ""),
                );
            }
        } catch (error) {
            setAlert({
                type: "error",
                message: error.message || "No se pudo cargar campañas",
            });
        } finally {
            setLoadingCampaigns(false);
        }
    }, [categoryId, selectedCampaignParentId]);

    useEffect(() => {
        if (!selectedCampaignParentId) {
            setSelectedSubcampaignId("");
            return;
        }

        const exists = subcampaignOptions.some(
            (item) => String(item.id) === String(selectedSubcampaignId),
        );

        if (!exists) {
            setSelectedSubcampaignId(String(subcampaignOptions[0]?.id || ""));
        }
    }, [selectedCampaignParentId, subcampaignOptions, selectedSubcampaignId]);

    const loadRows = useCallback(async () => {
        if (!effectiveCampaignId) {
            setRows([]);
            return;
        }

        try {
            setLoadingRows(true);
            const data = await listarNivelesGestion(effectiveCampaignId);
            setRows(data);
        } catch (error) {
            setRows([]);
            setAlert({
                type: "error",
                message:
                    error.message || "No se pudo cargar niveles de gestiÃ³n",
            });
        } finally {
            setLoadingRows(false);
        }
    }, [effectiveCampaignId]);

    const loadSuggestions = useCallback(async () => {
        try {
            setLoadingSuggestions(true);
            const data = await listarSugerenciasNivelesGestion(categoryId);
            setLevel1Suggestions(
                Array.isArray(data?.level1) ? data.level1 : [],
            );
            setLevel2Suggestions(
                Array.isArray(data?.level2) ? data.level2 : [],
            );
            setDescriptionSuggestions(
                Array.isArray(data?.descriptions) ? data.descriptions : [],
            );
            setNextFlexibleCode(
                Number.isFinite(Number(data?.nextCode))
                    ? Number(data.nextCode)
                    : null,
            );
        } catch (error) {
            setLevel1Suggestions([]);
            setLevel2Suggestions([]);
            setDescriptionSuggestions([]);
            setNextFlexibleCode(null);
            setAlert({
                type: "error",
                message:
                    error.message ||
                    "No se pudieron cargar sugerencias de niveles",
            });
        } finally {
            setLoadingSuggestions(false);
        }
    }, [categoryId]);

    useEffect(() => {
        loadCampaigns();
    }, [loadCampaigns]);

    useEffect(() => {
        loadSuggestions();
    }, [loadSuggestions]);

    useEffect(() => {
        loadRows();
    }, [loadRows]);

    useEffect(() => {
        if (isFlexibleCategory) {
            const normalizedDescription = String(description || "")
                .trim()
                .toLowerCase();
            if (!normalizedDescription) {
                setCode("");
                return;
            }

            const existingCode = codeByDescription.get(normalizedDescription);
            if (Number.isFinite(existingCode)) {
                setCode(String(existingCode));
                return;
            }

            if (Number.isFinite(nextFlexibleCode)) {
                setCode(String(nextFlexibleCode));
                return;
            }

            setCode("");
            return;
        }

        if (!selectedLevel1Option) {
            setCode("");
            return;
        }

        setCode(String(selectedLevel1Option.code || ""));
    }, [
        codeByDescription,
        description,
        isFlexibleCategory,
        nextFlexibleCode,
        selectedLevel1Option,
    ]);

    useEffect(() => {
        setLevel2("");
        setLevel2Pool([]);
    }, [level1]);

    useEffect(() => {
        if (!isFlexibleCategory) {
            setDescription("");
        }
    }, [isFlexibleCategory]);

    useEffect(() => {
        setEditingId("");
        setEditDescription("");
        setEditLevel1("");
        setEditLevel2("");
    }, [effectiveCampaignId]);

    async function handleCreate() {
        setAlert(null);

        if (!effectiveCampaignId) {
            setAlert({ type: "error", message: "Selecciona un CampaignId" });
            return;
        }

        if (!selectedLevel1Option && !isFlexibleCategory) {
            setAlert({
                type: "error",
                message: "Selecciona un Level1 vÃ¡lido de la lista",
            });
            return;
        }

        if (!String(level1 || "").trim()) {
            setAlert({
                type: "error",
                message: "Ingresa un Level1",
            });
            return;
        }

        if (isFlexibleCategory && !String(description || "").trim()) {
            setAlert({
                type: "error",
                message: "Ingresa una categorización",
            });
            return;
        }

        const level2Value = String(level2 || "").trim();
        if (!level2Value) {
            setAlert({
                type: "error",
                message: "Ingresa un Level2",
            });
            return;
        }

        const alreadyExists = level2Pool.some(
            (item) => String(item).toLowerCase() === level2Value.toLowerCase(),
        );
        if (alreadyExists) {
            setAlert({
                type: "error",
                message: "Ese Level2 ya estÃ¡ en el pool",
            });
            return;
        }

        setLevel2Pool((prev) => [...prev, level2Value]);
        setLevel2("");
    }

    // function handleAddLevel2ToPool(value) {
    //     const nextValue = String(value || "").trim();
    //     if (!nextValue) {
    //         return;
    //     }

    //     setLevel2Pool((prev) => {
    //         const alreadyExists = prev.some(
    //             (item) =>
    //                 String(item).toLowerCase() === nextValue.toLowerCase(),
    //         );
    //         if (alreadyExists) {
    //             return prev;
    //         }
    //         return [...prev, nextValue];
    //     });
    // }

    function handleRemoveLevel2FromPool(value) {
        const target = String(value || "")
            .trim()
            .toLowerCase();
        setLevel2Pool((prev) =>
            prev.filter((item) => String(item).trim().toLowerCase() !== target),
        );
    }

    async function handleCreateBulk() {
        setAlert(null);

        if (!effectiveCampaignId) {
            setAlert({ type: "error", message: "Selecciona un CampaignId" });
            return;
        }

        const codeValue = isFlexibleCategory ? 0 : Number(code);
        if (
            !isFlexibleCategory &&
            (!Number.isFinite(codeValue) || codeValue < 0)
        ) {
            setAlert({
                type: "error",
                message: "Code debe ser numÃ©rico y >= 0",
            });
            return;
        }

        if (!selectedLevel1Option && !isFlexibleCategory) {
            setAlert({
                type: "error",
                message: "Selecciona un Level1 vÃ¡lido de la lista",
            });
            return;
        }

        if (!String(level1 || "").trim()) {
            setAlert({
                type: "error",
                message: "Ingresa un Level1",
            });
            return;
        }

        if (level2Pool.length === 0) {
            setAlert({
                type: "error",
                message: "Agrega al menos un Level2 al pool",
            });
            return;
        }

        try {
            setSaving(true);
            const response = await crearNivelesGestionMasivo({
                categoryId,
                campaignId: effectiveCampaignId,
                code: codeValue,
                isgoal: 1,
                description: String(description || "").trim(),
                level1: String(level1 || "").trim(),
                level2List: level2Pool,
                state: 1,
            });

            setAlert({
                type: "success",
                message:
                    response.message || "Pool de niveles creado correctamente",
            });

            setLevel2Pool([]);
            setLevel2("");
            await loadRows();
        } catch (error) {
            setAlert({
                type: "error",
                message: error.message || "No se pudo crear el pool de niveles",
            });
        } finally {
            setSaving(false);
        }
    }

    function handleStartEdit(row) {
        const id = String(row?.Id || "");
        if (!id) {
            return;
        }

        setRowActionLoadingId(`edit-${id}`);
        setEditingId(id);
        setEditDescription(String(row?.Description || ""));
        setEditLevel1(String(row?.Level1 || ""));
        setEditLevel2(String(row?.Level2 || ""));
        setRowActionLoadingId("");
    }

    function handleCancelEdit() {
        setEditingId("");
        setEditDescription("");
        setEditLevel1("");
        setEditLevel2("");
    }

    async function handleUpdate() {
        setAlert(null);

        if (!effectiveCampaignId) {
            setAlert({ type: "error", message: "Selecciona un CampaignId" });
            return;
        }

        if (!editingId) {
            setAlert({ type: "error", message: "Selecciona un registro" });
            return;
        }

        if (!selectedEditRow) {
            setAlert({ type: "error", message: "Registro no vÃ¡lido" });
            return;
        }

        const codeValue = Number(selectedEditRow.Code || 0);
        if (!Number.isFinite(codeValue) || codeValue < 0) {
            setAlert({
                type: "error",
                message: "Code debe ser numÃ©rico y >= 0",
            });
            return;
        }

        if (
            !String(editLevel1 || "").trim() ||
            !String(editLevel2 || "").trim()
        ) {
            setAlert({
                type: "error",
                message: "Level1 y Level2 son obligatorios",
            });
            return;
        }

        if (isFlexibleCategory && !String(editDescription || "").trim()) {
            setAlert({
                type: "error",
                message:
                    "Categorización es obligatoria para campañas inbound y redes",
            });
            return;
        }

        try {
            setSaving(true);
            setRowActionLoadingId(`edit-${editingId}`);
            const response = await actualizarNivelGestion(editingId, {
                categoryId,
                campaignId: effectiveCampaignId,
                code: codeValue,
                isgoal: Number(selectedEditRow.Isgoal || 1) === 1 ? 1 : 0,
                description: String(editDescription || "").trim(),
                level1: String(editLevel1 || "").trim(),
                level2: String(editLevel2 || "").trim(),
                state: Number(selectedEditRow.State || 1) === 0 ? 0 : 1,
            });

            setAlert({
                type: "success",
                message: response.message || "Nivel actualizado correctamente",
            });
            await loadRows();
            handleCancelEdit();
        } catch (error) {
            setAlert({
                type: "error",
                message: error.message || "No se pudo actualizar el nivel",
            });
        } finally {
            setSaving(false);
            setRowActionLoadingId("");
        }
    }

    async function handleDeactivate(row) {
        if (!effectiveCampaignId) {
            setAlert({ type: "error", message: "Selecciona un CampaignId" });
            return;
        }

        const id = String(row?.Id || "");
        if (!id) {
            return;
        }

        if (String(row?.State || "") === "0") {
            return;
        }

        const confirmDeactivate = globalThis.confirm(
            "Â¿Seguro que deseas desactivar este nivel?",
        );
        if (!confirmDeactivate) {
            return;
        }

        try {
            setRowActionLoadingId(`deactivate-${id}`);
            const response = await actualizarNivelGestion(id, {
                categoryId,
                campaignId: effectiveCampaignId,
                code: Number(row?.Code || 0),
                isgoal: Number(row?.Isgoal || 1) === 1 ? 1 : 0,
                description: String(row?.Description || "").trim(),
                level1: String(row?.Level1 || "").trim(),
                level2: String(row?.Level2 || "").trim(),
                state: 0,
            });

            setAlert({
                type: "success",
                message: response.message || "Nivel desactivado correctamente",
            });
            await loadRows();
            if (String(editingId) === id) {
                handleCancelEdit();
            }
        } catch (error) {
            setAlert({
                type: "error",
                message: error.message || "No se pudo desactivar el nivel",
            });
        } finally {
            setRowActionLoadingId("");
        }
    }

    return (
        <PageContainer fullWidth>
            {alert && <Alert type={alert.type} message={alert.message} />}

            <Select
                label="Categoria"
                options={categoryOptions}
                value={categoryId}
                onChange={(value) => {
                    setCategoryId(value);
                    setSelectedCampaignParentId("");
                    setSelectedSubcampaignId("");
                    setRows([]);
                }}
                disabled={loadingCampaigns}
            />

            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="default"
            />
        </PageContainer>
    );
}
