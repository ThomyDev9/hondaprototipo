import { useState } from "react";
import "./TalentoHumanoPage.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function ReporteCrmTthhPage() {
    const [reportStartDate, setReportStartDate] = useState("");
    const [reportEndDate, setReportEndDate] = useState("");
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState("");

    const handleDownloadCrmBreakCsv = async () => {
        if (!reportStartDate || !reportEndDate) {
            setReportError("Debes seleccionar fecha inicio y fecha fin.");
            return;
        }
        if (reportEndDate < reportStartDate) {
            setReportError("La fecha fin no puede ser menor a la fecha inicio.");
            return;
        }

        const token = localStorage.getItem("access_token") || "";
        if (!token) {
            setReportError("No hay sesion activa para descargar el reporte.");
            return;
        }

        setReportLoading(true);
        setReportError("");
        try {
            const params = new URLSearchParams({
                startDate: reportStartDate,
                endDate: reportEndDate,
            });
            const response = await fetch(
                `${API_BASE}/tthh/reports/crm-break.csv?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!response.ok) {
                const json = await response.json().catch(() => ({}));
                throw new Error(json.error || "No se pudo descargar el reporte CSV.");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `reporte_crm_break_${reportStartDate}_a_${reportEndDate}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setReportError(err.message || "No se pudo descargar el reporte CSV.");
        } finally {
            setReportLoading(false);
        }
    };

    return (
        <div className="th-shell">
            <div className="th-card th-no-print">
                <h1>Reporte CRM</h1>
                <p className="th-help">
                    Exporta por rango de fechas la sesion diaria de asesores con break y tiempo efectivo.
                </p>
                <div className="th-report-filter-row">
                    <label>
                        Fecha inicio
                        <input
                            type="date"
                            value={reportStartDate}
                            onChange={(event) => setReportStartDate(event.target.value)}
                        />
                    </label>
                    <label>
                        Fecha fin
                        <input
                            type="date"
                            value={reportEndDate}
                            onChange={(event) => setReportEndDate(event.target.value)}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={handleDownloadCrmBreakCsv}
                        disabled={reportLoading}
                    >
                        {reportLoading ? "Descargando..." : "Descargar CSV"}
                    </button>
                </div>
                {reportError ? <p className="th-help">{reportError}</p> : null}
            </div>
        </div>
    );
}
