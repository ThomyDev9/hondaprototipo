import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import "./TalentoHumanoPage.css";


const INGRESOS_KEYS = [
    "SUELDO",
    "HORAS_EXTRAS_50",
    "RECARGO_NOCTURNO",
    "HORAS_EXTRAS_100",
    "BONIFICACION",
    "COMISIONES",
    "SUBTOTAL_INGRESOS",
    "FONDOS_RESERVA",
    "DECIMO_TERCER",
    "DECIMO_CUARTO",
    "VIATICOS",
    "OTROS",
    "TOTAL_INGRESOS",
];

const EGRESOS_KEYS = [
    "APORTE_PERS",
    "PREST_Q_IESS",
    "PREST_H_IESS",
    "IR",
    "DSCTOS",
    "UNIFORME",
    "ANTICIPADOS",
    "LLAMADOS_ATENCION",
    "FALTAS_ATRASOS",
    "TOTAL_EGRESOS",
];

const FIXED_META_KEYS = new Set([
    "No",
    "EMPLEADOS",
    "G",
    "PERIODO",
    "DEPARTAMENTO",
    "CEDULA",
    "FECHA_INGRESO",
    "DIAS",
    "BANCO",
    "No_CUENTA",
    "BAN_CODIGO",
    ...INGRESOS_KEYS,
    ...EGRESOS_KEYS,
    "TOTAL_A_PAGAR",
    "APORTE_PATRONAL",
    "__incomeKeys",
    "__expenseKeys",
    "__labels",
]);

const LEGACY_FIXED_KEY_BY_INDEX = {
    7: "SUELDO",
    8: "HORAS_EXTRAS_50",
    9: "RECARGO_NOCTURNO",
    10: "HORAS_EXTRAS_100",
    11: "BONIFICACION",
    12: "COMISIONES",
    13: "SUBTOTAL_INGRESOS",
    14: "FONDOS_RESERVA",
    15: "DECIMO_TERCER",
    16: "DECIMO_CUARTO",
    17: "VIATICOS",
    18: "OTROS",
    19: "TOTAL_INGRESOS",
    20: "APORTE_PERS",
    21: "PREST_Q_IESS",
    22: "PREST_H_IESS",
    23: "IR",
    24: "DSCTOS",
    25: "UNIFORME",
    26: "ANTICIPADOS",
    27: "LLAMADOS_ATENCION",
    28: "FALTAS_ATRASOS",
    29: "TOTAL_EGRESOS",
    30: "TOTAL_A_PAGAR",
    31: "APORTE_PATRONAL",
};

function toNumber(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    const raw = String(value ?? "").trim();
    if (!raw) return 0;

    const normalized = raw.replace(/[^0-9,.-]/g, "");
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");

    let numeric = normalized;
    if (lastComma !== -1 && lastDot !== -1) {
        if (lastComma > lastDot) {
            numeric = normalized.replace(/\./g, "").replace(",", ".");
        } else {
            numeric = normalized.replace(/,/g, "");
        }
    } else if (lastComma !== -1) {
        numeric = normalized.replace(/\./g, "").replace(",", ".");
    } else {
        numeric = normalized.replace(/,/g, "");
    }

    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toCurrency(value) {
    return new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
    }).format(toNumber(value));
}

function roundToTwoDecimals(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round(number * 100) / 100;
}

