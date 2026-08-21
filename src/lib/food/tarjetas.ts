import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyISOCR } from "@/lib/fechas";
import {
  fechaCorta,
  horaCorta,
  type FoodBusiness,
  type FoodFranja,
  type FoodLocation,
  type FoodMenuItem,
} from "@/lib/food/tipos";

/**
 * La tarjeta de un restaurante en el directorio (real o demo). Es la
 * ÚNICA fuente de verdad de "qué mostrar" para /food y /food/demo — los
 * dos usan `cargarTarjetasFood()` de acá abajo, así que no hay dos
 * cálculos de precio/descuento que puedan desalinearse.
 *
 * Todo lo que carga acá es un dato REAL de la base (food_businesses,
 * food_locations, food_menu_items, food_franjas — ver
 * src/lib/food/tipos.ts). Nada de rating, tipo de cocina ni distancia:
 * esas columnas no existen hoy en FOOD.BOOKEA, y el resto del sitio ya
 * tiene la regla de no inventar ese dato (ver el comentario grande
 * sobre COLLAGE en src/app/page.tsx).
 */
export type TarjetaFood = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  fotoUrl: string | null;
  /** food_locations.direccion de la primera sede — texto libre, real. */
  ubicacion: string | null;
  /** Hasta 2 nombres de platillos activos (los de menor `orden`). Reemplaza
   *  a un "tipo de cocina" que no existe en la base: en vez de inventar
   *  una categoría, se muestran platos reales del menú. */
  platos: string[];
  /** El precio de referencia: el MÍNIMO entre los food_menu_items activos
   *  del negocio. Es la base sobre la que se calcula el precio con
   *  descuento — ver `precioConDescuento`. */
  precioDesde: number | null;
  /** `precioDesde` con el % de la MEJOR franja activa próxima aplicado.
   *  null si no hay precio de referencia o no hay franja con descuento. */
  precioConDescuento: number | null;
  /** El % de la mejor franja activa próxima (0 si no hay ninguna). */
  descuentoPorcentaje: number;
  /** "Hoy · 8:00 p.m." o "20 ago · 8:00 p.m." de la mejor franja — null
   *  si el negocio no tiene ninguna franja activa próxima. */
  ofertaEtiqueta: string | null;
  /** Fechas ISO (YYYY-MM-DD) con al menos una franja activa — lo que usa
   *  el filtro de fecha del buscador para saber a qué negocios mostrar. */
  fechasConOferta: string[];
  /** true si alguna franja activa próxima cae en el rango que este
   *  archivo considera "happy hour" (ver HAPPY_HOUR_DESDE/HASTA abajo). */
  tieneHappyHour: boolean;
  /** true si el negocio se publicó hace `DIAS_PARA_NUEVO` días o menos. */
  esNuevo: boolean;
  /** Las franjas de la FECHA más próxima con oferta (máx 3, orden de
   *  hora): hora ya formateada, hora cruda ("HH:MM:SS", para ordenar
   *  cronológicamente) y % real. Es lo que la card pinta como
   *  "Hoy · 5:30 p.m. −20% …" — datos reales de food_franjas, nunca
   *  horarios inventados. */
  franjasProximas: { hora: string; horaOrden: string; descuento: number }[];
  /** "Hoy" o "21 ago" — la fecha a la que pertenecen `franjasProximas`.
   *  null si el negocio no tiene ninguna franja activa próxima. */
  franjasProximasEtiqueta: string | null;
};

/** Un negocio publicado hace 21 días o menos se marca "Nuevo" — es un
 *  criterio propio (no lo pidió el dueño un número exacto), elegido
 *  porque FOOD recién arranca: tres semanas alcanza para que un
 *  restaurante recién sumado se destaque sin que la etiqueta se quede
 *  pegada para siempre. */
const DIAS_PARA_NUEVO = 21;

/** Rango que este archivo considera "happy hour": 4pm–7pm. No hay una
 *  columna que lo diga, así que es un criterio editorial (el tramo más
 *  común de happy hour en restaurantes de Costa Rica), documentado acá
 *  para poder ajustarlo en un solo lugar. */
const HAPPY_HOUR_DESDE = "16:00:00";
const HAPPY_HOUR_HASTA = "19:00:00";

type FilaNegocio = Pick<
  FoodBusiness,
  "id" | "nombre" | "slug" | "descripcion" | "foto_portada_url"
> & { created_at: string };
type FilaLocation = Pick<FoodLocation, "business_id" | "direccion">;
type FilaItem = Pick<FoodMenuItem, "business_id" | "nombre" | "precio" | "orden">;
type FilaFranja = Pick<FoodFranja, "business_id" | "fecha" | "hora" | "descuento_porcentaje">;

/**
 * Carga y arma las tarjetas de un directorio de FOOD (real o demo).
 *
 * Cuatro consultas: negocios, sedes, ítems de menú y franjas — las tres
 * últimas en paralelo y acotadas a los IDs de negocios ya filtrados
 * (mismo criterio que food/demo/page.tsx antes de este rediseño). La
 * RLS de cada tabla ya exige que el negocio esté `activo` (0190/0194),
 * así que no hace falta repetir ese filtro acá.
 */
