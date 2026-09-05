import { createAdminClient } from "@/lib/supabase/admin";
import { addonsDelNegocio } from "./addons";
import {
  efectoDe,
  estiloLinksDe,
  fuenteDe,
  paletaDelTema,
  portadaDe,
  redondeoDe,
  temaDe,
} from "./temas";
import {
  estadoDominioDe,
  metodoPagoDe,
  metodosPagoDe,
  modalidadDe,
  TOPES,
  type ColaboradorSolutions,
  type EstadoPedido,
  type ItemMenuSolutions,
  type LinkSolutions,
  type NegocioSolutions,
  type PedidoSolutions,
  type SeccionMenu,
} from "./tipos";

/**
 * LAS LECTURAS DE SOLUTIONS — compartidas por /s/<slug> y el panel.
 *
 * Se lee con la LLAVE DE SERVICIO, igual que /r/<slug> hace con la
 * suya: la frontera de publicación es `negocio.publicado`, y quien
 * sirve al público la chequea acá. El panel lee TODO (también lo
 * apagado) porque pasó antes por verificarAccesoSolutions.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

function fila<T>(f: Record<string, unknown>): T {
  return f as unknown as T;
}

/**
 * Las columnas de la 0231 se SANEAN al leer: una fila anterior a esa
 * migración no las tiene, y un valor fuera de la lista cerrada no puede
 * llegar al render. `temaDe` y compañía caen al default.
 */
function conVestido(d: Record<string, unknown>): NegocioSolutions {
  const n = fila<NegocioSolutions>(d);
  return {
    ...n,
    tema: temaDe(d.tema),
    estilo_links: estiloLinksDe(d.estilo_links),
    redondeo: redondeoDe(d.redondeo),
    // 0232. Los parsers también cubren el hueco entre desplegar el
    // código y correr la migración: sin las columnas, `select("*")` no
    // las trae y cada una cae a su default en vez de quedar undefined.
    fuente: fuenteDe(d.fuente),
    estilo_portada: portadaDe(d.estilo_portada),
    efecto: efectoDe(d.efecto),
    // 0233. Mismo criterio: sin las columnas, cada una cae a su default.
    pedidos_llevar: d.pedidos_llevar === true,
    pedidos_express: d.pedidos_express === true,
    costo_express: Number(d.costo_express ?? 0) || 0,
    metodos_pago: metodosPagoDe(d.metodos_pago),
    whatsapp_pedidos: typeof d.whatsapp_pedidos === "string" && d.whatsapp_pedidos ? d.whatsapp_pedidos : null,
    // 0234
    dominio: typeof d.dominio === "string" && d.dominio ? d.dominio : null,
    dominio_estado: estadoDominioDe(d.dominio_estado),
    dominio_verificado_en: (d.dominio_verificado_en as string | null) ?? null,
    dominio_nota: (d.dominio_nota as string | null) ?? null,
  };
}

export async function negocioPorSlug(admin: Admin, slug: string): Promise<NegocioSolutions | null> {
  const { data } = await admin.from("solutions_negocios").select("*").eq("slug", slug).maybeSingle();
  return data ? conVestido(data as Record<string, unknown>) : null;
}

export async function negocioPorId(admin: Admin, id: string): Promise<NegocioSolutions | null> {
  const { data } = await admin.from("solutions_negocios").select("*").eq("id", id).maybeSingle();
  return data ? conVestido(data as Record<string, unknown>) : null;
}

export async function linksDelNegocio(admin: Admin, negocioId: string): Promise<LinkSolutions[]> {
  const { data } = await admin
    .from("solutions_links")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("orden", { ascending: true })
    .limit(TOPES.links);
  return (data ?? []).map((d) => fila<LinkSolutions>(d));
}

export type MenuDelNegocio = {
  secciones: SeccionMenu[];
  items: ItemMenuSolutions[];
  /** Agrupado y ordenado, listo para pintar: [sección, platos]. */
  agrupado: { seccion: SeccionMenu | null; items: ItemMenuSolutions[] }[];
};

