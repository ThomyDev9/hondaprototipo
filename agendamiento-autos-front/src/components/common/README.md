# Componentes Comunes / Reutilizables

Guía de componentes UI reutilizables para el proyecto Honda. Estos componentes promueven la consistencia visual y reducen código duplicado.

## Importación

```jsx
import { Button, SearchInput, Title, Table, Badge } from "@/components/common";
```

---

## Button

Componente de botón reutilizable con múltiples variantes.

### Props

- `variant`: "primary" | "secondary" | "danger" | "success" | "edit" | "create" | "outline" (default: "primary")
- `size`: "sm" | "md" | "lg" (default: "md")
- `disabled`: boolean
- `onClick`: function
- `type`: "button" | "submit" | "reset" (default: "button")
- `children`: ReactNode - Contenido del botón
- `className`: string - Clases CSS adicionales

### Ejemplos

```jsx
// Botón primario
<Button variant="primary">Crear usuario</Button>

// Botón de peligro pequeño
<Button variant="danger" size="sm">Desactivar</Button>

// Botón de éxito deshabilitado
<Button variant="success" disabled>Procesando...</Button>

// Botón tipo submit
<Button type="submit" variant="primary">Guardar</Button>
```

---

## SearchInput

Componente de búsqueda reutilizable con botón de limpiar.

### Props

- `placeholder`: string (default: "🔍 Buscar...")
- `value`: string
- `onChange`: function(event)
- `onClear`: function
- `className`: string - Clases CSS adicionales

### Ejemplos

```jsx
const [search, setSearch] = useState("");

<SearchInput
    placeholder="🔍 Buscar usuarios..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    onClear={() => setSearch("")}
/>;
```

---

## Title

Componente de títulos/headings con estilos predefinidos.

### Props

- `level`: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" (default: "h2")
- `variant`: "default" | "primary" | "section" (default: "default")
- `children`: ReactNode - Contenido del título
- `className`: string

### Ejemplos

```jsx
<Title level="h1">Mi Aplicación</Title>

<Title level="h2" variant="primary">Usuarios</Title>

<Title level="h3" variant="section">Datos Personales</Title>
```

---

## Table

Componente tabla reutilizable con soporte para checkboxes, acciones y datos dinámicos.

### Props

- `columns`: Array de objetos `{ key, label, render?, width?, sortable? }`
- `data`: Array de objetos (filas)
- `keyField`: string - Campo único (default: "id")
- `showCheckbox`: boolean - Mostrar columna de selección
- `selectedRows`: Array - IDs de filas seleccionadas
- `onSelectRow`: function(rowId)
- `onSelectAll`: function()
- `actions`: Array de objetos `{ label, onClick, variant }`
- `loading`: boolean
- `noDataMessage`: string

### Ejemplos

```jsx
const [selectedRows, setSelectedRows] = useState([]);

const columns = [
    { key: "nombre", label: "Nombre" },
    {
        key: "estado",
        label: "Estado",
        render: (estado) => <Badge variant={estado === "ACTIVO" ? "success" : "danger"}>{estado}</Badge>
    },
    { key: "email", label: "Email", width: "250px" }
];

const actions = [
    {
        label: "Editar",
        onClick: (row) => handleEdit(row),
        variant: "default"
    },
    {
        label: "Eliminar",
        onClick: (row) => handleDelete(row.id),
        variant: "danger"
    }
];

<Table
    columns={columns}
    data={usuarios}
    keyField="id"
    showCheckbox={true}
    selectedRows={selectedRows}
    onSelectRow={(id) => setSelectedRows(...)}
    onSelectAll={() => setSelectedRows(...)}
    actions={actions}
/>
```

---

## Badge

Componente para mostrar estados, etiquetas y tags.

### Props

- `variant`: "primary" | "success" | "danger" | "warning" | "info" | "secondary"
- `children`: ReactNode
- `className`: string

### Ejemplos

```jsx
<Badge variant="success">Activo</Badge>
<Badge variant="danger">Inactivo</Badge>
<Badge variant="warning">Pendiente</Badge>
<Badge variant="primary">Admin</Badge>
<Badge variant="info">Nuevo</Badge>
```

---

## Estructura de Carpetas

```
components/
├── common/
│   ├── Button.jsx
│   ├── Button.css
│   ├── SearchInput.jsx
│   ├── SearchInput.css
│   ├── Title.jsx
│   ├── Title.css
│   ├── Table.jsx
│   ├── Table.css
│   ├── Badge.jsx
│   ├── Badge.css
│   └── index.js
├── (componentes específicos del proyecto)
```

---

## Notas Importantes

1. **Importar desde común**: Siempre importa desde `@/components/common`
2. **Personalización**: Los componentes aceptan `className` para estilos personalizados
3. **Escalabilidad**: Nuevos componentes pueden agregarse siguiendo el mismo patrón
4. **Consistencia**: Todos los componentes respetan el sistema de diseño global (colores, tamaños, tipografía)
