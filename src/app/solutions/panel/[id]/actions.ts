"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { comprobarImagenSubida } from "@/lib/media/comprobar-imagen-subida";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { generarSlugSolutions } from "@/lib/solutions/slug";
import { esAddon } from "@/lib/solutions/addons";
import {
  efectoDe,
  estiloLinksDe,
  fuenteDe,
  portadaDe,
  redondeoDe,
  temaDe,
} from "@/lib/solutions/temas";
import {
  ESTADOS_PEDIDO,
  HEX,
  ICONOS_LINK,
  ROLES_COLABORADOR,
  TOPES,
  metodosPagoDe,
  type EstadoPedido,
  type IconoLink,
  type RolColaborador,
} from "@/lib/solutions/tipos";

/**
 * LAS ACTIONS DEL PANEL DE SOLUTIONS.
 *
 * Todas pasan por `verificarAccesoSolutions` — dueño, admin de Bookea
 * o colaborador según su rol — y escriben con la llave de servicio
 * (la RLS de solutions_* no da INSERT/UPDATE a nadie más). Las
 * validaciones ESPEJAN los CHECK de la 0230 para que el error llegue
 * en español y no como un `check constraint` pelado.
 *
 * Toda URL de imagen que llega del navegador se comprueba dos veces:
 * que sea de NUESTRO bucket `solutions-fotos` (esUrlDeNuestroStorage,
 * nunca startsWith) y que el archivo sea una imagen de verdad (magic
 * bytes). Mismo criterio que el resto del sitio.
 */

const BUCKET = "solutions-fotos";
const MAX_BYTES_FOTO = 4 * 1024 * 1024;

type R = { ok: true } | { ok: false; motivo: string };

async function portonEditar(negocioId: string) {
  const acceso = await verificarAccesoSolutions(negocioId);
  if (!acceso.ok) return { ok: false as const, motivo: acceso.user ? acceso.motivo : "Iniciá sesión." };
  if (!acceso.puedeEditar) return { ok: false as const, motivo: "Tu rol solo permite atender comandas." };
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, motivo: "Falta la llave de servicio." };
  return { ok: true as const, admin, acceso };
}

async function portonComandas(negocioId: string) {
  const acceso = await verificarAccesoSolutions(negocioId);
  if (!acceso.ok) return { ok: false as const, motivo: acceso.user ? acceso.motivo : "Iniciá sesión." };
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, motivo: "Falta la llave de servicio." };
  return { ok: true as const, admin };
}

async function fotoValida(url: string): Promise<{ ok: true; url: string | null } | { ok: false; motivo: string }> {
  const limpia = (url ?? "").trim();
  if (!limpia) return { ok: true, url: null };
  if (!esUrlDeNuestroStorage(limpia, BUCKET)) return { ok: false, motivo: "La foto tiene que subirse desde el panel." };
  const r = await comprobarImagenSubida(limpia, { maxBytes: MAX_BYTES_FOTO });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, url: limpia };
}

function refrescar(negocioId: string, slug?: string | null) {
  revalidatePath(`/solutions/panel/${negocioId}`);
  if (slug) {
    revalidatePath(`/s/${slug}`);
    revalidatePath(`/s/${slug}/menu`);
  }
}

// ── LA PÁGINA (marca, portada, contacto, interruptores) ─────────────

