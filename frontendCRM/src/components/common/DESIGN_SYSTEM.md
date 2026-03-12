# Design System - Honda Agendamiento

Definición centralizada de colores, tamaños de fuente, espacios y otros estilos globales para mantener consistencia en toda la aplicación.

## Paleta de Colores

### Colores Primarios

```
Azul Principal:    #2563eb (primarias, interacción)
Azul Oscuro:       #1e40af (hover)
Azul Claro:        #eff6ff (fondo)
```

### Colores Secundarios

```
Verde (Éxito):     #16a34a
Verde Oscuro:      #15803d
Verde Claro:       #ecfdf3

Rojo (Peligro):    #dc2626
Rojo Oscuro:       #b91c1c
Rojo Claro:        #fee2e2

Amarillo (Aviso):  #f59e0b
Gris (Neutral):    #6b7280
```

### Escala de Grises

```
Negro:             #0f172a (texto principal)
Gris Oscuro:       #4b5563
Gris Medio:        #6b7280
Gris Claro:        #9ca3af
Gris muy Claro:    #d1d5db
Gris Casi Blanco:  #e5e7eb
Fondo:             #f9fafb
Blanco:            #ffffff
```

## Tipografía

### Tamaños de Fuente

```
H1:  2.25rem  (36px)  - font-weight: 700
H2:  1.875rem (30px)  - font-weight: 700
H3:  1.5rem   (24px)  - font-weight: 700
H4:  1.25rem  (20px)  - font-weight: 700
H5:  1.125rem (18px)  - font-weight: 700
H6:  1rem     (16px)  - font-weight: 700

Body:       0.9rem   (14px)  - font-weight: 400
Small:      0.85rem  (13px)  - font-weight: 400
Extra Small: 0.75rem (12px)  - font-weight: 600
```

### Pesos de Fuente

```
Regular:   400
Medium:    500
Semibold:  600
Bold:      700
```

## Espaciado

### Escala de Espacios (rem)

```
xs:  0.25rem (4px)
sm:  0.5rem  (8px)
md:  1rem    (16px)
lg:  1.5rem  (24px)
xl:  2rem    (32px)
2xl: 3rem    (48px)
```

### Ejemplos de Uso

```
Padding pequeño:  padding: 0.5rem        (8px)
Padding normal:   padding: 0.75rem       (12px)
Padding grande:   padding: 1rem          (16px)

Margin:           margin-bottom: 1.5rem  (24px)
Gap (flexbox):    gap: 1rem              (16px)
```

## Bordes y Radios

```
Border Radius Small:  0.25rem (4px)   - Botones pequeños
Border Radius Norm:   0.5rem  (8px)   - Inputs, cards pequeñas
Border Radius Med:    0.75rem (12px)  - Cards, modales
Border Radius Large:  1.25rem (20px)  - Containers grandes
Border Radius Round:  999px           - Botones redondeados

Border Width:  1px (normal)
               2px (outline)
```

## Sombras

```
Sombra Pequeña:   0 2px 5px rgba(0, 0, 0, 0.05)
Sombra Normal:    0 5px 15px rgba(37, 99, 235, 0.3)
Sombra Grande:    0 10px 20px rgba(15, 23, 42, 0.05)
```

## Transiciones

```
Rápida:   0.1s ease
Normal:   0.2s ease
Lenta:    0.3s ease

Por defecto: transition: all 0.2s ease
```

## Componentes - Tamaños

### Botones

```
Small:
  - padding: 0.5rem 1rem
  - font-size: 0.85rem
  - height: ~32px

Medium (default):
  - padding: 0.6rem 1.2rem
  - font-size: 0.9rem
  - height: ~36px

Large:
  - padding: 0.75rem 1.5rem
  - font-size: 1rem
  - height: ~40px
```

### Inputs

```
Altura:           2.75rem (44px)
Padding:          0.75rem 1rem
Font-size:        0.9rem
Border:           1px solid #e5e7eb
Border-radius:    0.75rem
Background:       #ffffff
```

### Tablas

```
Cell Padding:     0.75rem 1rem
Header Height:    44px
Row Height:       ~44px
Border:           1px solid #e5e7eb
```

## Breakpoints (Responsive)

```
Mobile:        < 640px
Tablet:        640px - 1024px
Desktop:       > 1024px
```

## Uso en CSS

```css
/* Ejemplo de componentización */
.btn {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
    font-weight: 600;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-primary {
    background-color: #2563eb;
    color: white;
    box-shadow: 0 5px 15px rgba(37, 99, 235, 0.3);
}

.btn-primary:hover:not(:disabled) {
    background-color: #1e40af;
}
```

## Checklist para Consistencia

- ✅ Usa colores de la paleta definida
- ✅ Mantén consistencia de tamaños de fuente
- ✅ Usa la escala de espaciado (no valores aleatorios)
- ✅ Aplica transiciones estándar (0.2s ease)
- ✅ Respeta los radios de borde por contexto
- ✅ Usa componentes comunes en lugar de estilos inline
- ✅ Documenta cambios al design system
