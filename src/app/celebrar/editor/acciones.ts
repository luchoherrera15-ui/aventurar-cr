"use server";

import { revalidatePath } from "next/cache";
import { celebracionPorId, plantillaPorSlug, saldoCreditos } from "@/lib/celebrar/datos";
import { VALOR_CREDITO_CRC, paquetePublico } from "@/lib/celebrar/creditos";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { abrirCheckoutDeCreditos, sePuedenComprarCreditos } from "@/lib/celebrar/pagos/checkout-creditos";
import { cobrarPublicacion, costoDePublicar, marcarPublicada } from "@/lib/celebrar/publicacion";
import { origenDeLaPeticion, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import { normalizarDocumento, type Documento } from "@/lib/celebrar/invitacion/esquema";
import { datosParaDocumento, rellenarConCelebracion } from "@/lib/celebrar/invitacion/rellenar";
import { PREFIJO_CELEBRAR, RUTA } from "@/lib/celebrar/rutas";
import { cloudflareConfigurado, configuracionCF, solicitarSubidaDirecta } from "@/lib/media/cloudflare-images";
import { urlDeEntrega } from "@/lib/solutions/fotos";
import { createClient } from "@/lib/supabase/server";

/**
 * Las acciones del editor. Todas van con el cliente de la persona: RLS
 * (`celebrar_es_duena`) decide si puede tocar esa celebración. El
 * documento se NORMALIZA en el servidor antes de guardarse — lo que
 * mande el navegador (o la IA) jamás entra crudo a la base.
 */

export type Resultado = { ok: true } | { ok: false; mensaje: string };

function revalidarPanel() {
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.editor}`, "layout");
}

/** Paso 3: elegir una plantilla. Crea (o reemplaza) el documento de la invitación a partir de ella. */
export async function elegirPlantilla(celebracionId: string, plantillaSlug: string): Promise<Resultado> {
  const [c, p] = await Promise.all([celebracionPorId(celebracionId), plantillaPorSlug(plantillaSlug)]);
  if (!c) return { ok: false, mensaje: "No encontramos esa celebración en tu cuenta." };
  if (!p) return { ok: false, mensaje: "Esa plantilla ya no está disponible." };

  const base = normalizarDocumento(p.esquema);
  const doc: Documento = rellenarConCelebracion({ ...base, plantilla: p.slug, estilo: normalizarDocumento({ estilo: p.estilos }).estilo }, datosParaDocumento(c));

  const supabase = await createClient();
  const { error } = await supabase.from("celebrar_invitaciones").upsert(
    { celebracion_id: c.id, tipo: "invitacion", contenido: doc, plantilla_slug: p.slug, version: p.version },
    { onConflict: "celebracion_id,tipo" },
  );
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };

  await supabase.from("celebrar_celebraciones").update({ plantilla_id: p.id, plantilla_version: p.version }).eq("id", c.id);
  revalidarPanel();
  return { ok: true };
}

/** Guardado del editor (autoguardado). Normaliza y escribe el documento entero. */
export async function guardarDocumento(celebracionId: string, contenido: unknown): Promise<Resultado> {
  const doc = normalizarDocumento(contenido);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_invitaciones")
    .update({ contenido: doc })
    .eq("celebracion_id", celebracionId)
    .eq("tipo", "invitacion")
    .select("id");
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };
  if (!data || data.length === 0) return { ok: false, mensaje: "No encontramos la invitación de esa celebración." };
  // Sin revalidatePath: el editor ya tiene el estado; la página pública
  // se refresca por su propio `revalidate`.
  return { ok: true };
}

export type ResumenPublicacion = {
  /** Lo que cuesta publicar AHORA, en créditos (0 si ya está pagada). */
  costo: number;
  /** Lo mismo en colones: lo único que ve la persona. */
  costoCRC: number;
  /** Si es la invitación a medida que se le pidió al equipo. */
  aMedida: boolean;
  /** Créditos a favor (regalos, recargas): se usan primero. */
  saldo: number;
  yaPagado: boolean;
  publicada: boolean;
  /** Si este servidor puede cobrar con tarjeta. */
  hayTarjeta: boolean;
};

/**
 * Lo que el editor muestra antes de publicar: cuánto cuesta ESTA
 * invitación en colones (₡7 500 de plantilla, ₡10 500 a medida), si ya
 * está pagada y si los créditos a favor alcanzan para no pasar por la
 * tarjeta. Volver a publicar tras despublicar no cobra.
 */
export async function resumenPublicacion(celebracionId: string): Promise<ResumenPublicacion | null> {
  const c = await celebracionPorId(celebracionId);
  if (!c) return null;
  const supabase = await createClient();
  const [{ costo, aMedida }, saldo] = await Promise.all([costoDePublicar(supabase, c), saldoCreditos()]);
  return {
    costo,
    costoCRC: costo * VALOR_CREDITO_CRC,
    aMedida,
    saldo,
    yaPagado: costo === 0,
    publicada: c.estado === "publicada",
    hayTarjeta: sePuedenComprarCreditos(),
  };
}

export type ResultadoPublicar = Resultado | { ok: false; mensaje: string; faltan: number; costo: number };

/**
 * Paso 7: publicar o despublicar. Publicar COBRA la invitación si no
 * estaba pagada, con los créditos a favor; si no alcanzan, devuelve
 * `faltan` y el editor ofrece pagar con tarjeta (`pagarYPublicar`).
 */
export async function cambiarPublicacion(celebracionId: string, publicar: boolean): Promise<ResultadoPublicar> {
  const supabase = await createClient();
  if (publicar) {
    const { data: inv } = await supabase.from("celebrar_invitaciones").select("id").eq("celebracion_id", celebracionId).eq("tipo", "invitacion").maybeSingle();
    if (!inv) return { ok: false, mensaje: "Elegí un diseño antes de publicar." };
    const c = await celebracionPorId(celebracionId);
    if (!c) return { ok: false, mensaje: "No encontramos esa celebración en tu cuenta." };
    const cobro = await cobrarPublicacion(supabase, c);
    if (!cobro.ok) return cobro.faltan !== undefined ? { ok: false, mensaje: cobro.mensaje, faltan: cobro.faltan, costo: cobro.costo } : { ok: false, mensaje: cobro.mensaje };
    const r = await marcarPublicada(supabase, celebracionId);
    if (!r.ok) return r;
    revalidarPanel();
    return { ok: true };
  }
  const { data, error } = await supabase.from("celebrar_celebraciones").update({ estado: "borrador" }).eq("id", celebracionId).eq("estado", "publicada").select("id");
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };
  if (!data || data.length === 0) return { ok: false, mensaje: "La celebración no está en un estado que permita ese cambio." };
  revalidarPanel();
  return { ok: true };
}

export type ResultadoPagar = { ok: true; url: string } | { ok: false; mensaje: string };

/**
 * «Publicar por ₡7 500» cuando los créditos a favor no alcanzan: abre
 * Stripe Checkout por EXACTAMENTE esta invitación. La vuelta
 * (/app/pago?c=…&accion=publicar) verifica el pago contra Stripe,
 * acredita, cobra la invitación y la publica — sin otro clic.
 */
export async function pagarYPublicar(celebracionId: string): Promise<ResultadoPagar> {
  const [sesion, c, prefijo, origen] = await Promise.all([sesionCelebrar(), celebracionPorId(celebracionId), prefijoDeLaPeticion(), origenDeLaPeticion()]);
  if (!sesion) return { ok: false, mensaje: "Se cerró tu sesión. Recargá la página." };
  if (!c) return { ok: false, mensaje: "No encontramos esa celebración en tu cuenta." };
  const supabase = await createClient();
  const { costo, aMedida } = await costoDePublicar(supabase, c);
  if (costo === 0) return { ok: false, mensaje: "Esta invitación ya está pagada: publicala directo." };
  const paquete = paquetePublico(aMedida ? "medida" : "inv");
  if (!paquete) return { ok: false, mensaje: "No pudimos calcular el precio." };
  const volverA = `${origen}${conPrefijo(RUTA.appPago, prefijo)}?c=${c.id}&accion=publicar`;
  const r = await abrirCheckoutDeCreditos({ ownerId: sesion.id, correo: sesion.email, paquete, volverA });
  return r.ok ? { ok: true, url: r.url } : { ok: false, mensaje: r.motivo };
}

/**
 * Permiso de subida a Cloudflare Images para las fotos de la invitación
 * (el mismo camino que Solutions: el archivo va directo del navegador a
 * Cloudflare, nunca por Vercel). Sin Cloudflare configurado, el uploader
 * avisa que no se puede subir — CELEBRAR no usa buckets de Supabase.
 */
export type PermisoSubida =
  | { ok: true; configurado: true; uploadURL: string; urlFinal: string }
  | { ok: true; configurado: false }
  | { ok: false; motivo: string };

export async function prepararSubidaCelebrar(): Promise<PermisoSubida> {
  if (!cloudflareConfigurado()) return { ok: true, configurado: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Se cerró tu sesión. Recargá la página." };
  const permiso = await solicitarSubidaDirecta({
    requiereFirma: false,
    expiraEnSegundos: 30 * 60,
    metadata: { producto: "celebrar", usuario: user.id },
  });
  if (!permiso.ok) return { ok: false, motivo: "No se pudo preparar la subida. Probá de nuevo en un momento." };
  const config = configuracionCF();
  if (!config.ok) return { ok: true, configurado: false };
  return {
    ok: true,
    configurado: true,
    uploadURL: permiso.valor.uploadURL,
    urlFinal: urlDeEntrega(config.valor.deliveryUrl, permiso.valor.idBorrador),
  };
}

/* ── La canción ────────────────────────────────────────────────── */

const MUSICA_MAX_BYTES = 12 * 1024 * 1024;
const MUSICA_TIPOS = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-m4a"]);

export type ResultadoMusica = { ok: true; url: string } | { ok: false; mensaje: string };

/**
 * Sube la canción de la invitación al bucket `celebrar-media` (0244), en
 * la carpeta de la celebración. Va con el cliente de la PERSONA: la
 * política del bucket comprueba que la carpeta sea una celebración suya
 * (`celebrar_carpeta_es_mia`), así que nada de service role. Devuelve la
 * URL pública, que el editor guarda en `documento.musica.url`.
 */
export async function subirMusicaCelebrar(celebracionId: string, formData: FormData): Promise<ResultadoMusica> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, mensaje: "Elegí un archivo de audio." };
  if (archivo.size > MUSICA_MAX_BYTES) return { ok: false, mensaje: "La canción pesa más de 12 MB. Probá con una versión más liviana (mp3 a 128 kbps rinde bien)." };
  const tipo = archivo.type || "audio/mpeg";
  if (!MUSICA_TIPOS.has(tipo)) return { ok: false, mensaje: "Ese formato no sirve: subí un mp3, m4a, aac, ogg o wav." };
  if (!/^[0-9a-f-]{36}$/i.test(celebracionId)) return { ok: false, mensaje: "Celebración inválida." };

  const supabase = await createClient();
  const extension = tipo === "audio/mpeg" ? "mp3" : tipo === "audio/mp4" || tipo === "audio/x-m4a" ? "m4a" : tipo.split("/")[1];
  const ruta = `${celebracionId}/musica-${Date.now().toString(36)}.${extension}`;
  const { error } = await supabase.storage.from("celebrar-media").upload(ruta, archivo, { contentType: tipo, upsert: false, cacheControl: "31536000" });
  if (error) {
    const m = /row-level security|not authorized|policy/i.test(error.message)
      ? "No tenés permiso para subir a esta celebración."
      : /Bucket not found/i.test(error.message)
        ? "Falta aplicar la migración 0244 (bucket celebrar-media)."
        : error.message;
    return { ok: false, mensaje: m };
  }
  const { data } = supabase.storage.from("celebrar-media").getPublicUrl(ruta);
  return { ok: true, url: data.publicUrl };
}
