// src/components/UserFormModal.jsx
import { useEffect, useState } from "react";

function UserFormModal({ apiBase, token, editingUser, onClose, onSaved }) {
  const isEdit = Boolean(editingUser);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState("AGENTE");
  const [bloqueado, setBloqueado] = useState(false);
  const [estadoOperativo, setEstadoOperativo] = useState("disponible");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEdit) {
      setFullName(editingUser.full_name || "");
      setEmail(editingUser.email || "");
      setBloqueado(editingUser.bloqueado || false);
      setEstadoOperativo(editingUser.estado_operativo || "disponible");
      const rol =
        editingUser.user_roles && editingUser.user_roles.length > 0
          ? editingUser.user_roles[0].roles?.code
          : "AGENTE";
      setRoleCode(rol);
      setPassword("");
      setError("");
    } else {
      setFullName("");
      setEmail("");
      setPassword("");
      setRoleCode("AGENTE");
      setBloqueado(false);
      setEstadoOperativo("disponible");
      setError("");
    }
  }, [editingUser, isEdit]);

  const parseJsonSafe = async (res) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Respuesta no válida del servidor");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body = {
        full_name: fullName,
        email,
        role_code: roleCode,
        bloqueado,
        estado_operativo: estadoOperativo,
      };

      let url = `${apiBase}/admin/users`;
      let method = "POST";

      if (isEdit) {
        url = `${apiBase}/admin/users/${editingUser.id}`;
        method = "PUT";
      } else {
        if (!password) {
          setSaving(false);
          setError("La contraseña es obligatoria para nuevos usuarios.");
          return;
        }
        body.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(data.error || "Error guardando usuario");
      }

      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "1.25rem",
          padding: "1.75rem 1.75rem 1.5rem",
          width: "100%",
          maxWidth: "460px",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {isEdit ? "Editar usuario" : "Crear usuario"}
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "1.5rem",
              lineHeight: 1,
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "0.75rem",
              padding: "0.6rem 0.8rem",
              backgroundColor: "#fef2f2",
              borderRadius: "0.75rem",
              border: "1px solid #fecaca",
              fontSize: "0.8rem",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: "0.2rem",
              }}
            >
              Nombre completo
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: "0.2rem",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {!isEdit && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "#374151",
                  marginBottom: "0.2rem",
                }}
              >
                Contraseña inicial
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                }}
              >
                El usuario podrá cambiarla después desde su cuenta.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "#374151",
                  marginBottom: "0.2rem",
                }}
              >
                Rol
              </label>
              <select
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                style={inputStyle}
              >
                <option value="ADMIN">ADMIN</option>
                <option value="AGENTE">AGENTE</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "#374151",
                  marginBottom: "0.2rem",
                }}
              >
                Estado operativo
              </label>
              <select
                value={estadoOperativo}
                onChange={(e) => setEstadoOperativo(e.target.value)}
                style={inputStyle}
              >
                <option value="disponible">Disponible</option>
                <option value="pausa">Pausa</option>
                <option value="desconectado">Desconectado</option>
              </select>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.85rem",
              color: "#374151",
            }}
          >
            <input
              type="checkbox"
              checked={bloqueado}
              onChange={(e) => setBloqueado(e.target.checked)}
            />
            Usuario bloqueado
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.55rem 1.1rem",
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                backgroundColor: "white",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "#4b5563",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.55rem 1.3rem",
                borderRadius: "999px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? "Guardando..."
                : isEdit
                ? "Guardar cambios"
                : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "0.6rem",
  border: "1px solid #e5e7eb",
  fontSize: "0.85rem",
  outline: "none",
};

export default UserFormModal;
