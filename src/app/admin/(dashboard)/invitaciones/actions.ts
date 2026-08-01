"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { parsearPreguntas, type PreguntaInvitacion } from "@/lib/invitaciones-preguntas";

export type DatosInvitacion = {
  slug: string;
  titulo: string;
  anfitriones: string | null;
  mensaje: string | null;
  fechaEvento: string;
  hora: string | null;
  lugarNombre: string | null;
  direccion: string | null;
  mapsUrl: string | null;
  portadaUrl: string | null;
  htmlPersonalizado: string | null;
  tema: string;
  estado: "borrador" | "activa";
  /** Correo del cliente dueño (se busca en perfiles); vacío = sin asignar. */
  clienteCorreo: string | null;
  /** Hasta 3 preguntas del RSVP (0068); null = sin preguntas. */
  preguntas: PreguntaInvitacion[] | null;
};

/** "La boda de Sofía & Andrés" → "la-boda-de-sofia-andres". */
function normalizarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Arma la fila para la base a partir del formulario. Resuelve el
 * cliente por correo contra perfiles — si el correo no corresponde a
 * ninguna cuenta devuelve error en vez de guardar a medias.
 */
async function prepararFila(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  datos: DatosInvitacion,
) {
  const titulo = datos.titulo.trim();
  if (!titulo) return { error: "La invitación necesita un título.", fila: null };
  if (!datos.fechaEvento) return { error: "Falta la fecha del evento.", fila: null };

  const slug = normalizarSlug(datos.slug.trim() || titulo);
  if (!slug) return { error: "Ese slug no sirve — probá con letras y números.", fila: null };

  let clienteId: string | null = null;
  const correo = datos.clienteCorreo?.trim().toLowerCase() || null;
  if (correo) {
    const { data: perfil } = await admin
      .from("perfiles")
      .select("id")
      .ilike("email", correo)
      .maybeSingle();
    if (!perfil) {
      return {
        error: `No hay ninguna cuenta con el correo ${correo}. Crearla primero en Cuentas.`,
        fila: null,
      };
    }
    clienteId = perfil.id as string;
  }

  // Se re-valida lo que mandó el formulario: máximo 3, sin etiquetas
  // vacías ni "opciones" sin opciones.
  const preguntas = parsearPreguntas(datos.preguntas);

  return {
    error: null,
    fila: {
      slug,
      titulo,
      cliente_id: clienteId,
      anfitriones: datos.anfitriones?.trim() || null,
      mensaje: datos.mensaje?.trim() || null,
      fecha_evento: datos.fechaEvento,
      hora: datos.hora?.trim() || null,
      lugar_nombre: datos.lugarNombre?.trim() || null,
      direccion: datos.direccion?.trim() || null,
      maps_url: datos.mapsUrl?.trim() || null,
      portada_url: datos.portadaUrl?.trim() || null,
      html_personalizado: datos.htmlPersonalizado?.trim() || null,
      tema: datos.tema.trim() || "clasico",
      estado: datos.estado,
      preguntas: preguntas.length > 0 ? preguntas : null,
    },
  };
}

function refrescar(slug: string) {
  revalidatePath("/admin/invitaciones");
  revalidatePath(`/i/${slug}`);
  revalidatePath("/cuenta");
}

/** Crea (id null) o actualiza una invitación. Solo el equipo admin. */
export async function guardarInvitacion(id: string | null, datos: DatosInvitacion) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { error: errorFila, fila } = await prepararFila(admin, datos);
  if (errorFila || !fila) return { error: errorFila };

  let { error } = id
    ? await admin.from("invitaciones").update(fila).eq("id", id)
    : await admin.from("invitaciones").insert(fila);

  // La columna `preguntas` llegó con la 0068: si esa migración no ha
  // corrido, PostgREST rechaza la columna desconocida (PGRST204) — se
  // reintenta sin preguntas para no bloquear al equipo.
  if (error && (error.code === "PGRST204" || error.message?.includes("preguntas"))) {
    const { preguntas: _omitida, ...sinPreguntas } = fila;
    void _omitida;
    ({ error } = id
      ? await admin.from("invitaciones").update(sinPreguntas).eq("id", id)
      : await admin.from("invitaciones").insert(sinPreguntas));
  }

  if (error) {
    if (error.code === "23505") {
      return { error: `El slug "${fila.slug}" ya está en uso — elegí otro.` };
    }
    return { error: error.message };
  }

  refrescar(fila.slug);
  return { error: null };
}

/** Archiva (o reactiva) una invitación: el link deja de ser público. */
export async function archivarInvitacion(id: string, archivar: boolean) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data, error } = await admin
    .from("invitaciones")
    .update({ estado: archivar ? "archivada" : "activa" })
    .eq("id", id)
    .select("slug")
    .single();

  if (error) return { error: error.message };

  refrescar(data.slug as string);
  return { error: null };
}

/**
 * Retira una invitación del catálogo de ejemplos.
 *
 * Publicar al catálogo no mueve la invitación: crea una COPIA con slug
 * "ejemplo-{slug}" marcada `es_ejemplo`. Retirarla es archivar esa
 * copia — la del cliente no se toca, sigue viva en su link de siempre.
 *
 * Tolera que le pasen la propia muestra (en el panel se ven las dos):
 * en ese caso se retira ella misma.
 */
