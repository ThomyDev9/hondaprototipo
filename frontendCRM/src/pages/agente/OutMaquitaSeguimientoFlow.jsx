import React from "react";
import {
    fetchOutMaquitaDocumentosSeguimiento,
    guardarOutMaquitaDocumentosSeguimiento,
} from "../../services/dashboard.service";
import {
    OUT_MAQUITA_MAIL_MOTIVOS,
    getOutMaquitaSubmotivosByMotivo,
} from "./outMaquitaConfig";
import "./OutMaquitaDocumentosFlow.css";

const CAMPAIGN_ID = "Out Maquita Cushunchic";

function formatUploadDate(value = "") {
    if (!value) return "Sin fecha";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("es-EC", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

export default function OutMaquitaSeguimientoFlow({ onBack }) {
    const [rows, setRows] = React.useState([]);
    const [selectedRow, setSelectedRow] = React.useState(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [motivoInteraccion, setMotivoInteraccion] = React.useState("");
    const [submotivoInteraccion, setSubmotivoInteraccion] = React.useState("");
    const [observaciones, setObservaciones] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const [successMessage, setSuccessMessage] = React.useState("");

    const loadRows = React.useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const { ok, json } = await fetchOutMaquitaDocumentosSeguimiento({
                campaignId: CAMPAIGN_ID,
            });

            if (!ok) {
                throw new Error(
                    json?.detail ||
                        json?.error ||
                        "No se pudo cargar el seguimiento documental",
                );
            }

            const data = Array.isArray(json?.data) ? json.data : [];
            setRows(data);

            if (!data.length) {
                setSelectedRow(null);
                setIsModalOpen(false);
                return;
            }

            setSelectedRow((current) => {
                if (!current?.identification) return data[0];
                return (
                    data.find(
                        (item) => item.identification === current.identification,
                    ) || data[0]
                );
            });
        } catch (loadError) {
            setError(
                loadError?.message ||
                    "No se pudo cargar el seguimiento documental",
            );
            setRows([]);
            setSelectedRow(null);
            setIsModalOpen(false);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadRows();
    }, [loadRows]);

    const motivoOptions = OUT_MAQUITA_MAIL_MOTIVOS;
    const submotivoOptions = getOutMaquitaSubmotivosByMotivo(motivoInteraccion);

    React.useEffect(() => {
        setMotivoInteraccion(selectedRow?.motivoInteraccion || "");
        setSubmotivoInteraccion(selectedRow?.submotivoInteraccion || "");
        setObservaciones(selectedRow?.observaciones || "");
    }, [selectedRow]);

    React.useEffect(() => {
        if (!successMessage) return undefined;
        const timerId = window.setTimeout(() => {
            setSuccessMessage("");
        }, 3000);
        return () => window.clearTimeout(timerId);
    }, [successMessage]);

    const handleSaveComment = async () => {
        if (!selectedRow?.identification) return;
        if (!motivoInteraccion || !submotivoInteraccion) {
            setError("Motivo y submotivo son obligatorios.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccessMessage("");

        try {
            const { ok, json } = await guardarOutMaquitaDocumentosSeguimiento({
                campaignId: CAMPAIGN_ID,
                identification: selectedRow.identification,
                motivoInteraccion,
                submotivoInteraccion,
                observaciones,
            });
            if (!ok) {
                throw new Error(
                    json?.detail ||
                        json?.error ||
                        "No se pudo guardar el seguimiento",
                );
            }

            setSuccessMessage("Seguimiento guardado correctamente.");
            await loadRows();
            setIsModalOpen(false);
        } catch (saveError) {
            setError(
                saveError?.message ||
                    "No se pudo guardar el comentario de seguimiento",
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="outmaquita-docs__status">
                Cargando seguimiento documental...
            </div>
        );
    }

    return (
        <div className="outmaquita-docs">
            <div className="outmaquita-docs__shell">
                <div className="outmaquita-docs__header">
                    <button
                        type="button"
                        className="outmaquita-docs__back-button"
                        onClick={onBack}
                    >
                        Regresar
                    </button>
                    <div className="outmaquita-docs__title-wrap">
                        <h1 className="outmaquita-docs__title">Seguimiento</h1>
                        <span className="outmaquita-docs__count">
                            {rows.length} registros con estado documental
                        </span>
                    </div>
                </div>

                {successMessage ? (
                    <div className="outmaquita-docs__success">{successMessage}</div>
                ) : null}
                {error ? <div className="outmaquita-docs__error">{error}</div> : null}

                {!rows.length ? (
                    <div className="outmaquita-docs__empty">
                        No hay registros con estado documental Completos o
                        Incompletos.
                    </div>
                ) : (
                    <div className="outmaquita-docs__layout">
                        <section className="outmaquita-docs__table-card">
                            <div className="outmaquita-docs__table-wrapper">
                                <table className="outmaquita-docs__table">
                                    <thead>
                                        <tr>
                                            <th>Identificacion</th>
                                            <th>Cliente</th>
                                            <th>Celular</th>
                                            <th>Tipo entrega</th>
                                            <th>Agencia asistir</th>
                                            <th>Estado documentos</th>
                                            <th>Estado credito</th>
                                            <th>Motivo</th>
                                            <th>Submotivo</th>
                                            <th>Accion</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.identification}>
                                                <td>{row.identification}</td>
                                                <td>{row.fullName || "-"}</td>
                                                <td>{row.celular || "-"}</td>
                                                <td>{row.entregaDocumentos || "-"}</td>
                                                <td>{row.agenciaAsistir || "-"}</td>
                                                <td>{row.documentStatus || "-"}</td>
                                                <td>{row.creditStatus || "Sin estado"}</td>
                                                <td>{row.motivoInteraccion || "-"}</td>
                                                <td>{row.submotivoInteraccion || "-"}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="outmaquita-docs__select-button"
                                                        onClick={() => {
                                                            setSelectedRow(row);
                                                            setMotivoInteraccion(
                                                                row.motivoInteraccion ||
                                                                    "",
                                                            );
                                                            setSubmotivoInteraccion(
                                                                row.submotivoInteraccion ||
                                                                    "",
                                                            );
                                                            setObservaciones(
                                                                row.observaciones ||
                                                                    "",
                                                            );
                                                            setIsModalOpen(true);
                                                            setError("");
                                                            setSuccessMessage("");
                                                        }}
                                                    >
                                                        Seleccionar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {isModalOpen && selectedRow ? (
                <div
                    className="outmaquita-docs__modal-backdrop"
                    onClick={() => {
                        if (saving) return;
                        setIsModalOpen(false);
                    }}
                >
                    <div
                        className="outmaquita-docs__modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="outmaquita-docs__modal-head">
                            <h2>Seguimiento documental</h2>
                            <button
                                type="button"
                                className="outmaquita-docs__modal-close"
                                onClick={() => {
                                    if (saving) return;
                                    setIsModalOpen(false);
                                }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <div className="outmaquita-docs__upload-tag">
                            <span>
                                Cedula: <strong>{selectedRow.identification}</strong>
                            </span>
                            <span>
                                Estado:{" "}
                                <strong>{selectedRow.documentStatus || "-"}</strong>
                            </span>
                            <span>
                                Fecha de actualizacion:{" "}
                                <strong>
                                    {formatUploadDate(selectedRow.updatedAt)}
                                </strong>
                            </span>
                        </div>

                        <label className="outmaquita-docs__field">
                            <span>Tipo de entrega</span>
                            <input value={selectedRow.entregaDocumentos || ""} readOnly />
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>Comentario de gestion documental</span>
                            <input
                                value={selectedRow.documentComment || ""}
                                readOnly
                            />
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>Estado de credito</span>
                            <input
                                value={selectedRow.creditStatus || "Sin estado"}
                                readOnly
                            />
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>Motivo</span>
                            <select
                                value={motivoInteraccion}
                                onChange={(event) => {
                                    setMotivoInteraccion(event.target.value);
                                    setSubmotivoInteraccion("");
                                }}
                            >
                                <option value="">Selecciona una opcion</option>
                                {motivoOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>Submotivo</span>
                            <select
                                value={submotivoInteraccion}
                                onChange={(event) =>
                                    setSubmotivoInteraccion(event.target.value)
                                }
                            >
                                <option value="">Selecciona una opcion</option>
                                {submotivoOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>Observacion</span>
                            <textarea
                                rows="4"
                                value={observaciones}
                                onChange={(event) =>
                                    setObservaciones(event.target.value)
                                }
                                placeholder="Escribe observaciones de seguimiento del cliente"
                            />
                        </label>

                        <button
                            type="button"
                            className="outmaquita-docs__save-button"
                            onClick={handleSaveComment}
                            disabled={saving}
                        >
                            {saving ? "Guardando..." : "Guardar comentario"}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
