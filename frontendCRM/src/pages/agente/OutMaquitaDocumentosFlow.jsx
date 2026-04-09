import React from "react";
import {
    fetchOutMaquitaDocumentos,
    guardarOutMaquitaDocumentos,
} from "../../services/dashboard.service";
import "./OutMaquitaDocumentosFlow.css";

const CAMPAIGN_ID = "Out Maquita Cushunchic";
const DOCUMENT_STATUS_OPTIONS = ["Completos", "Incompletos"];

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

export default function OutMaquitaDocumentosFlow({ onBack }) {
    const [rows, setRows] = React.useState([]);
    const [selectedRow, setSelectedRow] = React.useState(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [documentStatus, setDocumentStatus] = React.useState("");
    const [documentComment, setDocumentComment] = React.useState("");
    const [documentFile, setDocumentFile] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const [successMessage, setSuccessMessage] = React.useState("");

    const loadRows = React.useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const { ok, json } = await fetchOutMaquitaDocumentos({
                campaignId: CAMPAIGN_ID,
            });

            if (!ok) {
                throw new Error(
                    json?.detail ||
                        json?.error ||
                        "No se pudo cargar la lista de documentos",
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
                if (!current?.identification) {
                    return data[0];
                }

                return (
                    data.find(
                        (item) => item.identification === current.identification,
                    ) || data[0]
                );
            });
        } catch (loadError) {
            setError(
                loadError?.message ||
                    "No se pudo cargar la bandeja de documentos",
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

    React.useEffect(() => {
        setDocumentStatus(selectedRow?.documentStatus || "");
        setDocumentComment(selectedRow?.documentComment || "");
        setDocumentFile(null);
    }, [selectedRow]);

    React.useEffect(() => {
        if (!successMessage) return undefined;

        const timerId = window.setTimeout(() => {
            setSuccessMessage("");
        }, 3000);

        return () => window.clearTimeout(timerId);
    }, [successMessage]);

    const isCompletedLocked = selectedRow?.documentStatus === "Completos";

    const handleSave = async () => {
        if (!selectedRow?.identification) {
            return;
        }

        if (!documentStatus) {
            setError("Selecciona si los documentos estan completos o incompletos.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccessMessage("");

        try {
            const formData = new FormData();
            formData.append("campaignId", CAMPAIGN_ID);
            formData.append("identification", selectedRow.identification);
            formData.append("documentStatus", documentStatus);
            formData.append("documentComment", documentComment);

            if (documentFile) {
                formData.append("document", documentFile);
            }

            const { ok, json } = await guardarOutMaquitaDocumentos(formData);

            if (!ok) {
                throw new Error(
                    json?.detail ||
                        json?.error ||
                        "No se pudieron guardar los documentos",
                );
            }

            setSuccessMessage("Documentos guardados correctamente.");
            await loadRows();
            setIsModalOpen(false);
        } catch (saveError) {
            setError(
                saveError?.message ||
                    "No se pudieron guardar los documentos",
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="outmaquita-docs__status">
                Cargando bandeja de documentos...
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
                        <h1 className="outmaquita-docs__title">
                            Cargar documentos
                        </h1>
                        <span className="outmaquita-docs__count">
                            {rows.length} registros con entrega digital
                        </span>
                    </div>
                </div>

                {successMessage ? (
                    <div className="outmaquita-docs__success">
                        {successMessage}
                    </div>
                ) : null}

                {error ? (
                    <div className="outmaquita-docs__error">{error}</div>
                ) : null}

                {!rows.length ? (
                    <div className="outmaquita-docs__empty">
                        No hay registros con entrega digital pendientes de
                        documentos.
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
                                            <th>Agencia asistir</th>
                                            <th>Estado documentos</th>
                                            <th>PDF</th>
                                            <th>Accion</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            return (
                                                <tr
                                                    key={row.identification}
                                                >
                                                    <td>{row.identification}</td>
                                                    <td>{row.fullName || "-"}</td>
                                                    <td>{row.celular || "-"}</td>
                                                    <td>{row.agenciaAsistir || "-"}</td>
                                                    <td>
                                                        {row.documentStatus || "-"}
                                                    </td>
                                                    <td>
                                                        {row.pdfFileName
                                                            ? "Cargado"
                                                            : "Pendiente"}
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="outmaquita-docs__select-button"
                                                            onClick={() => {
                                                                setSelectedRow(
                                                                    row,
                                                                );
                                                                setDocumentStatus(
                                                                    row.documentStatus ||
                                                                        "",
                                                                );
                                                                setDocumentComment(
                                                                    row.documentComment ||
                                                                        "",
                                                                );
                                                                setDocumentFile(
                                                                    null,
                                                                );
                                                                setIsModalOpen(
                                                                    true,
                                                                );
                                                                setError("");
                                                                setSuccessMessage(
                                                                    "",
                                                                );
                                                            }}
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
                            <h2>Carga documental</h2>
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
                                Cedula:{" "}
                                <strong>{selectedRow.identification}</strong>
                            </span>
                            <span>
                                Estado:{" "}
                                <strong>
                                    {selectedRow.documentStatus || "Pendiente"}
                                </strong>
                            </span>
                            <span>
                                Fecha de carga:{" "}
                                <strong>
                                    {formatUploadDate(selectedRow.updatedAt)}
                                </strong>
                            </span>
                        </div>

                        <label className="outmaquita-docs__field">
                            <span>Estado de documentos</span>
                            <select
                                value={documentStatus}
                                onChange={(event) =>
                                    setDocumentStatus(event.target.value)
                                }
                            >
                                <option value="">Selecciona una opcion</option>
                                {DOCUMENT_STATUS_OPTIONS.map((option) => (
                                    <option
                                        key={option}
                                        value={option}
                                        disabled={
                                            isCompletedLocked &&
                                            option === "Incompletos"
                                        }
                                    >
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>PDF de documentos</span>
                            <input
                                type="file"
                                accept="application/pdf,.pdf"
                                onChange={(event) =>
                                    setDocumentFile(
                                        event.target.files?.[0] || null,
                                    )
                                }
                            />
                        </label>

                        <label className="outmaquita-docs__field">
                            <span>Documento faltante / comentario</span>
                            <textarea
                                rows="3"
                                value={documentComment}
                                onChange={(event) =>
                                    setDocumentComment(event.target.value)
                                }
                                placeholder="Ej. Falta rol de pagos, cedula legible o firma del formulario"
                            />
                        </label>

                        <button
                            type="button"
                            className="outmaquita-docs__save-button"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "Guardando..." : "Guardar"}
                        </button>

                    </div>
                </div>
            ) : null}
        </div>
    );
}
