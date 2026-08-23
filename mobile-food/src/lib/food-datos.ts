import { supabase } from "./supabase";
import {
  fechaCorta,
  horaCorta,
  hoyISOCR,
  type FoodBusiness,
  type FoodFranja,
  type FoodMenuCategory,
  type FoodMenuItem,
  type FoodReservationEstado,
  type Provincia,
  type TipoCocina,
} from "./food-tipos";

/**
 * La tarjeta de un restaurante del directorio — espejo de
 * src/lib/food/tarjetas.ts de /web (misma forma, mismos cálculos,
 * para que las dos apps cuenten la misma oferta). Nada de rating ni
 * distancia: esas columnas no existen en food_* hoy, y no se inventan
 * acá tampoco. El tipo de cocina SÍ es real desde la 0202 — ver
 * `tipoCocina` abajo, nunca inventado, siempre lo que el dueño eligió.
 */
export type TarjetaFood = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  fotoUrl: string | null;
  ubicacion: string | null;
  platos: string[];
  /** 0202. null = el dueño no eligió categoría. */
  tipoCocina: TipoCocina | null;
  /** 0203. null = el dueño no ubicó su negocio. */
  provincia: Provincia | null;
  /** 0204: cuenta real vía food_conteo_reservas() — nunca inventado,
   *  0 si no hay ninguna reserva (o falla la RPC, fail-safe a 0). */
  conteoReservas: number;
  precioDesde: number | null;
  precioConDescuento: number | null;
  descuentoPorcentaje: number;
  fechasConOferta: string[];
  esNuevo: boolean;
  franjasProximas: { hora: string; horaOrden: string; descuento: number }[];
  franjasProximasEtiqueta: string | null;
};

const DIAS_PARA_NUEVO = 21;

