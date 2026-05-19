import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "../../components/common";
import ColaboradorFichaForm from "./ColaboradorFichaForm";
import "./TalentoHumanoPage.css";
import "./ColaboradorFichaForm.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function FichaColaboradorPage() {
    const [tab, setTab] = useState("crear");
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [error, setError] = useState("");
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const profileRef = useRef(null);

    const activeToken = useMemo(() => localStorage.getItem("access_token") || "", []);

    const fetchEmployees = async (searchTerm = "") => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams();
            if (searchTerm.trim()) params.set("search", searchTerm.trim());
            const res = await fetch(`${API_BASE}/tthh/employees?${params.toString()}`, {
                headers: { Authorization: `Bearer ${activeToken}` },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || "No se pudo cargar fichas");
            }
            setEmployees(Array.isArray(json.data) ? json.data : []);
        } catch (err) {
            setError(err.message || "No se pudo cargar fichas");
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeById = async (id) => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE}/tthh/employees/${id}`, {
                headers: { Authorization: `Bearer ${activeToken}` },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || "No se pudo cargar la ficha");
            }
            setSelectedEmployee(json.data || null);
        } catch (err) {
            setError(err.message || "No se pudo cargar la ficha");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tab === "ver" || tab === "editar") {
            fetchEmployees(search).catch(() => null);
        }
    }, [tab]);

    const handleSearch = () => {
        fetchEmployees(search).catch(() => null);
    };

    const handleSelectForEdit = async (employeeId) => {
        setSelectedEmployeeId(employeeId);
        await fetchEmployeeById(employeeId);
    };

    const handleSelectForView = async (employeeId) => {
        setSelectedEmployeeId(employeeId);
        await fetchEmployeeById(employeeId);
    };

    const renderText = (value, fallback = "-") => {
        const text = String(value ?? "").trim();
        return text || fallback;
    };

    const renderYesNo = (value) => (Number(value || 0) === 1 ? "Si" : "No");

    const handleDownloadProfilePdf = async () => {
        if (!profileRef.current || !selectedEmployee) return;
        setDownloadingPdf(true);
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import("html2canvas"),
                import("jspdf"),
            ]);
            const canvas = await html2canvas(profileRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4", true);
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const maxWidth = pageWidth - margin * 2;
            const maxHeight = pageHeight - margin * 2;
            const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
            const renderWidth = canvas.width * ratio;
            const renderHeight = canvas.height * ratio;
            const x = (pageWidth - renderWidth) / 2;
            const y = margin;
            pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
            const safeName = renderText(selectedEmployee.full_name, "COLABORADOR")
                .replace(/\s+/g, "_")
                .replace(/[^a-zA-Z0-9_-]/g, "");
            pdf.save(`FICHA_COLABORADOR_${safeName}.pdf`);
        } catch {
            setError("No se pudo generar el PDF de la ficha.");
        } finally {
            setDownloadingPdf(false);
        }
    };

    const tabs = [
        {
            id: "crear",
            label: "Crear ficha",
            content: (
                <ColaboradorFichaForm
                    mode="create"
                    onSaved={() => {
                        fetchEmployees(search).catch(() => null);
                    }}
                />
            ),
        },
        {
            id: "ver",
            label: "Ver fichas",
            content: (
                <div className="thf-view-layout">
                    <div className="th-card th-no-print">
                        <div className="th-row">
                            <h2>Fichas existentes</h2>
                            <div className="thf-list-search">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar por nombre o cedula"
                                />
                                <button type="button" onClick={handleSearch}>
                                    Buscar
                                </button>
                            </div>
                        </div>
                        {error ? <p className="th-help">{error}</p> : null}
                        {loading ? <p className="th-help">Cargando...</p> : null}
                        <div className="thf-list">
                            {employees.map((employee) => (
                                <button
                                    key={employee.id}
                                    type="button"
                                    className={`thf-list-item thf-list-item-btn ${
                                        Number(selectedEmployeeId) === Number(employee.id)
                                            ? "thf-selected"
                                            : ""
                                    }`}
                                    onClick={() => handleSelectForView(employee.id)}
                                >
                                    <strong>{employee.full_name}</strong>
                                    <span>{employee.national_id}</span>
                                    <span>
                                        {employee.department_label || "Sin departamento"} - {employee.employee_status_label || "Sin estado"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedEmployee ? (
                        <div className="th-card thf-profile-card">
                            <div className="th-actions th-no-print" style={{ marginTop: 0 }}>
                                <button
                                    type="button"
                                    onClick={handleDownloadProfilePdf}
                                    disabled={downloadingPdf}
                                >
                                    {downloadingPdf ? "Generando PDF..." : "Descargar ficha PDF"}
                                </button>
                            </div>
                            <div className="thf-profile-sheet" ref={profileRef}>
                                <div className="thf-profile-header">
                                    <div className="thf-profile-brand">
                                        <img src="/Logo_KMB.svg" alt="Logo empresa" className="thf-profile-logo" />
                                        <div>
                                            <h2>Ficha de Colaborador</h2>
                                            <p>{renderText(selectedEmployee.full_name)}</p>
                                            <span className="thf-profile-subline">
                                                Documento interno de Talento Humano
                                            </span>
                                        </div>
                                    </div>
                                    {selectedEmployee.photo_url ? (
                                        <img
                                            src={`${API_BASE}${selectedEmployee.photo_url}`}
                                            alt="Foto colaborador"
                                            className="thf-profile-photo"
                                        />
                                    ) : (
                                        <div className="thf-profile-photo thf-profile-photo-empty">
                                            Sin foto
                                        </div>
                                    )}
                                </div>
                                <div className="thf-profile-topmeta">
                                    <div><span>Cédula</span><strong>{renderText(selectedEmployee.national_id)}</strong></div>
                                    <div><span>Departamento</span><strong>{renderText(selectedEmployee.department_label)}</strong></div>
                                    <div><span>Cargo</span><strong>{renderText(selectedEmployee.job_title_label)}</strong></div>
                                    <div><span>Estado</span><strong>{renderText(selectedEmployee.employee_status_label)}</strong></div>
                                </div>

                                <div className="thf-profile-section">
                                    <h3>Datos Personales</h3>
                                    <div className="thf-profile-grid">
                                        <div><span>Cedula</span><strong>{renderText(selectedEmployee.national_id)}</strong></div>
                                        <div><span>Fecha nacimiento</span><strong>{renderText(selectedEmployee.birth_date)}</strong></div>
                                        <div><span>Estado Civil</span><strong>{renderText(selectedEmployee.marital_status_label)}</strong></div>
                                        <div><span>Hijos</span><strong>{renderText(selectedEmployee.children_count)}</strong></div>
                                        <div><span>Cargas Familiares</span><strong>{renderText(selectedEmployee.family_dependents_count)}</strong></div>
                                        <div><span>Telefono Personal</span><strong>{renderText(selectedEmployee.personal_phone)}</strong></div>
                                        <div><span>Telefono Alternativo</span><strong>{renderText(selectedEmployee.alt_phone)}</strong></div>
                                        <div><span>Mail Corporativo</span><strong>{renderText(selectedEmployee.corporate_email)}</strong></div>
                                        <div><span>Mail Personal</span><strong>{renderText(selectedEmployee.personal_email)}</strong></div>
                                        <div><span>Direccion</span><strong>{renderText(selectedEmployee.address_text)}</strong></div>
                                        <div><span>Provincia</span><strong>{renderText(selectedEmployee.province)}</strong></div>
                                        <div><span>Sector</span><strong>{renderText(selectedEmployee.sector_label)}</strong></div>
                                        <div><span>Genero</span><strong>{renderText(selectedEmployee.gender_label)}</strong></div>
                                    </div>
                                </div>

                                <div className="thf-profile-section">
                                    <h3>Informacion Laboral</h3>
                                    <div className="thf-profile-grid">
                                        <div><span>Cargo</span><strong>{renderText(selectedEmployee.job_title_label)}</strong></div>
                                        <div><span>Departamento</span><strong>{renderText(selectedEmployee.department_label)}</strong></div>
                                        <div><span>Area</span><strong>{renderText(selectedEmployee.area_label)}</strong></div>
                                        <div><span>Ingreso</span><strong>{renderText(selectedEmployee.hire_date)}</strong></div>
                                        <div><span>Salida</span><strong>{renderText(selectedEmployee.exit_date)}</strong></div>
                                        <div><span>Contrato</span><strong>{renderText(selectedEmployee.contract_type_label)}</strong></div>
                                        <div><span>Jornada</span><strong>{renderText(selectedEmployee.workday_type_label)}</strong></div>
                                        <div><span>Educacion</span><strong>{renderText(selectedEmployee.education_level_label)}</strong></div>
                                        <div><span>Salario Base</span><strong>{renderText(selectedEmployee.base_salary)}</strong></div>
                                        <div><span>Banco</span><strong>{renderText(selectedEmployee.bank_label)}</strong></div>
                                        <div><span>No. Cuenta</span><strong>{renderText(selectedEmployee.bank_account_number)}</strong></div>
                                        <div><span>Modalidad</span><strong>{renderText(selectedEmployee.work_modality_label)}</strong></div>
                                        <div><span>Estado</span><strong>{renderText(selectedEmployee.employee_status_label)}</strong></div>
                                        <div><span>Acumulacion Decimos</span><strong>{renderYesNo(selectedEmployee.decimals_accumulation)}</strong></div>
                                        <div><span>Motivo Salida</span><strong>{renderText(selectedEmployee.exit_reason_label)}</strong></div>
                                    </div>
                                </div>

                                <div className="thf-profile-section">
                                    <h3>Informacion Medica</h3>
                                    <div className="thf-profile-grid">
                                        <div><span>Alergia medicamento</span><strong>{renderYesNo(selectedEmployee.med_allergy_drug)}</strong></div>
                                        <div><span>Alergia alimento</span><strong>{renderYesNo(selectedEmployee.med_allergy_food)}</strong></div>
                                        <div className="thf-profile-wide"><span>Detalle alergias</span><strong>{renderText(selectedEmployee.med_allergy_detail)}</strong></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            ),
        },
        {
            id: "editar",
            label: "Editar ficha",
            content: (
                <>
                    <div className="th-card th-no-print">
                        <div className="th-row">
                            <h2>Seleccionar ficha para editar</h2>
                            <div className="thf-list-search">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar por nombre o cedula"
                                />
                                <button type="button" onClick={handleSearch}>
                                    Buscar
                                </button>
                            </div>
                        </div>
                        {error ? <p className="th-help">{error}</p> : null}
                        <div className="thf-list">
                            {employees.map((employee) => (
                                <button
                                    key={employee.id}
                                    type="button"
                                    className={`thf-list-item thf-list-item-btn ${
                                        Number(selectedEmployeeId) === Number(employee.id)
                                            ? "thf-selected"
                                            : ""
                                    }`}
                                    onClick={() => handleSelectForEdit(employee.id)}
                                >
                                    <strong>{employee.full_name}</strong>
                                    <span>{employee.national_id}</span>
                                    <span>
                                        {employee.department_label || "Sin departamento"} - {employee.employee_status_label || "Sin estado"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedEmployee ? (
                        <ColaboradorFichaForm
                            mode="edit"
                            initialData={selectedEmployee}
                            onSaved={() => {
                                fetchEmployees(search).catch(() => null);
                                fetchEmployeeById(selectedEmployee.id).catch(() => null);
                            }}
                        />
                    ) : null}
                </>
            ),
        },
    ];

    return (
        <div className="th-shell">
            <Tabs tabs={tabs} activeTab={tab} onChange={setTab} variant="default" />
        </div>
    );
}
