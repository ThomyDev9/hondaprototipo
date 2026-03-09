// Servicio para buscar registro en campaniasoutbound.trxout por identificación
export async function buscarTrxOutPorIdentificacion(identificacion) {
    const API_BASE = import.meta.env.VITE_API_BASE;
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(
        `${API_BASE}/agente/trxout?identificacion=${encodeURIComponent(identificacion)}`,
        {
            headers: {
                Authorization: token ? `Bearer ${token}` : "",
            },
        },
    );
    if (!res.ok) throw new Error("No se pudo buscar el registro");
    const json = await res.json();
    return json.data;
}
