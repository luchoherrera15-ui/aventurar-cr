"use server";

import { revalidatePath } from "next/cache";
import { personalizacionDe } from "@/lib/solutions/personalizacion";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { comprobarImagenSubida } from "@/lib/media/comprobar-imagen-subida";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { generarSlugSolutions } from "@/lib/solutions/slug";
import { esAddon } from "@/lib/solutions/addons";
import { HOSTS_MARCA, hostMarcaDe, planLinksyDe, sanearParaPlan, esPro } from "@/lib/solutions/planes";
import {
  ajustesMenuDe,
  estiloMenuDe,
  estiloMenuParaPlan,
  fuenteMenuDe,
  portadaMenuDe,
} from "@/lib/solutions/menu-estilos";
import { esHostPropio, normalizarDominio } from "@/lib/solutions/dominios";
import { idiomasMenuDe, nutricionDe, traduccionesDe } from "@/lib/solutions/idiomas";
import { traducirPiezas } from "@/lib/solutions/traducir-menu";
import {
  agregarDominioEnVercel,
  leerDns,
  quitarDominioEnVercel,
  sondaDominio,
  vercelConfigurado,
} from "@/lib/solutions/vercel-dominios";
import { disenoDe, efectoDe, estiloLinksDe, fuenteDe, portadaDe, redondeoDe, temaDe, FUENTES } from "@/lib/solutions/temas";
import {
  ESTADOS_PEDIDO,
  HEX,
  ICONOS_LINK,
  ROLES_COLABORADOR,
  TOPES,
  formatoLinkDe,
  metodosPagoDe,
  type EstadoDominio,
  type EstadoPedido,
  type FormatoLink,
  type IconoLink,
  type RolColaborador,
} from "@/lib/solutions/tipos";
import { monedaDe, paisDe, redondearMonto } from "@/lib/monedas";
import { rubroDe } from "@/lib/solutions/rubros";
import { esUrlDeCloudflare } from "@/lib/solutions/fotos";

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
  // Cloudflare Images (0236, «todo lo que sean imágenes desde
  // Cloudflare»): una URL de entrega de NUESTRA cuenta (el hash se
  // compara contra la variable del servidor). No hace falta mirar los
  // magic bytes: Cloudflare rechaza al subir lo que no es una imagen,
  // y lo que devuelve es lo que él mismo procesó.
  if (esUrlDeCloudflare(limpia, process.env.CLOUDFLARE_IMAGES_DELIVERY_URL)) return { ok: true, url: limpia };
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
    /** Idiomas del menú además del español (0235). */
    idiomasMenu: string[];
    /** País, moneda, rubro y diseño fino (0236). Listas cerradas, saneadas acá. */
    pais?: string;
    moneda?: string;
    rubro?: string;
    diseno?: unknown;
  },
): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;

  const nombre = d.nombre.trim().slice(0, TOPES.nombre);
  if (nombre.length < 1) return { ok: false, motivo: "El nombre no puede quedar vacío." };

  // El slug lo puede cambiar el dueño (para que el QR diga lo que él
  // quiere), pero pasa por el mismo generador: minúsculas, guiones,
  // único, no reservado.
  const { data: actual } = await p.admin.from("solutions_negocios").select("slug, plan").eq("id", negocioId).single();
  let slug = actual?.slug as string;
  // EL PLAN MANDA (0239): lo que es Pro vuelve a su valor gratis si el
  // negocio no tiene Pro, aunque el cliente lo mande a mano.
  const vestido = sanearParaPlan(
    {
      tema: temaDe(d.tema),
      estiloLinks: estiloLinksDe(d.estiloLinks),
      fuente: fuenteDe(d.fuente),
      estiloPortada: portadaDe(d.estiloPortada),
      efecto: efectoDe(d.efecto),
      diseno: disenoDe(d.diseno),
    },
    planLinksyDe((actual as { plan?: unknown } | null)?.plan),
  );
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
  const moneda = monedaDe(d.moneda);
  // El costo del envío se redondea a los decimales de SU moneda: en
  // colones no hay centavos; en pesos mexicanos, dos.
  const costoExpress = Math.max(0, redondearMonto(Number(d.costoExpress) || 0, moneda));
  const metodosPago = metodosPagoDe(d.metodosPago);

  const { error } = await p.admin
    .from("solutions_negocios")
    .update({
      pais: paisDe(d.pais),
      moneda,
      rubro: rubroDe(d.rubro),
      diseno: vestido.diseno,
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
      tema: vestido.tema,
      estilo_links: vestido.estiloLinks,
      redondeo: redondeoDe(d.redondeo),
      fuente: vestido.fuente,
      estilo_portada: vestido.estiloPortada,
      efecto: vestido.efecto,
      pedidos_llevar: d.pedidosLlevar === true,
      pedidos_express: d.pedidosExpress === true,
      costo_express: costoExpress,
      metodos_pago: metodosPago,
      whatsapp_pedidos: whatsappPedidos || null,
      idiomas_menu: idiomasMenuDe(d.idiomasMenu),
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

// ── EL DOMINIO PROPIO (0234) ─────────────────────────────────────────

/**
 * Guardar el dominio del negocio. Se normaliza, se rechaza lo nuestro,
 * y se intenta registrar en Vercel por API. Sin VERCEL_TOKEN eso no
 * falla: queda pendiente con una nota que dice que Bookea lo termina
 * de activar — y la sonda de «Verificar» es la que lo dará por activo
 * cuando de verdad sirva la página.
 */
export async function guardarDominioSolutions(negocioId: string, entrada: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const dominio = normalizarDominio(entrada);
  if (!dominio) return { ok: false, motivo: "Escribí un dominio válido, como casanostra.com o menu.casanostra.com." };
  if (esHostPropio(dominio)) return { ok: false, motivo: "Ese dominio es de Bookea. Usá uno tuyo." };

  const vercel = await agregarDominioEnVercel(dominio);
  const nota = !vercel.configurado
    ? "Guardado. Poné el registro en tu DNS y tocá «Verificar»; Bookea termina de activarlo."
    : vercel.ok
      ? "Guardado. Poné el registro en tu DNS y tocá «Verificar»."
      : `Vercel no lo aceptó: ${vercel.motivo ?? "sin detalle"}.`;

  const { error } = await p.admin
    .from("solutions_negocios")
    .update({
      dominio,
      dominio_estado: vercel.configurado && !vercel.ok ? "error" : "pendiente",
      dominio_verificado_en: null,
      dominio_nota: nota.slice(0, 240),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", negocioId);
  if (error) {
    if (error.code === "23505") return { ok: false, motivo: "Ese dominio ya está en uso por otro negocio." };
    return { ok: false, motivo: "No se pudo guardar el dominio. Probá de nuevo." };
  }
  refrescar(negocioId);
  return { ok: true };
}

/**
 * La comprobación de verdad: una petición HTTPS al dominio buscando la
 * cabecera del proxy. Si vuelve, activo. Si no, se mira el DNS para
 * decirle al negocio qué falta, con lo que se encontró.
 */
export async function verificarDominioSolutions(
  negocioId: string,
): Promise<{ ok: true; estado: EstadoDominio; nota: string } | { ok: false; motivo: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const { data: n } = await p.admin.from("solutions_negocios").select("slug, dominio").eq("id", negocioId).single();
  const dominio = (n?.dominio as string | null) ?? null;
  const slug = (n?.slug as string) ?? "";
  if (!dominio) return { ok: false, motivo: "No hay un dominio guardado." };

  const sonda = await sondaDominio(dominio, slug);
  let estado: EstadoDominio;
  let nota: string;
  if (sonda.vivo) {
    estado = "activo";
    nota = `Activo: ${dominio} ${sonda.detalle}.`;
  } else {
    const dnsL = await leerDns(dominio);
    estado = "pendiente";
    nota = dnsL.apunta
      ? vercelConfigurado()
        ? `El DNS ya apunta a Vercel (${dnsL.detalle}), pero el dominio ${sonda.detalle}. Probá de nuevo en unos minutos.`
        : `El DNS ya apunta a Vercel (${dnsL.detalle}). Falta que Bookea lo active en el servidor; te avisamos.`
      : `Tu DNS todavía no apunta acá: ${dnsL.detalle}.`;
  }
  await p.admin
    .from("solutions_negocios")
    .update({
      dominio_estado: estado,
      dominio_verificado_en: estado === "activo" ? new Date().toISOString() : null,
      dominio_nota: nota.slice(0, 240),
    })
    .eq("id", negocioId);
  refrescar(negocioId, slug);
  return { ok: true, estado, nota };
}

export async function quitarDominioSolutions(negocioId: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const { data: n } = await p.admin.from("solutions_negocios").select("slug, dominio").eq("id", negocioId).single();
  if (n?.dominio) await quitarDominioEnVercel(n.dominio as string);
  const { error } = await p.admin
    .from("solutions_negocios")
    .update({ dominio: null, dominio_estado: "pendiente", dominio_verificado_en: null, dominio_nota: null })
    .eq("id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo quitar el dominio. Probá de nuevo." };
  refrescar(negocioId, n?.slug as string | undefined);
  return { ok: true };
}

// ── TRADUCIR EL MENÚ CON IA (0235) ───────────────────────────────────

/**
 * Traduce de una vez TODO lo que falte a los idiomas que el negocio
 * tiene prendidos. Solo completa huecos: lo que ya estaba traducido a
 * mano no se pisa, así corregir un plato no se deshace al volver a
 * tocar el botón.
 */
export async function traducirMenuSolutions(
  negocioId: string,
): Promise<{ ok: true; platos: number; secciones: number } | { ok: false; motivo: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const { data: n } = await p.admin.from("solutions_negocios").select("idiomas_menu").eq("id", negocioId).single();
  const idiomas = idiomasMenuDe(n?.idiomas_menu);
  if (idiomas.length === 0) return { ok: false, motivo: "Primero prendé algún idioma en Mi página → Menú y pedidos." };

  const [{ data: secciones }, { data: platos }] = await Promise.all([
    p.admin.from("solutions_menu_secciones").select("id, nombre, traducciones").eq("negocio_id", negocioId),
    p.admin.from("solutions_menu_items").select("id, nombre, descripcion, traducciones").eq("negocio_id", negocioId),
  ]);
  const faltaAlgo = (t: unknown) => {
    const actuales = traduccionesDe(t);
    return idiomas.some((i) => !actuales[i]?.nombre);
  };
  const piezas = [
    ...(secciones ?? []).filter((s) => faltaAlgo(s.traducciones)).map((s) => ({ id: `s:${s.id}`, nombre: s.nombre as string })),
    ...(platos ?? [])
      .filter((it) => faltaAlgo(it.traducciones))
      .map((it) => ({ id: `p:${it.id}`, nombre: it.nombre as string, descripcion: (it.descripcion as string) || undefined })),
  ];
  if (piezas.length === 0) return { ok: true, platos: 0, secciones: 0 };

  const r = await traducirPiezas(piezas, idiomas);
  if (!r.ok) return r;

  let nPlatos = 0;
  let nSecciones = 0;
  for (const [clave, nuevas] of Object.entries(r.por)) {
    const [tipo, id] = clave.split(":");
    const tabla = tipo === "s" ? "solutions_menu_secciones" : "solutions_menu_items";
    const fuente = (tipo === "s" ? secciones : platos)?.find((x) => x.id === id);
    if (!fuente) continue;
    // Se completa lo que falta; lo hecho a mano se respeta.
    const actuales = traduccionesDe(fuente.traducciones);
    const fusion = { ...actuales };
    for (const i of idiomas) if (!fusion[i]?.nombre && nuevas[i]) fusion[i] = nuevas[i];
    const { error } = await p.admin.from(tabla).update({ traducciones: fusion }).eq("id", id).eq("negocio_id", negocioId);
    if (!error) {
      if (tipo === "s") nSecciones++;
      else nPlatos++;
    }
  }
  await refrescarPorId(p.admin, negocioId);
  return { ok: true, platos: nPlatos, secciones: nSecciones };
}

// ── LOS LINKS (se guardan todos juntos, en orden) ───────────────────

export async function guardarLinksSolutions(
  negocioId: string,
  links: {
    etiqueta: string;
    url: string;
    icono: string;
    visible: boolean;
    fondoUrl?: string | null;
    /** Botón, ícono de red, título o texto (0236). */
    formato?: string;
    descripcion?: string;
  }[],
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
    formato: FormatoLink;
    descripcion: string;
  }[] = [];
  for (const l of Array.isArray(links) ? links.slice(0, TOPES.links) : []) {
    const formato = formatoLinkDe(l.formato);
    // Un texto es un párrafo (160); botón, ícono y título, un rótulo (40).
    const etiqueta = String(l.etiqueta ?? "").trim().slice(0, formato === "texto" ? TOPES.textoLink : TOPES.etiquetaLink);
    let url = String(l.url ?? "").trim();
    if (!etiqueta && !url) continue; // fila vacía: se ignora
    if (!etiqueta) return { ok: false, motivo: "Cada enlace necesita un texto." };
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url)) url = `https://${url}`;
    // Un título o un texto no llevan a ningún lado: la URL es opcional.
    const sinDestino = formato === "titulo" || formato === "texto";
    if (sinDestino && !url) url = "";
    if (url && !/^(https?:\/\/|mailto:|tel:)/i.test(url)) return { ok: false, motivo: `«${etiqueta}» necesita una dirección válida.` };
    if (!sinDestino && !url) return { ok: false, motivo: `«${etiqueta}» necesita una dirección válida.` };
    const icono = (ICONOS_LINK as readonly string[]).includes(l.icono) ? (l.icono as IconoLink) : "link";
    const descripcion = String(l.descripcion ?? "").trim().slice(0, TOPES.descripcionLink);

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
      formato,
      descripcion,
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
  d: { id: string | null; nombre: string; traducciones?: unknown },
): Promise<R & { id?: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const nombre = d.nombre.trim().slice(0, TOPES.seccionNombre);
  if (!nombre) return { ok: false, motivo: "La sección necesita un nombre." };
  const traducciones = traduccionesDe(d.traducciones);

  if (d.id) {
    const { error } = await p.admin
      .from("solutions_menu_secciones")
      .update({ nombre, traducciones })
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
    .insert({ negocio_id: negocioId, nombre, orden: count ?? 0, traducciones })
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
    /** Nombre y descripción en otros idiomas (0235). */
    traducciones?: unknown;
    /** La ficha nutricional; null o vacía = no la tiene (0235). */
    nutricion?: unknown;
    /** Ingredientes que se pueden quitar y extras con precio (0241). */
    personalizacion?: unknown;
  },
): Promise<R & { id?: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const nombre = d.nombre.trim().slice(0, TOPES.itemNombre);
  if (!nombre) return { ok: false, motivo: "El plato necesita un nombre." };
  const foto = await fotoValida(d.fotoUrl);
  if (!foto.ok) return foto;
  // Dos decimales y no entero (0236): en pesos mexicanos o soles un
  // precio lleva centavos. La columna es numeric(12,2) desde la 0230;
  // lo que se muestra lo redondea `fmtMoneda` a los decimales de la
  // moneda del negocio.
  const precio =
    d.precio === null || d.precio === undefined || Number.isNaN(Number(d.precio))
      ? null
      : Math.max(0, Math.round(Number(d.precio) * 100) / 100);

  const fila = {
    seccion_id: d.seccionId || null,
    nombre,
    descripcion: d.descripcion.trim().slice(0, TOPES.itemDescripcion),
    precio,
    foto_url: foto.url,
    disponible: d.disponible !== false,
    traducciones: traduccionesDe(d.traducciones),
    nutricion: nutricionDe(d.nutricion),
    // Se sanea acá y no en la pantalla: los precios de los extras
    // terminan cobrándose, así que la lista buena es la del servidor.
    personalizacion: personalizacionDe(d.personalizacion),
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

// ── EL DOMINIO DE MARCA (0239) ───────────────────────────────────────

/**
 * En qué dirección se muestra la página: linksy.lat/<slug> o
 * bookea.lat/s/<slug>. Las dos sirven; esto decide cuál se enseña,
 * se comparte y va en el QR.
 */
/**
 * EL DISEÑO DEL CATÁLOGO (8 sep 2026).
 *
 * Se guarda dentro del jsonb `diseno` —el mismo de la 0232— y no en
 * una columna nueva: no hace falta migración y `disenoDe` ya tolera
 * campos que no conoce. Se LEE primero para no pisar el resto del
 * vestido (animación, fondo, encabezado…) con un objeto de un campo.
 *
 * El plan se hace cumplir acá y no en la pantalla: un diseño Pro que
 * llegue de un negocio Gratis vuelve al base, igual que en
 * `sanearParaPlan`.
 */
/**
 * TODOS LOS AJUSTES DEL CATÁLOGO, DE UNA (9 sep 2026).
 *
 * El editor manda el objeto entero —tema, colores, letra, tamaño,
 * disposición, foto, separador, precio, aire, esquinas y portada— y acá
 * se sanea con `ajustesMenuDe`: lo que no sea una opción conocida cae
 * en su valor base, y un color que no sea #rrggbb se descarta.
 *
 * Todo esto es afinado fino: Pro. Sin Pro se guarda solo la plantilla
 * (que es lo que el plan Gratis puede elegir) y el resto queda como
 * estaba.
 */
export async function guardarAjustesMenuSolutions(negocioId: string, crudo: unknown): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;

  const { data: fila } = await p.admin
    .from("solutions_negocios")
    .select("slug, diseno, plan")
    .eq("id", negocioId)
    .single();

  const pro = esPro(planLinksyDe(fila?.plan));
  const previo = disenoDe(fila?.diseno);
  const pedido = ajustesMenuDe(crudo, FUENTES);
  const plantilla = estiloMenuParaPlan(pedido.plantilla, pro);
  const menuAjustes = pro ? { ...pedido, plantilla } : { ...previo.menuAjustes, plantilla };

  const diseno = { ...previo, menu: plantilla, menuAjustes };
  const { error } = await p.admin.from("solutions_negocios").update({ diseno }).eq("id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo guardar el diseño del menú." };

  refrescar(negocioId, (fila?.slug as string | null) ?? null);
  return { ok: true };
}

export async function elegirEstiloMenuSolutions(
  negocioId: string,
  estilo: string,
  /** La letra («auto» = la del diseño) y la portada, del mismo editor. */
  extra?: { fuente?: string; portada?: string },
): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;

  const { data: fila } = await p.admin
    .from("solutions_negocios")
    .select("slug, diseno, plan")
    .eq("id", negocioId)
    .single();

  const pro = esPro(planLinksyDe(fila?.plan));
  const elegido = estiloMenuParaPlan(estiloMenuDe(estilo), pro);
  const previo = disenoDe(fila?.diseno);
  const diseno = {
    ...previo,
    menu: elegido,
    // La letra suelta y la portada son afinado fino: Pro. Sin Pro se
    // queda lo que ya había, que es lo que su plan permite.
    menuFuente: pro ? fuenteMenuDe(extra?.fuente ?? previo.menuFuente, FUENTES) : previo.menuFuente,
    menuPortada: pro ? portadaMenuDe(extra?.portada ?? previo.menuPortada) : previo.menuPortada,
  };

  const { error } = await p.admin.from("solutions_negocios").update({ diseno }).eq("id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo guardar el diseño del menú." };

  refrescar(negocioId, (fila?.slug as string | null) ?? null);
  return { ok: true };
}

export async function elegirDominioMarcaSolutions(negocioId: string, host: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  if (!(HOSTS_MARCA as readonly string[]).includes(host)) return { ok: false, motivo: "Elegí linksy.lat o bookea.lat." };
  const { data: fila } = await p.admin.from("solutions_negocios").select("slug").eq("id", negocioId).single();
  const { error } = await p.admin
    .from("solutions_negocios")
    .update({ host_marca: hostMarcaDe(host) })
    .eq("id", negocioId);
  if (error) {
    // Sin la 0239 aplicada la columna no existe: se dice, no se disfraza.
    return { ok: false, motivo: error.message.includes("host_marca") ? "Falta aplicar la migración 0239 para elegir el dominio." : "No se pudo guardar el dominio." };
  }
  refrescar(negocioId, (fila?.slug as string | null) ?? null);
  return { ok: true };
}