export async function cargarTarjetasFood(): Promise<TarjetaFood[]> {
  const hoy = hoyISOCR();

  const { data: negociosData, error: errNegocios } = await supabase
    .from("food_businesses")
    .select("id, nombre, slug, descripcion, foto_portada_url, created_at, tipo_cocina, provincia")
    .eq("activo", true)
    .eq("es_demo", false)
    .order("nombre");

  if (errNegocios || !negociosData || negociosData.length === 0) return [];

  const ids = negociosData.map((n) => n.id as string);

  const [{ data: locationsData }, { data: itemsData }, { data: franjasData }, conteos] = await Promise.all([
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
    // Cuenta real de reservas por negocio (0204) — la RLS de
    // food_reservations no deja `select count(*)` directo, así que se
    // pide por la RPC que solo devuelve el número. Fail-safe a 0 si
    // una llamada falla: un conteo que no carga es peor mostrado en 0
    // que rompiendo toda la pantalla.
    Promise.all(
      ids.map((id) =>
        supabase.rpc("food_conteo_reservas", { p_business_id: id }).then(
          ({ data }) => [id, typeof data === "number" ? data : 0] as const,
          () => [id, 0] as const,
        ),
      ),
    ),
  ]);
  const conteoReservasPorNegocio = new Map(conteos);

  const ubicacionPorNegocio = new Map<string, string | null>();
  for (const l of locationsData ?? []) {
    if (!ubicacionPorNegocio.has(l.business_id as string)) {
      ubicacionPorNegocio.set(l.business_id as string, (l.direccion as string | null) ?? null);
    }
  }

  const itemsPorNegocio = new Map<string, { nombre: string; precio: number; orden: number }[]>();
  for (const it of itemsData ?? []) {
    const lista = itemsPorNegocio.get(it.business_id as string) ?? [];
    lista.push({ nombre: it.nombre as string, precio: it.precio as number, orden: it.orden as number });
    itemsPorNegocio.set(it.business_id as string, lista);
  }

  const franjasPorNegocio = new Map<
    string,
    { fecha: string; hora: string; descuento_porcentaje: number }[]
  >();
  for (const f of franjasData ?? []) {
    const lista = franjasPorNegocio.get(f.business_id as string) ?? [];
    lista.push({
      fecha: f.fecha as string,
      hora: f.hora as string,
      descuento_porcentaje: f.descuento_porcentaje as number,
    });
    franjasPorNegocio.set(f.business_id as string, lista);
  }

  const ahoraMs = Date.now();

  return negociosData.map((n) => {
    const items = (itemsPorNegocio.get(n.id as string) ?? []).slice().sort((a, b) => a.orden - b.orden);
    const precioDesde = items.length > 0 ? Math.min(...items.map((i) => i.precio)) : null;
    const platos = items.slice(0, 2).map((i) => i.nombre);

    const franjas = franjasPorNegocio.get(n.id as string) ?? [];
    let mejor: (typeof franjas)[number] | null = null;
    for (const f of franjas) {
      if (!mejor || f.descuento_porcentaje > mejor.descuento_porcentaje) mejor = f;
    }

    const fechasConOferta = Array.from(new Set(franjas.map((f) => f.fecha)));
    const descuentoPorcentaje = mejor?.descuento_porcentaje ?? 0;
    const precioConDescuento =
      precioDesde != null && descuentoPorcentaje > 0
        ? Math.round(precioDesde * (1 - descuentoPorcentaje / 100))
        : null;

    const primeraFecha = franjas.length > 0 ? franjas[0].fecha : null;
    const franjasProximas = primeraFecha
      ? franjas
          .filter((f) => f.fecha === primeraFecha)
          .slice(0, 3)
          .map((f) => ({ hora: horaCorta(f.hora), horaOrden: f.hora, descuento: f.descuento_porcentaje }))
      : [];
    const franjasProximasEtiqueta = primeraFecha
      ? primeraFecha === hoy
        ? "Hoy"
        : fechaCorta(primeraFecha)
      : null;

    const creadoMs = Date.parse(n.created_at as string);
    const esNuevo =
      Number.isFinite(creadoMs) && ahoraMs - creadoMs <= DIAS_PARA_NUEVO * 24 * 60 * 60 * 1000;

    return {
      id: n.id as string,
      nombre: n.nombre as string,
      slug: n.slug as string,
      descripcion: n.descripcion as string | null,
      fotoUrl: n.foto_portada_url as string | null,
      ubicacion: ubicacionPorNegocio.get(n.id as string) ?? null,
      platos,
      tipoCocina: (n.tipo_cocina as TipoCocina | null) ?? null,
      provincia: (n.provincia as Provincia | null) ?? null,
      conteoReservas: conteoReservasPorNegocio.get(n.id as string) ?? 0,
      precioDesde,
      precioConDescuento,
      descuentoPorcentaje,
      fechasConOferta,
      esNuevo,
      franjasProximas,
      franjasProximasEtiqueta,
    };
  });
}

export type DetalleRestaurante = {
  negocio: FoodBusiness;
  direccion: string | null;
  categorias: FoodMenuCategory[];
  itemsPorCategoria: Map<string, FoodMenuItem[]>;
  franjas: FoodFranja[];
};

export async function cargarDetalleRestaurante(slug: string): Promise<DetalleRestaurante | null> {
  const { data: negocio } = await supabase
    .from("food_businesses")
    .select("id, owner_id, nombre, slug, descripcion, foto_portada_url, telefono, activo, es_demo, created_at")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();
  if (!negocio) return null;

  const hoy = hoyISOCR();
  const [{ data: categorias }, { data: items }, { data: franjas }, { data: sedes }] = await Promise.all([
    supabase
      .from("food_menu_categories")
      .select("id, business_id, nombre, orden")
      .eq("business_id", negocio.id)
      .order("orden"),
    supabase
      .from("food_menu_items")
      .select("id, business_id, category_id, nombre, descripcion, precio, foto_url, activo, orden")
      .eq("business_id", negocio.id)
      .eq("activo", true)
      .order("orden"),
    supabase
      .from("food_franjas")
      .select("id, business_id, location_id, fecha, hora, capacidad, reservado, descuento_porcentaje, activa")
      .eq("business_id", negocio.id)
      .eq("activa", true)
      .gte("fecha", hoy)
      .order("fecha")
      .order("hora"),
    supabase.from("food_locations").select("direccion").eq("business_id", negocio.id).limit(1),
  ]);

  const itemsPorCategoria = new Map<string, FoodMenuItem[]>();
  for (const it of (items ?? []) as FoodMenuItem[]) {
    const lista = itemsPorCategoria.get(it.category_id) ?? [];
    lista.push(it);
    itemsPorCategoria.set(it.category_id, lista);
  }

  return {
    negocio: negocio as FoodBusiness,
    direccion: (sedes?.[0]?.direccion as string | null) ?? null,
    categorias: (categorias ?? []) as FoodMenuCategory[],
    itemsPorCategoria,
    franjas: (franjas ?? []) as FoodFranja[],
  };
}