export async function guardarPaginaSolutions(
  negocioId: string,
  d: {
    nombre: string;
    slug: string;
    bajada: string;
    colorFondo: string;
    colorAcento: string;
    logoUrl: string;
    fotoPortadaUrl: string;
    whatsapp: string;
    direccion: string;
    publicado: boolean;
    mostrarMenu: boolean;
    aceptaPedidos: boolean;
    mesas: number;
    /** El vestido de la página (0231). Lista cerrada; lo saneamos acá
     *  igual que el CHECK de la migración. */
    tema: string;
    estiloLinks: string;
    redondeo: string;
    /** El vestido fino (0232). Mismo criterio: lista cerrada saneada acá. */
    fuente: string;
    estiloPortada: string;
    efecto: string;
    /** Cómo recibe pedidos además de la mesa (0233). */
    pedidosLlevar: boolean;
    pedidosExpress: boolean;
    costoExpress: number;
    metodosPago: string[];
    whatsappPedidos: string;
  },
): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;

  const nombre = d.nombre.trim().slice(0, TOPES.nombre);
  if (nombre.length < 1) return { ok: false, motivo: "El nombre no puede quedar vacío." };

  // El slug lo puede cambiar el dueño (para que el QR diga lo que él
  // quiere), pero pasa por el mismo generador: minúsculas, guiones,
  // único, no reservado.
  const { data: actual } = await p.admin.from("solutions_negocios").select("slug").eq("id", negocioId).single();
  let slug = actual?.slug as string;
  const pedido = d.slug.trim().toLowerCase();
  if (pedido && pedido !== slug) {
    const candidato = await generarSlugSolutions(p.admin, pedido);
    if (candidato !== pedido) return { ok: false, motivo: `Ese enlace no está libre. Podés usar «${candidato}».` };
    slug = candidato;
  }

  const logo = await fotoValida(d.logoUrl);
  if (!logo.ok) return logo;
  const portada = await fotoValida(d.fotoPortadaUrl);
  if (!portada.ok) return portada;

  const whatsapp = d.whatsapp.replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) {
    return { ok: false, motivo: "El WhatsApp tiene que tener entre 8 y 15 dígitos." };
  }
  const whatsappPedidos = String(d.whatsappPedidos ?? "").replace(/\D/g, "");
  if (whatsappPedidos && (whatsappPedidos.length < 8 || whatsappPedidos.length > 15)) {
    return { ok: false, motivo: "El WhatsApp de pedidos tiene que tener entre 8 y 15 dígitos." };
  }
  // Para llevar o exprés necesitan un número a dónde mandar el pedido:
  // el de pedidos o, en su defecto, el de la página. Sin ninguno, el
  // cliente armaría un pedido que no llega a nadie.
  if ((d.pedidosLlevar || d.pedidosExpress) && !whatsappPedidos && !whatsapp) {
    return { ok: false, motivo: "Para recibir pedidos para llevar o exprés hace falta un WhatsApp." };
  }
  const costoExpress = Math.max(0, Math.round(Number(d.costoExpress) || 0));
  const metodosPago = metodosPagoDe(d.metodosPago);

  const { error } = await p.admin
    .from("solutions_negocios")
    .update({
      nombre,
      slug,
      bajada: d.bajada.trim().slice(0, TOPES.bajada),
      color_fondo: HEX.test(d.colorFondo) ? d.colorFondo : "#0a1226",
      color_acento: HEX.test(d.colorAcento) ? d.colorAcento : "#9db4ff",
      logo_url: logo.url,
      foto_portada_url: portada.url,
      whatsapp: whatsapp || null,
      direccion: d.direccion.trim().slice(0, TOPES.direccion) || null,
      publicado: d.publicado === true,
      mostrar_menu: d.mostrarMenu !== false,
      acepta_pedidos: d.aceptaPedidos === true,
      tema: temaDe(d.tema),
      estilo_links: estiloLinksDe(d.estiloLinks),
      redondeo: redondeoDe(d.redondeo),
      fuente: fuenteDe(d.fuente),
      estilo_portada: portadaDe(d.estiloPortada),
      efecto: efectoDe(d.efecto),
      pedidos_llevar: d.pedidosLlevar === true,
      pedidos_express: d.pedidosExpress === true,
      costo_express: costoExpress,
      metodos_pago: metodosPago,
      whatsapp_pedidos: whatsappPedidos || null,
      mesas: Math.max(0, Math.min(TOPES.mesas, Math.trunc(Number(d.mesas)) || 0)),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo guardar. Probá de nuevo." };

  refrescar(negocioId, slug);
  if (actual?.slug && actual.slug !== slug) revalidatePath(`/s/${actual.slug}`);
  return { ok: true };
}

// ── LOS ADD-ONS (0233) ──────────────────────────────────────────────

/**
 * Prender o apagar un add-on. Hoy es gratis («todo es prueba», dueño,
 * 4 sep 2026): el día que se cobre, lo que cambia es lo que pasa ANTES
 * de escribir la fila —verificar el pago—, no esta puerta.
 *
 * Solo dueño/admin (`portonEditar`), y el link hub no se apaga: es lo
 * incluido con la cuenta.
 */
export async function activarAddonSolutions(negocioId: string, addon: string, activo: boolean): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  if (!esAddon(addon)) return { ok: false, motivo: "Ese complemento no existe." };
  if (addon === "linkhub") return { ok: false, motivo: "Tu página viene con la cuenta: no se apaga." };

  const fila: Record<string, unknown> = { negocio_id: negocioId, addon, activo: activo === true, vence_en: null };
  if (activo) {
    fila.activado_en = new Date().toISOString();
    fila.notas = "prueba (gratis)";
  }
  const { error } = await p.admin.from("solutions_addons").upsert(fila, { onConflict: "negocio_id,addon" });
  if (error) return { ok: false, motivo: "No se pudo cambiar el complemento. Probá de nuevo." };

  const { data: n } = await p.admin.from("solutions_negocios").select("slug").eq("id", negocioId).single();
  refrescar(negocioId, n?.slug as string | undefined);
  return { ok: true };
}

