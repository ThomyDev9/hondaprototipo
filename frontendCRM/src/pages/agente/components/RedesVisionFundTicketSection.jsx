import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import Button from "../../../components/common/Button";
import {
    createTicketClient,
    createExternalTicket,
    fetchTicketCanals,
    fetchTicketCanalTypes,
    fetchTicketClientByIdentification,
    fetchTicketProductsByType,
    fetchTicketTopProducts,
    fetchTicketReasons,
    fetchTicketTypes,
    fetchTicketCatalogFromCascade,
    fetchTicketAgencies,
    fetchTicketProvinces,
    fetchTicketCantonsByProvince,
    sendTicketCreateMail,
    fetchTicketCurrentUser,
    createTicketLocation,
} from "../../../services/dashboard.service";

const REQUIRED_STAGE_ONE = new Set([
    "id_type",
    "id_number",
    "client_name",
    "email",
    "phone",
    "gender",
    "main_street",
    "secondary_street",
    "house_number",
]);

const REQUIRED_STAGE_TWO = new Set([
    "happened_in_ecuador",
    "incident_province",
    "incident_canton",
    "incident_city",
    "incident_type",
    "incident_product",
    "complaint_reason",
    "incident_reason",
    "area",
    "incident_amount",
    "channel_type",
    "channel",
    "agency",
    "catalog_id",
]);

const STAGE_ONE_FIELDS = [
    { key: "id_type", label: "Tipo de identificacion *", type: "select" },
    { key: "id_number", label: "Cedula cliente *", type: "text" },
    { key: "client_name", label: "Nombre cliente *", type: "text" },
    { key: "email", label: "Correo cliente *", type: "email" },
    { key: "phone", label: "Telefono cliente *", type: "text" },
    { key: "gender", label: "Genero *", type: "select" },
    { key: "birth_date", label: "Fecha de nacimiento", type: "date" },
    { key: "province", label: "Provincia", type: "text" },
    { key: "canton", label: "Canton", type: "text" },
    { key: "main_street", label: "Direccion (Calle Principal) *", type: "text" },
    { key: "secondary_street", label: "Direccion (Calle Secundaria) *", type: "text" },
    { key: "house_number", label: "Nro Casa *", type: "text" },
];

