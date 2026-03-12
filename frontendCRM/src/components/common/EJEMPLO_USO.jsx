/**
 * GUÍA DE USO: Refactorizar UsuariosAdmin con componentes comunes
 *
 * Este es un ejemplo de cómo usar los nuevos componentes reutilizables
 * en lugar de tener código duplicado.
 */

// ANTES (código duplicado)
// ======================================
// En UsuariosAdmin.jsx había:
// - Botones con clases 'btn-save', 'btn-cancel', etc.
// - Input de búsqueda con HTML repetido
// - Tabla con HTML largo
// - Badges de estado con estilos inline

// DESPUÉS (usando componentes comunes)
// ======================================

import { useState } from "react";
import { Button, SearchInput, Title, Table, Badge } from "@/components/common";

function UsuariosAdminRefactorizado() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Configuración de columnas
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

    // Configuración de acciones
    const actions = [
        {
            label: "Editar",
            onClick: (row) => console.log("Editar:", row),
            variant: "default",
        },
    ];

    return (
        <div>
            {/* Título principal */}
            <Title level="h1">Usuarios del Sistema</Title>

            {/* Controles */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                {/* Otros controles */}
                <Button variant="create">+ Crear Usuario</Button>
            </div>

            {/* Filtros y búsqueda */}
            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "1rem",
                    alignItems: "center",
                }}
            >
                <SearchInput
                    placeholder="🔍 Buscar usuarios..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClear={() => setSearchTerm("")}
                />

                {selectedUsers.length > 0 && (
                    <Button variant="danger" size="sm">
                        🚫 Desactivar ({selectedUsers.length})
                    </Button>
                )}
            </div>

            {/* Tabla */}
            <Table
                columns={columns}
                data={usuarios}
                keyField="IdUser"
                showCheckbox={true}
                selectedRows={selectedUsers}
                onSelectRow={(id) => {
                    setSelectedUsers((prev) =>
                        prev.includes(id)
                            ? prev.filter((uid) => uid !== id)
                            : [...prev, id],
                    );
                }}
                onSelectAll={() => {
                    if (selectedUsers.length === usuarios.length) {
                        setSelectedUsers([]);
                    } else {
                        setSelectedUsers(usuarios.map((u) => u.IdUser));
                    }
                }}
                actions={actions}
            />
        </div>
    );
}

/**
 * BENEFICIOS DE ESTA REFACTORIZACIÓN:
 *
 * 1. ✅ Menos código duplicado
 * 2. ✅ Consistencia visual garantizada
 * 3. ✅ Más fácil de mantener y actualizar
 * 4. ✅ Reutilizable en otras páginas
 * 5. ✅ Props claros y documentados
 * 6. ✅ Sistema de variantes flexible
 * 7. ✅ Mejor performance (componentes optimizados)
 * 8. ✅ Fácil de temas/cambiar estilos globales
 */
