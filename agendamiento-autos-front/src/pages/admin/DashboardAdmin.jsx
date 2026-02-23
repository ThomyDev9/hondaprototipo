// src/pages/DashboardAdmin.jsx
import { useEffect, useState } from "react";
import {
    Title,
    Button,
    Alert,
    Card,
    Progress,
    Badge,
    PageContainer,
} from "../../components/common";
import "./DashboardAdmin.css";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function DashboardAdmin() {
    const [loading, setLoading] = useState(false);
    const [resumen, setResumen] = useState(null);
    const [error, setError] = useState("");
    const [agentes, setAgentes] = useState([]);
    const [pausaMax, setPausaMax] = useState(30);
    const [savingPausa, setSavingPausa] = useState(false);
    const [reciclandoBaseId, setReciclandoBaseId] = useState(null);
    const [exportandoBaseId, setExportandoBaseId] = useState(null);
    const token = localStorage.getItem("access_token");

    const cargarResumen = async () => {
        if (!token) {
            setError("No hay token, inicia sesión de nuevo.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };

            const [basesResp, agentesResp, pausaResp] = await Promise.all([
                fetch(`${API_BASE}/admin/bases-resumen`, { headers }),
                fetch(`${API_BASE}/admin/dashboard/agentes`, { headers }),
                fetch(`${API_BASE}/admin/parametros/pausa-max`, { headers }),
            ]);

            const basesJson = await basesResp.json();
            const agentesJson = await agentesResp.json();
            const pausaJson = await pausaResp.json();

            if (!basesResp.ok) {
                console.error("Error /admin/bases-resumen:", basesJson);
                setError(
                    basesJson.error || "Error obteniendo resumen de bases",
                );
            } else {
                setResumen(basesJson);
            }

            if (!agentesResp.ok) {
                console.error("Error /admin/dashboard/agentes:", agentesJson);
                setError(
                    (prev) =>
                        prev ||
                        agentesJson.error ||
                        "Error obteniendo resumen de agentes",
                );
            } else {
                setAgentes(agentesJson.agentes || []);
            }

            if (pausaResp.ok) {
                setPausaMax(pausaJson.pausaMaxMinDia ?? 30);
            } else {
                console.error("Error /admin/parametros/pausa-max:", pausaJson);
            }
        } catch (err) {
            console.error(err);
            setError("Error de conexión con el servidor");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarResumen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tot = resumen?.totales;
    const agentesTotales = agentes.length;
    const agentesConExceso = agentes.filter((a) => a.exceso_pausa).length;
    const agentesBloqueados = agentes.filter((a) => a.bloqueado).length;

    // ===== Exportar reporte por base =====
    const handleExportReporteBase = async (base) => {
        if (!token) {
            alert("Sesión expirada, inicia sesión de nuevo.");
            return;
        }

        try {
            setExportandoBaseId(base.base_id);

            const params = new URLSearchParams({ base_id: base.base_id });
            const resp = await fetch(
                `${API_BASE}/admin/reportes/gestion/export?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (!resp.ok) {
                const json = await resp.json().catch(() => ({}));
                console.error("Error exportando reporte:", json);
                alert(
                    json.error || "No se pudo generar el reporte de gestión.",
                );
                return;
            }

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            // nombre bonito usando el nombre de la base
            const safeName = (base.base || "base")
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^\w-]+/g, "");
            a.download = `reporte_gestion_${safeName}.csv`;

            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error de conexión al exportar reporte:", err);
            alert("Error de conexión al exportar el reporte.");
        } finally {
            setExportandoBaseId(null);
        }
    };

    const handleGuardarPausa = async (e) => {
        e.preventDefault();

        const valor = Number(pausaMax);
        if (isNaN(valor) || valor <= 0) {
            alert("Ingresa un número de minutos válido");
            return;
        }

        try {
            setSavingPausa(true);
            const resp = await fetch(`${API_BASE}/admin/parametros/pausa-max`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify({ valor }),
            });
            const json = await resp.json();
            if (!resp.ok) {
                console.error(json);
                alert(json.error || "No se pudo actualizar el parámetro");
                return;
            }
            setPausaMax(json.pausaMaxMinDia ?? valor);
            alert("Parámetro actualizado correctamente");
        } catch (err) {
            console.error(err);
            alert("Error de conexión al guardar el parámetro");
        } finally {
            setSavingPausa(false);
        }
    };

    const handleReciclarBase = async (base) => {
        if (!token) {
            alert("Sesión expirada, inicia sesión de nuevo.");
            return;
        }

        const confirmar = window.confirm(
            `¿Reciclar registros de la base "${base.base}" con estados ` +
                "re-gestionable / re_llamada / sin_contacto y menos de 6 intentos?",
        );
        if (!confirmar) return;

        try {
            setReciclandoBaseId(base.base_id);

            const resp = await fetch(
                `${API_BASE}/admin/bases/${base.base_id}/reciclar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            const json = await resp.json();

            if (!resp.ok) {
                console.error("Error reciclando base:", json);
                alert(json.error || "No se pudo reciclar la base");
                return;
            }

            alert(
                `Reciclados ${json.registros_reciclados} registros de la base "${base.base}".`,
            );
            await cargarResumen();
        } catch (err) {
            console.error(err);
            alert("Error de conexión al reciclar la base");
        } finally {
            setReciclandoBaseId(null);
        }
    };

    return (
        <PageContainer title="Panel administrador">
            <div className="dashboard-admin">
                <div className="dashboard-admin__header">
                    <div>
                        <Title level="h1">Panel administrador</Title>
                        <p className="dashboard-admin__subtitle">
                            Aquí ves cómo van tus bases, cuánto falta por
                            gestionar y el comportamiento de los estados y
                            agentes.
                        </p>
                    </div>

                    <Button
                        variant="primary"
                        onClick={cargarResumen}
                        disabled={loading}
                    >
                        {loading ? "Actualizando..." : "Actualizar"}
                    </Button>
                </div>

                {error && (
                    <Alert type="error" message={error} closable={false} />
                )}

                {tot && (
                    <div className="dashboard-admin__cards-grid">
                        <Card
                            label="Bases cargadas"
                            value={tot.total_bases}
                            highlight
                        />
                        <Card
                            label="Registros totales"
                            value={tot.total_registros}
                        />
                        <Card
                            label="Sin gestionar"
                            value={tot.total_sin_gestionar}
                        />
                        <Card
                            label="Citas agendadas"
                            value={tot.total_con_cita}
                            color="#16A34A"
                        />
                        <Card label="No desea" value={tot.total_no_desea} />
                        <Card
                            label="Rellamadas"
                            value={tot.total_rel_llamada}
                        />
                        <Card
                            label="Re-gestionables"
                            value={tot.total_re_gestionable}
                        />
                        <Card
                            label="Inubicables"
                            value={tot.total_inubicable}
                        />
                    </div>
                )}

                <div className="dashboard-admin__cards-grid-agents">
                    <Card label="Agentes" value={agentesTotales} />
                    <Card
                        label="Agentes en exceso de pausa"
                        value={agentesConExceso}
                        color="#EA580C"
                    />
                    <Card
                        label="Agentes bloqueados"
                        value={agentesBloqueados}
                        color="#DC2626"
                    />

                    <div className="dashboard-admin__card-param">
                        <span className="dashboard-admin__card-label">
                            Minutos máximos de pausa diarios
                        </span>
                        <form
                            onSubmit={handleGuardarPausa}
                            className="dashboard-admin__param-form"
                        >
                            <input
                                type="number"
                                min={1}
                                value={pausaMax}
                                onChange={(e) => setPausaMax(e.target.value)}
                                className="dashboard-admin__param-input"
                            />
                            <Button
                                variant="primary"
                                size="sm"
                                type="submit"
                                disabled={savingPausa}
                            >
                                {savingPausa ? "Guardando..." : "Guardar"}
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Tabla de bases */}
                <div className="dashboard-admin__table-card">
                    <Title level="h2" variant="section">
                        Detalle por base
                    </Title>
                    <p className="dashboard-admin__table-subtitle">
                        Avance, registros pendientes y distribución por estados.
                    </p>
                    <div className="dashboard-admin__table-wrapper">
                        <table className="dashboard-admin__table">
                            <thead>
                                <tr>
                                    <th>Base</th>
                                    <th>Registros</th>
                                    <th>Sin gestionar</th>
                                    <th>Citas</th>
                                    <th>No desea</th>
                                    <th>Rellamadas</th>
                                    <th>Re-gestionables</th>
                                    <th>Inubicables</th>
                                    <th>Avance</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resumen?.bases?.map((b) => {
                                    const puedeReciclar =
                                        (b.re_gestionables || 0) > 0 ||
                                        (b.rellamadas || 0) > 0;

                                    return (
                                        <tr key={b.base_id}>
                                            <td className="dashboard-admin__td-base">
                                                <div className="dashboard-admin__base-name">
                                                    {b.base}
                                                </div>
                                                <div className="dashboard-admin__base-desc">
                                                    {b.description}
                                                </div>
                                            </td>
                                            <td>{b.registros}</td>
                                            <td>{b.sin_gestionar}</td>
                                            <td>{b.citas}</td>
                                            <td>{b.no_desea}</td>
                                            <td>{b.rellamadas}</td>
                                            <td>{b.re_gestionables}</td>
                                            <td>{b.inubicables}</td>
                                            <td className="dashboard-admin__td-progress">
                                                <Progress
                                                    value={Number.parseFloat(
                                                        b.avance,
                                                    )}
                                                />
                                            </td>
                                            <td className="dashboard-admin__td-actions">
                                                <div className="dashboard-admin__actions-row">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleExportReporteBase(
                                                                b,
                                                            )
                                                        }
                                                        disabled={
                                                            exportandoBaseId ===
                                                            b.base_id
                                                        }
                                                    >
                                                        {exportandoBaseId ===
                                                        b.base_id
                                                            ? "Exportando..."
                                                            : "Exportar"}
                                                    </Button>
                                                    <Button
                                                        variant={
                                                            puedeReciclar
                                                                ? "secondary"
                                                                : "secondary"
                                                        }
                                                        size="sm"
                                                        disabled={
                                                            !puedeReciclar ||
                                                            reciclandoBaseId ===
                                                                b.base_id
                                                        }
                                                        onClick={() =>
                                                            handleReciclarBase(
                                                                b,
                                                            )
                                                        }
                                                    >
                                                        {reciclandoBaseId ===
                                                        b.base_id
                                                            ? "Reciclando..."
                                                            : "Reciclar base"}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!resumen ||
                                    !resumen.bases ||
                                    resumen.bases.length === 0) && (
                                    <tr>
                                        <td
                                            className="dashboard-admin__td-empty"
                                            colSpan={10}
                                        >
                                            No hay bases cargadas todavía.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tabla de agentes */}
                <div className="dashboard-admin__table-card dashboard-admin__table-card--agents">
                    <Title level="h2" variant="section">
                        Monitoreo de agentes
                    </Title>
                    <p className="dashboard-admin__table-subtitle">
                        Estado actual, registros y citas del día, minutos de
                        pausa y alertas para recursos humanos.
                    </p>
                    <div className="dashboard-admin__table-wrapper">
                        <table className="dashboard-admin__table">
                            <thead>
                                <tr>
                                    <th>Agente</th>
                                    <th>Estado</th>
                                    <th>Registros hoy</th>
                                    <th>Citas hoy</th>
                                    <th>Pausa hoy (min)</th>
                                    <th>Alertas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agentes.map((a) => {
                                    const rowClass = a.exceso_pausa
                                        ? "dashboard-admin__row--excess"
                                        : "";
                                    return (
                                        <tr
                                            key={a.agente_id}
                                            className={rowClass}
                                        >
                                            <td className="dashboard-admin__td-base">
                                                <div className="dashboard-admin__base-name">
                                                    {a.full_name ||
                                                        "Sin nombre"}
                                                </div>
                                                {a.email && (
                                                    <div className="dashboard-admin__base-desc">
                                                        {a.email}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="dashboard-admin__td-status">
                                                <Badge
                                                    variant="primary"
                                                    text={a.estado_operativo}
                                                />
                                                {a.bloqueado && (
                                                    <Badge
                                                        variant="danger"
                                                        text="BLOQUEADO"
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {a.registros_gestionados_hoy}
                                            </td>
                                            <td>{a.citas_agendadas_hoy}</td>
                                            <td>{a.minutos_pausa_hoy}</td>
                                            <td>
                                                {a.exceso_pausa && (
                                                    <Badge
                                                        variant="warning"
                                                        text="Exceso pausa"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {agentes.length === 0 && (
                                    <tr>
                                        <td
                                            className="dashboard-admin__td-empty"
                                            colSpan={6}
                                        >
                                            No hay agentes registrados o no se
                                            pudo obtener la información.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