export default function RedesVisionFundTicketSection({
    identification,
    fullName,
    phone,
    onSyncRedesClientData,
}) {
    const [stage, setStage] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [searchingClient, setSearchingClient] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [files, setFiles] = useState([]);
    const [typesOptions, setTypesOptions] = useState([]);
    const [topProductsOptions, setTopProductsOptions] = useState([]);
    const [productsOptions, setProductsOptions] = useState([]);
    const [incidenceOptions, setIncidenceOptions] = useState([]);
    const [catalogByAllOptions, setCatalogByAllOptions] = useState([]);
    const [canalTypeOptions, setCanalTypeOptions] = useState([]);
    const [canalOptions, setCanalOptions] = useState([]);
    const [agencyOptions, setAgencyOptions] = useState([]);
    const [provinceOptions, setProvinceOptions] = useState([]);
    const [cantonOptions, setCantonOptions] = useState([]);
    const [incidentCantonOptions, setIncidentCantonOptions] = useState([]);
    const [form, setForm] = useState({
        id_type: "C",
        id_number: String(identification || "").trim(),
        client_name: String(fullName || "").trim(),
        email: "",
        phone: String(phone || "").trim(),
        gender: "",
        birth_date: "",
        province: "",
        canton: "",
        main_street: "",
        secondary_street: "",
        house_number: "",
        happened_in_ecuador: "Si",
        incident_province: "",
        incident_canton: "",
        incident_city: "",
        incident_type: "",
        incident_product: "",
        complaint_reason: "",
        incident_reason: "",
        area: "",
        incident_amount: "0",
        channel_type: "",
        channel: "",
        agency: "",
        catalog_id: "",
        error_description: "",
    });

    const normalizeGenderValue = (raw = "") => {
        const value = String(raw || "").trim().toLowerCase();
        if (!value) return "";
        if (value === "m" || value.includes("masc")) return "Masculino";
        if (value === "f" || value.includes("fem")) return "Femenino";
        if (value.includes("otro") || value === "o") return "Otro";
        return "";
    };

    const looksLikeInternalCode = (value = "") => {
        const raw = String(value || "").trim();
        if (!raw) return false;
        const isUuidLike =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                raw,
            );
        const isLongToken = /^[a-z0-9_-]{12,}$/i.test(raw);
        return isUuidLike || isLongToken;
    };

    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            // Solo hidrata si está vacío para no pisar datos buscados/manuales.
            id_number: prev.id_number || String(identification || "").trim(),
        }));
    }, [identification]);

    useEffect(() => {
        const incomingName = String(fullName || "").trim();
        const safeName =
            incomingName && !looksLikeInternalCode(incomingName) ? incomingName : "";
        setForm((prev) => ({
            ...prev,
            // Evita reemplazar un nombre válido por códigos internos del flujo padre.
            client_name: prev.client_name || safeName,
        }));
    }, [fullName]);

    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            // Solo hidrata si está vacío para no borrar celular tras la búsqueda.
            phone: prev.phone || String(phone || "").trim(),
        }));
    }, [phone]);

    useEffect(() => {
        const load = async () => {
            try {
                setError("");
                const results = await Promise.allSettled([
                    fetchTicketTypes(),
                    fetchTicketCanalTypes(),
                    fetchTicketCanals(),
                    fetchTicketAgencies(),
                    fetchTicketProvinces(),
                ]);
                const safe = (index) =>
                    results[index]?.status === "fulfilled"
                        ? results[index].value
                        : null;

                const typesResponse = safe(0);
                const canalTypeResponse = safe(1);
                const canalResponse = safe(2);
                const agencyResponse = safe(3);
                const provinceResponse = safe(4);
                if (typesResponse?.ok) {
                    setTypesOptions(activeOnly(toList(typesResponse.json)));
                }
                if (canalTypeResponse?.ok) {
                    setCanalTypeOptions(
                        sortByLabel(
                            activeOnly(toList(canalTypeResponse.json)),
                            (item) =>
                                findFirstValue(item, [
                                    "canal_type_description",
                                    "canal_type_name",
                                    "name",
                                    "description",
                                ]),
                        ),
                    );
                }
                if (canalResponse?.ok) {
                    setCanalOptions(activeOnly(toList(canalResponse.json)));
                }
                if (agencyResponse?.ok) {
                    setAgencyOptions(activeOnly(toList(agencyResponse.json)));
                }
                if (provinceResponse?.ok) {
                    setProvinceOptions(toList(provinceResponse.json));
                }

                if (!provinceResponse?.ok && !typesResponse?.ok) {
                    throw new Error(
                        provinceResponse?.json?.detail ||
                            typesResponse?.json?.detail ||
                            "No se pudo cargar datos del formulario.",
                    );
                }
            } catch (loadError) {
                setError(loadError.message || "No se pudo cargar catalogos.");
            } finally {
            }
        };

        load();
    }, []);

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const findFirstValue = (item, keys = []) => {
        for (const key of keys) {
            const value = item?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
                return String(value).trim();
            }
        }
        return "";
    };

    const findHumanLabel = (item, preferredKeys = []) => {
        const preferred = findFirstValue(item, preferredKeys);
        if (preferred) return preferred;

        const entries = Object.entries(item || {});
        const ignoredKeys = [
            "id",
            "uuid",
            "type_id",
            "product_id",
            "top_product_id",
            "incidence_id",
            "catalog_id",
            "province_id",
            "canton_id",
            "agency_id",
            "canal_id",
            "canal_type_id",
            "is_active",
        ];

        for (const [key, value] of entries) {
            if (ignoredKeys.includes(String(key || "").toLowerCase())) continue;
            if (typeof value === "string" && value.trim()) {
                return value.trim();
            }
        }

        return "";
    };

    const getTopProductValue = (item) =>
        findFirstValue(item, [
            "top_product_id",
            "product_id",
            "id",
            "uuid",
        ]) ||
        findFirstValue(item?.top_product, ["top_product_id", "id", "uuid"]) ||
        findFirstValue(item?.product, ["product_id", "id", "uuid"]);

    const getTopProductLabel = (item) =>
        findHumanLabel(item, [
            "top_product_description",
            "top_product_name",
            "product_name",
            "name",
            "description",
            "detail",
            "service_name",
            "case_name",
        ]) ||
        findHumanLabel(item?.top_product, [
            "top_product_description",
            "top_product_name",
            "name",
            "description",
            "detail",
        ]) ||
        findHumanLabel(item?.product, [
            "product_description",
            "product_name",
            "name",
            "description",
            "detail",
        ]);

    const formatSentenceCase = (value = "") => {
        const normalized = String(value || "").trim();
        if (!normalized) return "";
        return (
            normalized.charAt(0).toUpperCase() +
            normalized.slice(1).toLowerCase()
        );
    };

    const sortByLabel = (rows = [], getLabel) =>
        [...(rows || [])].sort((a, b) =>
            String(getLabel(a) || "").localeCompare(String(getLabel(b) || ""), "es", {
                sensitivity: "base",
            }),
        );

    const getProductValue = (item) =>
        findFirstValue(item, ["product_id", "id", "uuid"]) ||
        findFirstValue(item?.product, ["product_id", "id", "uuid"]);

    const getProductLabel = (item) =>
        findHumanLabel(item, [
            "product_description",
            "product_name",
            "name",
            "description",
            "detail",
        ]) ||
        findHumanLabel(item?.product, [
            "product_description",
            "product_name",
            "name",
            "description",
            "detail",
        ]);

    const getIncidenceValue = (item) =>
        findFirstValue(item, ["incidence_id", "id", "uuid"]) ||
        findFirstValue(item?.incidence, ["incidence_id", "id", "uuid"]);

    const getIncidenceLabel = (item) =>
        findHumanLabel(item, [
            "incidence_description",
            "incidence_name",
            "name",
            "description",
            "detail",
        ]) ||
        findHumanLabel(item?.incidence, [
            "incidence_description",
            "incidence_name",
            "name",
            "description",
            "detail",
        ]);

    const getCatalogValue = (item) =>
        findFirstValue(item, ["catalog_id", "id", "uuid"]);

    const getCatalogAreaLabel = (item) =>
        findFirstValue(item?.area, [
            "area_name",
            "name",
            "area_description",
            "description",
        ]) ||
        findFirstValue(item, [
            "area_name",
            "area",
            "area_description",
            "description",
        ]);

    const toList = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== "object") return [];
        const keys = [
            "data",
            "items",
            "results",
            "rows",
            "catalog",
            "catalogs",
            "provinces",
            "cantons",
            "types",
            "canals",
            "agencies",
        ];
        for (const key of keys) {
            if (Array.isArray(payload[key])) return payload[key];
        }
        return [];
    };

    const isActiveItem = (item) => {
        const raw = item?.is_active;
        if (raw === undefined || raw === null || raw === "") return true;
        const value = String(raw).trim().toLowerCase();
        return value === "1" || value === "true";
    };

    const activeOnly = (rows = []) => (rows || []).filter(isActiveItem);

    const toReadableText = (value) => {
        if (value === undefined || value === null) return "";
        if (typeof value === "string") return value.trim();
        if (Array.isArray(value)) {
            return value
                .map((item) => toReadableText(item))
                .filter(Boolean)
                .join(", ");
        }
        if (typeof value === "object") {
            if (Array.isArray(value?.detail)) {
                const detailText = value.detail
                    .map((entry) => {
                        const loc = Array.isArray(entry?.loc)
                            ? entry.loc.join(".")
                            : "";
                        const msg = String(entry?.msg || "").trim();
                        if (!loc && !msg) return "";
                        return loc ? `${loc}: ${msg}` : msg;
                    })
                    .filter(Boolean)
                    .join(" | ");
                if (detailText) return detailText;
            }
            const preferred = [value.detail, value.error, value.message, value.msg]
                .map((item) => toReadableText(item))
                .find(Boolean);
            if (preferred) return preferred;
            try {
                return JSON.stringify(value);
            } catch (_) {
                return String(value);
            }
        }
        return String(value).trim();
    };

    const getApiErrorMessage = (response, fallback = "Ocurrio un error.") => {
        const body = response?.json;
        return (
            toReadableText(body?.detail) ||
            toReadableText(body?.error) ||
            toReadableText(body?.message) ||
            fallback
        );
    };

    const getOptionKey = (prefix, optionValue, index) => {
        const normalized = String(optionValue || "").trim();
        return normalized ? `${prefix}-${normalized}` : `${prefix}-idx-${index}`;
    };
    const isUuidLike = (value = "") =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            String(value || "").trim(),
        );
    const isMainOldTicketId = (value = "") =>
        /^\d+$/.test(String(value || "").trim());


    const resolveProvinceApiId = (selectedValue = "") => {
        const target = String(selectedValue || "").trim();
        const selected = (provinceOptions || []).find((item) => {
            const currentValue =
                findFirstValue(item, ["province_id", "id", "uuid"]) ||
                findFirstValue(item, ["province_code", "province_name", "name"]);
            return String(currentValue || "").trim() === target;
        });
        return (
            findFirstValue(selected, ["province_id", "id", "uuid"]) ||
            target
        );
    };

    const onTypeChange = async (typeId) => {
        setField("incident_type", typeId);
        setField("incident_product", "");
        setField("complaint_reason", "");
        setField("incident_reason", "");
        setField("catalog_id", "");
        setField("area", "");
        setCatalogByAllOptions([]);
        setTopProductsOptions([]);
        setProductsOptions([]);
        setIncidenceOptions([]);
        if (!typeId) return;
        const topResp = await fetchTicketProductsByType(typeId);
        if (topResp.ok) {
            setTopProductsOptions(activeOnly(toList(topResp.json)));
        }
    };

    const onTopProductChange = async (topProductId) => {
        setField("incident_product", topProductId);
        setField("complaint_reason", "");
        setField("incident_reason", "");
        setField("catalog_id", "");
        setField("area", "");
        setCatalogByAllOptions([]);
        setProductsOptions([]);
        setIncidenceOptions([]);
        const typeId = String(form.incident_type || "").trim();
        if (!typeId || !topProductId) return;
        const productsResp = await fetchTicketTopProducts({
            type_id: typeId,
            top_product_id: topProductId,
        });
        if (productsResp.ok) {
            setProductsOptions(
                sortByLabel(activeOnly(toList(productsResp.json)), getProductLabel),
            );
        }
    };

    const onProductChange = async (productId) => {
        setField("complaint_reason", productId);
        setField("incident_reason", "");
        setField("catalog_id", "");
        setField("area", "");
        setCatalogByAllOptions([]);
        setIncidenceOptions([]);
        const typeId = String(form.incident_type || "").trim();
        const topProductId = String(form.incident_product || "").trim();
        if (!typeId || !topProductId || !productId) return;
        const incidenceResp = await fetchTicketReasons({
            type_id: typeId,
            top_product_id: topProductId,
            product_id: productId,
        });
        if (incidenceResp.ok) {
            setIncidenceOptions(
                sortByLabel(activeOnly(toList(incidenceResp.json)), getIncidenceLabel),
            );
        }
    };

    const onIncidenceChange = async (incidenceId) => {
        setField("incident_reason", incidenceId);
        setField("catalog_id", "");
        setField("area", "");
        setCatalogByAllOptions([]);
        const typeId = String(form.incident_type || "").trim();
        const topProductId = String(form.incident_product || "").trim();
        const productId = String(form.complaint_reason || "").trim();
        if (!typeId || !topProductId || !productId || !incidenceId) return;
        const catalogResp = await fetchTicketCatalogFromCascade({
            type_id: typeId,
            top_product_id: topProductId,
            product_id: productId,
            incidence_id: incidenceId,
        });
        if (catalogResp.ok) {
            const list = activeOnly(toList(catalogResp.json));
            const normalizedList =
                list.length > 0
                    ? list
                    : getCatalogValue(catalogResp.json)
                      ? [catalogResp.json]
                      : [];
            const sortedList = sortByLabel(normalizedList, getCatalogAreaLabel);
            setCatalogByAllOptions(sortedList);

            if (sortedList.length > 1) {
                return;
            }

            const first = sortedList[0] || catalogResp.json || {};
            const catalogId = getCatalogValue(first);
            if (catalogId) {
                setField("catalog_id", catalogId);
            }
            const areaValue = getCatalogAreaLabel(first);
            if (areaValue) {
                setField("area", areaValue);
            }
        }
    };

    const onCatalogAreaChange = (catalogId) => {
        setField("catalog_id", catalogId);
        const selected = (catalogByAllOptions || []).find(
            (item) => getCatalogValue(item) === String(catalogId || "").trim(),
        );
        setField("area", getCatalogAreaLabel(selected));
    };

    const onProvinceChange = async (provinceId) => {
        setField("province", provinceId);
        setField("canton", "");
        setCantonOptions([]);
        if (!provinceId) return;
        const resp = await fetchTicketCantonsByProvince(
            resolveProvinceApiId(provinceId),
        );
        if (resp.ok) {
            setCantonOptions(toList(resp.json));
        }
    };

    const onIncidentProvinceChange = async (provinceId) => {
        setField("incident_province", provinceId);
        setField("incident_canton", "");
        setIncidentCantonOptions([]);
        if (!provinceId) return;
        const resp = await fetchTicketCantonsByProvince(
            resolveProvinceApiId(provinceId),
        );
        if (resp.ok) {
            setIncidentCantonOptions(toList(resp.json));
        }
    };

    const validateStageOne = () => {
        const missing = STAGE_ONE_FIELDS.filter((field) => {
            if (!REQUIRED_STAGE_ONE.has(field.key)) return false;
            return !String(form[field.key] || "").trim();
        });
        return missing.length === 0;
    };

    const validateStageTwo = () => {
        const missing = Array.from(REQUIRED_STAGE_TWO).filter((key) => {
            if (key === "incident_amount") {
                return String(form[key] ?? "").trim() === "";
            }
            return !String(form[key] || "").trim();
        });
        return missing.length === 0;
    };

    const onNextStage = () => {
        setError("");
        if (stage === 1 && !validateStageOne()) {
            setError("Completa todos los campos obligatorios (*) de la etapa 1.");
            return;
        }
        if (stage === 2 && !validateStageTwo()) {
            setError("Completa todos los campos obligatorios de la etapa 2.");
            return;
        }
        setStage((prev) => Math.min(prev + 1, 3));
    };

    const onPrevStage = () => {
        setError("");
        setStage((prev) => Math.max(prev - 1, 1));
    };

    const onSubmit = async () => {
        setMessage("");
        setError("");
        if (!validateStageOne()) {
            setError("Completa todos los campos obligatorios (*) de la etapa 1.");
            setStage(1);
            return;
        }
        if (!String(form.catalog_id || "").trim()) {
            setError("Debes seleccionar un catalogo.");
            setStage(2);
            return;
        }
        if (!String(form.error_description || "").trim()) {
            setError("La descripcion es obligatoria.");
            setStage(3);
            return;
        }

        const crmPayload = {
            flow: "main_old",
            crud: "crud_old",
            form_name: "TicketWebContact",
            id_type: "C",
            id_number: String(form.id_number || "").trim(),
            client_name: String(form.client_name || "").trim(),
            email: String(form.email || "").trim(),
            phone: String(form.phone || "").trim(),
            gender: String(form.gender || "").trim(),
            birth_date: String(form.birth_date || "").trim(),
            province: String(form.province || "").trim(),
            canton: String(form.canton || "").trim(),
            main_street: String(form.main_street || "").trim(),
            secondary_street: String(form.secondary_street || "").trim(),
            house_number: String(form.house_number || "").trim(),
            happened_in_ecuador: "Si",
            incident_province: String(form.incident_province || "").trim(),
            incident_canton: String(form.incident_canton || "").trim(),
            incident_city: String(form.incident_city || "").trim(),
            incident_type: String(form.incident_type || "").trim(),
            incident_product: String(form.incident_product || "").trim(),
            complaint_reason: String(form.complaint_reason || "").trim(),
            incident_reason: String(form.incident_reason || "").trim(),
            area: String(form.area || "").trim(),
            incident_amount: Number(form.incident_amount || 0),
            channel_type: String(form.channel_type || "").trim(),
            channel: String(form.channel || "").trim(),
            agency: String(form.agency || "").trim(),
            catalog_id: String(form.catalog_id || "").trim(),
            comment: String(form.error_description || "").trim(),
        };

        try {
            setSubmitting(true);
            // Debug temporal para inspeccionar el payload real enviado al proxy.
            // eslint-disable-next-line no-console
            console.log("[VisionFund Debug] crm payload before submit:", crmPayload);
            // eslint-disable-next-line no-console
            console.log(
                "[VisionFund Debug] files before submit:",
                (files || []).map((file) => ({
                    name: file?.name || "",
                    size: file?.size || 0,
                    type: file?.type || "",
                })),
            );
            const idNumber = String(form.id_number || "").trim();
            const existingClientResp = await fetchTicketClientByIdentification(idNumber);
            if (!existingClientResp.ok && existingClientResp.status !== 404) {
                throw new Error(
                    getApiErrorMessage(
                        existingClientResp,
                        "No se pudo validar el cliente.",
                    ),
                );
            }
            let resolvedClient = existingClientResp?.json || {};
            if (existingClientResp.status === 404) {
                const genderValue = String(form.gender || "").trim().toLowerCase();
                const genreCode = genderValue.startsWith("f")
                    ? "F"
                    : genderValue.startsWith("m")
                      ? "M"
                      : "O";
                const clientPayload = {
                    client_identification: idNumber,
                    client_name: String(form.client_name || "").trim(),
                    client_mail: String(form.email || "").trim(),
                    client_phone: String(form.phone || "").trim(),
                    id_type: {
                        identification_type_code: "C",
                    },
                    genre: {
                        genre_code: genreCode,
                    },
                    birth_date: String(form.birth_date || "").trim() || null,
                    first_street: String(form.main_street || "").trim(),
                    second_street: String(form.secondary_street || "").trim(),
                    house_number: String(form.house_number || "").trim(),
                    province: {
                        province_id: String(form.province || "").trim() || null,
                    },
                    canton: {
                        canton_id: String(form.canton || "").trim() || null,
                    },
                };
                const createClientResp = await createTicketClient(clientPayload);
                if (!createClientResp.ok) {
                    throw new Error(
                        getApiErrorMessage(
                            createClientResp,
                            "No se pudo crear el cliente.",
                        ),
                    );
                }
                resolvedClient = createClientResp?.json || {};
            }

            const selectedCatalog = (catalogByAllOptions || []).find(
                (item) => getCatalogValue(item) === String(form.catalog_id || "").trim(),
            );
            const selectedCanalType = (canalTypeOptions || []).find((item) => {
                const value = findFirstValue(item, [
                    "canal_type_code",
                    "canal_type_id",
                    "id",
                    "uuid",
                ]);
                return String(value || "").trim() === String(form.channel_type || "").trim();
            });
            const selectedCanal = (canalOptions || []).find((item) => {
                const value =
                    findFirstValue(item, ["canal_id", "id", "uuid"]) ||
                    findFirstValue(item, ["canal_code", "code", "canal_name", "name"]);
                return String(value || "").trim() === String(form.channel || "").trim();
            });

            const currentUserResp = await fetchTicketCurrentUser();
            if (!currentUserResp?.ok) {
                throw new Error(
                    getApiErrorMessage(
                        currentUserResp,
                        "No se pudo validar el usuario de tickets.",
                    ),
                );
            }
            const currentUser = currentUserResp?.json || {};
            const clientId = findFirstValue(resolvedClient, [
                "client_id",
                "id",
                "uuid",
            ]);
            const userInId = findFirstValue(currentUser, ["user_id", "id", "uuid"]);
            const userOwnId =
                findFirstValue(selectedCatalog?.users?.[0], [
                    "user_id",
                    "id",
                    "uuid",
                ]) ||
                findFirstValue(selectedCatalog, [
                    "user_own_id",
                    "owner_user_id",
                    "user_owner_id",
                ]) ||
                findFirstValue(selectedCatalog?.user_own, ["user_id", "id", "uuid"]) ||
                findFirstValue(selectedCatalog?.owner, ["user_id", "id", "uuid"]);
            const canalCode =
                findFirstValue(selectedCanal, ["canal_code", "code", "canal_name", "name"]) ||
                String(form.channel || "").trim();
            const canalTypeCode =
                findFirstValue(selectedCanalType, [
                    "canal_type_code",
                    "code",
                    "canal_type_name",
                    "name",
                ]) || String(form.channel_type || "").trim();
            const agenciaId = String(form.agency || "").trim();

            const ticketPayload = {
                status: "Abierto",
                amount: Number(form.incident_amount || 0),
                client_id: clientId,
                catalog_id: String(form.catalog_id || "").trim(),
                user_in_id: userInId,
                user_own_id: userOwnId,
                canal_code: canalCode,
                canal_type_code: canalTypeCode,
                agencia_id: agenciaId,
                condition_code: "",
            };

            const missingTicketFields = [
                "client_id",
                "catalog_id",
                "user_in_id",
                "user_own_id",
                "canal_code",
                "canal_type_code",
                "agencia_id",
            ].filter((key) => !String(ticketPayload[key] || "").trim());
            if (missingTicketFields.length > 0) {
                setError(
                    `Faltan campos para crear ticket main_old: ${missingTicketFields.join(", ")}`,
                );
                return;
            }
            const invalidUuidFields = [
                "client_id",
                "catalog_id",
                "user_in_id",
                "user_own_id",
                "agencia_id",
            ].filter((key) => !isUuidLike(ticketPayload[key]));
            if (invalidUuidFields.length > 0) {
                setError(
                    `Campos con formato UUID invalido: ${invalidUuidFields.join(", ")}`,
                );
                return;
            }
            // eslint-disable-next-line no-console
            console.log("[VisionFund Debug] ticket payload before submit:", ticketPayload);

            const response = await createExternalTicket({
                ticketData: ticketPayload,
                files,
            });
            // eslint-disable-next-line no-console
            console.log("[VisionFund Debug] create ticket response:", {
                ok: response?.ok,
                status: response?.status,
                json: response?.json,
            });
            if (!response.ok) {
                const backendError = getApiErrorMessage(
                    response,
                    "No se pudo crear el ticket.",
                );
                if (Number(response?.status) === 422) {
                    throw new Error(`Error 422 al crear ticket: ${backendError}`);
                }
                throw new Error(backendError);
            }
            const ticketRef =
                response?.json?.ticket_number ||
                response?.json?.ticket_id ||
                "sin referencia";
            const ticketIdCandidates = [
                response?.json?.ticket_id,
                response?.json?.payload?.ticket_id,
                response?.json?.data?.ticket_id,
                response?.json?.data?.payload?.ticket_id,
                response?.json?.ticket?.ticket_id,
                response?.json?.data?.ticket?.ticket_id,
                response?.json?.ticket_uuid,
                response?.json?.data?.ticket_uuid,
                response?.json?.ticket?.uuid,
                response?.json?.data?.ticket?.uuid,
                response?.json?.id,
                response?.json?.data?.id,
                response?.json?.ticket_number,
                response?.json?.data?.ticket_number,
            ]
                .map((value) => String(value || "").trim())
                .filter(Boolean);
            const createdTicketId =
                ticketIdCandidates.find(
                    (value) => isUuidLike(value) || isMainOldTicketId(value),
                ) ||
                ticketIdCandidates[0] ||
                "";
            // eslint-disable-next-line no-console
            console.log("[VisionFund Debug] ticket id for mail:", {
                ticketRef,
                createdTicketId,
                isUuid: isUuidLike(createdTicketId),
                isMainOldNumericId: isMainOldTicketId(createdTicketId),
                candidates: ticketIdCandidates,
            });
            const validMailCandidates = Array.from(
                new Set(
                    ticketIdCandidates.filter(
                        (value) => isUuidLike(value) || isMainOldTicketId(value),
                    ),
                ),
            );
            let locationWarning = "";
            if (createdTicketId) {
                const happenedInEcuador =
                    String(form.happened_in_ecuador || "").trim().toLowerCase() === "si";
                const locationPayload = happenedInEcuador
                    ? {
                        ticket_id: createdTicketId,
                        province_id: String(form.incident_province || "").trim(),
                        canton_id: String(form.incident_canton || "").trim(),
                    }
                    : {
                        ticket_id: createdTicketId,
                        country_id: String(form.incident_country || "").trim(),
                    };
                // eslint-disable-next-line no-console
                console.log("[VisionFund Debug] ticket_location payload:", locationPayload);
                const locationResp = await createTicketLocation(locationPayload);
                if (!locationResp.ok) {
                    locationWarning = getApiErrorMessage(
                        locationResp,
                        "No se pudo registrar ticket_location.",
                    );
                    // eslint-disable-next-line no-console
                    console.log("[VisionFund Debug] ticket_location failed:", {
                        status: locationResp?.status,
                        json: locationResp?.json,
                        text: locationResp?.text,
                    });
                }
            }
            if (validMailCandidates.length > 0) {
                let lastMailError = "";
                let mailSent = false;
                for (const mailTicketId of validMailCandidates) {
                    // eslint-disable-next-line no-console
                    console.log("[VisionFund Debug] trying mail with ticket id:", mailTicketId);
                    const mailResp = await sendTicketCreateMail(mailTicketId);
                    if (mailResp.ok) {
                        mailSent = true;
                        break;
                    }
                    lastMailError = getApiErrorMessage(mailResp, "Correo no enviado.");
                    // eslint-disable-next-line no-console
                    console.log("[VisionFund Debug] mail send failed:", {
                        ticketId: mailTicketId,
                        status: mailResp?.status,
                        json: mailResp?.json,
                    });
                }
                if (!mailSent) {
                    setMessage(
                        `Ticket creado: ${ticketRef}.${locationWarning ? ` Ubicacion no registrada (${locationWarning}).` : ""} Correo no enviado${lastMailError ? ` (${lastMailError})` : ""}.`,
                    );
                    return;
                }
            }
            if (
                createdTicketId &&
                !isUuidLike(createdTicketId) &&
                !isMainOldTicketId(createdTicketId)
            ) {
                setMessage(
                    `Ticket creado: ${ticketRef}. Correo no enviado (ticket_id invalido).`,
                );
                return;
            }
            setMessage(
                `Ticket creado: ${ticketRef}${locationWarning ? `. Ubicacion no registrada (${locationWarning})` : ""}`,
            );
        } catch (submitError) {
            setError(
                toReadableText(submitError?.message || submitError) ||
                    "Error al crear ticket.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const onSearchClient = async () => {
        const id = String(form.id_number || "").trim();
        if (!id) {
            setError("Ingresa la cedula para buscar.");
            return;
        }

        try {
            setSearchingClient(true);
            setError("");
            setMessage("");
            const response = await fetchTicketClientByIdentification(id);
            if (!response.ok) {
                const fallbackDetail = getApiErrorMessage(
                    response,
                    "No se encontro cliente con esa identificacion.",
                );
                const normalizedDetail = String(fallbackDetail || "").toLowerCase();
                const isClientNotFound =
                    Number(response?.status) === 404 ||
                    normalizedDetail.includes("not found") ||
                    normalizedDetail.includes("no se encontro");

                if (isClientNotFound) {
                    setForm((prev) => ({
                        ...prev,
                        id_type: "C",
                        id_number: id,
                        client_name: "",
                        email: "",
                        phone: "",
                        gender: "",
                        birth_date: "",
                        province: "",
                        canton: "",
                        main_street: "N/A",
                        secondary_street: "N/A",
                        house_number: "N/A",
                    }));
                    setMessage("No se encontro cliente. Se creara un nuevo cliente.");
                    setError("");
                    if (typeof onSyncRedesClientData === "function") {
                        onSyncRedesClientData({
                            identification: "",
                            fullName: "",
                            phone: "",
                            clear: true,
                        });
                    }
                    return;
                }

                throw new Error(fallbackDetail);
            }
            const client = response?.json || {};
            const provinceId = String(client?.province?.province_id || "").trim();
            const cantonId = String(client?.canton?.canton_id || "").trim();
            if (provinceId) {
                const cantonsResp = await fetchTicketCantonsByProvince(provinceId);
                if (cantonsResp.ok) {
                    setCantonOptions(toList(cantonsResp.json));
                }
            }
            setForm((prev) => ({
                ...prev,
                id_type: "C",
                id_number: String(client?.client_identification || prev.id_number || "").trim(),
                client_name: String(client?.client_name || prev.client_name || "").trim(),
                email: String(client?.client_mail || prev.email || "").trim(),
                phone: String(client?.client_phone || prev.phone || "").trim(),
                gender:
                    normalizeGenderValue(
                        client?.genre?.genre_name || client?.genre?.genre_code || "",
                    ) || prev.gender,
                birth_date: String(client?.birth_date || prev.birth_date || "")
                    .trim()
                    .slice(0, 10),
                province:
                    provinceId ||
                    String(client?.province?.province_name || prev.province || "").trim(),
                canton:
                    cantonId ||
                    String(client?.canton?.canton_name || prev.canton || "").trim(),
                main_street: String(client?.first_street || prev.main_street || "").trim(),
                secondary_street: String(
                    client?.second_street || prev.secondary_street || "",
                ).trim(),
                house_number: String(client?.house_number || prev.house_number || "").trim(),
            }));
            if (typeof onSyncRedesClientData === "function") {
                onSyncRedesClientData({
                    identification: String(
                        client?.client_identification || form.id_number || "",
                    ).trim(),
                    fullName: String(client?.client_name || form.client_name || "").trim(),
                    phone: String(client?.client_phone || form.phone || "").trim(),
                });
            }
        } catch (searchError) {
            setError(searchError.message || "No se pudo buscar cliente.");
        } finally {
            setSearchingClient(false);
        }
    };

    return (
        <section className="agent-form-card agent-form-card--tertiary">
            <div className="agent-form-header-row agent-inbound-detail-header">
                <p className="agent-form-card__title">
                    Ticket Banco VisionFund - Etapa {stage} de 3
                </p>
            </div>
            <div className="agent-inbound-detail-form">
                <div
                    className="agent-inbound-detail-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "0.4rem",
                    }}
                >
                    {stage === 1 &&
                        STAGE_ONE_FIELDS.map((field) => (
                            <div className="agent-form-field" key={field.key}>
                                <label>{field.label}</label>
                                {field.key === "id_type" ? (
                                    <>
                                        <input
                                            className="agent-input agent-survey-input"
                                            value="Para personas naturales identificadas con la cedula de identidad o ciudadania."
                                            readOnly
                                        />
                                    </>
                                ) : field.key === "gender" ? (
                                    <select
                                        className="agent-input agent-survey-input"
                                        value={form.gender}
                                        onChange={(event) =>
                                            setField("gender", event.target.value)
                                        }
                                    >
                                        <option value="">Selecciona</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                ) : field.key === "province" ? (
                                    <select
                                        className="agent-input agent-survey-input"
                                        value={form.province}
                                        onChange={(event) =>
                                            onProvinceChange(event.target.value)
                                        }
                                    >
                                        <option value="">Seleccione una opcion</option>
                                        {provinceOptions.map((item, index) => {
                                            const optionValue =
                                                findFirstValue(item, [
                                                    "province_id",
                                                    "id",
                                                    "uuid",
                                                ]) ||
                                                findFirstValue(item, [
                                                    "province_code",
                                                    "province_name",
                                                    "name",
                                                ]);
                                            const optionLabel = findFirstValue(item, [
                                                "province_name",
                                                "name",
                                            ]);
                                            return (
                                                <option
                                                    key={getOptionKey(
                                                        "province-stage1",
                                                        optionValue,
                                                        index,
                                                    )}
                                                    value={optionValue}
                                                >
                                                    {optionLabel || optionValue}
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : field.key === "canton" ? (
                                    <select
                                        className="agent-input agent-survey-input"
                                        value={form.canton}
                                        onChange={(event) =>
                                            setField("canton", event.target.value)
                                        }
                                    >
                                        <option value="">Seleccione una opcion</option>
                                        {cantonOptions.map((item, index) => {
                                            const optionValue =
                                                findFirstValue(item, [
                                                    "canton_id",
                                                    "id",
                                                    "uuid",
                                                ]) ||
                                                findFirstValue(item, [
                                                    "canton_code",
                                                    "canton_name",
                                                    "name",
                                                ]);
                                            const optionLabel = findFirstValue(item, [
                                                "canton_name",
                                                "name",
                                            ]);
                                            return (
                                                <option
                                                    key={getOptionKey(
                                                        "canton-stage1",
                                                        optionValue,
                                                        index,
                                                    )}
                                                    value={optionValue}
                                                >
                                                    {optionLabel || optionValue}
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    <>
                                        {field.key === "id_number" ? (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: "0.4rem",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <input
                                                    className="agent-input agent-survey-input"
                                                    type={field.type}
                                                    value={form[field.key]}
                                                    onChange={(event) =>
                                                        setField(field.key, event.target.value)
                                                    }
                                                    style={{ flex: 1 }}
                                                />
                                                <Button
                                                    variant="secondary"
                                                    type="button"
                                                    onClick={onSearchClient}
                                                    disabled={searchingClient}
                                                >
                                                    {searchingClient ? "Buscando..." : "Buscar"}
                                                </Button>
                                            </div>
                                        ) : (
                                            <input
                                                className="agent-input agent-survey-input"
                                                type={field.type}
                                                value={form[field.key]}
                                                onChange={(event) =>
                                                    setField(field.key, event.target.value)
                                                }
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        ))}

                    {stage === 2 && (
                        <>
                            <div className="agent-form-field">
                                <label>¿ El hecho sucedio en Ecuador ? *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.happened_in_ecuador}
                                    disabled
                                >
                                    <option value="Si">Si</option>
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Provincia del Incidente *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.incident_province}
                                    onChange={(event) =>
                                        onIncidentProvinceChange(event.target.value)
                                    }
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {provinceOptions.map((item, index) => {
                                        const optionValue =
                                            findFirstValue(item, [
                                                "province_id",
                                                "id",
                                                "uuid",
                                            ]) ||
                                            findFirstValue(item, [
                                                "province_code",
                                                "province_name",
                                                "name",
                                            ]);
                                        const optionLabel = findFirstValue(item, [
                                            "province_name",
                                            "name",
                                        ]);
                                        return (
                                            <option
                                                key={getOptionKey(
                                                    "province-stage2",
                                                    optionValue,
                                                    index,
                                                )}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Canton del Incidente *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.incident_canton}
                                    onChange={(event) =>
                                        setField("incident_canton", event.target.value)
                                    }
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {incidentCantonOptions.map((item, index) => {
                                        const optionValue =
                                            findFirstValue(item, [
                                                "canton_id",
                                                "id",
                                                "uuid",
                                            ]) ||
                                            findFirstValue(item, [
                                                "canton_code",
                                                "canton_name",
                                                "name",
                                            ]);
                                        const optionLabel = findFirstValue(item, [
                                            "canton_name",
                                            "name",
                                        ]);
                                        return (
                                            <option
                                                key={getOptionKey(
                                                    "incident-canton",
                                                    optionValue,
                                                    index,
                                                )}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Ciudad del Incidente *</label>
                                <input
                                    className="agent-input agent-survey-input"
                                    value={form.incident_city}
                                    onChange={(event) =>
                                        setField("incident_city", event.target.value)
                                    }
                                />
                            </div>
                            <div className="agent-form-field">
                                <label>Tipo *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.incident_type}
                                    onChange={(event) => onTypeChange(event.target.value)}
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {typesOptions.map((item, index) => {
                                        const optionValue = findFirstValue(item, [
                                            "type_id",
                                            "id",
                                            "uuid",
                                        ]);
                                        const optionLabel = findFirstValue(item, [
                                            "type_name",
                                            "name",
                                            "description",
                                        ]);
                                        return (
                                            <option
                                                key={getOptionKey("type", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Producto *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.incident_product}
                                    onChange={(event) =>
                                        onTopProductChange(event.target.value)
                                    }
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {topProductsOptions.map((item, index) => {
                                        const optionValue = getTopProductValue(item);
                                        const optionLabel = formatSentenceCase(
                                            getTopProductLabel(item),
                                        );
                                        return (
                                            <option
                                                key={getOptionKey("top-product", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Motivo de queja o sugerencia *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.complaint_reason}
                                    onChange={(event) => onProductChange(event.target.value)}
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {productsOptions.map((item, index) => {
                                        const optionValue = getProductValue(item);
                                        const optionLabel = formatSentenceCase(
                                            getProductLabel(item),
                                        );
                                        return (
                                            <option
                                                key={getOptionKey("product", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Motivo *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.incident_reason}
                                    onChange={(event) =>
                                        onIncidenceChange(event.target.value)
                                    }
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {incidenceOptions.map((item, index) => {
                                        const optionValue = getIncidenceValue(item);
                                        const optionLabel = getIncidenceLabel(item);
                                        return (
                                            <option
                                                key={getOptionKey("incidence", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Area *</label>
                                {catalogByAllOptions.length > 1 ? (
                                    <select
                                        className="agent-input agent-survey-input"
                                        value={form.catalog_id}
                                        onChange={(event) =>
                                            onCatalogAreaChange(event.target.value)
                                        }
                                    >
                                        <option value="">Seleccione una opcion</option>
                                        {catalogByAllOptions.map((item, index) => {
                                            const optionValue = getCatalogValue(item);
                                            const optionLabel = formatSentenceCase(
                                                getCatalogAreaLabel(item),
                                            );
                                            return (
                                                <option
                                                    key={getOptionKey("catalog", optionValue, index)}
                                                    value={optionValue}
                                                >
                                                    {optionLabel || optionValue}
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    <input
                                        className="agent-input agent-survey-input"
                                        value={form.area}
                                        readOnly
                                    />
                                )}
                            </div>
                            <div className="agent-form-field">
                                <label>Monto *</label>
                                <input
                                    className="agent-input agent-survey-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.incident_amount}
                                    onChange={(event) =>
                                        setField("incident_amount", event.target.value)
                                    }
                                />
                            </div>
                            <div className="agent-form-field">
                                <label>Tipo de Canal *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.channel_type}
                                    onChange={(event) =>
                                        setField("channel_type", event.target.value)
                                    }
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {canalTypeOptions.map((item, index) => {
                                        const optionValue = findFirstValue(item, [
                                            "canal_type_code",
                                            "canal_type_id",
                                            "id",
                                            "uuid",
                                        ]);
                                        const optionLabel = findFirstValue(item, [
                                            "canal_type_description",
                                            "canal_type_name",
                                            "name",
                                            "description",
                                        ]);
                                        return (
                                            <option
                                                key={getOptionKey("canal-type", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Canal *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.channel}
                                    onChange={(event) => setField("channel", event.target.value)}
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {canalOptions.map((item, index) => {
                                        const optionValue =
                                            findFirstValue(item, ["canal_id", "id", "uuid"]) ||
                                            findFirstValue(item, [
                                                "canal_code",
                                                "code",
                                                "canal_name",
                                                "name",
                                            ]);
                                        const optionLabel = findFirstValue(item, [
                                            "canal_name",
                                            "name",
                                            "description",
                                        ]);
                                        return (
                                            <option
                                                key={getOptionKey("canal", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Agencia *</label>
                                <select
                                    className="agent-input agent-survey-input"
                                    value={form.agency}
                                    onChange={(event) => setField("agency", event.target.value)}
                                >
                                    <option value="">Seleccione una opcion</option>
                                    {agencyOptions.map((item, index) => {
                                        const optionValue = findFirstValue(item, [
                                            "agency_id",
                                            "agencia_id",
                                            "id",
                                            "uuid",
                                        ]);
                                        const optionLabel = findFirstValue(item, [
                                            "agency_name",
                                            "agencia_name",
                                            "name",
                                            "description",
                                        ]);
                                        return (
                                            <option
                                                key={getOptionKey("agency", optionValue, index)}
                                                value={optionValue}
                                            >
                                                {optionLabel || optionValue}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <label>Catalogo *</label>
                                <input
                                    className="agent-input agent-survey-input"
                                    value={form.catalog_id}
                                    readOnly
                                    placeholder="Se genera automaticamente al elegir Motivo"
                                />
                            </div>
                        </>
                    )}

                    {stage === 3 && (
                        <>
                            <div
                                className="agent-form-field agent-inbound-detail-observaciones"
                                style={{ gridColumn: "1 / -1" }}
                            >
                                <label>Comentario *</label>
                                <textarea
                                    className="agent-input agent-survey-input"
                                    value={form.error_description}
                                    onChange={(event) =>
                                        setField("error_description", event.target.value)
                                    }
                                />
                            </div>
                            <div className="agent-form-field" style={{ gridColumn: "1 / -1" }}>
                                <label>Adjuntos (opcional)</label>
                                <input
                                    className="agent-input agent-survey-input"
                                    type="file"
                                    multiple
                                    onChange={(event) =>
                                        setFiles(Array.from(event.target.files || []))
                                    }
                                />
                            </div>
                        </>
                    )}
                </div>

                {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
                {message && <p style={{ color: "#166534" }}>{message}</p>}

                <div className="agent-form-actions">
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={onPrevStage}
                        disabled={submitting || stage === 1}
                    >
                        Anterior
                    </Button>
                    {stage < 3 ? (
                        <Button
                            variant="primary"
                            type="button"
                            onClick={onNextStage}
                            disabled={submitting}
                        >
                            Siguiente
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            type="button"
                            onClick={onSubmit}
                            disabled={submitting}
                        >
                            {submitting ? "Creando..." : "Crear ticket"}
                        </Button>
                    )}
                </div>
            </div>
        </section>
    );
}

RedesVisionFundTicketSection.propTypes = {
    identification: PropTypes.string,
    fullName: PropTypes.string,
    phone: PropTypes.string,
    onSyncRedesClientData: PropTypes.func,
};