export async function menuDelNegocio(admin: Admin, negocioId: string): Promise<MenuDelNegocio> {
  const [{ data: s }, { data: i }] = await Promise.all([
    admin
      .from("solutions_menu_secciones")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: true }),
    admin
      .from("solutions_menu_items")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: true }),
  ]);
  const secciones = (s ?? []).map((d) => fila<SeccionMenu>(d));
  const items = (i ?? []).map((d) => {
    const it = fila<ItemMenuSolutions>(d);
    return { ...it, precio: it.precio === null ? null : Number(it.precio) };
  });

  const agrupado: MenuDelNegocio["agrupado"] = secciones.map((seccion) => ({
    seccion,
    items: items.filter((it) => it.seccion_id === seccion.id),
  }));
  const sueltos = items.filter((it) => !it.seccion_id || !secciones.some((sc) => sc.id === it.seccion_id));
  if (sueltos.length > 0) agrupado.push({ seccion: null, items: sueltos });

  return { secciones, items, agrupado };
}

/** Solo lo que la calle puede ver: disponibles y no agotados hoy. */
export function menuPublico(menu: MenuDelNegocio): MenuDelNegocio["agrupado"] {
  return menu.agrupado
    .map((g) => ({ ...g, items: g.items.filter((it) => it.disponible && !it.agotado_hoy) }))
    .filter((g) => g.items.length > 0);
}

export async function pedidosDelNegocio(
  admin: Admin,
  negocioId: string,
  opciones?: { estados?: EstadoPedido[]; limite?: number },
): Promise<PedidoSolutions[]> {
  let q = admin
    .from("solutions_pedidos")
    .select("*, solutions_pedido_items(id, nombre, precio, cantidad)")
    .eq("negocio_id", negocioId)
    .order("creado_en", { ascending: false })
    .limit(opciones?.limite ?? 60);
  if (opciones?.estados?.length) q = q.in("estado", opciones.estados);
  const { data } = await q;
  return (data ?? []).map((d) => {
    const f = d as Record<string, unknown>;
    const items = (f.solutions_pedido_items as Record<string, unknown>[] | null) ?? [];
    return {
      id: f.id as string,
      negocio_id: f.negocio_id as string,
      mesa: f.mesa === null || f.mesa === undefined ? null : Number(f.mesa),
      modalidad: modalidadDe(f.modalidad),
      nombre: (f.nombre as string) ?? "",
      nota: (f.nota as string) ?? "",
      estado: f.estado as EstadoPedido,
      total: Number(f.total ?? 0),
      telefono: (f.telefono as string | null) ?? null,
      cedula: (f.cedula as string | null) ?? null,
      direccion: (f.direccion as string | null) ?? null,
      metodo_pago: metodoPagoDe(f.metodo_pago),
      costo_envio: Number(f.costo_envio ?? 0) || 0,
      creado_en: f.creado_en as string,
      actualizado_en: f.actualizado_en as string,
      items: items.map((it) => ({
        id: it.id as string,
        nombre: it.nombre as string,
        precio: Number(it.precio),
        cantidad: Number(it.cantidad),
      })),
    };
  });
}

export async function colaboradoresDelNegocio(admin: Admin, negocioId: string): Promise<ColaboradorSolutions[]> {
  const { data } = await admin
    .from("solutions_colaboradores")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("creado_en", { ascending: true });
  return (data ?? []).map((d) => fila<ColaboradorSolutions>(d));
}

/** El número de mesa del QR (`?mesa=N`), validado contra el negocio. */
export function mesaDeBusqueda(valor: string | string[] | undefined, mesasDelNegocio: number): number | null {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (!crudo || !/^\d{1,2}$/.test(crudo)) return null;
  const n = parseInt(crudo, 10);
  return n >= 1 && n <= Math.min(mesasDelNegocio || TOPES.mesas, TOPES.mesas) ? n : null;
}

/** Todo lo que /s/<slug> y /s/<slug>/menu necesitan, o null si no está en la calle. */
export async function paginaPublica(slug: string) {
  const admin = createAdminClient();
  if (!admin || !slug) return null;
  const negocio = await negocioPorSlug(admin, slug);
  if (!negocio || !negocio.publicado) return null;
  const [links, menu, addons] = await Promise.all([
    linksDelNegocio(admin, negocio.id),
    menuDelNegocio(admin, negocio.id),
    addonsDelNegocio(admin, negocio.id),
  ]);
  return {
    negocio,
    links: links.filter((l) => l.visible),
    // El menú público solo existe si el add-on está prendido (0233):
    // lo que el negocio no contrató no sale a la calle, tenga o no
    // platos cargados.
    menu: addons.menu ? menuPublico(menu) : [],
    addons,
    paleta: paletaDelTema(negocio.tema, negocio.color_fondo, negocio.color_acento),
  };
}
