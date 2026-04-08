import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import {
    assignPendingConsultorLeads,
    fetchConsultorAssignmentConfig,
    fetchConsultorLeadById,
    fetchConsultorLeads,
    fetchConsultorLeadStats,
    fetchConsultorPerformanceSummary,
    fetchConsultorUsers,
    reassignConsultorLeads,
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

const MAIL_ESTATUS_OPTIONS = [
    { value: "", label: "Selecciona estatus" },
    { value: "desembolso", label: "Desembolso" },
    { value: "entrega de documentos", label: "Entrega de documentos" },
    { value: "negado", label: "Negado" },
];

const MAIL_AGENCIA_OPTIONS = [
    { value: "", label: "Selecciona agencia" },
    { value: "quito sur", label: "Quito Sur" },
    { value: "arcadia", label: "Arcadia" },
    { value: "chillogallo", label: "Chillogallo" },
    { value: "america", label: "America" },
    { value: "centro", label: "Centro" },
    { value: "carapungo", label: "Carapungo" },
    { value: "tumbaco", label: "Tumbaco" },
    { value: "portoviejo", label: "Portoviejo" },
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

export default function DashboardConsultor({ page = "consultor-leads" }) {
    const { userInfo } = useContext(AuthContext);
    const isAdmin = Boolean(userInfo?.roles?.includes("CONSULTOR_ADMIN"));
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
    const availableReassignCount =
        reassignForm.sourceChannel === "mail"
            ? totalExpiredMail
            : reassignForm.sourceChannel === "rrss"
              ? totalExpiredRrss
              : Number(summary.totals.total_expired || 0);
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
        loadLeads();
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        loadSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, summaryFilters.dateFrom, summaryFilters.dateTo]);

    useEffect(() => {
        if (!isAdmin) return;
        loadConsultorUsers();
        loadAssignmentConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

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
        loadLeads();
        loadStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.sourceChannel, filters.workflowStatus]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            loadLeads();
            loadStats();
        }, 350);
        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.search]);

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
                          String(name || "").startsWith(identification),
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
                estatus: form.estatus,
                agencia: form.agencia,
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
            const { ok, json } = await reassignConsultorLeads(reassignForm);
            if (!ok) {
                throw new Error(json?.error || "No se pudo reasignar");
            }

            setSuccess(json?.message || "Reasignacion completada.");
            await loadSummary();
            await loadLeads();
            await loadStats();
        } catch (err) {
            setError(err?.message || "Error en reasignacion manual");
        } finally {
            setReassigning(false);
        }
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
                        {isReassignPage
                            ? "Reasignar Leads"
                            : isAssignmentConfigPage
                              ? "Configuracion Asignacion"
                              : isAdmin
                                ? "Panel Consultor Admin"
                                : "Gestion Externa"}
                    </h1>
                    <p>
                        {isReassignPage
                            ? "Gestiona los leads vencidos y reasignalos a otro consultor."
                            : isAssignmentConfigPage
                              ? "Configura el porcentaje de asignacion automatica para cada consultor."
                              : isAdmin
                                ? "Resumen general de asignacion y resultado de todos los consultores."
                                : "Modulo de trabajo para consultores sobre leads externos."}
                    </p>
                </div>
                {isAdmin ? (
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
                            <span>Por reasignar</span>
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
                            <strong>{stats.expired}</strong>
                            <span>Por reasignar</span>
                        </article>
                        <article>
                            <strong>{stats.promoted}</strong>
                            <span>Promovidos</span>
                        </article>
                    </div>
                )}
            </section>

            {isAdmin && isReassignPage ? (
                <section className="consultor-panel consultor-panel--summary">
                    <div className="consultor-panel-head">
                        <div className="consultor-panel-head-inline">
                            <h2>Reasignar leads vencidos</h2>
                            <span className="consultor-inline-count">
                                Disponibles: {summary.totals.total_expired}
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

            {isAdmin && !isReassignPage && !isAssignmentConfigPage ? (
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

            {!isAdmin ||
            (isAdmin &&
                !isReassignPage &&
                !isAssignmentConfigPage) ? (
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
                            {WORKFLOW_OPTIONS.map((option) => (
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
                                        <th>Tiempo</th>
                                        <th>Workflow</th>
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="7"
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
                                            Estatus
                                            <select
                                                value={form.estatus || ""}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        estatus: e.target.value,
                                                    }))
                                                }
                                            >
                                                {MAIL_ESTATUS_OPTIONS.map(
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
                                            Agencia
                                            <select
                                                value={form.agencia || ""}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        agencia: e.target.value,
                                                    }))
                                                }
                                            >
                                                {MAIL_AGENCIA_OPTIONS.map(
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
                                ) : (
                                    <div className="consultor-form-grid consultor-form-grid--rrss">
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

                                <div
                                    className={`consultor-form-grid consultor-form-grid--wide consultor-form-grid--${selectedChannel || "general"}`}
                                >
                                    {selectedChannel === "mail" ? (
                                        <>
                                            <label className="consultor-field-full">
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
                                            <label className="consultor-field-full">
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
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </label>
                                        </>
                                    ) : null}

                                    {selectedChannel === "rrss" ? (
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
                                    ) : null}
                                </div>

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

