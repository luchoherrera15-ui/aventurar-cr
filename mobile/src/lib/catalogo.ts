import type { RanchoItem } from "@/lib/types";

/**
 * Lógica pura del catálogo reservable — espejo de src/lib/catalogo.ts
 * de /web. Si se cambia allá, cambiarlo acá (dos proyectos npm
 * independientes, en paridad a mano).
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
 * tiene precio publicado (el proveedor la cotiza aparte).
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

/**
 * Config de "incluido: elegí hasta N" por sección del catálogo. Vive
 * en ranchos.detalles.elecciones_incluidas ({"Postres": 1, ...}) — el
 * cliente marca hasta N ítems de esa sección sin costo (van en notas).
 */
export function leerEleccionesIncluidas(
  detalles: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const crudo = (detalles ?? {})["elecciones_incluidas"];
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};
  const limpio: Record<string, number> = {};
  for (const [grupo, n] of Object.entries(crudo as Record<string, unknown>)) {
    const tope = Number(n);
    if (grupo.trim() && Number.isFinite(tope) && tope >= 1) {
      limpio[grupo.trim()] = Math.floor(tope);
    }
  }
  return limpio;
}

/**
 * El primer paquete base elegido del carrito (es_paquete_base = true,
 * cantidad > 0), en el orden del catálogo. Su precio sustituye la
 * tarifa por evento/paquete del cotizador. El campo es opcional para
 * tolerar bases sin la migración 0067 corrida.
 */
export function paqueteBaseElegido(
  items: (RanchoItem & { es_paquete_base?: boolean | null })[],
  cantidades: Record<string, number>,
): (RanchoItem & { es_paquete_base?: boolean | null }) | null {
  return (
    items.find(
      (i) => i.es_paquete_base === true && (cantidades[i.id] ?? 0) > 0,
    ) ?? null
  );
}
