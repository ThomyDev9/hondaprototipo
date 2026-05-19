import { useEffect, useMemo, useState } from "react";
import "./ColaboradorFichaForm.css";

const API_BASE = import.meta.env.VITE_API_BASE;

const CATALOG_CONFIG = [
    ["marital_status_id", "marital_status", "Estado Civil"],
    ["sector_id", "sector", "Sector"],
    ["gender_id", "gender", "Genero"],
    ["job_title_id", "job_title", "Cargo / Puesto"],
    ["department_id", "department", "Departamento"],
    ["area_id", "area", "Area"],
    ["contract_type_id", "contract_type", "Tipo de Contrato"],
    ["workday_type_id", "workday_type", "Jornada Trabajo"],
    ["education_level_id", "education_level", "Educacion"],
    ["bank_id", "bank", "Banco"],
    ["work_modality_id", "work_modality", "Modalidad de Trabajo"],
    ["employee_status_id", "employee_status", "Estado de Empleado"],
    ["exit_reason_id", "exit_reason", "Motivo Salida"],
];

const INITIAL_FORM = {
    first_name: "",
    last_name: "",
    full_name: "",
    photo_url: "",
    national_id: "",
    birth_date: "",
    marital_status_id: "",
    children_count: "",
    personal_phone: "",
    alt_phone: "",
    corporate_email: "",
    personal_email: "",
    address_text: "",
    province: "",
    sector_id: "",
    gender_id: "",
    family_dependents_count: "",
    job_title_id: "",
    department_id: "",
    area_id: "",
    hire_date: "",
    exit_date: "",
    contract_type_id: "",
    workday_type_id: "",
    education_level_id: "",
    base_salary: "",
    bank_id: "",
    bank_account_number: "",
    work_modality_id: "",
    employee_status_id: "",
    decimals_accumulation: false,
    exit_reason_id: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    med_allergy_drug: false,
    med_allergy_food: false,
    med_allergy_detail: "",
    observations: "",
};

function LabeledField({ label, children, full = false }) {
    return (
        <label className={`thf-field ${full ? "thf-full" : ""}`}>
            <span className="thf-label">{label}</span>
            {children}
        </label>
    );
}

