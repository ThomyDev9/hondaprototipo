import React, { useEffect, useState } from "react";
import "./GrabacionesOutboundPage.css";
// ...existing code...
import { PageContainer } from "../../components/common";
const token = localStorage.getItem("access_token");

export default function GrabacionesOutboundPage() {
    const [grabaciones, setGrabaciones] = useState([]);
    const [loadingGrabaciones, setLoadingGrabaciones] = useState(false);
    const [audioUrls, setAudioUrls] = useState({});
    const [error, setError] = useState(null);
    // Filtros
    const [filtroCampania, setFiltroCampania] = useState("");
    const [filtroBase, setFiltroBase] = useState("");
    const [filtroResultado, setFiltroResultado] = useState("");
    const [filtroAgente, setFiltroAgente] = useState("");
    const [filtroTelefono, setFiltroTelefono] = useState("");
    const [filtroFecha, setFiltroFecha] = useState("");

    useEffect(() => {
        const API_BASE = import.meta.env.VITE_API_BASE;
        setLoadingGrabaciones(true);
        fetch(`${API_BASE}/supervisor/grabaciones`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("No autorizado");
                return res.json();
            })
            .then((data) => setGrabaciones(Array.isArray(data) ? data : []))
            .catch((err) => {
                setError("No se pudo cargar las grabaciones");
                setGrabaciones([]);
            })
            .finally(() => setLoadingGrabaciones(false));
    }, []);

    // Limpia los object URLs al desmontar
    useEffect(() => {
        return () => {
            Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
        };
    }, [audioUrls]);

    const fetchAudioUrl = async (recordingfile) => {
        if (audioUrls[recordingfile]) return audioUrls[recordingfile];
        const API_BASE = import.meta.env.VITE_API_BASE;
        try {
            const res = await fetch(
                `${API_BASE}/supervisor/grabacion-sftp/${recordingfile}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
            );
            if (!res.ok) throw new Error("No autorizado o error de descarga");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrls((prev) => ({ ...prev, [recordingfile]: url }));
            return url;
        } catch (err) {
            alert("No se pudo obtener la grabación: " + err.message);
            return null;
        }
    };

    const styles = {
        table: {
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "24px",
        },
        thtd: {
            border: "1px solid #ddd",
            padding: "8px",
            textAlign: "center",
        },
    };

    // Opciones únicas para selects
    const campanias = Array.from(
        new Set(grabaciones.map((g) => g.CampaignId).filter(Boolean)),
    );
    const bases = Array.from(
        new Set(
            grabaciones
                .map((g) => g.ImportId || g.Importid || g.ImportID)
                .filter(Boolean),
        ),
    );
    const resultados = Array.from(
        new Set(grabaciones.map((g) => g.ResultLevel1).filter(Boolean)),
    );
    const agentes = Array.from(
        new Set(grabaciones.map((g) => g.Agent).filter(Boolean)),
    );

    // Filtro aplicado
    const grabacionesFiltradas = grabaciones.filter((g) => {
        const fechaOk =
            !filtroFecha ||
            (g.calldate &&
                new Date(g.calldate).toISOString().slice(0, 10) ===
                    filtroFecha);
        const campaniaOk = !filtroCampania || g.CampaignId === filtroCampania;
        const baseOk =
            !filtroBase ||
            (g.ImportId || g.Importid || g.ImportID) === filtroBase;
        const resultadoOk =
            !filtroResultado || g.ResultLevel1 === filtroResultado;
        const agenteOk = !filtroAgente || g.Agent === filtroAgente;
        const telefonoOk =
            !filtroTelefono || (g.dst && g.dst.includes(filtroTelefono));
        return (
            fechaOk &&
            campaniaOk &&
            baseOk &&
            resultadoOk &&
            agenteOk &&
            telefonoOk
        );
    });

    // Descarga en bloque
    const handleDescargarTodas = async () => {
        if (grabacionesFiltradas.length === 0) {
            alert("No hay grabaciones para descargar.");
            return;
        }
        let descargadas = 0;
        for (const g of grabacionesFiltradas) {
            if (!g.recordingfile) continue;
            try {
                const url = await fetchAudioUrl(g.recordingfile);
                if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = g.recordingfile;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    descargadas++;
                }
            } catch (e) {}
        }
        if (descargadas === 0) {
            alert("No se pudo descargar ninguna grabación.");
        }
    };

    return (
        <PageContainer title="Grabaciones Outbound">
            <h2>Grabaciones recientes</h2>
            <div style={{ marginBottom: 12 }}>
                <button
                    className="grabaciones-icon-btn"
                    onClick={handleDescargarTodas}
                    title="Descargar todas las grabaciones filtradas"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 22 22"
                        fill="none"
                        className="grabaciones-icon"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle cx="11" cy="11" r="11" fill="#2563EB" />
                        <path
                            d="M11 6v7m0 0l-3-3m3 3l3-3"
                            stroke="#100e0e"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <rect
                            x="7"
                            y="16"
                            width="8"
                            height="2"
                            rx="1"
                            fill="#282525"
                        />
                    </svg>
                    Descargar todas
                </button>
            </div>
            {/* Filtros */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                <select
                    value={filtroCampania}
                    onChange={(e) => setFiltroCampania(e.target.value)}
                >
                    <option value="">Todas las campañas</option>
                    {campanias.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <select
                    value={filtroBase}
                    onChange={(e) => setFiltroBase(e.target.value)}
                >
                    <option value="">Todas las bases</option>
                    {bases.map((b) => (
                        <option key={b} value={b}>
                            {b}
                        </option>
                    ))}
                </select>
                <select
                    value={filtroResultado}
                    onChange={(e) => setFiltroResultado(e.target.value)}
                >
                    <option value="">Todos los resultados</option>
                    {resultados.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </select>
                <select
                    value={filtroAgente}
                    onChange={(e) => setFiltroAgente(e.target.value)}
                >
                    <option value="">Todos los agentes</option>
                    {agentes.map((a) => (
                        <option key={a} value={a}>
                            {a}
                        </option>
                    ))}
                </select>
                <input
                    type="date"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                />
                <input
                    type="text"
                    value={filtroTelefono}
                    onChange={(e) => setFiltroTelefono(e.target.value)}
                    placeholder="Teléfono"
                    style={{ minWidth: 120 }}
                />
            </div>
            {error && <p style={{ color: "red" }}>{error}</p>}
            {loadingGrabaciones ? (
                <p>Cargando grabaciones...</p>
            ) : grabacionesFiltradas.length === 0 ? (
                <p>No hay grabaciones disponibles.</p>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table className="grabaciones-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Teléfono</th>
                                <th>Agente</th>
                                <th>Cliente</th>
                                <th>Campaña</th>
                                <th>Base</th>
                                <th>Resultado</th>
                                <th>Grabación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grabacionesFiltradas.map((g, idx) => (
                                <tr key={idx}>
                                    <td>
                                        {g.calldate
                                            ? new Date(
                                                  g.calldate,
                                              ).toLocaleString()
                                            : ""}
                                    </td>
                                    <td>{g.dst}</td>
                                    <td>{g.Agent}</td>
                                    <td>{g.ContactName}</td>
                                    <td>{g.CampaignId}</td>
                                    <td>
                                        {g.ImportId ||
                                            g.Importid ||
                                            g.ImportID ||
                                            ""}
                                    </td>
                                    <td>{g.ResultLevel1}</td>
                                    <td>
                                        {g.recordingfile ? (
                                            <>
                                                <span
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    {/* Icono escuchar */}
                                                    <button
                                                        title="Escuchar"
                                                        className="grabaciones-icon-btn"
                                                        onClick={async () => {
                                                            const url =
                                                                await fetchAudioUrl(
                                                                    g.recordingfile,
                                                                );
                                                            if (url) {
                                                                const audio =
                                                                    document.getElementById(
                                                                        `audio-outbound-${idx}`,
                                                                    );
                                                                if (audio) {
                                                                    audio.src =
                                                                        url;
                                                                    audio.play();
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {/* SVG play icon */}
                                                        <svg
                                                            width="22"
                                                            height="22"
                                                            viewBox="0 0 22 22"
                                                            fill="none"
                                                            className="grabaciones-icon"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                        >
                                                            <circle
                                                                cx="11"
                                                                cy="11"
                                                                r="11"
                                                                fill="#2563EB"
                                                            />
                                                            <polygon
                                                                points="8,6 17,11 8,16"
                                                                fill="#fff"
                                                            />
                                                        </svg>
                                                    </button>
                                                    {/* Reproductor oculto */}
                                                    <audio
                                                        id={`audio-outbound-${idx}`}
                                                        style={{
                                                            display: "none",
                                                        }}
                                                        src={
                                                            audioUrls[
                                                                g.recordingfile
                                                            ] || ""
                                                        }
                                                    />
                                                    {/* Icono descargar */}
                                                    <button
                                                        title="Descargar"
                                                        className="grabaciones-icon-btn"
                                                        onClick={async () => {
                                                            const url =
                                                                await fetchAudioUrl(
                                                                    g.recordingfile,
                                                                );
                                                            if (url) {
                                                                const a =
                                                                    document.createElement(
                                                                        "a",
                                                                    );
                                                                a.href = url;
                                                                a.download =
                                                                    g.recordingfile;
                                                                document.body.appendChild(
                                                                    a,
                                                                );
                                                                a.click();
                                                                document.body.removeChild(
                                                                    a,
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        {/* SVG download icon */}
                                                        <svg
                                                            width="22"
                                                            height="22"
                                                            viewBox="0 0 22 22"
                                                            fill="none"
                                                            className="grabaciones-icon"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                        >
                                                            <circle
                                                                cx="11"
                                                                cy="11"
                                                                r="11"
                                                                fill="#2563EB"
                                                            />
                                                            <path
                                                                d="M11 6v7m0 0l-3-3m3 3l3-3"
                                                                stroke="#fff"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                            <rect
                                                                x="7"
                                                                y="16"
                                                                width="8"
                                                                height="2"
                                                                rx="1"
                                                                fill="#fff"
                                                            />
                                                        </svg>
                                                    </button>
                                                </span>
                                            </>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </PageContainer>
    );
}