export async function quitarDelCatalogo(id: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data: inv, error: errorLectura } = await admin
    .from("invitaciones")
    .select("slug, es_ejemplo")
    .eq("id", id)
    .maybeSingle();
  if (errorLectura) return { error: errorLectura.message };
  if (!inv) return { error: "Esa invitación ya no existe." };

  const slug = inv.slug as string;
  const slugEjemplo = inv.es_ejemplo ? slug : `ejemplo-${slug}`.slice(0, 80);

  const { error } = await admin
    .from("invitaciones")
    .update({ estado: "archivada", en_catalogo: false })
    .eq("slug", slugEjemplo)
    .eq("es_ejemplo", true);
  if (error) return { error: error.message };

  // La original deja de figurar como publicada, así el checkbox del
  // generador no dice que sigue en el catálogo cuando ya no está.
  if (!inv.es_ejemplo) {
    await admin.from("invitaciones").update({ en_catalogo: false }).eq("id", id);
  }

  refrescar(slug);
  return { error: null };
}

// ------------------------------------------------------------
// Álbumes digitales (0068): el QR del evento donde los invitados
// suben sus fotos. Solo el equipo los crea y archiva.
// ------------------------------------------------------------

const FALTA_0068 =
  "La tabla de álbumes no existe todavía — hay que correr la migración 0068 en Supabase.";

/** true si el error de PostgREST huele a "la 0068 no ha corrido". */
function faltaTablaAlbumes(error: { code?: string; message?: string }) {
  return error.code === "PGRST205" || error.code === "42P01" || Boolean(error.message?.includes("albumes"));
}

/**
 * Crea el álbum de fotos de una invitación con slug automático
 * ("fotos-{slug de la invitación}") y hereda su cliente, para que el
 * anfitrión lo vea en su espacio de /cuenta/evento.
 */
export async function crearAlbum(invitacionId: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data: inv, error: errorInv } = await admin
    .from("invitaciones")
    .select("id, slug, titulo, cliente_id")
    .eq("id", invitacionId)
    .maybeSingle();
  if (errorInv) return { error: errorInv.message };
  if (!inv) return { error: "Esa invitación ya no existe." };

  const base = normalizarSlug(`fotos-${inv.slug as string}`) || `fotos-${Date.now().toString(36)}`;
  const fila = {
    invitacion_id: inv.id as string,
    cliente_id: (inv.cliente_id as string | null) ?? null,
    titulo: inv.titulo as string,
    subtitulo: null as string | null,
    estado: "activo",
  };

  let { error } = await admin.from("albumes").insert({ ...fila, slug: base });
  // Si el slug ya está tomado (otro álbum del mismo evento, por
  // ejemplo), se le agrega un sufijo corto y listo.
  if (error?.code === "23505") {
    ({ error } = await admin
      .from("albumes")
      .insert({ ...fila, slug: `${base}-${Date.now().toString(36).slice(-4)}` }));
  }

  if (error) {
    return { error: faltaTablaAlbumes(error) ? FALTA_0068 : error.message };
  }

  refrescar(inv.slug as string);
  return { error: null };
}

// ------------------------------------------------------------
// Pedidos de invitación (0075): lo que el cliente llenó en el
// formulario del sitio y del app, antes de que exista la invitación.
// ------------------------------------------------------------

/** Los mismos estados que acepta el check de la 0075. */
const ESTADOS_PEDIDO = [
  "pendiente_pago",
  "en_revision",
  "pagado",
  "en_diseno",
  "entregado",
  "cancelado",
];

/**
 * Mueve un pedido por su flujo (comprobante revisado → en diseño →
 * entregado). Va con la service key porque la RLS de la 0075 solo deja
 * al CLIENTE tocar sus pedidos, y solo mientras siguen abiertos.
 *
 * `pagado_en` se sella acá si todavía venía vacío: es la fecha que usa
 * el reporte de ingresos de Finanzas, y un pedido que el equipo marca
 * como pagado a mano no pasa por el endpoint que la escribe.
 */
export async function cambiarEstadoPedido(id: string, estado: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (!ESTADOS_PEDIDO.includes(estado)) {
    return { error: "Ese estado no existe." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data: actual, error: errorLectura } = await admin
    .from("pedidos_invitacion")
    .select("pagado_en")
    .eq("id", id)
    .maybeSingle();
  if (errorLectura) return { error: errorLectura.message };
  if (!actual) return { error: "Ese pedido ya no existe." };

  const fila: { estado: string; pagado_en?: string } = { estado };
  const yaCobrado = ["pagado", "en_diseno", "entregado"].includes(estado);
  if (yaCobrado && !actual.pagado_en) {
    fila.pagado_en = new Date().toISOString();
  }

  const { error } = await admin
    .from("pedidos_invitacion")
    .update(fila)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/invitaciones");
  // El monto entra al reporte apenas el pedido queda cobrado.
  revalidatePath("/admin/finanzas");
  return { error: null };
}

/**
 * El comprobante de pago vive en un bucket privado, así que se abre con
 * una URL firmada de un minuto — igual que en el panel de eventos.
 */
export async function urlComprobantePedido(path: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { url: null, error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { url: null, error: FALTA_SERVICE_KEY };

  const { data, error } = await admin.storage
    .from("comprobantes")
    .createSignedUrl(path, 60);

  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}

/** Archiva (o reactiva) un álbum: el link /a/… deja de ser público. */
export async function archivarAlbum(id: string, archivar: boolean) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data, error } = await admin
    .from("albumes")
    .update({ estado: archivar ? "archivado" : "activo" })
    .eq("id", id)
    .select("slug")
    .single();

  if (error) {
    return { error: faltaTablaAlbumes(error) ? FALTA_0068 : error.message };
  }

  revalidatePath("/admin/invitaciones");
  revalidatePath(`/a/${data.slug as string}`);
  return { error: null };
}