// ── LOS LINKS (se guardan todos juntos, en orden) ───────────────────

export async function guardarLinksSolutions(
  negocioId: string,
  links: { etiqueta: string; url: string; icono: string; visible: boolean; fondoUrl?: string | null }[],
): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;

  const limpios: {
    negocio_id: string;
    etiqueta: string;
    url: string;
    icono: IconoLink;
    orden: number;
    visible: boolean;
    fondo_url: string | null;
  }[] = [];
  for (const l of Array.isArray(links) ? links.slice(0, TOPES.links) : []) {
    const etiqueta = String(l.etiqueta ?? "").trim().slice(0, TOPES.etiquetaLink);
    let url = String(l.url ?? "").trim();
    if (!etiqueta && !url) continue; // fila vacía: se ignora
    if (!etiqueta) return { ok: false, motivo: "Cada enlace necesita un texto." };
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url)) url = `https://${url}`;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) return { ok: false, motivo: `«${etiqueta}» necesita una dirección válida.` };
    const icono = (ICONOS_LINK as readonly string[]).includes(l.icono) ? (l.icono as IconoLink) : "link";

    // La foto de fondo pasa por el MISMO portero que el logo y la
    // portada: tiene que estar en nuestro storage y ser una imagen de
    // verdad (magic bytes), no solo una cadena que termine en .png.
    const fondo = await fotoValida(String(l.fondoUrl ?? ""));
    if (!fondo.ok) return fondo;

    // `fondo_url` va SIEMPRE, aunque sea null. PostgREST rechaza un
    // insert en lote donde los objetos no tienen las mismas claves
    // (PGRST102, «All object keys must match») — y acá la mitad de las
    // puertas no lleva foto, que es justo el caso que lo dispara.
    limpios.push({
      negocio_id: negocioId,
      etiqueta,
      url,
      icono,
      orden: limpios.length,
      visible: l.visible !== false,
      fondo_url: fondo.url,
    });
  }

  // Reemplazo completo: borrar y volver a insertar es más simple y más
  // seguro que un diff por fila para una lista de ≤12 que siempre se
  // edita entera.
  const { error: eBorrar } = await p.admin.from("solutions_links").delete().eq("negocio_id", negocioId);
  if (eBorrar) return { ok: false, motivo: "No se pudieron guardar los enlaces." };
  if (limpios.length > 0) {
    const { error } = await p.admin.from("solutions_links").insert(limpios);
    if (error) return { ok: false, motivo: "No se pudieron guardar los enlaces." };
  }

  const { data: n } = await p.admin.from("solutions_negocios").select("slug").eq("id", negocioId).single();
  refrescar(negocioId, n?.slug as string | undefined);
  return { ok: true };
}

