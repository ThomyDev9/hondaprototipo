import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import {
    assignPendingConsultorLeads,
    fetchConsultorAssignmentConfig,
    fetchConsultorCreditStatusTracking,
    fetchConsultorDocumentTracking,
    fetchConsultorLeadById,
    fetchConsultorLeads,
    fetchConsultorLeadStats,
    fetchConsultorPerformanceSummary,
    fetchConsultorUsers,
    reassignConsultorLeads,
    updateConsultorCreditStatus,
    updateConsultorDocumentComment,
    updateConsultorAssignmentConfig,
    updateConsultorLead,
} from "../../services/consultor.service";
import "./DashboardConsultor.css";

const WORKFLOW_OPTIONS = [
    { value: "", label: "Todos los estados" },
    { value: "pendiente_completar", label: "Pendiente completar" },
    { value: "por_reasignar", label: "Por reasignar" },
    { value: "ya_gestionado", label: "Ya gestionado" },
    { value: "promovido", label: "Promovido" },
];

const CHANNEL_OPTIONS = [
    { value: "", label: "Todos los canales" },
    { value: "mail", label: "Mail" },
    { value: "rrss", label: "RRSS" },
];

const REASSIGN_CHANNEL_OPTIONS = [
    { value: "", label: "Todos los canales" },
    { value: "mail", label: "Mail" },
    { value: "rrss", label: "RRSS" },
];

const DOCUMENT_DELIVERY_OPTIONS = [
    { value: "", label: "Todas las entregas" },
    { value: "Entrega digital", label: "Entrega digital" },
    { value: "Entrega fisica", label: "Entrega fisica" },
];

const DOCUMENT_STATUS_OPTIONS = [
    { value: "", label: "Todos los estados" },
    { value: "Completos", label: "Completos" },
    { value: "Incompletos", label: "Incompletos" },
    { value: "Sin estado", label: "Sin estado" },
];
const DOCUMENT_REVIEW_STATUS_OPTIONS = [
    { value: "Completos", label: "Completos" },
    { value: "Incompletos", label: "Incompletos" },
];

const CREDIT_STATUS_FILTER_OPTIONS = [
    { value: "", label: "Todos los estados" },
    { value: "Negado", label: "Negado" },
    { value: "Aprobado", label: "Aprobado" },
    { value: "Desembolsado", label: "Desembolsado" },
    {
        value: "Pendiente regularizacion",
        label: "Pendiente regularizacion",
    },
    { value: "Sin estado", label: "Sin estado" },
];

const CREDIT_STATUS_OPTIONS = [
    { value: "Negado", label: "Negado" },
    { value: "Aprobado", label: "Aprobado" },
    { value: "Desembolsado", label: "Desembolsado" },
    {
        value: "Pendiente regularizacion",
        label: "Pendiente regularizacion",
    },
];

const RRSS_PRODUCT_OPTIONS = [
    { value: "", label: "Selecciona producto" },
    { value: "credito", label: "Credito" },
    { value: "cuenta", label: "Cuenta" },
    { value: "inversion", label: "Inversion" },
];

const RRSS_PROCESS_OPTIONS = [
    { value: "", label: "Selecciona proceso" },
    { value: "consumo", label: "Consumo" },
    { value: "microcredito", label: "Microcredito" },
    { value: "back to back", label: "Back to back" },
    { value: "crediflash", label: "Crediflash" },
    { value: "mi mesada", label: "Mi mesada" },
    { value: "apertura de ahorro", label: "Apertura de ahorro" },
    { value: "sin cobertura", label: "Sin cobertura" },
    { value: "agencia", label: "Agencia" },
    { value: "cedula no existe", label: "Cedula no existe" },
    { value: "cedula incorrecta", label: "Cedula incorrecta" },
];

function emptyForm() {
    return {
        full_name: "",
        celular: "",
        city: "",
        province: "",
        estado_civil: "",
        actividad_economica: "",
        monto_solicitado: "",
        monto_aplica: "",
        autoriza_buro: "",
        destino_credito: "",
        ingreso_neto_recibir: "",
        tipo_relacion_laboral: "",
        tipo_vivienda: "",
        mantiene_hijos: "",
        otros_ingresos: "",
        producto: "",
        observacion_externo: "",
        observacion_cooperativa: "",
        proceso_a_realizar: "",
        estatus: "",
        agencia: "",
        asesor_externo: "",
        usuario_maquita: "",
        seguimiento_kimobill: "",
        workflow_substatus: "",
    };
}

function normalize(value) {
    return String(value || "").trim();
}

function normalizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
}

function stripLeadingZeros(value) {
    const digits = normalizeDigits(value).replace(/^0+/, "");
    return digits || "0";
}

function isPdfMatchByIdentification(fileName, identification) {
    const safeFileName = String(fileName || "").trim();
    const safeIdentification = normalize(identification);

    if (!safeFileName || !safeIdentification) {
        return false;
    }

    if (safeFileName.startsWith(safeIdentification)) {
        return true;
    }

    const fileBaseName = safeFileName.replace(/\.pdf$/i, "");
    const filePrefix = fileBaseName.split("_")[0];
    const fileDigits = normalizeDigits(filePrefix);
    const idDigits = normalizeDigits(safeIdentification);

    if (!fileDigits || !idDigits) {
        return false;
    }

    return (
        fileDigits === idDigits ||
        stripLeadingZeros(fileDigits) === stripLeadingZeros(idDigits)
    );
}

function toInputDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getRemainingDisplay(lead) {
    const status = normalize(lead?.workflow_status).toLowerCase();
    if (!["pendiente_completar", "por_reasignar"].includes(status)) {
        return "-";
    }

    const assignedAt = lead?.assigned_at ? new Date(lead.assigned_at) : null;
    if (!assignedAt || Number.isNaN(assignedAt.getTime())) {
        return "Sin fecha";
    }

    const deadline = assignedAt.getTime() + 24 * 60 * 60 * 1000;
    const diff = deadline - Date.now();

    if (diff <= 0) {
        const overdueHours = Math.floor(Math.abs(diff) / (60 * 60 * 1000));
        return `Vencido ${overdueHours}h`;
    }

    const totalMinutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

function getMissingFields(lead) {
    const channel = normalize(lead?.source_channel).toLowerCase();
    const missing = [];

    if (channel === "rrss") {
        if (!normalize(lead?.producto)) missing.push("Producto");
        if (!normalize(lead?.observacion_externo)) {
            missing.push("Observacion agente maquita");
        }
        if (!normalize(lead?.proceso_a_realizar)) {
            missing.push("Proceso a realizar");
        }
    }

    if (channel === "mail") {
        if (!normalize(lead?.observacion_cooperativa)) {
            missing.push("Observacion cooperativa");
        }
        if (!normalize(lead?.proceso_a_realizar)) {
            missing.push("Proceso a realizar");
        }
    }

    return missing;
}

function getDocumentAgencyFields(item) {
    const channel = normalize(item?.source_channel).toLowerCase();

    if (channel === "rrss") {
        return [
            {
                label: "Producto",
                value: item?.respuesta_13 || "",
            },
            {
                label: "Observacion agente maquita",
                value: item?.respuesta_14 || "",
            },
            {
                label: "Proceso a realizar",
                value: item?.respuesta_15 || "",
            },
        ];
    }

    return [
        {
            label: "Proceso a realizar",
            value: item?.respuesta_11 || "",
        },
        {
            label: "Estatus",
            value: item?.respuesta_13 || "",
        },
    ];
}

export default function DashboardConsultor({ page = "consultor-leads" }) {
    const { userInfo } = useContext(AuthContext);
    const isAdmin = Boolean(userInfo?.roles?.includes("CONSULTOR_ADMIN"));
    const isDocumentsPage = page === "consultor-documents";
    const isCreditStatusPage = page === "consultor-credit-status";
    const isReassignPage = isAdmin && page === "consultor-reassign";
    const isAssignmentConfigPage =
        isAdmin && page === "consultor-assignment";
    const [filters, setFilters] = useState({
        sourceChannel: "",
        workflowStatus: "pendiente_completar",
        search: "",
    });
    const [leads, setLeads] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        expired: 0,
        promoted: 0,
    });
    const [summaryFilters, setSummaryFilters] = useState(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        return {
            dateFrom: toInputDate(thirtyDaysAgo),
            dateTo: toInputDate(today),
        };
    });
    const [summaryDraftFilters, setSummaryDraftFilters] = useState(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        return {
            dateFrom: toInputDate(thirtyDaysAgo),
            dateTo: toInputDate(today),
        };
    });
    const [summary, setSummary] = useState({
        items: [],
        totals: {
            total_assigned: 0,
            assigned_mail: 0,
            assigned_rrss: 0,
            total_pending: 0,
            total_expired: 0,
            total_promoted: 0,
            total_historical: 0,
        },
    });
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [consultorOptions, setConsultorOptions] = useState([]);
    const [assignmentConfig, setAssignmentConfig] = useState([]);
    const [assignmentConfigSnapshot, setAssignmentConfigSnapshot] = useState([]);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [assignmentTotal, setAssignmentTotal] = useState(0);
    const [assignmentEditableIds, setAssignmentEditableIds] = useState([]);
    const [reassigning, setReassigning] = useState(false);
    const [reassignForm, setReassignForm] = useState({
        targetUserId: "",
        quantity: 1,
        sourceChannel: "",
    });
    const [reassignSearch, setReassignSearch] = useState("");
    const [reassignLeads, setReassignLeads] = useState([]);
    const [reassignLeadsLoading, setReassignLeadsLoading] = useState(false);
    const [selectedReassignIds, setSelectedReassignIds] = useState([]);
    const [documentFilters, setDocumentFilters] = useState({
        deliveryMode: "",
        documentStatus: "",
        search: "",
    });
    const [documentTracking, setDocumentTracking] = useState([]);
    const [documentTrackingLoading, setDocumentTrackingLoading] = useState(false);
    const [documentTrackingStats, setDocumentTrackingStats] = useState({
        total: 0,
        digital: 0,
        fisica: 0,
        completos: 0,
        incompletos: 0,
        sin_estado: 0,
    });
    const [selectedDocumentItem, setSelectedDocumentItem] = useState(null);
    const [documentCommentDraft, setDocumentCommentDraft] = useState("");
    const [documentStatusDraft, setDocumentStatusDraft] = useState("");
    const [documentCommentSaving, setDocumentCommentSaving] = useState(false);
    const [creditFilters, setCreditFilters] = useState({
        creditStatus: "",
        search: "",
    });
    const [creditTracking, setCreditTracking] = useState([]);
    const [creditTrackingLoading, setCreditTrackingLoading] = useState(false);
    const [creditTrackingStats, setCreditTrackingStats] = useState({
        total: 0,
        negado: 0,
        aprobado: 0,
        desembolsado: 0,
        pendiente_regularizacion: 0,
        sin_estado: 0,
    });
    const [selectedCreditItem, setSelectedCreditItem] = useState(null);
    const [creditStatusDraft, setCreditStatusDraft] = useState("");
    const [creditStatusSaving, setCreditStatusSaving] = useState(false);

    const selectedChannel = normalize(
        selectedLead?.source_channel,
    ).toLowerCase();
    const totalExpiredMail = summary.items.reduce(
        (acc, item) => acc + Number(item.expired_mail || 0),
        0,
    );
    const totalExpiredRrss = summary.items.reduce(
        (acc, item) => acc + Number(item.expired_rrss || 0),
        0,
    );
    const summaryAvailableReassignCount =
        reassignForm.sourceChannel === "mail"
            ? totalExpiredMail
            : reassignForm.sourceChannel === "rrss"
              ? totalExpiredRrss
              : Number(summary.totals.total_expired || 0);
    const availableReassignCount = isReassignPage
        ? reassignLeads.length
        : summaryAvailableReassignCount;
    const selectedReassignCount = selectedReassignIds.length;
    const isAllReassignSelected =
        reassignLeads.length > 0 &&
        selectedReassignIds.length === reassignLeads.length;
    const visibleWorkflowOptions = isAdmin
        ? WORKFLOW_OPTIONS
        : WORKFLOW_OPTIONS.filter(
            (option) => option.value !== "por_reasignar",
        );
    const isAssignmentConfigValid =
        Math.abs(Number(assignmentTotal || 0) - 100) < 0.001;
    const hasAssignmentChanges = assignmentConfig.some((item) => {
        const original = assignmentConfigSnapshot.find(
            (snapshot) => snapshot.user_id === item.user_id,
        );

        return (
            Number(item.assignment_percentage || 0) !==
            Number(original?.assignment_percentage || 0)
        );
    });
    const selectedDocumentAgencyFields = selectedDocumentItem
        ? getDocumentAgencyFields(selectedDocumentItem)
        : [];

    const loadLeads = async () => {
        setLoading(true);
        setError("");
        try {
            const { ok, json } = await fetchConsultorLeads(filters);
            if (!ok) {
                throw new Error(
                    json?.error || "No se pudo cargar leads externos",
                );
            }

            setLeads(Array.isArray(json?.data) ? json.data : []);
        } catch (err) {
            setError(err?.message || "Error cargando leads externos");
        } finally {
            setLoading(false);
        }
    };

    const loadDocumentTracking = async () => {
        setDocumentTrackingLoading(true);
        setError("");
        try {
            const { ok, json } = await fetchConsultorDocumentTracking(
                documentFilters,
            );

            if (!ok) {
                throw new Error(
                    json?.error ||
                        "No se pudo cargar el seguimiento documental",
                );
            }

            setDocumentTracking(
                Array.isArray(json?.data?.items) ? json.data.items : [],
            );
            setDocumentTrackingStats({
                total: Number(json?.data?.totals?.total || 0),
                digital: Number(json?.data?.totals?.digital || 0),
                fisica: Number(json?.data?.totals?.fisica || 0),
                completos: Number(json?.data?.totals?.completos || 0),
                incompletos: Number(json?.data?.totals?.incompletos || 0),
                sin_estado: Number(json?.data?.totals?.sin_estado || 0),
            });
        } catch (err) {
            setDocumentTracking([]);
            setDocumentTrackingStats({
                total: 0,
                digital: 0,
                fisica: 0,
                completos: 0,
                incompletos: 0,
                sin_estado: 0,
            });
            setError(err?.message || "Error cargando seguimiento documental");
        } finally {
            setDocumentTrackingLoading(false);
        }
    };

    const loadCreditTracking = async () => {
        setCreditTrackingLoading(true);
        setError("");
        try {
            const { ok, json } = await fetchConsultorCreditStatusTracking(
                creditFilters,
            );

            if (!ok) {
                throw new Error(
                    json?.error || "No se pudo cargar estado de credito",
                );
            }

            setCreditTracking(
                Array.isArray(json?.data?.items) ? json.data.items : [],
            );
            setCreditTrackingStats({
                total: Number(json?.data?.totals?.total || 0),
                negado: Number(json?.data?.totals?.negado || 0),
                aprobado: Number(json?.data?.totals?.aprobado || 0),
                desembolsado: Number(json?.data?.totals?.desembolsado || 0),
                pendiente_regularizacion: Number(
                    json?.data?.totals?.pendiente_regularizacion || 0,
                ),
                sin_estado: Number(json?.data?.totals?.sin_estado || 0),
            });
        } catch (err) {
            setCreditTracking([]);
            setCreditTrackingStats({
                total: 0,
                negado: 0,
                aprobado: 0,
                desembolsado: 0,
                pendiente_regularizacion: 0,
                sin_estado: 0,
            });
            setError(err?.message || "Error cargando estado de credito");
        } finally {
            setCreditTrackingLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const { ok, json } = await fetchConsultorLeadStats({
                sourceChannel: filters.sourceChannel,
                search: filters.search,
            });

            if (!ok) {
                throw new Error(
                    json?.error || "No se pudo cargar estadisticas",
                );
            }

            setStats({
                total: Number(json?.data?.total || 0),
                pending: Number(json?.data?.pending || 0),
                expired: Number(json?.data?.expired || 0),
                promoted: Number(json?.data?.promoted || 0),
            });
        } catch (err) {
            setStats({
                total: 0,
                pending: 0,
                expired: 0,
                promoted: 0,
            });
        }
    };

    const loadLeadDetail = async (id, openModal = false) => {
        if (!id) return;
        setError("");
        try {
            const { ok, json } = await fetchConsultorLeadById(id);
            if (!ok) {
                throw new Error(json?.error || "No se pudo cargar el detalle");
            }
            const lead = json?.data || null;
            setSelectedId(id);
            setSelectedLead(lead);
            setForm({
                ...emptyForm(),
                ...lead,
            });
            if (openModal) {
                setDetailOpen(true);
            }
        } catch (err) {
            setError(err?.message || "No se pudo cargar el lead");
        }
    };

    const loadSummary = async () => {
        if (!isAdmin) return;
        setSummaryLoading(true);
        try {
            const { ok, json } =
                await fetchConsultorPerformanceSummary(summaryFilters);
            if (!ok) {
                throw new Error(json?.error || "No se pudo cargar el resumen");
            }

            setSummary({
                items: Array.isArray(json?.data?.items) ? json.data.items : [],
                totals: {
                    total_assigned: Number(
                        json?.data?.totals?.total_assigned || 0,
                    ),
                    assigned_mail: Number(
                        json?.data?.totals?.assigned_mail || 0,
                    ),
                    assigned_rrss: Number(
                        json?.data?.totals?.assigned_rrss || 0,
                    ),
                    total_pending: Number(
                        json?.data?.totals?.total_pending || 0,
                    ),
                    total_expired: Number(
                        json?.data?.totals?.total_expired || 0,
                    ),
                    total_promoted: Number(
                        json?.data?.totals?.total_promoted || 0,
                    ),
                    total_historical: Number(
                        json?.data?.totals?.total_historical || 0,
                    ),
                },
            });
        } catch (err) {
            setSummary({
                items: [],
                totals: {
                    total_assigned: 0,
                    assigned_mail: 0,
                    assigned_rrss: 0,
                    total_pending: 0,
                    total_expired: 0,
                    total_promoted: 0,
                    total_historical: 0,
                },
            });
        } finally {
            setSummaryLoading(false);
        }
    };

    const loadConsultorUsers = async () => {
        if (!isAdmin) return;
        try {
            const { ok, json } = await fetchConsultorUsers();
            if (!ok) {
                throw new Error(json?.error || "No se pudo cargar consultores");
            }

            const items = Array.isArray(json?.data) ? json.data : [];
            setConsultorOptions(items);
            if (!reassignForm.targetUserId && items[0]?.id) {
                setReassignForm((prev) => ({
                    ...prev,
                    targetUserId: items[0].id,
                }));
            }
        } catch {
            setConsultorOptions([]);
        }
    };

    const loadReassignLeads = async () => {
        if (!isAdmin || !isReassignPage) return;
        setReassignLeadsLoading(true);
        setError("");
        try {
            const { ok, json } = await fetchConsultorLeads({
                sourceChannel: reassignForm.sourceChannel,
                workflowStatus: "por_reasignar",
                search: reassignSearch,
                limit: 500,
            });
            if (!ok) {
                throw new Error(
                    json?.error ||
                        "No se pudo cargar la lista de leads por reasignar",
                );
            }

            const items = Array.isArray(json?.data) ? json.data : [];
            setReassignLeads(items);
            setSelectedReassignIds((prev) =>
                prev.filter((id) =>
                    items.some((lead) => Number(lead.id) === Number(id)),
                ),
            );
        } catch (err) {
            setReassignLeads([]);
            setSelectedReassignIds([]);
            setError(
                err?.message ||
                    "Error cargando la lista de leads por reasignar",
            );
        } finally {
            setReassignLeadsLoading(false);
        }
    };

    const loadAssignmentConfig = async () => {
        if (!isAdmin) return;
        setAssignmentLoading(true);
        try {
            const { ok, json } = await fetchConsultorAssignmentConfig();
            if (!ok) {
                throw new Error(
                    json?.error ||
                        "No se pudo cargar la distribucion automatica",
                );
            }

            const items = Array.isArray(json?.data?.items) ? json.data.items : [];
            setAssignmentConfig(
                items.map((item) => ({
                    user_id: normalize(item.id),
                    name: item.name || item.email || item.id,
                    email: item.email || "",
                    assignment_percentage: Number(
                        item.assignment_percentage || 0,
                    ),
                })),
            );
            setAssignmentConfigSnapshot(
                items.map((item) => ({
                    user_id: normalize(item.id),
                    name: item.name || item.email || item.id,
                    email: item.email || "",
                    assignment_percentage: Number(
                        item.assignment_percentage || 0,
                    ),
                })),
            );
            setAssignmentTotal(Number(json?.data?.totalPercentage || 0));
            setAssignmentEditableIds([]);
        } catch (err) {
            setAssignmentConfig([]);
            setAssignmentConfigSnapshot([]);
            setAssignmentTotal(0);
            setAssignmentEditableIds([]);
        } finally {
            setAssignmentLoading(false);
        }
    };

    useEffect(() => {
        if (isDocumentsPage || isCreditStatusPage) return;
        loadLeads();
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDocumentsPage, isCreditStatusPage]);

    useEffect(() => {
        if (!isAdmin || isDocumentsPage || isCreditStatusPage) return;
        loadSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isAdmin,
        isDocumentsPage,
        isCreditStatusPage,
        summaryFilters.dateFrom,
        summaryFilters.dateTo,
    ]);

    useEffect(() => {
        if (!isAdmin || isDocumentsPage || isCreditStatusPage) return;
        loadConsultorUsers();
        loadAssignmentConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, isDocumentsPage, isCreditStatusPage]);

    useEffect(() => {
        if (!isReassignPage) {
            setReassignLeads([]);
            setSelectedReassignIds([]);
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            loadReassignLeads();
        }, 250);

        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReassignPage, reassignForm.sourceChannel, reassignSearch]);

    useEffect(() => {
        if (!isAdmin) return;

        setReassignForm((prev) => {
            const normalizedQuantity = Math.max(
                1,
                Math.min(
                    Number(prev.quantity || 1),
                    Math.max(availableReassignCount, 1),
                ),
            );

            if (normalizedQuantity === Number(prev.quantity || 1)) {
                return prev;
            }

            return {
                ...prev,
                quantity: normalizedQuantity,
            };
        });
    }, [isAdmin, availableReassignCount]);

    useEffect(() => {
        if (isDocumentsPage || isCreditStatusPage) return;
        loadLeads();
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        filters.sourceChannel,
        filters.workflowStatus,
        isDocumentsPage,
        isCreditStatusPage,
    ]);

    useEffect(() => {
        if (isDocumentsPage || isCreditStatusPage) return undefined;
        const timeoutId = window.setTimeout(() => {
            loadLeads();
            loadStats();
        }, 350);
        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.search, isDocumentsPage, isCreditStatusPage]);

    useEffect(() => {
        if (!isDocumentsPage) return undefined;
        const timeoutId = window.setTimeout(() => {
            loadDocumentTracking();
        }, 250);
        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isDocumentsPage,
        documentFilters.deliveryMode,
        documentFilters.documentStatus,
        documentFilters.search,
    ]);

    useEffect(() => {
        if (!isCreditStatusPage) return undefined;
        const timeoutId = window.setTimeout(() => {
            loadCreditTracking();
        }, 250);
        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isCreditStatusPage,
        creditFilters.creditStatus,
        creditFilters.search,
    ]);

    useEffect(() => {
        const identification = normalize(selectedLead?.identification);

        if (!detailOpen || selectedChannel !== "mail" || !identification) {
            setPdfUrl(null);
            setPdfLoading(false);
            return;
        }

        let active = true;

        async function loadPdf() {
            setPdfLoading(true);
            try {
                const apiBase = import.meta.env.VITE_API_BASE;
                const resp = await fetch(`${apiBase}/uploads-list`);
                const files = await resp.json();
                const match = Array.isArray(files)
                    ? files.find((name) =>
                          isPdfMatchByIdentification(name, identification),
                      )
                    : null;

                if (!active) return;
                setPdfUrl(match ? `${apiBase}/uploads/${match}` : null);
            } catch {
                if (!active) return;
                setPdfUrl(null);
            } finally {
                if (active) {
                    setPdfLoading(false);
                }
            }
        }

        loadPdf();

        return () => {
            active = false;
        };
    }, [detailOpen, selectedChannel, selectedLead?.identification]);

    const closeDetail = () => {
        setDetailOpen(false);
        setSelectedId(null);
        setSelectedLead(null);
        setForm(emptyForm());
        setPdfUrl(null);
        setPdfLoading(false);
        setError("");
        setSuccess("");
    };

    const handleSave = async () => {
        if (!selectedId) return;
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const payload = {
                full_name: form.full_name,
                celular: form.celular,
                city: form.city,
                province: form.province,
                estado_civil: form.estado_civil,
                actividad_economica: form.actividad_economica,
                monto_solicitado: form.monto_solicitado,
                monto_aplica: form.monto_aplica,
                autoriza_buro: form.autoriza_buro,
                destino_credito: form.destino_credito,
                ingreso_neto_recibir: form.ingreso_neto_recibir,
                tipo_relacion_laboral: form.tipo_relacion_laboral,
                tipo_vivienda: form.tipo_vivienda,
                mantiene_hijos: form.mantiene_hijos,
                otros_ingresos: form.otros_ingresos,
                producto: form.producto,
                observacion_externo: form.observacion_externo,
                observacion_cooperativa: form.observacion_cooperativa,
                proceso_a_realizar: form.proceso_a_realizar,
                asesor_externo: form.asesor_externo,
                usuario_maquita: form.usuario_maquita,
                seguimiento_kimobill: form.seguimiento_kimobill,
                workflow_substatus: form.workflow_substatus,
            };

            const { ok, json } = await updateConsultorLead(selectedId, payload);
            if (!ok) {
                throw new Error(json?.error || "No se pudo actualizar el lead");
            }

            setSuccess(
                json?.message || "Lead externo actualizado correctamente.",
            );
            await loadLeadDetail(selectedId, false);
            await loadLeads();
            await loadStats();
            if (isAdmin) {
                await loadSummary();
            }
            closeDetail();
        } catch (err) {
            setError(err?.message || "Error actualizando lead externo");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        setCreditStatusDraft(selectedCreditItem?.credit_status || "");
    }, [selectedCreditItem]);

    useEffect(() => {
        setDocumentCommentDraft(selectedDocumentItem?.comment || "");
        const normalizedStatus = normalize(
            selectedDocumentItem?.document_status,
        );
        setDocumentStatusDraft(
            normalizedStatus === "Completos" || normalizedStatus === "Incompletos"
                ? normalizedStatus
                : "Incompletos",
        );
    }, [selectedDocumentItem]);

    const handleSaveCreditStatus = async () => {
        if (!selectedCreditItem) return;
        if (!creditStatusDraft) {
            setError("Selecciona un estado de credito.");
            return;
        }

        setCreditStatusSaving(true);
        setError("");
        setSuccess("");
        try {
            const { ok, json } = await updateConsultorCreditStatus({
                contactId: selectedCreditItem.contact_id,
                identification: selectedCreditItem.identification,
                creditStatus: creditStatusDraft,
            });

            if (!ok) {
                throw new Error(
                    json?.error || "No se pudo actualizar estado de credito",
                );
            }

            setSuccess(
                json?.message || "Estado de credito actualizado correctamente.",
            );
            await loadCreditTracking();
            setSelectedCreditItem(null);
        } catch (err) {
            setError(err?.message || "Error actualizando estado de credito");
        } finally {
            setCreditStatusSaving(false);
        }
    };

    const handleSaveDocumentComment = async () => {
        if (!selectedDocumentItem) return;
        const isPhysicalDelivery =
            normalize(selectedDocumentItem.delivery_mode) === "Entrega fisica";

        if (isPhysicalDelivery && !documentStatusDraft) {
            setError("Selecciona un estado documental para entrega fisica.");
            return;
        }

        if (
            isPhysicalDelivery &&
            documentStatusDraft === "Incompletos" &&
            !normalize(documentCommentDraft)
        ) {
            setError(
                "Debes ingresar un comentario cuando el estado es Incompletos.",
            );
            return;
        }

        setDocumentCommentSaving(true);
        setError("");
        setSuccess("");
        try {
            const payload = {
                contactId: selectedDocumentItem.contact_id,
                identification: selectedDocumentItem.identification,
                documentComment: documentCommentDraft,
            };
            if (isPhysicalDelivery) {
                payload.documentStatus = documentStatusDraft;
            }

            const { ok, json } = await updateConsultorDocumentComment({
                ...payload,
            });

            if (!ok) {
                throw new Error(
                    json?.error ||
                        "No se pudo actualizar comentario documental",
                );
            }

            setSuccess(
                json?.message ||
                    "Comentario documental actualizado correctamente.",
            );
            await loadDocumentTracking();
            setSelectedDocumentItem(null);
        } catch (err) {
            setError(err?.message || "Error actualizando comentario");
        } finally {
            setDocumentCommentSaving(false);
        }
    };

    const handleAutoAssign = async () => {
        setAssigning(true);
        setError("");
        setSuccess("");
        try {
            const { ok, json } = await assignPendingConsultorLeads();
            if (!ok) {
                throw new Error(
                    json?.error || "No se pudo ejecutar la asignacion",
                );
            }

            const assigned = Number(json?.data?.assigned || 0);
            const consultors = Number(json?.data?.consultors || 0);
            setSuccess(
                `Asignacion automatica completada. ${assigned} leads repartidos entre ${consultors} consultores.`,
            );
            await loadLeads();
            await loadStats();
            await loadSummary();
        } catch (err) {
            setError(err?.message || "Error en asignacion automatica");
        } finally {
            setAssigning(false);
        }
    };

    const handleManualReassign = async () => {
        setReassigning(true);
        setError("");
        setSuccess("");
        try {
            const payload = {
                ...reassignForm,
                leadIds: selectedReassignIds,
            };
            const { ok, json } = await reassignConsultorLeads(payload);
            if (!ok) {
                throw new Error(json?.error || "No se pudo reasignar");
            }

            setSuccess(json?.message || "Reasignacion completada.");
            await loadSummary();
            await loadReassignLeads();
            await loadLeads();
            await loadStats();
            setSelectedReassignIds([]);
        } catch (err) {
            setError(err?.message || "Error en reasignacion manual");
        } finally {
            setReassigning(false);
        }
    };

    const toggleReassignLead = (leadId) => {
        const normalizedId = Number(leadId || 0);
        if (!normalizedId) return;
        setSelectedReassignIds((prev) =>
            prev.includes(normalizedId)
                ? prev.filter((id) => id !== normalizedId)
                : [...prev, normalizedId],
        );
    };

    const toggleAllReassignLeads = (checked) => {
        if (!checked) {
            setSelectedReassignIds([]);
            return;
        }

        setSelectedReassignIds(
            reassignLeads
                .map((lead) => Number(lead.id || 0))
                .filter((id) => id > 0),
        );
    };

    const handleAssignmentRowChange = (userId, changes) => {
        setAssignmentConfig((prev) => {
            const next = prev.map((item) =>
                item.user_id === userId
                    ? {
                        ...item,
                        ...changes,
                    }
                    : item,
            );

            const total = next
                .reduce(
                    (acc, item) =>
                        acc + Number(item.assignment_percentage || 0),
                    0,
                );
            setAssignmentTotal(total);
            return next;
        });
    };

    const handleSaveAssignmentConfig = async () => {
        setAssignmentSaving(true);
        setError("");
        setSuccess("");
        try {
            const payload = {
                items: assignmentConfig.map((item) => ({
                    user_id: item.user_id,
                    is_active: Number(item.assignment_percentage || 0) > 0,
                    assignment_percentage: Number(
                        item.assignment_percentage || 0,
                    ),
                })),
            };

            const { ok, json } =
                await updateConsultorAssignmentConfig(payload);
            if (!ok) {
                throw new Error(
                    json?.error ||
                        "No se pudo guardar la distribucion automatica",
                );
            }

            setSuccess(
                json?.message ||
                    "Distribucion automatica guardada correctamente.",
            );
            await loadAssignmentConfig();
        } catch (err) {
            setError(err?.message || "Error guardando porcentajes");
        } finally {
            setAssignmentSaving(false);
        }
    };

    const recalculateAssignmentTotal = (items) => {
        setAssignmentTotal(
            items.reduce(
                (acc, item) => acc + Number(item.assignment_percentage || 0),
                0,
            ),
        );
    };

    const handleEditAssignmentRow = (userId) => {
        setAssignmentEditableIds((prev) =>
            prev.includes(userId) ? prev : [...prev, userId],
        );
    };

    const handleCancelAssignmentRow = (userId) => {
        const original = assignmentConfigSnapshot.find(
            (item) => item.user_id === userId,
        );
        const next = assignmentConfig.map((item) =>
            item.user_id === userId && original
                ? {
                    ...item,
                    assignment_percentage: Number(
                        original.assignment_percentage || 0,
                    ),
                }
                : item,
        );
        setAssignmentConfig(next);
        recalculateAssignmentTotal(next);
        setAssignmentEditableIds((prev) =>
            prev.filter((item) => item !== userId),
        );
    };

    const handleCancelAssignmentEdit = () => {
        const restored = assignmentConfigSnapshot.map((item) => ({ ...item }));
        setAssignmentConfig(restored);
        setAssignmentTotal(
            restored.reduce(
                (acc, item) => acc + Number(item.assignment_percentage || 0),
                0,
            ),
        );
        setAssignmentEditableIds([]);
    };

    return (
        <div className="consultor-page">
            <section className="consultor-hero">
                <div>
                    <h1>
                        {isDocumentsPage
                            ? "Seguimiento Documentos"
                            : isCreditStatusPage
                              ? "Estado Credito"
                            : isReassignPage
                            ? "Reasignar Leads"
                            : isAssignmentConfigPage
                              ? "Configuracion Asignacion"
                              : isAdmin
                                ? "Panel Consultor Admin"
                                : "Gestion Externa"}
                    </h1>
                    <p>
                        {isDocumentsPage
                            ? "Monitorea los registros de Out Maquita con entrega digital o fisica y su estado documental."
                            : isCreditStatusPage
                              ? "Actualiza el estado de credito para registros con documentos completos."
                            : isReassignPage
                            ? "Gestiona los leads vencidos y reasignalos a otro consultor."
                            : isAssignmentConfigPage
                              ? "Configura el porcentaje de asignacion automatica para cada consultor."
                              : isAdmin
                                ? "Resumen general de asignacion y resultado de todos los consultores."
                                : "Modulo de trabajo para consultores sobre leads externos."}
                    </p>
                </div>
                {isDocumentsPage ? (
                    <div className="consultor-stats">
                        <article>
                            <strong>{documentTrackingStats.total}</strong>
                            <span>Total</span>
                        </article>
                        <article>
                            <strong>{documentTrackingStats.completos}</strong>
                            <span>Completos</span>
                        </article>
                        <article>
                            <strong>{documentTrackingStats.incompletos}</strong>
                            <span>Incompletos</span>
                        </article>
                        <article>
                            <strong>{documentTrackingStats.sin_estado}</strong>
                            <span>Sin estado</span>
                        </article>
                    </div>
                ) : isCreditStatusPage ? (
                    <div className="consultor-stats">
                        <article>
                            <strong>{creditTrackingStats.total}</strong>
                            <span>Total</span>
                        </article>
                        <article>
                            <strong>{creditTrackingStats.aprobado}</strong>
                            <span>Aprobados</span>
                        </article>
                        <article>
                            <strong>{creditTrackingStats.desembolsado}</strong>
                            <span>Desembolsados</span>
                        </article>
                        <article>
                            <strong>{creditTrackingStats.sin_estado}</strong>
                            <span>Sin estado</span>
                        </article>
                    </div>
                ) : isAdmin ? (
                    <div className="consultor-stats">
                        <article>
                            <strong>{summary.totals.total_assigned}</strong>
                            <span>Asignados totales</span>
                        </article>
                        <article>
                            <strong>{summary.totals.total_pending}</strong>
                            <span>Pendientes totales</span>
                        </article>
                        <article>
                            <strong>{summary.totals.total_expired}</strong>
                            <span>Vencidos totales</span>
                        </article>
                        <article>
                            <strong>{summary.totals.total_promoted}</strong>
                            <span>Promovidos totales</span>
                        </article>
                    </div>
                ) : (
                    <div className="consultor-stats">
                        <article>
                            <strong>{stats.total}</strong>
                            <span>Total</span>
                        </article>
                        <article>
                            <strong>{stats.pending}</strong>
                            <span>Pendientes</span>
                        </article>
                        <article>
                            <strong>{stats.promoted}</strong>
                            <span>Promovidos</span>
                        </article>
                    </div>
                )}
            </section>

            {isDocumentsPage ? (
                <section className="consultor-panel">
                    <div className="consultor-panel-head">
                        <div>
                            <h2>Seguimiento documental</h2>
                            <p>
                                Revisa los registros de Out Maquita por tipo de
                                entrega y estado documental.
                            </p>
                        </div>
                    </div>

                    <div className="consultor-toolbar">
                        <select
                            value={documentFilters.deliveryMode}
                            onChange={(e) =>
                                setDocumentFilters((prev) => ({
                                    ...prev,
                                    deliveryMode: e.target.value,
                                }))
                            }
                        >
                            {DOCUMENT_DELIVERY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={documentFilters.documentStatus}
                            onChange={(e) =>
                                setDocumentFilters((prev) => ({
                                    ...prev,
                                    documentStatus: e.target.value,
                                }))
                            }
                        >
                            {DOCUMENT_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, cedula o celular"
                            value={documentFilters.search}
                            onChange={(e) =>
                                setDocumentFilters((prev) => ({
                                    ...prev,
                                    search: e.target.value,
                                }))
                            }
                        />
                    </div>

                    {error ? (
                        <div className="consultor-error">{error}</div>
                    ) : null}

                    {documentTrackingLoading ? (
                        <div className="consultor-status">
                            Cargando seguimiento documental...
                        </div>
                    ) : (
                        <div className="consultor-table-wrap consultor-table-wrap--full">
                            <table className="consultor-table">
                                <thead>
                                    <tr>
                                        <th>Cedula</th>
                                        <th>Cliente</th>
                                        <th>Entrega</th>
                                        <th>Agencia</th>
                                        <th>Consultor asignado</th>
                                        <th>Estado documental</th>
                                        <th>Actualizado por</th>
                                        <th>Comentario</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {documentTracking.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="9"
                                                className="consultor-table-empty"
                                            >
                                                No hay registros documentales
                                                para los filtros actuales.
                                            </td>
                                        </tr>
                                    ) : (
                                        documentTracking.map((item) => (
                                            <tr key={item.id || item.contact_id}>
                                                <td>{item.identification}</td>
                                                <td>{item.full_name || "-"}</td>
                                                <td>{item.delivery_mode || "-"}</td>
                                                <td>{item.agency || "-"}</td>
                                                <td>
                                                    {item.assigned_to_name ||
                                                        item.assigned_to ||
                                                        "-"}
                                                </td>
                                                <td>
                                                    <span className="consultor-badge">
                                                        {item.document_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {item.document_updated_by ||
                                                        "-"}
                                                </td>
                                                <td>{item.comment || "-"}</td>
                                                <td>
                                                    <div className="consultor-document-actions">
                                                        {item.pdf_url ? (
                                                            <a
                                                                href={`${import.meta.env.VITE_API_BASE}${item.pdf_url}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="consultor-icon-btn"
                                                                title="Ver PDF"
                                                                aria-label="Ver PDF"
                                                            >
                                                                <span aria-hidden="true">
                                                                    👁
                                                                </span>
                                                            </a>
                                                        ) : null}
                                                        <button
                                                            type="button"
                                                            className="consultor-icon-btn consultor-icon-btn--secondary"
                                                            title="Ver detalle"
                                                            aria-label="Ver detalle"
                                                            onClick={() =>
                                                                setSelectedDocumentItem(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <span aria-hidden="true">
                                                                ℹ
                                                            </span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : null}

            {isCreditStatusPage ? (
                <section className="consultor-panel">
                    <div className="consultor-panel-head">
                        <div>
                            <h2>Estado de credito</h2>
                            <p>
                                Registros con documentos completos para actualizar:
                                Negado, Aprobado, Desembolsado o Pendiente
                                regularizacion.
                            </p>
                        </div>
                    </div>

                    <div className="consultor-toolbar">
                        <select
                            value={creditFilters.creditStatus}
                            onChange={(e) =>
                                setCreditFilters((prev) => ({
                                    ...prev,
                                    creditStatus: e.target.value,
                                }))
                            }
                        >
                            {CREDIT_STATUS_FILTER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, cedula o celular"
                            value={creditFilters.search}
                            onChange={(e) =>
                                setCreditFilters((prev) => ({
                                    ...prev,
                                    search: e.target.value,
                                }))
                            }
                        />
                    </div>

                    {error ? (
                        <div className="consultor-error">{error}</div>
                    ) : null}
                    {success ? (
                        <div className="consultor-success">{success}</div>
                    ) : null}

                    {creditTrackingLoading ? (
                        <div className="consultor-status">
                            Cargando estado de credito...
                        </div>
                    ) : (
                        <div className="consultor-table-wrap consultor-table-wrap--full">
                            <table className="consultor-table">
                                <thead>
                                    <tr>
                                        <th>Cedula</th>
                                        <th>Cliente</th>
                                        <th>Celular</th>
                                        <th>Agencia</th>
                                        <th>Consultor asignado</th>
                                        <th>Estado credito</th>
                                        <th>Actualizado por</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditTracking.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="8"
                                                className="consultor-table-empty"
                                            >
                                                No hay registros para los filtros
                                                actuales.
                                            </td>
                                        </tr>
                                    ) : (
                                        creditTracking.map((item) => (
                                            <tr key={item.id || item.contact_id}>
                                                <td>{item.identification}</td>
                                                <td>{item.full_name || "-"}</td>
                                                <td>{item.celular || "-"}</td>
                                                <td>{item.agency || "-"}</td>
                                                <td>
                                                    {item.assigned_to_name ||
                                                        item.assigned_to ||
                                                        "-"}
                                                </td>
                                                <td>
                                                    <span className="consultor-badge">
                                                        {item.credit_status ||
                                                            "Sin estado"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {item.credit_updated_by ||
                                                        "-"}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="consultor-btn consultor-btn--small"
                                                        onClick={() =>
                                                            setSelectedCreditItem(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        Actualizar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : null}

            {isAdmin && isReassignPage ? (
                <section className="consultor-panel consultor-panel--summary">
                    <div className="consultor-panel-head">
                        <div className="consultor-panel-head-inline">
                            <h2>Reasignar leads vencidos</h2>
                            <span className="consultor-inline-count">
                                Disponibles: {availableReassignCount}
                            </span>
                        </div>
                    </div>

                    <div className="consultor-reassign-box">
                        <div className="consultor-toolbar consultor-toolbar--reassign">
                            <label className="consultor-filter-field">
                                <span>Consultor destino</span>
                                <select
                                    value={reassignForm.targetUserId}
                                    onChange={(e) =>
                                        setReassignForm((prev) => ({
                                            ...prev,
                                            targetUserId: e.target.value,
                                        }))
                                    }
                                >
                                    <option value="">
                                        Selecciona consultor
                                    </option>
                                    {consultorOptions.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="consultor-filter-field">
                                <span>Cantidad</span>
                                <input
                                    type="number"
                                    min="1"
                                    max={Math.max(availableReassignCount, 1)}
                                    value={reassignForm.quantity}
                                    onChange={(e) =>
                                        setReassignForm((prev) => ({
                                            ...prev,
                                            quantity: Math.max(
                                                1,
                                                Math.min(
                                                    Number(e.target.value || 1),
                                                    Math.max(
                                                        availableReassignCount,
                                                        1,
                                                    ),
                                                ),
                                            ),
                                        }))
                                    }
                                />
                            </label>
                            <label className="consultor-filter-field">
                                <span>Buscar lead</span>
                                <input
                                    type="text"
                                    placeholder="Nombre, cedula o celular"
                                    value={reassignSearch}
                                    onChange={(e) =>
                                        setReassignSearch(e.target.value)
                                    }
                                />
                            </label>
                            <label className="consultor-filter-field">
                                <span>Canal</span>
                                <select
                                    value={reassignForm.sourceChannel}
                                    onChange={(e) =>
                                        setReassignForm((prev) => ({
                                            ...prev,
                                            sourceChannel: e.target.value,
                                        }))
                                    }
                                >
                                    {REASSIGN_CHANNEL_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button
                                type="button"
                                className="consultor-btn consultor-btn--primary"
                                onClick={handleManualReassign}
                                disabled={
                                    reassigning ||
                                    !reassignForm.targetUserId ||
                                    availableReassignCount === 0
                                }
                            >
                                {reassigning ? "Reasignando..." : "Reasignar"}
                            </button>
                        </div>

                        <p className="consultor-reassign-copy">
                            Seleccionados: <strong>{selectedReassignCount}</strong>.
                            Si no seleccionas ninguno, se reasignan por cantidad.
                        </p>

                        {reassignLeadsLoading ? (
                            <div className="consultor-status">
                                Cargando leads por reasignar...
                            </div>
                        ) : (
                            <div className="consultor-table-wrap consultor-table-wrap--summary">
                                <table className="consultor-table">
                                    <thead>
                                        <tr>
                                            <th className="consultor-table-check-col">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllReassignSelected}
                                                    onChange={(e) =>
                                                        toggleAllReassignLeads(
                                                            e.target.checked,
                                                        )
                                                    }
                                                    disabled={
                                                        reassignLeads.length ===
                                                        0
                                                    }
                                                />
                                            </th>
                                            <th>ID</th>
                                            <th>Canal</th>
                                            <th>Cedula</th>
                                            <th>Nombre</th>
                                            <th>Celular</th>
                                            <th>Asignado actual</th>
                                            <th>Tiempo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reassignLeads.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="8"
                                                    className="consultor-table-empty"
                                                >
                                                    No hay leads vencidos para
                                                    reasignar con los filtros
                                                    actuales.
                                                </td>
                                            </tr>
                                        ) : (
                                            reassignLeads.map((lead) => {
                                                const leadId = Number(
                                                    lead.id || 0,
                                                );
                                                const isChecked =
                                                    selectedReassignIds.includes(
                                                        leadId,
                                                    );

                                                return (
                                                    <tr key={lead.id}>
                                                        <td className="consultor-table-check-col">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    isChecked
                                                                }
                                                                onChange={() =>
                                                                    toggleReassignLead(
                                                                        leadId,
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                        <td>{lead.id}</td>
                                                        <td>
                                                            {lead.source_channel ||
                                                                "-"}
                                                        </td>
                                                        <td>
                                                            {lead.identification ||
                                                                "-"}
                                                        </td>
                                                        <td>
                                                            {lead.full_name ||
                                                                "-"}
                                                        </td>
                                                        <td>
                                                            {lead.celular ||
                                                                "-"}
                                                        </td>
                                                        <td>
                                                            {lead.assigned_to_name ||
                                                                lead.assigned_to ||
                                                                "-"}
                                                        </td>
                                                        <td>
                                                            {getRemainingDisplay(
                                                                lead,
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            ) : null}

            {isAdmin && isAssignmentConfigPage ? (
                <section className="consultor-panel consultor-panel--summary">
                    <div className="consultor-panel-head">
                        <div>
                            <h2>Configuracion de asignacion</h2>
                        </div>
                    </div>

                    <div className="consultor-assignment-config">
                        <div className="consultor-panel-head consultor-panel-head--compact">
                            <div>
                                <h3>Distribucion automatica</h3>
                                <p>
                                    Ajusta el porcentaje por consultor. La suma
                                    total debe ser 100%.
                                </p>
                            </div>
                        </div>

                        {assignmentLoading ? (
                            <div className="consultor-status">
                                Cargando distribucion...
                            </div>
                        ) : (
                            <div className="consultor-table-wrap consultor-table-wrap--summary">
                                <table className="consultor-table">
                                    <thead>
                                        <tr>
                                            <th>Consultor</th>
                                            <th>Porcentaje</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignmentConfig.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="3"
                                                    className="consultor-table-empty"
                                                >
                                                    No hay consultores
                                                    disponibles para configurar.
                                                </td>
                                            </tr>
                                        ) : (
                                            assignmentConfig.map((item) => (
                                                <tr key={item.user_id}>
                                                    <td>
                                                        <div className="consultor-summary-name">
                                                            <strong>
                                                                {item.name}
                                                            </strong>
                                                            <span>
                                                                {item.email ||
                                                                    "-"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="consultor-percentage-input">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="0.01"
                                                                disabled={
                                                                    !assignmentEditableIds.includes(
                                                                        item.user_id,
                                                                    )
                                                                }
                                                                value={
                                                                    item.assignment_percentage
                                                                }
                                                                onChange={(
                                                                    e,
                                                                ) =>
                                                                    handleAssignmentRowChange(
                                                                        item.user_id,
                                                                        {
                                                                            assignment_percentage:
                                                                                Math.max(
                                                                                    0,
                                                                                    Math.min(
                                                                                        100,
                                                                                        Number(
                                                                                            e
                                                                                                .target
                                                                                                .value ||
                                                                                                0,
                                                                                        ),
                                                                                    ),
                                                                                ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <span>%</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="consultor-table-row-actions">
                                                            {assignmentEditableIds.includes(
                                                                item.user_id,
                                                            ) ? (
                                                                <button
                                                                    type="button"
                                                                    className="consultor-btn"
                                                                    onClick={() =>
                                                                        handleCancelAssignmentRow(
                                                                            item.user_id,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        assignmentSaving
                                                                    }
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="consultor-btn consultor-btn--primary"
                                                                    onClick={() =>
                                                                        handleEditAssignmentRow(
                                                                            item.user_id,
                                                                        )
                                                                    }
                                                                >
                                                                    Editar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {assignmentConfig.length > 0 ? (
                            <div className="consultor-assignment-footer">
                                <span
                                    className={`consultor-inline-count ${isAssignmentConfigValid ? "consultor-inline-count--ok" : "consultor-inline-count--warn"}`}
                                >
                                    Total global: {assignmentTotal}%
                                </span>
                                <div className="consultor-table-actions">
                                    <button
                                        type="button"
                                        className="consultor-btn"
                                        onClick={handleCancelAssignmentEdit}
                                        disabled={
                                            assignmentSaving ||
                                            !hasAssignmentChanges
                                        }
                                    >
                                        Restablecer todo
                                    </button>
                                    <button
                                        type="button"
                                        className="consultor-btn consultor-btn--primary"
                                        onClick={handleSaveAssignmentConfig}
                                        disabled={
                                            assignmentSaving ||
                                            assignmentLoading ||
                                            !hasAssignmentChanges ||
                                            !isAssignmentConfigValid
                                        }
                                    >
                                        {assignmentSaving
                                            ? "Guardando..."
                                            : "Guardar cambios"}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}

            {isAdmin &&
            !isDocumentsPage &&
            !isCreditStatusPage &&
            !isReassignPage &&
            !isAssignmentConfigPage ? (
                <section className="consultor-panel consultor-panel--summary">
                    <div className="consultor-panel-head">
                        <div>
                            <h2>Control por consultor</h2>
                        </div>
                    </div>

                    <div className="consultor-toolbar consultor-toolbar--summary">
                        <label className="consultor-filter-field">
                            <span>Fecha inicio</span>
                            <input
                                type="date"
                                value={summaryDraftFilters.dateFrom}
                                onChange={(e) =>
                                    setSummaryDraftFilters((prev) => ({
                                        ...prev,
                                        dateFrom: e.target.value,
                                    }))
                                }
                            />
                        </label>
                        <label className="consultor-filter-field">
                            <span>Fecha fin</span>
                            <input
                                type="date"
                                value={summaryDraftFilters.dateTo}
                                onChange={(e) =>
                                    setSummaryDraftFilters((prev) => ({
                                        ...prev,
                                        dateTo: e.target.value,
                                    }))
                                }
                            />
                        </label>
                        <div className="consultor-summary-actions">
                            <button
                                type="button"
                                className="consultor-btn consultor-btn--primary"
                                onClick={() =>
                                    setSummaryFilters({
                                        dateFrom: summaryDraftFilters.dateFrom,
                                        dateTo: summaryDraftFilters.dateTo,
                                    })
                                }
                            >
                                Buscar
                            </button>
                            <button
                                type="button"
                                className="consultor-btn"
                                onClick={() => {
                                    setSummaryDraftFilters({
                                        dateFrom: "",
                                        dateTo: "",
                                    });
                                    setSummaryFilters({
                                        dateFrom: "",
                                        dateTo: "",
                                    });
                                }}
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    </div>

                    {summaryLoading ? (
                        <div className="consultor-status">
                            Cargando resumen...
                        </div>
                    ) : (
                        <div className="consultor-table-wrap consultor-table-wrap--summary">
                            <table className="consultor-table">
                                <thead>
                                    <tr>
                                        <th>Consultor</th>
                                        <th>Asignados</th>
                                        <th>Mail</th>
                                        <th>RRSS</th>
                                        <th>Pendientes activos</th>
                                        <th>Pendientes por reasignar</th>
                                        <th>Promovidos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.items.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="consultor-table-empty"
                                            >
                                                No hay registros para ese rango
                                                de fechas. Si acabas de activar
                                                este modulo, ejecuta la
                                                migracion
                                                `017_add_external_leads_assignment_tracking.sql`
                                                para completar la fecha de
                                                asignacion historica.
                                            </td>
                                        </tr>
                                    ) : (
                                        summary.items.map((item) => (
                                            <tr key={item.consultor_id}>
                                                <td>
                                                    <div className="consultor-summary-name">
                                                        <strong>
                                                            {
                                                                item.consultor_name
                                                            }
                                                        </strong>
                                                        <span>
                                                            {item.consultor_email ||
                                                                "-"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>{item.total_assigned}</td>
                                                <td>{item.assigned_mail}</td>
                                                <td>{item.assigned_rrss}</td>
                                                <td>
                                                    {item.total_pending}
                                                    <small>
                                                        {` M:${item.pending_mail} | R:${item.pending_rrss}`}
                                                    </small>
                                                </td>
                                                <td>
                                                    {item.total_expired}
                                                    <small>
                                                        {` M:${item.expired_mail} | R:${item.expired_rrss}`}
                                                    </small>
                                                </td>
                                                <td>
                                                    {item.total_promoted}
                                                    <small>
                                                        {` M:${item.promoted_mail} | R:${item.promoted_rrss}`}
                                                    </small>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : null}

            {!isDocumentsPage &&
            !isCreditStatusPage &&
            (!isAdmin ||
            (isAdmin &&
                !isDocumentsPage &&
                !isCreditStatusPage &&
                !isReassignPage &&
                !isAssignmentConfigPage)) ? (
                <section className="consultor-panel">
                    <div className="consultor-panel-head">
                        <div>
                            <h2>
                                {isAdmin
                                    ? "Vista general de leads"
                                    : "Bandeja de leads"}
                            </h2>
                            <p>
                                {isAdmin
                                    ? ""
                                    : "Solo ves los leads que te fueron asignados."}
                            </p>
                        </div>
                    </div>

                    <div className="consultor-toolbar">
                        <select
                            value={filters.sourceChannel}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    sourceChannel: e.target.value,
                                }))
                            }
                        >
                            {CHANNEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filters.workflowStatus}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    workflowStatus: e.target.value,
                                }))
                            }
                        >
                            {visibleWorkflowOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, cedula o celular"
                            value={filters.search}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    search: e.target.value,
                                }))
                            }
                        />
                    </div>

                    {error ? (
                        <div className="consultor-error">{error}</div>
                    ) : null}
                    {success ? (
                        <div className="consultor-success">{success}</div>
                    ) : null}

                    {loading ? (
                        <div className="consultor-status">
                            Cargando leads...
                        </div>
                    ) : (
                        <div className="consultor-table-wrap consultor-table-wrap--full">
                            <table className="consultor-table">
                                <thead>
                                    <tr>
                                        <th>Canal</th>
                                        <th>Cedula</th>
                                        <th>Cliente</th>
                                        <th>Celular</th>
                                        <th>Consultor asignado</th>
                                        <th>Tiempo</th>
                                        <th>Workflow</th>
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="8"
                                                className="consultor-table-empty"
                                            >
                                                No hay leads para los filtros
                                                actuales.
                                            </td>
                                        </tr>
                                    ) : (
                                        leads.map((lead) => (
                                            <tr key={lead.id}>
                                                <td>{lead.source_channel}</td>
                                                <td>{lead.identification}</td>
                                                <td>{lead.full_name || "-"}</td>
                                                <td>{lead.celular || "-"}</td>
                                                <td>
                                                    {lead.assigned_to_name ||
                                                        lead.assigned_to ||
                                                        "-"}
                                                </td>
                                                <td>
                                                    {getRemainingDisplay(lead)}
                                                </td>
                                                <td>
                                                    <span className="consultor-badge">
                                                        {lead.workflow_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="consultor-btn consultor-btn--small"
                                                        onClick={() =>
                                                            loadLeadDetail(
                                                                lead.id,
                                                                true,
                                                            )
                                                        }
                                                    >
                                                        Calificar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : null}

            {isDocumentsPage && selectedDocumentItem ? (
                <div
                    className="consultor-modal-backdrop"
                    onClick={() => {
                        if (documentCommentSaving) return;
                        setSelectedDocumentItem(null);
                    }}
                >
                    <div
                        className="consultor-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="consultor-detail-head">
                            <div className="consultor-detail-meta">
                                <h2>
                                    {selectedDocumentItem.full_name ||
                                        "Detalle documental"}
                                </h2>
                                <span>{selectedDocumentItem.identification}</span>
                                <span>
                                    {selectedDocumentItem.source_channel || "-"}
                                </span>
                            </div>
                            <div className="consultor-detail-actions">
                                <button
                                    type="button"
                                    className="consultor-close"
                                    onClick={() => {
                                        if (documentCommentSaving) return;
                                        setSelectedDocumentItem(null);
                                    }}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        <div className="consultor-form-grid consultor-form-grid--readonly">
                            <label>
                                Cedula
                                <input
                                    value={
                                        selectedDocumentItem.identification || ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Cliente
                                <input
                                    value={selectedDocumentItem.full_name || ""}
                                    readOnly
                                />
                            </label>
                            <label>
                                Entrega
                                <input
                                    value={
                                        selectedDocumentItem.delivery_mode || ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Agencia
                                <input
                                    value={selectedDocumentItem.agency || ""}
                                    readOnly
                                />
                            </label>
                            <label>
                                Consultor asignado
                                <input
                                    value={
                                        selectedDocumentItem.assigned_to_name ||
                                        selectedDocumentItem.assigned_to ||
                                        ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Actualizado por
                                <input
                                    value={
                                        selectedDocumentItem.document_updated_by ||
                                        ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Estado documental
                                {normalize(selectedDocumentItem.delivery_mode) ===
                                "Entrega fisica" ? (
                                    <select
                                        value={documentStatusDraft}
                                        onChange={(event) =>
                                            setDocumentStatusDraft(
                                                event.target.value,
                                            )
                                        }
                                    >
                                        {DOCUMENT_REVIEW_STATUS_OPTIONS.map(
                                            (option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                ) : (
                                    <input
                                        value={
                                            selectedDocumentItem.document_status || ""
                                        }
                                        readOnly
                                    />
                                )}
                            </label>
                            <label>
                                Actualizado
                                <input
                                    value={
                                        selectedDocumentItem.updated_at
                                            ? new Date(
                                                  selectedDocumentItem.updated_at,
                                              ).toLocaleString("es-EC")
                                            : ""
                                    }
                                    readOnly
                                />
                            </label>
                            {selectedDocumentAgencyFields.map((field) => (
                                <label key={field.label}>
                                    {field.label}
                                    <input value={field.value || ""} readOnly />
                                </label>
                            ))}
                            <label className="consultor-field-full">
                                Comentario
                                <textarea
                                    value={documentCommentDraft}
                                    onChange={(event) =>
                                        setDocumentCommentDraft(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                        </div>
                        <div className="consultor-actions">
                            <button
                                type="button"
                                className="consultor-btn consultor-btn--primary"
                                onClick={handleSaveDocumentComment}
                                disabled={documentCommentSaving}
                            >
                                {documentCommentSaving
                                    ? "Guardando..."
                                    : "Guardar comentario"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isCreditStatusPage && selectedCreditItem ? (
                <div
                    className="consultor-modal-backdrop"
                    onClick={() => {
                        if (creditStatusSaving) return;
                        setSelectedCreditItem(null);
                    }}
                >
                    <div
                        className="consultor-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="consultor-detail-head">
                            <div className="consultor-detail-meta">
                                <h2>
                                    {selectedCreditItem.full_name ||
                                        "Estado de credito"}
                                </h2>
                                <span>{selectedCreditItem.identification}</span>
                                <span>{selectedCreditItem.agency || "-"}</span>
                            </div>
                            <div className="consultor-detail-actions">
                                <button
                                    type="button"
                                    className="consultor-close"
                                    onClick={() => {
                                        if (creditStatusSaving) return;
                                        setSelectedCreditItem(null);
                                    }}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        <div className="consultor-form-grid">
                            <label>
                                Cedula
                                <input
                                    value={
                                        selectedCreditItem.identification || ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Cliente
                                <input
                                    value={selectedCreditItem.full_name || ""}
                                    readOnly
                                />
                            </label>
                            <label>
                                Estado documental
                                <input
                                    value={
                                        selectedCreditItem.document_status ||
                                        "Completos"
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Consultor asignado
                                <input
                                    value={
                                        selectedCreditItem.assigned_to_name ||
                                        selectedCreditItem.assigned_to ||
                                        ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Actualizado por
                                <input
                                    value={
                                        selectedCreditItem.credit_updated_by ||
                                        ""
                                    }
                                    readOnly
                                />
                            </label>
                            <label>
                                Estado de credito
                                <select
                                    value={creditStatusDraft}
                                    onChange={(event) =>
                                        setCreditStatusDraft(
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">
                                        Selecciona estado de credito
                                    </option>
                                    {CREDIT_STATUS_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="consultor-actions">
                            <button
                                type="button"
                                className="consultor-btn consultor-btn--primary"
                                onClick={handleSaveCreditStatus}
                                disabled={creditStatusSaving}
                            >
                                {creditStatusSaving
                                    ? "Guardando..."
                                    : "Guardar estado"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {detailOpen && selectedLead ? (
                <div className="consultor-modal-backdrop" onClick={closeDetail}>
                    <div
                        className={`consultor-modal ${selectedChannel === "mail" ? "consultor-modal--mail" : ""}`.trim()}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="consultor-modal-layout">
                            <div className="consultor-modal-content">
                                <div className="consultor-detail-head">
                                    <div className="consultor-detail-meta">
                                        <h2>
                                            {selectedLead.full_name ||
                                                "Lead externo"}
                                        </h2>
                                        <span>
                                            {selectedLead.identification}
                                        </span>
                                        <span>
                                            {selectedLead.source_channel}
                                        </span>
                                    </div>
                                    <div className="consultor-detail-actions">
                                        <div className="consultor-badges">
                                            <span>
                                                {selectedLead.workflow_status}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="consultor-close"
                                            onClick={closeDetail}
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </div>

                                {error ? (
                                    <div className="consultor-error">
                                        {error}
                                    </div>
                                ) : null}
                                {success ? (
                                    <div className="consultor-success">
                                        {success}
                                    </div>
                                ) : null}
                                <div
                                    className={`consultor-form-grid consultor-form-grid--readonly consultor-form-grid--${selectedChannel || "general"}`}
                                >
                                    <label>
                                        Nombre
                                        <input
                                            value={form.full_name || ""}
                                            readOnly
                                        />
                                    </label>
                                    <label>
                                        Celular
                                        <input
                                            value={form.celular || ""}
                                            readOnly
                                        />
                                    </label>
                                    {selectedChannel === "rrss" ? (
                                        <label>
                                            Ciudad
                                            <input
                                                value={form.city || ""}
                                                readOnly
                                            />
                                        </label>
                                    ) : null}
                                    {selectedChannel === "mail" ? (
                                        <label>
                                            Provincia
                                            <input
                                                value={form.province || ""}
                                                readOnly
                                            />
                                        </label>
                                    ) : null}
                                    <label>
                                        Estado civil
                                        <input
                                            value={form.estado_civil || ""}
                                            readOnly
                                        />
                                    </label>
                                    <label>
                                        Actividad economica
                                        <input
                                            value={
                                                form.actividad_economica || ""
                                            }
                                            readOnly
                                        />
                                    </label>
                                    <label>
                                        Monto solicitado
                                        <input
                                            value={form.monto_solicitado || ""}
                                            readOnly
                                        />
                                    </label>
                                    {selectedChannel === "rrss" ? (
                                        <>
                                            <label>
                                                Autoriza buro
                                                <input
                                                    value={
                                                        form.autoriza_buro || ""
                                                    }
                                                    readOnly
                                                />
                                            </label>
                                            <label>
                                                Destino credito
                                                <input
                                                    value={
                                                        form.destino_credito ||
                                                        ""
                                                    }
                                                    readOnly
                                                />
                                            </label>
                                            <label>
                                                Tipo relacion laboral
                                                <input
                                                    value={
                                                        form.tipo_relacion_laboral ||
                                                        ""
                                                    }
                                                    readOnly
                                                />
                                            </label>
                                            <label>
                                                Tipo vivienda
                                                <input
                                                    value={
                                                        form.tipo_vivienda || ""
                                                    }
                                                    readOnly
                                                />
                                            </label>
                                            <label>
                                                Mantiene hijos
                                                <input
                                                    value={
                                                        form.mantiene_hijos || ""
                                                    }
                                                    readOnly
                                                />
                                            </label>
                                            <label>
                                                Otros ingresos
                                                <input
                                                    value={
                                                        form.otros_ingresos || ""
                                                    }
                                                    readOnly
                                                />
                                            </label>
                                        </>
                                    ) : null}
                                </div>

                                {selectedChannel === "mail" ? (
                                    <div className="consultor-form-grid consultor-form-grid--mail">
                                        <label>
                                            Monto aplica
                                            <input
                                                value={form.monto_aplica || ""}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        monto_aplica:
                                                            e.target.value,
                                                    }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Proceso a realizar
                                            <select
                                                value={
                                                    form.proceso_a_realizar ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        proceso_a_realizar:
                                                            e.target.value,
                                                    }))
                                                }
                                            >
                                                {RRSS_PROCESS_OPTIONS.map(
                                                    (option) => (
                                                        <option
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                        <label>
                                            Observacion cooperativa
                                            <textarea
                                                value={
                                                    form.observacion_cooperativa ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        observacion_cooperativa:
                                                            e.target.value,
                                                    }))
                                                }
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="consultor-form-grid consultor-form-grid--rrss">
                                        <label>
                                            Monto aplica
                                            <input
                                                value={form.monto_aplica || ""}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        monto_aplica:
                                                            e.target.value,
                                                    }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Producto
                                            <select
                                                value={form.producto || ""}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        producto:
                                                            e.target.value,
                                                    }))
                                                }
                                            >
                                                {RRSS_PRODUCT_OPTIONS.map(
                                                    (option) => (
                                                        <option
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                        <label>
                                            Proceso a realizar
                                            <select
                                                value={
                                                    form.proceso_a_realizar ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        proceso_a_realizar:
                                                            e.target.value,
                                                    }))
                                                }
                                            >
                                                {RRSS_PROCESS_OPTIONS.map(
                                                    (option) => (
                                                        <option
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                    </div>
                                )}

                                {selectedChannel === "rrss" ? (
                                    <div
                                        className={`consultor-form-grid consultor-form-grid--wide consultor-form-grid--${selectedChannel || "general"}`}
                                    >
                                        <label className="consultor-field-full">
                                            Observacion agente maquita
                                            <textarea
                                                value={
                                                    form.observacion_externo ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        observacion_externo:
                                                            e.target.value,
                                                    }))
                                                }
                                            />
                                        </label>
                                    </div>
                                ) : null}

                                <div className="consultor-actions">
                                    <button
                                        type="button"
                                        className="consultor-btn consultor-btn--primary"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving
                                            ? "Guardando..."
                                            : "Guardar cambios"}
                                    </button>
                                </div>
                            </div>

                            {selectedChannel === "mail" ? (
                                <aside className="consultor-pdf-panel">
                                    {pdfLoading ? (
                                        <div className="consultor-pdf-empty">
                                            Cargando PDF...
                                        </div>
                                    ) : pdfUrl ? (
                                        <iframe
                                            src={pdfUrl}
                                            className="consultor-pdf-iframe"
                                            title="PDF lead mail"
                                        />
                                    ) : (
                                        <div className="consultor-pdf-empty">
                                            No se encontro PDF para esta cedula.
                                        </div>
                                    )}
                                </aside>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

