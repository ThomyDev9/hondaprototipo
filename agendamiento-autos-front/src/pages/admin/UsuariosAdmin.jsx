// src/pages/UsuariosAdmin.jsx
import { useEffect, useState } from "react";
import {
    Button,
    SearchInput,
    Title,
    Table,
    Badge,
    Tabs,
} from "../../components/common";
import UserFormModal from "../../components/UserFormModal";
import "./UsuariosAdmin.css";

const API_BASE = import.meta.env.VITE_API_BASE;

function UsuariosAdmin() {
    const [usuariosActivos, setUsuariosActivos] = useState([]);
    const [usuariosInactivos, setUsuariosInactivos] = useState([]);
    const [tab, setTab] = useState("ACTIVOS");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const token = localStorage.getItem("access_token") || "";

    // Función para filtrar usuarios
    const filtrarUsuarios = (usuariosList) => {
        if (!searchTerm.trim()) return usuariosList;

        const term = searchTerm.toLowerCase();
        return usuariosList.filter(
            (u) =>
                u.Usuario.toLowerCase().includes(term) ||
                u.Identificacion.toLowerCase().includes(term) ||
                u.Nombres.toLowerCase().includes(term) ||
                u.Celular.toLowerCase().includes(term),
        );
    };

    const parseJsonSafe = async (res) => {
        const text = await res.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Respuesta no válida del servidor");
        }
    };

    // =============================
    // LOAD USERS
    // =============================
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

            if (!res.ok)
                throw new Error(data.error || "Error cargando usuarios");

            setUsuariosActivos(data.activos || []);
            setUsuariosInactivos(data.inactivos || []);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsuarios();
        // eslint-disable-next-line
    }, []);

    // Limpiar checkboxes cuando cambia el tab
    useEffect(() => {
        setSelectedUsers([]);
    }, [tab]);

    const usuariosTab = tab === "ACTIVOS" ? usuariosActivos : usuariosInactivos;
    const usuarios = filtrarUsuarios(usuariosTab);

    // =============================
    // ACTIONS
    // =============================
    const handleCreate = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const handleEdit = (user) => {
        // Separar nombres y apellidos del string completo
        const namesArr = (user.Nombres || "").split(" ");
        const Name1 = namesArr[0] || "";
        const Name2 = namesArr.slice(1, -2).join(" ") || "";
        const Surname1 = namesArr.slice(-2, -1)[0] || "";
        const Surname2 = namesArr.slice(-1)[0] || "";

        const formForModal = {
            IdUser: user.IdUser || "",
            Identification: user.Identificacion || "",
            FullNames: [Name1, Name2].filter(Boolean).join(" "),
            FullSurnames: [Surname1, Surname2].filter(Boolean).join(" "),
            dateBirth: user.dateBirth || "",
            Address: user.Address || "",
            ContacAddress: user.Celular || "",
            Email: user.Email || "",
            UserGroup: user.UserGroup || user.Perfil || "",
            Username: user.Usuario || "",
            Password: "", // vacío, solo se envía si se cambia
        };

        setEditingUser(formForModal);
        setModalOpen(true);
    };

    const handleCheckboxChange = (userId) => {
        setSelectedUsers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    const handleSelectAll = () => {
        if (selectedUsers.length === usuarios.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(usuarios.map((u) => u.IdUser));
        }
    };

    const handleChangeStatus = async () => {
        if (selectedUsers.length === 0) {
            alert("Selecciona al menos un usuario");
            return;
        }

        const action = tab === "ACTIVOS" ? "desactivar" : "activar";
        if (
            !confirm(
                `¿Estás seguro de que deseas ${action} ${selectedUsers.length} usuario(s)?`,
            )
        ) {
            return;
        }

        try {
            setActionLoading(true);
            setError("");

            // Cambiar estado de cada usuario
            for (const userId of selectedUsers) {
                const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    throw new Error(
                        `Error cambiando estado del usuario ${userId}`,
                    );
                }
            }

            setSelectedUsers([]);
            await loadUsuarios();
            alert(
                `${selectedUsers.length} usuario(s) ${action === "desactivar" ? "desactivado(s)" : "activado(s)"} correctamente`,
            );
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setActionLoading(false);
        }
    };

    // =============================
    // CONTENT - Configuración de la tabla
    // =============================
    const columns = [
        { key: "Usuario", label: "Usuario" },
        { key: "Identificacion", label: "Identificación" },
        { key: "Nombres", label: "Nombres" },
        { key: "Celular", label: "Celular" },
        {
            key: "Perfil",
            label: "Perfil",
            render: (perfil) => <Badge variant="primary">{perfil}</Badge>,
        },
        {
            key: "Estado",
            label: "Estado",
            render: (estado) => (
                <Badge variant={estado === "ACTIVO" ? "success" : "danger"}>
                    {estado}
                </Badge>
            ),
        },
    ];

    const actions = [
        {
            label: "Editar",
            onClick: handleEdit,
            variant: "default",
        },
    ];

    // =============================
    // RENDER
    // =============================
    const actBadge = usuariosActivos.length;
    const inactBadge = usuariosInactivos.length;

    // Contenido de la pestaña activos
    const tabActivosContent = (
        <>
            {selectedUsers.length > 0 && (
                <div className="action-bar-inline">
                    <span>
                        {selectedUsers.length} usuario(s) seleccionado(s)
                    </span>
                    <Button
                        onClick={handleChangeStatus}
                        disabled={actionLoading}
                        variant="danger"
                        size="sm"
                    >
                        {actionLoading ? "Procesando..." : "🚫 Desactivar"}
                    </Button>
                </div>
            )}
            <Table
                columns={columns}
                data={usuarios}
                keyField="IdUser"
                showCheckbox={true}
                selectedRows={selectedUsers}
                onSelectRow={handleCheckboxChange}
                onSelectAll={handleSelectAll}
                actions={actions}
                loading={loading}
                noDataMessage="No hay usuarios activos."
            />
        </>
    );

    // Contenido de la pestaña inactivos
    const tabInactivosContent = (
        <>
            {selectedUsers.length > 0 && (
                <div className="action-bar-inline">
                    <span>
                        {selectedUsers.length} usuario(s) seleccionado(s)
                    </span>
                    <Button
                        onClick={handleChangeStatus}
                        disabled={actionLoading}
                        variant="success"
                        size="sm"
                    >
                        {actionLoading ? "Procesando..." : "✅ Activar"}
                    </Button>
                </div>
            )}
            <Table
                columns={columns}
                data={usuarios}
                keyField="IdUser"
                showCheckbox={true}
                selectedRows={selectedUsers}
                onSelectRow={handleCheckboxChange}
                onSelectAll={handleSelectAll}
                actions={actions}
                loading={loading}
                noDataMessage="No hay usuarios inactivos."
            />
        </>
    );

    const tabsList = [
        {
            id: "ACTIVOS",
            label: "Activos",
            badge: actBadge,
            content: tabActivosContent,
        },
        {
            id: "INACTIVOS",
            label: "Inactivos",
            badge: inactBadge,
            content: tabInactivosContent,
        },
    ];

    return (
        <div className="usuarios-container">
            {/* HEADER */}
            <div className="header">
                <Title level="h4">Usuarios del Sistema</Title>
                <div className="header__search-action">
                    <SearchInput
                        placeholder="🔍 Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClear={() => setSearchTerm("")}
                    />
                    <Button variant="create" onClick={handleCreate}>
                        + Crear usuario
                    </Button>
                </div>
            </div>

            {/* ERROR */}
            {error && <div className="error-msg">{error}</div>}

            {/* TABS */}
            <Tabs tabs={tabsList} activeTab={tab} onChange={setTab} />

            {/* MODAL */}
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

export default UsuariosAdmin;