// ── EL MENÚ ─────────────────────────────────────────────────────────

export async function guardarSeccionSolutions(
  negocioId: string,
  d: { id: string | null; nombre: string },
): Promise<R & { id?: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const nombre = d.nombre.trim().slice(0, TOPES.seccionNombre);
  if (!nombre) return { ok: false, motivo: "La sección necesita un nombre." };

  if (d.id) {
    const { error } = await p.admin
      .from("solutions_menu_secciones")
      .update({ nombre })
      .eq("id", d.id)
      .eq("negocio_id", negocioId);
    if (error) return { ok: false, motivo: "No se pudo guardar la sección." };
    await refrescarPorId(p.admin, negocioId);
    return { ok: true, id: d.id };
  }

  const { count } = await p.admin
    .from("solutions_menu_secciones")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocioId);
  if ((count ?? 0) >= TOPES.secciones) return { ok: false, motivo: `Máximo ${TOPES.secciones} secciones.` };

  const { data, error } = await p.admin
    .from("solutions_menu_secciones")
    .insert({ negocio_id: negocioId, nombre, orden: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, motivo: "No se pudo crear la sección." };
  await refrescarPorId(p.admin, negocioId);
  return { ok: true, id: data.id as string };
}

export async function borrarSeccionSolutions(negocioId: string, seccionId: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  // Los platos quedan (seccion_id → null por la FK); van a «Otros».
  const { error } = await p.admin.from("solutions_menu_secciones").delete().eq("id", seccionId).eq("negocio_id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo borrar la sección." };
  await refrescarPorId(p.admin, negocioId);
  return { ok: true };
}

export async function ordenarSeccionesSolutions(negocioId: string, idsEnOrden: string[]): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  await Promise.all(
    idsEnOrden.slice(0, TOPES.secciones).map((id, i) =>
      p.admin.from("solutions_menu_secciones").update({ orden: i }).eq("id", id).eq("negocio_id", negocioId),
    ),
  );
  await refrescarPorId(p.admin, negocioId);
  return { ok: true };
}

export async function guardarPlatoSolutions(
  negocioId: string,
  d: {
    id: string | null;
    seccionId: string | null;
    nombre: string;
    descripcion: string;
    precio: number | null;
    fotoUrl: string;
    disponible: boolean;
  },
): Promise<R & { id?: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const nombre = d.nombre.trim().slice(0, TOPES.itemNombre);
  if (!nombre) return { ok: false, motivo: "El plato necesita un nombre." };
  const foto = await fotoValida(d.fotoUrl);
  if (!foto.ok) return foto;
  const precio =
    d.precio === null || d.precio === undefined || Number.isNaN(Number(d.precio))
      ? null
      : Math.max(0, Math.round(Number(d.precio)));

  const fila = {
    seccion_id: d.seccionId || null,
    nombre,
    descripcion: d.descripcion.trim().slice(0, TOPES.itemDescripcion),
    precio,
    foto_url: foto.url,
    disponible: d.disponible !== false,
  };

  if (d.id) {
    const { error } = await p.admin.from("solutions_menu_items").update(fila).eq("id", d.id).eq("negocio_id", negocioId);
    if (error) return { ok: false, motivo: "No se pudo guardar el plato." };
    await refrescarPorId(p.admin, negocioId);
    return { ok: true, id: d.id };
  }

  const { count } = await p.admin
    .from("solutions_menu_items")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocioId);
  if ((count ?? 0) >= TOPES.items) return { ok: false, motivo: `Máximo ${TOPES.items} platos.` };

  const { data, error } = await p.admin
    .from("solutions_menu_items")
    .insert({ ...fila, negocio_id: negocioId, orden: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, motivo: "No se pudo crear el plato." };
  await refrescarPorId(p.admin, negocioId);
  return { ok: true, id: data.id as string };
}

