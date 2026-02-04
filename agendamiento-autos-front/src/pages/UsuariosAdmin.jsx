// src/pages/UsuariosAdmin.jsx
import { useEffect, useState } from "react";
import UserFormModal from "../components/UserFormModal";

const API_BASE = import.meta.env.VITE_API_BASE;

function UsuariosAdmin() {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const token = localStorage.getItem("access_token") || "";

    const parseJsonSafe = async (res) => {
        const text = await res.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            // Cuando viene HTML u otra cosa
            throw new Error("Respuesta no válida del servidor");
        }
    };

    const loadUsuarios = async () => {
        try {
            setLoading(true);
            setError("");

            const res = await fetch(`${API_BASE}/admin/users`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await parseJsonSafe(res);

            if (!res.ok) {
                throw new Error(data.error || "Error cargando usuarios");
            }

            setUsuarios(data.users || []);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setUsuarios([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsuarios();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreate = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setModalOpen(true);
    };

    const handleDelete = async (user) => {
        const ok = window.confirm(`¿Desactivar al usuario ${user.full_name}?`);
        if (!ok) return;

        try {
            const res = await fetch(`${API_BASE}/admin/users/${user.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await parseJsonSafe(res);
            if (!res.ok) {
                throw new Error(data.error || "Error desactivando usuario");
            }

            await loadUsuarios();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div
            style={{
                padding: "2rem 2.5rem",
                maxWidth: "1100px",
                margin: "0 auto",
            }}
        >
            {/* HEADER */}
            <div
                style={{
                    marginBottom: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: "1.8rem",
                            fontWeight: "700",
                            margin: 0,
                            color: "#0f172a",
                        }}
                    >
                        Usuarios del sistema
                    </h1>
                    <p
                        style={{
                            margin: "0.4rem 0 0",
                            fontSize: "0.9rem",
                            color: "#6b7280",
                        }}
                    >
                        Administra agentes, administradores y supervisores.
                    </p>
                </div>

                <button
                    onClick={handleCreate}
                    style={{
                        padding: "0.6rem 1.2rem",
                        borderRadius: "999px",
                        border: "none",
                        backgroundColor: "#2563eb",
                        color: "white",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 10px 25px rgba(37, 99, 235, 0.35)",
                    }}
                >
                    + Crear usuario
                </button>
            </div>

            {/* MENSAJE ERROR */}
            {error && (
                <div
                    style={{
                        marginBottom: "1rem",
                        padding: "0.75rem 1rem",
                        backgroundColor: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "0.75rem",
                        color: "#b91c1c",
                        fontSize: "0.85rem",
                    }}
                >
                    {error}
                </div>
            )}

            {/* CARD LISTA */}
            <div
                style={{
                    backgroundColor: "white",
                    borderRadius: "1.25rem",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        padding: "1rem 1.25rem",
                        borderBottom: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                    }}
                >
                    <span
                        style={{
                            fontSize: "0.95rem",
                            fontWeight: 600,
                            color: "#0f172a",
                        }}
                    >
                        Lista de usuarios
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                        {usuarios.length} usuario(s) registrados
                    </span>
                </div>

                {loading ? (
                    <div
                        style={{
                            padding: "1.5rem",
                            fontSize: "0.9rem",
                            color: "#6b7280",
                        }}
                    >
                        Cargando usuarios...
                    </div>
                ) : usuarios.length === 0 ? (
                    <div
                        style={{
                            padding: "1.5rem",
                            fontSize: "0.9rem",
                            color: "#6b7280",
                        }}
                    >
                        No hay usuarios registrados todavía.
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: "0.9rem",
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        backgroundColor: "#f9fafb",
                                        color: "#6b7280",
                                    }}
                                >
                                    <th style={thStyle}>Nombre</th>
                                    <th style={thStyle}>Email</th>
                                    <th style={thStyle}>Rol</th>
                                    <th style={thStyle}>Estado</th>
                                    <th
                                        style={{
                                            ...thStyle,
                                            textAlign: "right",
                                        }}
                                    >
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u) => {
                                    const rol =
                                        u.user_roles && u.user_roles.length > 0
                                            ? u.user_roles[0].code
                                            : "SIN_ROL";

                                    return (
                                        <tr
                                            key={u.id}
                                            style={{
                                                borderTop: "1px solid #e5e7eb",
                                            }}
                                        >
                                            <td style={tdStyle}>
                                                {u.full_name}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {u.email}
                                            </td>
                                            <td style={tdStyle}>
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        padding:
                                                            "0.15rem 0.6rem",
                                                        borderRadius: "999px",
                                                        fontSize: "0.7rem",
                                                        backgroundColor:
                                                            "#eff6ff",
                                                        color: "#1d4ed8",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {rol}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                {u.is_active ? (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            padding:
                                                                "0.15rem 0.6rem",
                                                            borderRadius:
                                                                "999px",
                                                            fontSize: "0.7rem",
                                                            backgroundColor:
                                                                "#ecfdf3",
                                                            color: "#15803d",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-flex",
                                                            padding:
                                                                "0.15rem 0.6rem",
                                                            borderRadius:
                                                                "999px",
                                                            fontSize: "0.7rem",
                                                            backgroundColor:
                                                                "#f3f4f6",
                                                            color: "#4b5563",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Inactivo
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    textAlign: "right",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <button
                                                    onClick={() =>
                                                        handleEdit(u)
                                                    }
                                                    style={{
                                                        border: "none",
                                                        background: "none",
                                                        color: "#2563eb",
                                                        fontSize: "0.8rem",
                                                        marginRight: "0.5rem",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDelete(u)
                                                    }
                                                    style={{
                                                        border: "none",
                                                        background: "none",
                                                        color: "#dc2626",
                                                        fontSize: "0.8rem",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Desactivar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modalOpen && (
                <UserFormModal
                    apiBase={API_BASE}
                    token={token}
                    editingUser={editingUser}
                    onClose={() => {
                        setModalOpen(false);
                        setEditingUser(null);
                    }}
                    onSaved={loadUsuarios}
                />
            )}
        </div>
    );
}

const thStyle = {
    textAlign: "left",
    padding: "0.75rem 1rem",
    fontWeight: 600,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

const tdStyle = {
    padding: "0.75rem 1rem",
    color: "#111827",
};

export default UsuariosAdmin;
