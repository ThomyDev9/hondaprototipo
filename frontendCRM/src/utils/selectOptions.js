// Utilidad para opciones de selects
export function opciones(arr) {
    if (!arr.length) return [{ value: "", label: "Sin datos" }];
    const opts = [];
    for (const v of arr) {
        opts.push({ value: v, label: v });
    }
    return opts;
}
