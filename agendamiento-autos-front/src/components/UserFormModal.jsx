// src/components/UserFormModal.jsx
import { useState, useEffect } from "react";
import { Modal, FormField, Alert, Button, Title } from "./common";
import "./UserFormModal.css";

function UserFormModal({ apiBase, token, onClose, onSaved, editingUser }) {
    const initialForm = {
        IdUser: "",
        Identification: "",
        FullNames: "",
        FullSurnames: "",
        dateBirth: "",
        Address: "",
        ContacAddress: "",
        Email: "",
        UserGroup: "",
        Usuario: "",
    };

    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [showCredentials, setShowCredentials] = useState(false);
    const [password, setPassword] = useState("");
    const [showMasterKeyInput, setShowMasterKeyInput] = useState(false);
    const [masterKeyInput, setMasterKeyInput] = useState("");

    // Cargar datos si es edición
    useEffect(() => {
        console.log("editingUser en useEffect:", editingUser);
        if (editingUser) {
            setForm({
                IdUser: editingUser.IdUser || "",
                Identification: editingUser.Identification || "",
                FullNames: editingUser.FullNames || "",
                FullSurnames: editingUser.FullSurnames || "",
                dateBirth: editingUser.dateBirth || "",
                Address: editingUser.Address || "",
                ContacAddress: editingUser.ContacAddress || "",
                Email: editingUser.Email || "",
                UserGroup: editingUser.UserGroup || "",
                Usuario: editingUser.Usuario || "",
            });
        } else {
            setForm(initialForm);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingUser]);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const parseJsonSafe = async (res) => {
        const text = await res.text();
        if (!text) return {};
        return JSON.parse(text);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccessMsg("");

        try {
            // Separar nombres y apellidos
            const [Name1 = "", Name2 = ""] = (form.FullNames || "").split(" ");
            const [Surname1 = "", Surname2 = ""] = (
                form.FullSurnames || ""
            ).split(" ");

            const payload = {
                ...form,
                Name1,
                Name2,
                Surname1,
                Surname2,
            };

            delete payload.FullNames;
            delete payload.FullSurnames;

            const method = form.IdUser ? "PUT" : "POST";
            const url = form.IdUser
                ? `${apiBase}/admin/users/${form.IdUser}`
                : `${apiBase}/admin/users`;

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await parseJsonSafe(res);

            if (!res.ok)
                throw new Error(data.error || "Error al guardar usuario");

            const isCreating = !editingUser;
            if (isCreating) {
                // Mensaje de éxito solo en creación
                setSuccessMsg(
                    ` Usuario creado: ${data.usuario} | Password: ${data.password}`,
                );
                setForm(initialForm);
                setPassword(data.password);
            } else {
                setSuccessMsg("✅ Usuario actualizado correctamente");
            }

            await onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleShowCredentials = async () => {
        console.log("editingUser:", editingUser);
        console.log("IdUser:", editingUser?.IdUser);
        try {
            if (!masterKeyInput) {
                alert("Ingrese clave maestra");
                return;
            }

            const res = await fetch(
                `${apiBase}/admin/users/${form.IdUser}/credentials`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ masterKey: masterKeyInput }),
                },
            );

            const data = await parseJsonSafe(res);

            if (!res.ok) {
                throw new Error(data.error || "Error obteniendo credenciales");
            }

            // ✅ cargar usuario y password reales
            setForm((prev) => ({
                ...prev,
                Usuario: data.username,
            }));

            setPassword(data.password);
            setShowCredentials(true);
            setShowMasterKeyInput(false);
            setMasterKeyInput("");
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={editingUser ? "Editar Usuario" : "Crear Usuario"}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="user-form">
                {/* Alertas */}
                {error && (
                    <Alert
                        type="error"
                        message={error}
                        onClose={() => setError("")}
                        closable={true}
                    />
                )}
                {successMsg && (
                    <Alert
                        type="success"
                        message={successMsg}
                        onClose={() => setSuccessMsg("")}
                        closable={true}
                    />
                )}

                {/* DATOS PERSONALES */}
                <Title level="h3" variant="section">
                    Datos Personales
                </Title>
                <div className="form-grid-4">
                    <FormField
                        label="Identificación"
                        name="Identification"
                        value={form.Identification}
                        onChange={handleChange}
                        required
                    />
                    <FormField
                        label="Nombres"
                        name="FullNames"
                        placeholder="Nombres completos"
                        value={form.FullNames}
                        onChange={handleChange}
                        required
                    />
                    <FormField
                        label="Apellidos"
                        name="FullSurnames"
                        placeholder="Apellidos completos"
                        value={form.FullSurnames}
                        onChange={handleChange}
                        required
                    />
                    <FormField
                        label="Fecha Nacimiento"
                        type="date"
                        name="dateBirth"
                        value={form.dateBirth}
                        onChange={handleChange}
                        required
                    />
                </div>

                {/* INFORMACIÓN DE CONTACTO */}
                <Title level="h4" variant="section">
                    Información de Contacto
                </Title>
                <div className="form-grid-4">
                    <FormField
                        label="Dirección"
                        name="Address"
                        placeholder="Dirección"
                        value={form.Address}
                        onChange={handleChange}
                    />
                    <FormField
                        label="Celular"
                        name="ContacAddress"
                        placeholder="Número celular"
                        value={form.ContacAddress}
                        onChange={handleChange}
                    />
                    <FormField
                        label="Email"
                        type="email"
                        name="Email"
                        placeholder="correo@ejemplo.com"
                        value={form.Email}
                        onChange={handleChange}
                        required
                    />
                    <FormField
                        label="Perfil"
                        type="select"
                        name="UserGroup"
                        value={form.UserGroup}
                        onChange={handleChange}
                        options={[
                            { value: "1", label: "ADMINISTRADOR" },
                            { value: "2", label: "SUPERVISOR" },
                            { value: "3", label: "ASESOR" },
                            { value: "4", label: "ESCUELA" },
                        ]}
                        required
                    />
                </div>

                {showCredentials && (
                    <Alert
                        type="info"
                        message={`Usuario: ${form.Usuario} | Password: ${password || "******"}`}
                        closable={false}
                    />
                )}

                {/* ACCIONES */}
                <div className="form-actions">
                    {/* CREDENCIALES EN EDICIÓN */}
                    {editingUser && !showCredentials && (
                        <div
                            style={{
                                display: "flex",
                                gap: "0.5rem",
                                alignItems: "center",
                                flex: 1,
                            }}
                        >
                            {showMasterKeyInput ? (
                                <>
                                    <input
                                        type="password"
                                        placeholder="Ingrese clave maestra"
                                        value={masterKeyInput}
                                        onChange={(e) =>
                                            setMasterKeyInput(e.target.value)
                                        }
                                        style={{
                                            padding: "0.5rem",
                                            borderRadius: "0.375rem",
                                            border: "1px solid #cbd5e1",
                                            fontSize: "0.875rem",
                                            flex: "0 0 200px",
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleShowCredentials();
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        type="button"
                                        onClick={handleShowCredentials}
                                    >
                                        Confirmar
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        type="button"
                                        onClick={() => {
                                            setShowMasterKeyInput(false);
                                            setMasterKeyInput("");
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    type="button"
                                    onClick={() => setShowMasterKeyInput(true)}
                                >
                                    Mostrar credenciales
                                </Button>
                            )}
                        </div>
                    )}
                    <Button variant="secondary" onClick={onClose} type="button">
                        Cancelar
                    </Button>
                    <Button variant="primary" type="submit" disabled={saving}>
                        {saving ? "Guardando..." : getButtonLabel()}
                    </Button>
                </div>
            </form>
        </Modal>
    );

    function getButtonLabel() {
        return editingUser ? "Actualizar" : "Crear Usuario";
    }
}

export default UserFormModal;