export async function cargarTarjetasFood(
  supabase: SupabaseClient,
  opts: { esDemo: boolean },
): Promise<TarjetaFood[]> {
  const hoy = hoyISOCR();

  const { data: negociosData, error: errNegocios } = await supabase
    .from("food_businesses")
    .select("id, nombre, slug, descripcion, foto_portada_url, created_at")
    .eq("activo", true)
    .eq("es_demo", opts.esDemo)
    .order("nombre");

  if (errNegocios) {
    console.error("[food/tarjetas] no se pudo cargar los negocios:", errNegocios.message);
    return [];
  }

  const negocios = (negociosData ?? []) as FilaNegocio[];
  if (negocios.length === 0) return [];

  const ids = negocios.map((n) => n.id);

  const [{ data: locationsData }, { data: itemsData }, { data: franjasData }] = await Promise.all([
    supabase.from("food_locations").select("business_id, direccion").in("business_id", ids),
    supabase
      .from("food_menu_items")
      .select("business_id, nombre, precio, orden")
      .eq("activo", true)
      .in("business_id", ids),
    supabase
      .from("food_franjas")
      .select("business_id, fecha, hora, descuento_porcentaje")
      .eq("activa", true)
      .gte("fecha", hoy)
      .in("business_id", ids)
      .order("fecha")
      .order("hora"),
  ]);

  const ubicacionPorNegocio = new Map<string, string | null>();
  for (const l of (locationsData ?? []) as FilaLocation[]) {
    // La primera sede que llega gana — hoy casi todo negocio tiene una
    // sola, y mostrar la primera es más honesto que promediar o mezclar.
    if (!ubicacionPorNegocio.has(l.business_id)) {
      ubicacionPorNegocio.set(l.business_id, l.direccion ?? null);
    }
  }

  const itemsPorNegocio = new Map<string, FilaItem[]>();
  for (const it of (itemsData ?? []) as FilaItem[]) {
    const lista = itemsPorNegocio.get(it.business_id) ?? [];
    lista.push(it);
    itemsPorNegocio.set(it.business_id, lista);
  }

  const franjasPorNegocio = new Map<string, FilaFranja[]>();
  for (const f of (franjasData ?? []) as FilaFranja[]) {
    const lista = franjasPorNegocio.get(f.business_id) ?? [];
    lista.push(f);
    franjasPorNegocio.set(f.business_id, lista);
  }

  const ahoraMs = Date.now();

  return negocios.map((n) => {
    const items = (itemsPorNegocio.get(n.id) ?? []).slice().sort((a, b) => a.orden - b.orden);
    const precioDesde = items.length > 0 ? Math.min(...items.map((i) => i.precio)) : null;
    const platos = items.slice(0, 2).map((i) => i.nombre);

    // Ya vienen ordenadas fecha,hora asc desde la consulta — el Map
    // preserva ese orden de inserción.
    const franjas = franjasPorNegocio.get(n.id) ?? [];

    let mejor: FilaFranja | null = null;
    for (const f of franjas) {
      if (!mejor || f.descuento_porcentaje > mejor.descuento_porcentaje) mejor = f;
    }

    const fechasConOferta = Array.from(new Set(franjas.map((f) => f.fecha)));
    const tieneHappyHour = franjas.some(
      (f) => f.hora >= HAPPY_HOUR_DESDE && f.hora < HAPPY_HOUR_HASTA,
    );

    const descuentoPorcentaje = mejor?.descuento_porcentaje ?? 0;
    const precioConDescuento =
      precioDesde != null && descuentoPorcentaje > 0
        ? Math.round(precioDesde * (1 - descuentoPorcentaje / 100))
        : null;

    const ofertaEtiqueta = mejor
      ? `${mejor.fecha === hoy ? "Hoy" : fechaCorta(mejor.fecha)} · ${horaCorta(mejor.hora)}`
      : null;

    // La primera fecha con franjas (las franjas ya vienen fecha,hora asc).
    const primeraFecha = franjas.length > 0 ? franjas[0].fecha : null;
    const franjasProximas = primeraFecha
      ? franjas
          .filter((f) => f.fecha === primeraFecha)
          .slice(0, 3)
          .map((f) => ({
            hora: horaCorta(f.hora),
            horaOrden: f.hora,
            descuento: f.descuento_porcentaje,
          }))
      : [];
    const franjasProximasEtiqueta = primeraFecha
      ? primeraFecha === hoy
        ? "Hoy"
        : fechaCorta(primeraFecha)
      : null;

    const creadoMs = Date.parse(n.created_at);
    const esNuevo =
      Number.isFinite(creadoMs) && ahoraMs - creadoMs <= DIAS_PARA_NUEVO * 24 * 60 * 60 * 1000;

    return {
      id: n.id,
      nombre: n.nombre,
      slug: n.slug,
      descripcion: n.descripcion,
      fotoUrl: n.foto_portada_url,
      ubicacion: ubicacionPorNegocio.get(n.id) ?? null,
      platos,
      precioDesde,
      precioConDescuento,
      descuentoPorcentaje,
      ofertaEtiqueta,
      fechasConOferta,
      tieneHappyHour,
      esNuevo,
      franjasProximas,
      franjasProximasEtiqueta,
    };
  });
}

/** Para buscar sin pelear con tildes — mismo criterio que /restaurantes
 *  (src/app/restaurantes/page.tsx, `normalizarBusqueda`). */
export function normalizarBusquedaFood(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
