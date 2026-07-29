import type { RanchoItem } from "@/app/mi-rancho/types";

/**
 * Lógica pura del catálogo reservable — sin React ni Supabase, para
 * poder usarla igual en el panel del proveedor, en la página pública
 * y (cuando toque) en la app móvil.
 */

/**
 * Agrupa el catálogo por sección respetando el orden de los ítems: la
 * sección aparece donde aparece su primer ítem. Los que no tienen
 * sección van juntos al final, sin título.
 */
export function agruparPorSeccion(items: RanchoItem[]) {
  const orden = [...items].sort((a, b) => a.orden - b.orden);
  const grupos: { grupo: string | null; items: RanchoItem[] }[] = [];
  const sinGrupo: RanchoItem[] = [];

  for (const item of orden) {
    const nombre = item.grupo?.trim() || null;
    if (nombre === null) {
      sinGrupo.push(item);
      continue;
    }
    const existente = grupos.find((g) => g.grupo === nombre);
    if (existente) existente.items.push(item);
    else grupos.push({ grupo: nombre, items: [item] });
  }

  if (sinGrupo.length > 0) grupos.push({ grupo: null, items: sinGrupo });
  return grupos;
}

/**
 * Cuántas unidades de este ítem quedan para una fecha, dado cuántas ya
 * están reservadas ese día. null = sin límite configurado.
 */
export function cupoRestante(item: RanchoItem, reservadas: number): number | null {
  if (item.capacidad_dia === null) return null;
  return Math.max(0, item.capacidad_dia - reservadas);
}

/**
 * Total del carrito. `hayACotizar` avisa que alguna línea elegida no
 * tiene precio publicado (el proveedor la cotiza aparte), para que la
 * UI no venda un total como si fuera completo.
 */
export function totalPedido(
  items: RanchoItem[],
  cantidades: Record<string, number>,
): { total: number; unidades: number; hayACotizar: boolean } {
  let total = 0;
  let unidades = 0;
  let hayACotizar = false;

  for (const item of items) {
    const cantidad = cantidades[item.id] ?? 0;
    if (cantidad <= 0) continue;
    unidades += cantidad;
    if (item.precio === null) hayACotizar = true;
    else total += item.precio * cantidad;
  }

  return { total, unidades, hayACotizar };
}

/** "5 horas", "1 hora", "2.5 horas" — o null si el ítem no dura horas. */
export function etiquetaDuracion(horas: number | null): string | null {
  if (horas === null || horas <= 0) return null;
  return `${horas} hora${horas === 1 ? "" : "s"}`;
}