export default function ColaboradorFichaForm({
    mode = "create",
    initialData = null,
    onSaved = null,
}) {
    const [catalogs, setCatalogs] = useState({});
    const [form, setForm] = useState(INITIAL_FORM);
    const [newOption, setNewOption] = useState({
        field: "job_title_id",
        code: "",
        label: "",
    });
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const activeToken = useMemo(() => localStorage.getItem("access_token") || "", []);

    const fetchCatalogs = async () => {
        const reqs = CATALOG_CONFIG.map(async ([, catalogType]) => {
            const res = await fetch(
                `${API_BASE}/tthh/catalogs?type=${encodeURIComponent(catalogType)}`,
                {
                    headers: {
                        Authorization: `Bearer ${activeToken}`,
                    },
                },
            );
            const json = await res.json().catch(() => ({}));
            return [catalogType, Array.isArray(json.data) ? json.data : []];
        });
        const all = await Promise.all(reqs);
        setCatalogs(Object.fromEntries(all));
    };

    useEffect(() => {
        fetchCatalogs().catch(() => {
            setError("No se pudo cargar catalogos.");
        });
    }, []);

    useEffect(() => {
        if (!initialData) {
            setForm(INITIAL_FORM);
            return;
        }
        setForm({
            ...INITIAL_FORM,
            ...initialData,
            ...Object.fromEntries(
                CATALOG_CONFIG.map(([field]) => [
                    field,
                    initialData[field] ? String(initialData[field]) : "",
                ]),
            ),
            children_count:
                initialData.children_count === null || initialData.children_count === undefined
                    ? ""
                    : Number(initialData.children_count || 0),
            family_dependents_count:
                initialData.family_dependents_count === null ||
                initialData.family_dependents_count === undefined
                    ? ""
                    : Number(initialData.family_dependents_count || 0),
            base_salary: Number(initialData.base_salary || 0),
            decimals_accumulation: Number(initialData.decimals_accumulation || 0) === 1,
            med_allergy_drug: Number(initialData.med_allergy_drug || 0) === 1,
            med_allergy_food: Number(initialData.med_allergy_food || 0) === 1,
        });
    }, [initialData]);

    const onChange = (key, value) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            if (key === "first_name" || key === "last_name") {
                const first = key === "first_name" ? value : next.first_name;
                const last = key === "last_name" ? value : next.last_name;
                next.full_name = `${String(first || "").trim()} ${String(last || "").trim()}`.trim();
            }
            return next;
        });
    };

    const createCatalogOption = async () => {
        setError("");
        setMessage("");
        const fieldConfig = CATALOG_CONFIG.find(([field]) => field === newOption.field);
        if (!fieldConfig) return;
        const [, catalogType] = fieldConfig;
        if (!newOption.code.trim() || !newOption.label.trim()) {
            setError("Para agregar opcion, completa codigo y etiqueta.");
            return;
        }

        const res = await fetch(`${API_BASE}/tthh/catalogs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${activeToken}`,
            },
            body: JSON.stringify({
                catalog_type: catalogType,
                code: newOption.code.trim().toLowerCase(),
                label: newOption.label.trim(),
            }),
        });
        if (!res.ok) {
            setError("No se pudo crear la opcion.");
            return;
        }
        setMessage("Opcion creada correctamente.");
        setNewOption((prev) => ({ ...prev, code: "", label: "" }));
        await fetchCatalogs();
    };

    const uploadPhoto = async (file) => {
        if (!file) return;
        setError("");
        setMessage("");
        setUploadingPhoto(true);
        try {
            const formData = new FormData();
            formData.append("photo", file);
            const res = await fetch(`${API_BASE}/tthh/employees/photo`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${activeToken}`,
                },
                body: formData,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json.error || "No se pudo subir la foto");
                return;
            }
            const nextUrl = String(json?.data?.photoUrl || "").trim();
            if (nextUrl) {
                onChange("photo_url", nextUrl);
                setMessage("Foto cargada correctamente.");
            }
        } finally {
            setUploadingPhoto(false);
        }
    };

    const submitForm = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const payload = {
                ...form,
                ...Object.fromEntries(
                    CATALOG_CONFIG.map(([field]) => [
                        field,
                        form[field] ? Number(form[field]) : null,
                    ]),
                ),
                children_count: Number(form.children_count || 0),
                family_dependents_count: Number(form.family_dependents_count || 0),
                base_salary: Number(form.base_salary || 0),
            };

            const isEdit = mode === "edit" && initialData?.id;
            const endpoint = isEdit
                ? `${API_BASE}/tthh/employees/${initialData.id}`
                : `${API_BASE}/tthh/employees`;

            const response = await fetch(endpoint, {
                method: isEdit ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${activeToken}`,
                },
                body: JSON.stringify(payload),
            });
            const json = await response.json().catch(() => ({}));

            if (!response.ok) {
                setError(json.error || "No se pudo guardar la ficha.");
                return;
            }

            setMessage(isEdit ? "Ficha actualizada correctamente." : "Ficha guardada correctamente.");
            if (!isEdit) {
                setForm(INITIAL_FORM);
            }
            if (typeof onSaved === "function") {
                onSaved(json?.data?.id || initialData?.id || null);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="th-card th-no-print">
            <h2>Ficha de Colaborador</h2>
            {error ? <p className="th-help">{error}</p> : null}
            {message ? <p className="th-help">{message}</p> : null}

            <form onSubmit={submitForm} className="thf-form">
                <section className="thf-section">
                    <h3 className="thf-section-title">Datos Personales</h3>
                    <div className="thf-grid">
                        <LabeledField label="Nombres"><input value={form.first_name} onChange={(e) => onChange("first_name", e.target.value)} required /></LabeledField>
                        <LabeledField label="Apellidos"><input value={form.last_name} onChange={(e) => onChange("last_name", e.target.value)} required /></LabeledField>
                        <LabeledField label="Cedula / ID"><input value={form.national_id} onChange={(e) => onChange("national_id", e.target.value)} required /></LabeledField>
                        <LabeledField label="Fotografia del empleado">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => uploadPhoto(e.target.files?.[0])}
                                disabled={uploadingPhoto}
                            />
                        </LabeledField>
                        <LabeledField label="Fecha de nacimiento"><input type="date" value={form.birth_date} onChange={(e) => onChange("birth_date", e.target.value)} required /></LabeledField>
                        <LabeledField label="Estado Civil">
                            <select value={form.marital_status_id} onChange={(e) => onChange("marital_status_id", e.target.value)}>
                                <option value="">Seleccionar</option>
                                {(catalogs.marital_status || []).map((item) => (
                                    <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                            </select>
                        </LabeledField>
                        <LabeledField label="Numero de Hijos"><input type="number" min="0" value={form.children_count} onChange={(e) => onChange("children_count", e.target.value)} /></LabeledField>
                        <LabeledField label="Telefono Personal"><input value={form.personal_phone} onChange={(e) => onChange("personal_phone", e.target.value)} /></LabeledField>
                        <LabeledField label="Telefono Alternativo"><input value={form.alt_phone} onChange={(e) => onChange("alt_phone", e.target.value)} /></LabeledField>
                        <LabeledField label="Mail Corporativo"><input type="email" value={form.corporate_email} onChange={(e) => onChange("corporate_email", e.target.value)} /></LabeledField>
                        <LabeledField label="Mail Personal"><input type="email" value={form.personal_email} onChange={(e) => onChange("personal_email", e.target.value)} /></LabeledField>
                        <LabeledField label="Direccion"><input value={form.address_text} onChange={(e) => onChange("address_text", e.target.value)} /></LabeledField>
                        <LabeledField label="Provincia"><input value={form.province} onChange={(e) => onChange("province", e.target.value)} /></LabeledField>
                        <LabeledField label="Sector">
                            <select value={form.sector_id} onChange={(e) => onChange("sector_id", e.target.value)}>
                                <option value="">Seleccionar</option>
                                {(catalogs.sector || []).map((item) => (
                                    <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                            </select>
                        </LabeledField>
                        <LabeledField label="Genero">
                            <select value={form.gender_id} onChange={(e) => onChange("gender_id", e.target.value)}>
                                <option value="">Seleccionar</option>
                                {(catalogs.gender || []).map((item) => (
                                    <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                            </select>
                        </LabeledField>
                        <LabeledField label="Cargas Familiares"><input type="number" min="0" value={form.family_dependents_count} onChange={(e) => onChange("family_dependents_count", e.target.value)} /></LabeledField>
                        <LabeledField label="Vista de fotografia">
                            {form.photo_url ? (
                                <img
                                    src={`${API_BASE}${form.photo_url}`}
                                    alt="Foto colaborador"
                                    className="thf-photo-preview"
                                />
                            ) : (
                                <span className="thf-photo-empty">Sin foto cargada</span>
                            )}
                        </LabeledField>
                    </div>
                </section>

                <section className="thf-section">
                    <h3 className="thf-section-title">Informacion Laboral</h3>
                    <div className="thf-grid">
                        {CATALOG_CONFIG.filter(([field]) =>
                            [
                                "job_title_id",
                                "department_id",
                                "area_id",
                                "contract_type_id",
                                "workday_type_id",
                                "education_level_id",
                                "bank_id",
                                "work_modality_id",
                                "employee_status_id",
                                "exit_reason_id",
                            ].includes(field),
                        ).map(([field, type, label]) => (
                            <LabeledField key={field} label={label}>
                                <select value={form[field]} onChange={(e) => onChange(field, e.target.value)}>
                                    <option value="">Seleccionar</option>
                                    {(catalogs[type] || []).map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </select>
                            </LabeledField>
                        ))}

                        <LabeledField label="Fecha de Ingreso"><input type="date" value={form.hire_date} onChange={(e) => onChange("hire_date", e.target.value)} required /></LabeledField>
                        <LabeledField label="Fecha de Salida"><input type="date" value={form.exit_date} onChange={(e) => onChange("exit_date", e.target.value)} /></LabeledField>
                        <LabeledField label="Salario Base"><input type="number" step="0.01" min="0" value={form.base_salary} onChange={(e) => onChange("base_salary", e.target.value)} /></LabeledField>
                        <LabeledField label="No. cuenta"><input value={form.bank_account_number} onChange={(e) => onChange("bank_account_number", e.target.value)} /></LabeledField>
                    </div>
                </section>

                <div className="thf-switches">
                    <label><input type="checkbox" checked={form.decimals_accumulation} onChange={(e) => onChange("decimals_accumulation", e.target.checked)} />Acumulacion de Decimos</label>
                    <label><input type="checkbox" checked={form.med_allergy_drug} onChange={(e) => onChange("med_allergy_drug", e.target.checked)} />Alergia medicamento</label>
                    <label><input type="checkbox" checked={form.med_allergy_food} onChange={(e) => onChange("med_allergy_food", e.target.checked)} />Alergia alimento</label>
                </div>

                <section className="thf-section">
                    <h3 className="thf-section-title">Informacion Medica</h3>
                    <div className="thf-grid">
                        <LabeledField label="Nombre del Contacto"><input value={form.emergency_contact_name} onChange={(e) => onChange("emergency_contact_name", e.target.value)} /></LabeledField>
                        <LabeledField label="Parentesco"><input value={form.emergency_contact_relationship} onChange={(e) => onChange("emergency_contact_relationship", e.target.value)} /></LabeledField>
                        <LabeledField label="Telefono de Contacto"><input value={form.emergency_contact_phone} onChange={(e) => onChange("emergency_contact_phone", e.target.value)} /></LabeledField>
                        <LabeledField full label="Detalle de alergias"><textarea value={form.med_allergy_detail} onChange={(e) => onChange("med_allergy_detail", e.target.value)} /></LabeledField>
                        <LabeledField full label="Observaciones"><textarea value={form.observations} onChange={(e) => onChange("observations", e.target.value)} /></LabeledField>
                    </div>
                </section>

                <button className="thf-full" type="submit" disabled={loading}>
                    {loading ? "Guardando..." : mode === "edit" ? "Actualizar ficha" : "Guardar ficha"}
                </button>
            </form>

            {mode === "create" ? (
                <div className="thf-divider">
                    <h3>Agregar opcion dinamica</h3>
                    <div className="thf-inline-grid">
                        <select value={newOption.field} onChange={(e) => setNewOption((prev) => ({ ...prev, field: e.target.value }))}>
                            {CATALOG_CONFIG.map(([field, , label]) => (
                                <option key={field} value={field}>{label}</option>
                            ))}
                        </select>
                        <input placeholder="codigo-opcion" value={newOption.code} onChange={(e) => setNewOption((prev) => ({ ...prev, code: e.target.value }))} />
                        <input placeholder="Etiqueta visible" value={newOption.label} onChange={(e) => setNewOption((prev) => ({ ...prev, label: e.target.value }))} />
                        <button type="button" onClick={createCatalogOption}>Agregar opcion</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
