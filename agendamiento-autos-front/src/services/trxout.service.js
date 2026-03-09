// Servicio para insertar o actualizar registros en campaniasoutbound.trxout
export async function insertarTrxOut(data) {
    const API_BASE = import.meta.env.VITE_API_BASE;
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(`${API_BASE}/agente/trxout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("No se pudo insertar el registro");
    return await res.json();
}

export async function actualizarTrxOut(data) {
    const API_BASE = import.meta.env.VITE_API_BASE;
    const token = localStorage.getItem("access_token") || "";
    const res = await fetch(`${API_BASE}/agente/trxout`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("No se pudo actualizar el registro");
    return await res.json();
}
