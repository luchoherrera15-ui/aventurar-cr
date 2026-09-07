"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { configMeta } from "@/lib/instagram/config";
import { cuentaConToken, cuentaDelNegocio, desconectarCuenta, marcarEstadoCuenta, refrescarSiToca } from "@/lib/instagram/cuentas";
import { publicacionesInstagram, suscribirComentarios } from "@/lib/instagram/meta";
import { validarMensajePrivado, validarMensajePublico } from "@/lib/instagram/mensaje";
import { normalizarTexto, sanearPalabras } from "@/lib/instagram/coincidencia";
import { disparadorDe, EXPLICACION_ERROR, modoCoincidenciaDe, TOPES_IG, type PublicacionIg } from "@/lib/instagram/tipos";

/**
 * LAS ACCIONES DE INSTAGRAM — todas detrás de la misma puerta que el
 * resto del panel (`verificarAccesoSolutions` + `puedeEditar`) y todas
 * con la llave de servicio: la RLS no da escritura a nadie más.
 *
 * Ninguna devuelve un token. `listarPublicacionesIg` lo usa en el
 * servidor y devuelve solo la lista.
 */

type R = { ok: true } | { ok: false; motivo: string };

async function portonEditar(negocioId: string) {
  const acceso = await verificarAccesoSolutions(negocioId);
  if (!acceso.ok) return { ok: false as const, motivo: acceso.user ? acceso.motivo : "Iniciá sesión." };
  if (!acceso.puedeEditar) return { ok: false as const, motivo: "Tu rol solo permite atender comandas." };
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, motivo: "Falta la llave de servicio." };
  const cfg = configMeta();
  if (!cfg) return { ok: false as const, motivo: "Instagram no está configurado en el servidor." };
  return { ok: true as const, admin, cfg, acceso };
}

function refrescar(negocioId: string) {
  revalidatePath(`/solutions/panel/${negocioId}/instagram`);
}

const ID_MEDIA = /^[0-9]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las publicaciones de la cuenta, para elegir una. */
export async function listarPublicacionesIg(negocioId: string): Promise<{ ok: true; publicaciones: PublicacionIg[] } | { ok: false; motivo: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const c = await cuentaConToken(p.admin, p.cfg, negocioId);
  if (!c || !c.cuenta.activa || c.cuenta.estado === "desconectada") return { ok: false, motivo: "Primero conectá tu Instagram." };
  if (!c.token) return { ok: false, motivo: EXPLICACION_ERROR.token_vencido };
  const r = await publicacionesInstagram(p.cfg, c.cuenta.ig_user_id, c.token, 30);
  if (!r.ok) {
    if (r.error.codigo === "token_vencido" || r.error.codigo === "permisos") {
      await marcarEstadoCuenta(p.admin, c.cuenta.id, "reconectar", r.error.mensaje);
      refrescar(negocioId);
    }
    return { ok: false, motivo: EXPLICACION_ERROR[r.error.codigo] };
  }
  return { ok: true, publicaciones: r.data };
}

export type DatosAutomatizacion = {
  id?: string | null;
  nombre: string;
  mediaId: string;
  mediaPermalink?: string | null;
  mediaResumen?: string | null;
  mediaMiniaturaUrl?: string | null;
  disparador: string;
  modo: string;
  palabras: string[];
  mensajePrivado: string;
  enlace: string;
  respuestaPublica: boolean;
  mensajePublico: string;
};

function urlHttps(v: string | null | undefined, max = 500): string | null {
  const s = (v ?? "").trim();
  return s.startsWith("https://") && s.length <= max ? s : null;
}