export async function borrarPlatoSolutions(negocioId: string, itemId: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const { error } = await p.admin.from("solutions_menu_items").delete().eq("id", itemId).eq("negocio_id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo borrar el plato." };
  await refrescarPorId(p.admin, negocioId);
  return { ok: true };
}

/** «Agotado hoy»: el interruptor del turno. Lo puede tocar el equipo. */
export async function marcarAgotadoSolutions(negocioId: string, itemId: string, agotado: boolean): Promise<R> {
  const p = await portonComandas(negocioId);
  if (!p.ok) return p;
  const { error } = await p.admin
    .from("solutions_menu_items")
    .update({ agotado_hoy: agotado === true })
    .eq("id", itemId)
    .eq("negocio_id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo actualizar." };
  await refrescarPorId(p.admin, negocioId);
  return { ok: true };
}

// ── LAS COMANDAS ────────────────────────────────────────────────────

export async function cambiarEstadoPedidoSolutions(negocioId: string, pedidoId: string, estado: EstadoPedido): Promise<R> {
  const p = await portonComandas(negocioId);
  if (!p.ok) return p;
  if (!(ESTADOS_PEDIDO as readonly string[]).includes(estado)) return { ok: false, motivo: "Estado inválido." };
  const { error } = await p.admin
    .from("solutions_pedidos")
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("negocio_id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo cambiar el estado." };
  revalidatePath(`/solutions/panel/${negocioId}`);
  return { ok: true };
}

// ── EL EQUIPO ───────────────────────────────────────────────────────

export async function invitarColaboradorSolutions(negocioId: string, correo: string, rol: RolColaborador): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const limpio = correo.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) return { ok: false, motivo: "Escribí un correo válido." };
  const r: RolColaborador = (ROLES_COLABORADOR as readonly string[]).includes(rol) ? rol : "equipo";

  const { count } = await p.admin
    .from("solutions_colaboradores")
    .select("correo", { count: "exact", head: true })
    .eq("negocio_id", negocioId);
  if ((count ?? 0) >= TOPES.colaboradores) return { ok: false, motivo: `Máximo ${TOPES.colaboradores} colaboradores.` };

  // Si la cuenta ya existe se vincula de una; si no, queda pendiente
  // por correo y se vincula la primera vez que entre (acceso.ts).
  const { data: perfil } = await p.admin.from("perfiles").select("id").eq("email", limpio).maybeSingle();

  const { error } = await p.admin
    .from("solutions_colaboradores")
    .upsert({ negocio_id: negocioId, correo: limpio, rol: r, usuario_id: perfil?.id ?? null }, { onConflict: "negocio_id,correo" });
  if (error) return { ok: false, motivo: "No se pudo invitar." };
  revalidatePath(`/solutions/panel/${negocioId}`);
  return { ok: true };
}

export async function quitarColaboradorSolutions(negocioId: string, correo: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const { error } = await p.admin
    .from("solutions_colaboradores")
    .delete()
    .eq("negocio_id", negocioId)
    .eq("correo", correo.trim().toLowerCase());
  if (error) return { ok: false, motivo: "No se pudo quitar." };
  revalidatePath(`/solutions/panel/${negocioId}`);
  return { ok: true };
}

async function refrescarPorId(admin: NonNullable<ReturnType<typeof createAdminClient>>, negocioId: string) {
  const { data } = await admin.from("solutions_negocios").select("slug").eq("id", negocioId).single();
  refrescar(negocioId, data?.slug as string | undefined);
}
