import { useEffect, useState } from "react";
import { Button, PageContainer } from "../../components/common";
import {
    downloadSupervisorRedesReport,
    downloadSupervisorOutboundReport,
    fetchSupervisorRedesCampaigns,
    fetchSupervisorOutboundCampaigns,
} from "../../services/supervisorReports.service";

const REPORT_TYPES = [
    { value: "outbound", label: "Outbound" },
    { value: "redes", label: "Redes" },
];

function getTodayLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 10);
}

function getMonthStart(dateText) {
    const value = String(dateText || "").trim();
    if (!value) {
        return "";
    }

    return `${value.slice(0, 8)}01`;
}

export default function ReportesSupervisorPage() {
    const today = getTodayLocalDate();
    const [reportType, setReportType] = useState("outbound");
    const [campaigns, setCampaigns] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [startDate, setStartDate] = useState(getMonthStart(today));
    const [endDate, setEndDate] = useState(today);
    const [loadingCampaigns, setLoadingCampaigns] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const monthStart = getMonthStart(today);

    useEffect(() => {
        let cancelled = false;

        const loadCampaigns = async () => {
            try {
                setLoadingCampaigns(true);
                setError("");
                setSuccess("");
                const data =
                    reportType === "redes"
                        ? await fetchSupervisorRedesCampaigns()
                        : await fetchSupervisorOutboundCampaigns();

                if (cancelled) {
                    return;
                }

                setCampaigns(data);
                setCampaignId((current) =>
                    data.includes(current) ? current : data[0] || "",
                );
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "No se pudieron cargar las campanas");
                }
            } finally {
                if (!cancelled) {
                    setLoadingCampaigns(false);
                }
            }
        };

        loadCampaigns();

        return () => {
            cancelled = true;
        };
    }, [reportType]);

    const handleDownload = async () => {
        try {
            setError("");
            setSuccess("");

            if (!campaignId || !startDate || !endDate) {
                throw new Error("Selecciona campana y rango de fechas");
            }

            setDownloading(true);
            const downloadReport =
                reportType === "redes"
                    ? downloadSupervisorRedesReport
                    : downloadSupervisorOutboundReport;
            const { blob, filename } = await downloadReport({
                campaignId,
                startDate,
                endDate,
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setSuccess(
                `Reporte ${reportType} descargado para ${campaignId} del ${startDate} al ${endDate}.`,
            );
        } catch (err) {
            setError(err.message || "No se pudo descargar el reporte");
        } finally {
            setDownloading(false);
        }
    };

    const handleClearFilters = () => {
        setCampaignId("");
        setStartDate(monthStart);
        setEndDate(today);
        setError("");
        setSuccess("");
    };

    return (
        <PageContainer title="Reportes Supervisor">
            <div style={styles.wrapper}>
                <div style={styles.card}>
                    <h3 style={styles.subtitle}>Exportar reportes</h3>

                    <div style={styles.grid}>
                        <label style={styles.field}>
                            <span style={styles.label}>Tipo de reporte</span>
                            <select
                                value={reportType}
                                onChange={(event) =>
                                    setReportType(event.target.value)
                                }
                                disabled={downloading}
                                style={styles.input}
                            >
                                {REPORT_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label style={styles.field}>
                            <span style={styles.label}>Campana</span>
                            <select
                                value={campaignId}
                                onChange={(event) =>
                                    setCampaignId(event.target.value)
                                }
                                disabled={loadingCampaigns || downloading}
                                style={styles.input}
                            >
                                <option value="">
                                    {loadingCampaigns
                                        ? "Cargando campanas..."
                                        : "Selecciona una campana"}
                                </option>
                                {campaigns.map((campaign) => (
                                    <option key={campaign} value={campaign}>
                                        {campaign}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label style={styles.field}>
                            <span style={styles.label}>Fecha inicial</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) =>
                                    setStartDate(event.target.value)
                                }
                                disabled={downloading}
                                style={styles.input}
                            />
                        </label>

                        <label style={styles.field}>
                            <span style={styles.label}>Fecha final</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                                disabled={downloading}
                                style={styles.input}
                            />
                        </label>
                    </div>

                    <div style={styles.actions}>
                        <Button
                            onClick={handleDownload}
                            disabled={
                                downloading ||
                                loadingCampaigns ||
                                !campaignId ||
                                !startDate ||
                                !endDate
                            }
                        >
                            {downloading ? "Descargando..." : "Exportar Excel"}
                        </Button>
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={handleClearFilters}
                            disabled={downloading}
                        >
                            Limpiar filtros
                        </Button>
                    </div>

                    {error ? <p style={styles.error}>{error}</p> : null}
                    {success ? <p style={styles.success}>{success}</p> : null}
                </div>
            </div>
        </PageContainer>
    );
}

const styles = {
    wrapper: {
        padding: "24px",
    },
    card: {
        background: "#ffffff",
        border: "1px solid #dbe4f0",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
        maxWidth: "980px",
    },
    subtitle: {
        margin: "0 0 8px",
        fontSize: "1.2rem",
        color: "#0f172a",
    },
    text: {
        margin: "0 0 20px",
        color: "#475569",
        lineHeight: 1.5,
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        fontSize: "0.9rem",
        fontWeight: 600,
        color: "#1e293b",
    },
    input: {
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        padding: "10px 12px",
        fontSize: "0.95rem",
        background: "#fff",
        color: "#0f172a",
    },
    actions: {
        marginTop: "20px",
        display: "flex",
        gap: "12px",
    },
    error: {
        marginTop: "16px",
        color: "#b91c1c",
        fontWeight: 600,
    },
    success: {
        marginTop: "16px",
        color: "#15803d",
        fontWeight: 600,
    },
};