export async function guardarAutomatizacionIg(negocioId: string, d: DatosAutomatizacion): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const cuenta = await cuentaDelNegocio(p.admin, negocioId);
  if (!cuenta || !cuenta.activa || cuenta.estado === "desconectada") return { ok: false, motivo: "Primero conectá tu Instagram." };

  const nombre = (d.nombre ?? "").trim().slice(0, TOPES_IG.nombre);
  if (nombre.length < 1) return { ok: false, motivo: "Ponele un nombre a la automatización." };
  const mediaId = (d.mediaId ?? "").trim();
  if (!ID_MEDIA.test(mediaId)) return { ok: false, motivo: "Elegí la publicación (o pegá su ID numérico)." };
  const disparador = disparadorDe(d.disparador);
  const modo = modoCoincidenciaDe(d.modo);
  const palabras = sanearPalabras(Array.isArray(d.palabras) ? d.palabras : [], TOPES_IG.palabras, TOPES_IG.palabra);
  if (disparador === "palabra" && palabras.length === 0) return { ok: false, motivo: "Agregá al menos una palabra clave, o elegí «cualquier comentario»." };

  const privado = validarMensajePrivado(d.mensajePrivado, d.enlace);
  if (!privado.ok) return { ok: false, motivo: privado.motivo };
  let mensajePublico: string | null = null;
  if (d.respuestaPublica) {
    const pub = validarMensajePublico(d.mensajePublico);
    if (!pub.ok) return { ok: false, motivo: pub.motivo };
    mensajePublico = pub.texto;
  }

  const fila = {
    negocio_id: negocioId,
    cuenta_id: cuenta.id,
    nombre,
    media_id: mediaId,
    media_permalink: urlHttps(d.mediaPermalink),
    media_resumen: (d.mediaResumen ?? "").trim().slice(0, TOPES_IG.mediaResumen) || null,
    media_miniatura_url: urlHttps(d.mediaMiniaturaUrl, 1000),
    disparador,
    modo_coincidencia: modo,
    mensaje_privado: (d.mensajePrivado ?? "").trim(),
    enlace: privado.enlace,
    respuesta_publica: d.respuestaPublica === true,
    mensaje_publico: mensajePublico,
    actualizada_en: new Date().toISOString(),
  };

  let id = (d.id ?? "").trim();
  if (id) {
    if (!UUID.test(id)) return { ok: false, motivo: "Automatización inválida." };
    const { data, error } = await p.admin
      .from("solutions_instagram_automatizaciones")
      .update(fila)
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, motivo: "No se pudo guardar la automatización." };
  } else {
    const { data, error } = await p.admin.from("solutions_instagram_automatizaciones").insert(fila).select("id").single();
    if (error || !data) return { ok: false, motivo: "No se pudo crear la automatización." };
    id = String(data.id);
  }

  // Las palabras se reemplazan enteras: es la lista que la persona ve.
  await p.admin.from("solutions_instagram_palabras").delete().eq("automatizacion_id", id);
  if (palabras.length > 0) {
    const { error } = await p.admin
      .from("solutions_instagram_palabras")
      .insert(palabras.map((palabra) => ({ automatizacion_id: id, palabra, palabra_normalizada: normalizarTexto(palabra) })));
    if (error) return { ok: false, motivo: "La automatización quedó, pero las palabras no se guardaron. Editala y volvé a intentar." };
  }

  refrescar(negocioId);
  return { ok: true, id };
}

export async function activarAutomatizacionIg(negocioId: string, id: string, activa: boolean): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  if (!UUID.test(id)) return { ok: false, motivo: "Automatización inválida." };
  const { error } = await p.admin
    .from("solutions_instagram_automatizaciones")
    .update({ activa: activa === true, actualizada_en: new Date().toISOString() })
    .eq("id", id)
    .eq("negocio_id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo cambiar el estado." };
  refrescar(negocioId);
  return { ok: true };
}

export async function borrarAutomatizacionIg(negocioId: string, id: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  if (!UUID.test(id)) return { ok: false, motivo: "Automatización inválida." };
  const { error } = await p.admin.from("solutions_instagram_automatizaciones").delete().eq("id", id).eq("negocio_id", negocioId);
  if (error) return { ok: false, motivo: "No se pudo borrar." };
  refrescar(negocioId);
  return { ok: true };
}

/** Apaga la cuenta y borra el token. Las automatizaciones quedan, pausadas de hecho. */
export async function desconectarInstagramIg(negocioId: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  if (!(await desconectarCuenta(p.admin, negocioId))) return { ok: false, motivo: "No se pudo desconectar." };
  refrescar(negocioId);
  return { ok: true };
}

/** Vuelve a pedirle a Meta que mande los comentarios de esta cuenta al webhook. */
export async function reintentarSuscripcionIg(negocioId: string): Promise<R> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const c = await cuentaConToken(p.admin, p.cfg, negocioId);
  if (!c || !c.token) return { ok: false, motivo: EXPLICACION_ERROR.token_vencido };
  const r = await suscribirComentarios(p.cfg, c.token);
  const ahora = new Date().toISOString();
  if (!r.ok) {
    await p.admin
      .from("solutions_instagram_cuentas")
      .update({ suscrito_webhook: false, estado_nota: `No se pudo suscribir al webhook: ${r.error.mensaje}`.slice(0, 300), actualizada_en: ahora })
      .eq("id", c.cuenta.id);
    refrescar(negocioId);
    return { ok: false, motivo: EXPLICACION_ERROR[r.error.codigo] };
  }
  await p.admin.from("solutions_instagram_cuentas").update({ suscrito_webhook: true, estado_nota: null, actualizada_en: ahora }).eq("id", c.cuenta.id);
  refrescar(negocioId);
  return { ok: true };
}

export async function refrescarTokenIg(negocioId: string): Promise<{ ok: true; resultado: string } | { ok: false; motivo: string }> {
  const p = await portonEditar(negocioId);
  if (!p.ok) return p;
  const cuenta = await cuentaDelNegocio(p.admin, negocioId);
  if (!cuenta) return { ok: false, motivo: "No hay cuenta conectada." };
  const r = await refrescarSiToca(p.admin, p.cfg, cuenta.id);
  refrescar(negocioId);
  if (r === "error") return { ok: false, motivo: "Instagram no pudo refrescar el token. Si venció, reconectá la cuenta." };
  if (r === "sin_token") return { ok: false, motivo: EXPLICACION_ERROR.token_vencido };
  return { ok: true, resultado: r === "refrescado" ? "Token renovado por 60 días más." : "El token todavía no necesita refresco." };
}