function excelSerialDateToFormattedString(serial) {
    const parsed = Number(serial);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    const utcDays = Math.floor(parsed - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(
        (utcValue + new Date().getTimezoneOffset() * 60) * 1000,
    );
    const day = String(dateInfo.getDate()).padStart(2, "0");
    const month = String(dateInfo.getMonth() + 1).padStart(2, "0");
    const year = dateInfo.getFullYear();
    return `${day}/${month}/${year}`;
}

function normalizeRow(row) {
    return {
        No: row.No || row.NO || row.no || "",
        EMPLEADOS: row.EMPLEADOS || row.Empleado || row.EMPLEADO || "",
        PERIODO: row.PERIODO || row.Periodo || "",
        DEPARTAMENTO: row.DEPARTAMENTO || row.Departamento || "",
        CEDULA: row.CEDULA || row.Cedula || "",
        FECHA_INGRESO: row.FECHA_INGRESO || row.FechaIngreso || "",
        DIAS: row.DIAS || row.Dias || "",
        BANCO: row.BANCO || row.Banco || "",
        No_CUENTA: row.No_CUENTA || row.NO_CUENTA || row.CUENTA || "",
        ...row,
    };
}

function normalizeLabelToken(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase();
}

function getLegacyValueByIndex(item, index) {
    const key = index === 0 ? "__EMPTY" : `__EMPTY_${index}`;
    return item[key];
}

function buildLegacyColumnLabels(rows) {
    const labels = {};
    for (const row of rows) {
        const isDataRow =
            typeof row?.__EMPTY === "number" && !Number.isNaN(row.__EMPTY);
        if (isDataRow) continue;

        for (const key of Object.keys(row || {})) {
            const match = /^__EMPTY(?:_(\d+))?$/.exec(key);
            if (!match) continue;
            const index = match[1] ? Number(match[1]) : 0;
            const value = row[key];
            if (typeof value !== "string") continue;
            const normalized = value.trim();
            if (!normalized) continue;
            if (!labels[index]) labels[index] = normalized;
        }
    }
    return labels;
}

function mapOriginalTthhRow(item, columnLabels = {}) {
    const base = {
        No: item.__EMPTY,
        EMPLEADOS: item["KIMOBILL OMNICONTACT SOCIEDAD ANONIMA"] || "",
        G: item.__EMPTY_1,
        PERIODO: item.__EMPTY_2,
        DEPARTAMENTO: item.__EMPTY_3,
        CEDULA: item.__EMPTY_4,
        FECHA_INGRESO: excelSerialDateToFormattedString(item.__EMPTY_5),
        DIAS: item.__EMPTY_6,
        SUELDO: roundToTwoDecimals(item.__EMPTY_7),
        HORAS_EXTRAS_50: roundToTwoDecimals(item.__EMPTY_8),
        RECARGO_NOCTURNO: roundToTwoDecimals(item.__EMPTY_9),
        HORAS_EXTRAS_100: roundToTwoDecimals(item.__EMPTY_10),
        BONIFICACION: roundToTwoDecimals(item.__EMPTY_11),
        COMISIONES: roundToTwoDecimals(item.__EMPTY_12),
        SUBTOTAL_INGRESOS: roundToTwoDecimals(item.__EMPTY_13),
        FONDOS_RESERVA: roundToTwoDecimals(item.__EMPTY_14),
        DECIMO_TERCER: roundToTwoDecimals(item.__EMPTY_15),
        DECIMO_CUARTO: roundToTwoDecimals(item.__EMPTY_16),
        VIATICOS: roundToTwoDecimals(item.__EMPTY_17),
        OTROS: roundToTwoDecimals(item.__EMPTY_18),
        TOTAL_INGRESOS: roundToTwoDecimals(item.__EMPTY_19),
        APORTE_PERS: roundToTwoDecimals(item.__EMPTY_20),
        PREST_Q_IESS: roundToTwoDecimals(item.__EMPTY_21),
        PREST_H_IESS: roundToTwoDecimals(item.__EMPTY_22),
        IR: roundToTwoDecimals(item.__EMPTY_23),
        DSCTOS: roundToTwoDecimals(item.__EMPTY_24),
        UNIFORME: roundToTwoDecimals(item.__EMPTY_25),
        ANTICIPADOS: roundToTwoDecimals(item.__EMPTY_26),
        LLAMADOS_ATENCION: roundToTwoDecimals(item.__EMPTY_27),
        FALTAS_ATRASOS: roundToTwoDecimals(item.__EMPTY_28),
        TOTAL_EGRESOS: roundToTwoDecimals(item.__EMPTY_29),
        TOTAL_A_PAGAR: roundToTwoDecimals(item.__EMPTY_30),
        APORTE_PATRONAL: roundToTwoDecimals(item.__EMPTY_31),
        BANCO: item.__EMPTY_32,
        No_CUENTA: item.__EMPTY_33,
        BAN_CODIGO: item.__EMPTY_34,
    };

    const maxLegacyIndex = Object.keys(item || {}).reduce((max, key) => {
        const match = /^__EMPTY_(\d+)$/.exec(key);
        if (!match) return max;
        const index = Number(match[1]);
        return Number.isFinite(index) ? Math.max(max, index) : max;
    }, 34);

    const bankIndex = Number.isFinite(maxLegacyIndex) ? maxLegacyIndex - 2 : 32;
    const accountIndex = Number.isFinite(maxLegacyIndex) ? maxLegacyIndex - 1 : 33;
    const bankCodeIndex = Number.isFinite(maxLegacyIndex) ? maxLegacyIndex : 34;

    const firstFinancialIndex = 7;
    const lastFinancialIndex = Math.max(firstFinancialIndex, bankIndex - 1);
    const splitIndex = Math.floor((firstFinancialIndex + lastFinancialIndex) / 2);

    const labels = {};
    const incomeKeys = [];
    const expenseKeys = [];
    const dynamicFields = {};

    for (let index = firstFinancialIndex; index <= lastFinancialIndex; index += 1) {
        const rawValue = getLegacyValueByIndex(item, index);
        const rawLabel =
            columnLabels[index] || LEGACY_FIXED_KEY_BY_INDEX[index] || `CAMPO_${index}`;
        const key =
            LEGACY_FIXED_KEY_BY_INDEX[index] ||
            `DYN_${index}_${normalizeLabelToken(rawLabel) || "CAMPO"}`;
        labels[key] = rawLabel;
        dynamicFields[key] = roundToTwoDecimals(rawValue);

        if (index <= splitIndex) {
            incomeKeys.push(key);
        } else {
            expenseKeys.push(key);
        }
    }

    const totalPagarValue = getLegacyValueByIndex(item, 30);
    const banco = getLegacyValueByIndex(item, bankIndex);
    const cuenta = getLegacyValueByIndex(item, accountIndex);
    const bancoCodigo = getLegacyValueByIndex(item, bankCodeIndex);

    return {
        ...base,
        ...dynamicFields,
        TOTAL_A_PAGAR:
            totalPagarValue === undefined
                ? base.TOTAL_A_PAGAR
                : roundToTwoDecimals(totalPagarValue),
        BANCO: banco ?? base.BANCO,
        No_CUENTA: cuenta ?? base.No_CUENTA,
        BAN_CODIGO: bancoCodigo ?? base.BAN_CODIGO,
        __incomeKeys: incomeKeys,
        __expenseKeys: expenseKeys,
        __labels: labels,
    };
}

function PayrollPrintTemplate({
    employee,
    containerRef,
    incomeKeys = [],
    expenseKeys = [],
}) {
    if (!employee) return null;
    return (
        <div className="th-payroll-print" ref={containerRef}>
            <div className="th-payroll-header-title">
                <span className="th-payroll-no-inline">{employee.No || ""}</span>
                <h2>KIMOBILL OMNICONTACT SOCIEDAD ANONIMA</h2>
                <img src="/iconoRol.png" alt="Logo Kimobill" />
            </div>
            <div className="th-payroll-ruc">RUC: 1792915805001</div>
            <div className="th-payroll-header-info">
                <div className="th-payroll-grow">
                    <strong>NOMBRES:</strong> {employee.EMPLEADOS || ""}
                </div>
                <div>
                    <strong>IDENTIFICACION:</strong> {employee.CEDULA || ""}
                </div>
                <div>
                    <strong>SUELDO:</strong> {employee.SUELDO || 0}
                </div>
                <div>
                    <strong>DIAS ELABORADOS:</strong> {employee.DIAS || 0}
                </div>
                <div>
                    <strong>PERIODO:</strong> {employee.PERIODO || ""}
                </div>
            </div>

            <div className="th-payroll-body">
                <div className="th-payroll-col">
                    <div className="th-payroll-col-head">
                        <span>INGRESOS</span>
                        <span>VALOR</span>
                    </div>
                    <div className="th-payroll-lines">
                        {incomeKeys.map((key) => (
                            <div key={`pdf-income-${key}`}>
                                <span>{employee.__labels?.[key] || key}</span>
                                <span>${roundToTwoDecimals(employee[key])}</span>
                            </div>
                        ))}
                    </div>
                    <div className="th-payroll-total-row">
                        <span>TOTAL INGRESOS</span>
                        <span>${roundToTwoDecimals(employee.TOTAL_INGRESOS)}</span>
                    </div>
                </div>

                <div className="th-payroll-col">
                    <div className="th-payroll-col-head">
                        <span>EGRESOS</span>
                        <span>VALOR</span>
                    </div>
                    <div className="th-payroll-lines">
                        {expenseKeys.map((key) => (
                            <div key={`pdf-expense-${key}`}>
                                <span>{employee.__labels?.[key] || key}</span>
                                <span>${roundToTwoDecimals(employee[key])}</span>
                            </div>
                        ))}
                    </div>
                    <div className="th-payroll-total-row">
                        <span>TOTAL EGRESOS</span>
                        <span>${roundToTwoDecimals(employee.TOTAL_EGRESOS)}</span>
                    </div>
                </div>
            </div>

            <div className="th-payroll-footer">
                <div className="th-payroll-sign">
                    <p>
                        He leido y acepto el detalle completo de valores generados por
                        mis actividades laboradas mediante el rol expuesto.
                    </p>
                    <div className="th-payroll-sign-line">
                        <div>
                            <div className="th-line-sign" />
                            <span>FIRMA COLABORADOR</span>
                        </div>
                        <span>C.C. {employee.CEDULA || ""}</span>
                    </div>
                </div>
                <div className="th-payroll-pay">
                    <div><span>TOTAL A RECIBIR</span><strong>${roundToTwoDecimals(employee.TOTAL_A_PAGAR)}</strong></div>
                    <div><span>FORMA DE PAGO</span><span>TRANSFERENCIA</span></div>
                    <div><span>ENTIDAD F.</span><span>{employee.BANCO || ""}</span></div>
                    <div><span>No.CUENTA</span><span>{employee.No_CUENTA || ""}</span></div>
                </div>
            </div>
        </div>
    );
}

export default function TalentoHumanoPage() {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [email, setEmail] = useState("");
    const [loadError, setLoadError] = useState("");
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [pdfRenderEmployee, setPdfRenderEmployee] = useState(null);
    const payrollPrintRef = useRef(null);

    const filteredEmployees = useMemo(() => {
        const term = String(search || "").trim().toLowerCase();
        if (!term) return employees;
        return employees.filter((item) => {
            const fullName = String(item.EMPLEADOS || "").toLowerCase();
            const department = String(item.DEPARTAMENTO || "").toLowerCase();
            return fullName.includes(term) || department.includes(term);
        });
    }, [employees, search]);

    const dynamicFields = useMemo(() => {
        if (!selectedEmployee) return [];
        const usedKeys = new Set([
            ...(selectedEmployee.__incomeKeys || []),
            ...(selectedEmployee.__expenseKeys || []),
        ]);
        return Object.entries(selectedEmployee)
            .filter(([key, value]) => {
                if (FIXED_META_KEYS.has(key)) return false;
                if (usedKeys.has(key)) return false;
                if (key.startsWith("__EMPTY")) return false;
                if (key.startsWith("DYN_")) return false;
                if (value === null || value === undefined) return false;
                if (String(value).trim() === "") return false;
                return true;
            })
            .sort(([a], [b]) => a.localeCompare(b));
    }, [selectedEmployee]);

    const employeeForPrint = pdfRenderEmployee || selectedEmployee;

    const resolvedIncomeKeys =
        employeeForPrint?.__incomeKeys?.length > 0
            ? employeeForPrint.__incomeKeys
            : INGRESOS_KEYS;
    const resolvedExpenseKeys =
        employeeForPrint?.__expenseKeys?.length > 0
            ? employeeForPrint.__expenseKeys
            : EGRESOS_KEYS;

    const handleExcelUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setLoadError("");

        try {
            const XLSX = await import("xlsx");
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const firstSheetName = workbook.SheetNames?.[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, {
                defval: "",
            });

            const sourceRows = Array.isArray(rows) ? rows : [];
            const hasOriginalTthhShape = sourceRows.some((item) =>
                Object.prototype.hasOwnProperty.call(item, "__EMPTY"),
            );
            const legacyColumnLabels = hasOriginalTthhShape
                ? buildLegacyColumnLabels(sourceRows)
                : {};

            const normalized = hasOriginalTthhShape
                ? sourceRows
                      .filter(
                          (item) =>
                              typeof item.__EMPTY === "number" &&
                              !Number.isNaN(item.__EMPTY),
                      )
                      .map((item) => mapOriginalTthhRow(item, legacyColumnLabels))
                      .filter((row) => String(row.EMPLEADOS || "").trim())
                : sourceRows
                      .map(normalizeRow)
                      .filter((row) => String(row.EMPLEADOS || "").trim());

            setEmployees(normalized);
            setSelectedEmployee(null);
            setSearch("");
        } catch (err) {
            setLoadError(
                "No se pudo leer el archivo Excel. Verifica el formato .xlsx/.xls.",
            );
            console.error("Error leyendo archivo Excel TTHH:", err);
        }
    };

    const normalizeFileSegment = (value) =>
        String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

    const renderEmployeePdfBlob = async (employee) => {
        if (!employee || !payrollPrintRef.current) {
            throw new Error("No hay empleado para generar PDF");
        }

        const [{ default: html2canvas }, { default: jsPDF }] =
            await Promise.all([import("html2canvas"), import("jspdf")]);

        const canvas = await html2canvas(payrollPrintRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4", true);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 6;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const renderWidth = canvas.width * ratio;
        const renderHeight = canvas.height * ratio;
        const x = (pageWidth - renderWidth) / 2;
        const y = margin;

        pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);

        const fullName = normalizeFileSegment(employee.EMPLEADOS);
        const period = normalizeFileSegment(employee.PERIODO);
        const filename = `ROL DE PAGO - ${fullName}(${period}).pdf`;

        return {
            filename,
            blob: pdf.output("blob"),
        };
    };

    const handleDownloadRole = async () => {
        if (!selectedEmployee) return;

        setPdfRenderEmployee(selectedEmployee);
        await new Promise((resolve) => setTimeout(resolve, 90));

        try {
            const { filename, blob } = await renderEmployeePdfBlob(selectedEmployee);
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generando PDF del rol de pago:", error);
            alert("No se pudo generar el PDF del rol de pago.");
        } finally {
            setPdfRenderEmployee(null);
        }
    };

    const handleDownloadAllRoles = async () => {
        if (!employees.length || bulkDownloading) return;

        const previousSelected = selectedEmployee;
        setBulkDownloading(true);
        const zip = new JSZip();

        try {
            for (const employee of employees) {
                setPdfRenderEmployee(employee);
                await new Promise((resolve) => setTimeout(resolve, 100));
                const { filename, blob } = await renderEmployeePdfBlob(employee);
                zip.file(filename, blob);
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(zipBlob);
            link.href = url;
            link.download = "ROLES_DE_PAGO_TTHH.zip";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generando ZIP de roles:", error);
            alert("No se pudo descargar el paquete de roles.");
        } finally {
            setPdfRenderEmployee(null);
            setSelectedEmployee(previousSelected);
            setBulkDownloading(false);
        }
    };

    const handleSendEmail = () => {
        if (!selectedEmployee) return;
        const subject = encodeURIComponent(
            `ENVIO DE ROL DE PAGO (${selectedEmployee.PERIODO || "SIN PERIODO"})`,
        );
        const body = encodeURIComponent(
            `Estimado/a ${selectedEmployee.EMPLEADOS || "colaborador"},\n\nAdjunto tu rol de pago del periodo ${selectedEmployee.PERIODO || "actual"}.\n\nSaludos,\nTalento Humano`,
        );
        const target = String(email || "").trim();
        window.open(`mailto:${target}?subject=${subject}&body=${body}`, "_self");
    };

    return (
        <div className="th-shell">
            <div className="th-card th-no-print">
                <h1>Generar Roles</h1>
                <p className="th-help">
                    Carga un archivo Excel (.xlsx o .xls) con las columnas del modulo TTHH.
                </p>
                {loadError ? <p className="th-help">{loadError}</p> : null}
                <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleExcelUpload}
                />
                {employees.length > 0 && (
                    <div className="th-actions" style={{ marginTop: "12px" }}>
                        <button
                            type="button"
                            onClick={handleDownloadAllRoles}
                            disabled={bulkDownloading}
                        >
                            {bulkDownloading
                                ? "Generando ZIP..."
                                : "Descargar todos los PDF"}
                        </button>
                    </div>
                )}
            </div>

            {employees.length > 0 && !selectedEmployee && (
                <div className="th-card th-no-print">
                    <div className="th-row">
                        <h2>Empleados ({filteredEmployees.length})</h2>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o departamento"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <div className="th-list">
                        {filteredEmployees.map((item, index) => (
                            <button
                                type="button"
                                key={`${item.CEDULA}-${index}`}
                                className="th-item"
                                onClick={() => {
                                    setSelectedEmployee(item);
                                    setEmail("");
                                }}
                            >
                                <span>{item.EMPLEADOS}</span>
                                <span>{item.DEPARTAMENTO || "Sin departamento"}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {selectedEmployee && (
                <div className="th-card th-no-print">
                    <div className="th-row">
                        <h2>{selectedEmployee.EMPLEADOS}</h2>
                        <button type="button" onClick={() => setSelectedEmployee(null)}>
                            Volver
                        </button>
                    </div>

                    <div className="th-meta">
                        <span>Periodo: {selectedEmployee.PERIODO || "-"}</span>
                        <span>Cedula: {selectedEmployee.CEDULA || "-"}</span>
                        <span>Ingreso: {selectedEmployee.FECHA_INGRESO || "-"}</span>
                        <span>
                            Banco: {selectedEmployee.BANCO || "-"} {selectedEmployee.No_CUENTA || ""}
                        </span>
                    </div>

                    <div className="th-grid">
                        <div>
                            <h3>Ingresos</h3>
                            {resolvedIncomeKeys.map((key) => (
                                <div className="th-line" key={key}>
                                    <span>{selectedEmployee?.__labels?.[key] || key}</span>
                                    <strong>{toCurrency(selectedEmployee[key])}</strong>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h3>Egresos</h3>
                            {resolvedExpenseKeys.map((key) => (
                                <div className="th-line" key={key}>
                                    <span>{selectedEmployee?.__labels?.[key] || key}</span>
                                    <strong>{toCurrency(selectedEmployee[key])}</strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    {dynamicFields.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                            <h3>Campos adicionales del Excel</h3>
                            <div className="th-grid">
                                {dynamicFields.map(([key, value]) => (
                                    <div className="th-line" key={key}>
                                        <span>{key}</span>
                                        <strong>{String(value)}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="th-total">
                        <span>Total a pagar</span>
                        <strong>{toCurrency(selectedEmployee.TOTAL_A_PAGAR)}</strong>
                    </div>

                    <div className="th-actions">
                        <button type="button" onClick={handleDownloadRole}>
                            Descargar PDF rol
                        </button>
                        <input
                            type="email"
                            placeholder="correo@empresa.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                        <button type="button" onClick={handleSendEmail}>
                            Enviar correo
                        </button>
                    </div>
                </div>
            )}

            <PayrollPrintTemplate
                employee={employeeForPrint}
                containerRef={payrollPrintRef}
                incomeKeys={resolvedIncomeKeys}
                expenseKeys={resolvedExpenseKeys}
            />
        </div>
    );
}