export type FilaMisReserva = {
  id: string;
  codigoConfirmacion: string;
  partySize: number;
  estado: FoodReservationEstado;
  negocioNombre: string;
  fecha: string | null;
  hora: string | null;
  pasada: boolean;
};

export async function cargarMisReservas(customerId: string): Promise<FilaMisReserva[]> {
  const { data, error } = await supabase
    .from("food_reservations")
    .select(
      "id, codigo_confirmacion, party_size, estado, food_franjas(fecha, hora), food_businesses(nombre)",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const ahoraCR = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Costa_Rica",
    hour12: false,
  }).replace(" ", "T").slice(0, 16);

  return data.map((r) => {
    const franjaRaw = r.food_franjas as { fecha: string; hora: string } | { fecha: string; hora: string }[] | null;
    const negocioRaw = r.food_businesses as { nombre: string } | { nombre: string }[] | null;
    const franja = Array.isArray(franjaRaw) ? franjaRaw[0] : franjaRaw;
    const negocio = Array.isArray(negocioRaw) ? negocioRaw[0] : negocioRaw;
    const fecha = franja?.fecha ?? null;
    const hora = franja?.hora ?? null;
    return {
      id: r.id as string,
      codigoConfirmacion: r.codigo_confirmacion as string,
      partySize: r.party_size as number,
      estado: r.estado as FoodReservationEstado,
      negocioNombre: negocio?.nombre ?? "Restaurante",
      fecha,
      hora,
      pasada: fecha !== null && hora !== null && `${fecha}T${hora.slice(0, 5)}` < ahoraCR,
    };
  });
}

export type DetalleReserva = {
  id: string;
  codigoConfirmacion: string;
  partySize: number;
  descuentoPorcentaje: number;
  estado: FoodReservationEstado;
  negocioNombre: string;
  negocioTelefono: string | null;
  fecha: string | null;
  hora: string | null;
};

export async function cargarReserva(reservaId: string): Promise<DetalleReserva | null> {
  const { data } = await supabase
    .from("food_reservations")
    .select(
      "id, party_size, descuento_porcentaje, codigo_confirmacion, estado, food_franjas(fecha, hora), food_businesses(nombre, telefono)",
    )
    .eq("id", reservaId)
    .maybeSingle();
  if (!data) return null;

  const franjaRaw = data.food_franjas as { fecha: string; hora: string } | { fecha: string; hora: string }[] | null;
  const negocioRaw = data.food_businesses as
    | { nombre: string; telefono: string | null }
    | { nombre: string; telefono: string | null }[]
    | null;
  const franja = Array.isArray(franjaRaw) ? franjaRaw[0] : franjaRaw;
  const negocio = Array.isArray(negocioRaw) ? negocioRaw[0] : negocioRaw;

  return {
    id: data.id as string,
    codigoConfirmacion: data.codigo_confirmacion as string,
    partySize: data.party_size as number,
    descuentoPorcentaje: data.descuento_porcentaje as number,
    estado: data.estado as FoodReservationEstado,
    negocioNombre: negocio?.nombre ?? "Restaurante",
    negocioTelefono: negocio?.telefono ?? null,
    fecha: franja?.fecha ?? null,
    hora: franja?.hora ?? null,
  };
}

export async function cargarFavoritosIds(customerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("food_favoritos")
    .select("business_id")
    .eq("customer_id", customerId);
  if (error || !data) return new Set();
  return new Set(data.map((f) => f.business_id as string));
}
