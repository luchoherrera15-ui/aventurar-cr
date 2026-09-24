"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { celebracionPorId, invitacionDe } from "@/lib/celebrar/datos";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import { normalizarDocumento } from "@/lib/celebrar/invitacion/esquema";
import { datosParaDocumento, rellenarConCelebracion } from "@/lib/celebrar/invitacion/rellenar";
import { TIPOS_PARTNER, miPartner, partnerAprobado, plantillaPartnerPorId } from "@/lib/celebrar/partners";
import { PREFIJO_CELEBRAR, RUTA, rutaEditor } from "@/lib/celebrar/rutas";
import { slugify } from "@/lib/slug";
import { prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import { createClient } from "@/lib/supabase/server";

type Resultado = { ok: true } | { ok: false; mensaje: string };

function texto(v: FormDataEntryValue | null, max: number): string | null {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

/** Lo que la persona puede escribir de su ficha (las columnas del equipo quedan afuera). */
function fichaDelFormulario(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "planner");
  const instagram = texto(formData.get("instagram"), 30)?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "") ?? null;
  let sitio = texto(formData.get("sitio"), 200);
  if (sitio && !/^https?:\/\//i.test(sitio)) sitio = `https://${sitio}`;
  const eventos = Number(formData.get("eventos_por_anio"));
  return {
    nombre_comercial: texto(formData.get("nombre_comercial"), 80) ?? "",
    tipo: TIPOS_PARTNER.some(([id]) => id === tipo) ? tipo : "planner",
    ciudad: texto(formData.get("ciudad"), 80),
    sitio,
    instagram,
    whatsapp: texto(formData.get("whatsapp"), 20),
    descripcion: texto(formData.get("descripcion"), 600),
    eventos_por_anio: Number.isInteger(eventos) && eventos >= 0 ? eventos : null,
    marca_en_invitaciones: formData.get("marca_en_invitaciones") !== "off",
    mostrar_en_directorio: formData.get("mostrar_en_directorio") !== "off",
  };
}

function revalidarPartner() {
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.appPartner}`);
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
}

/** Aplicar al programa: crea la ficha en `pendiente`. */
export async function aplicarComoPartner(formData: FormData): Promise<void> {
  const [sesion, prefijo] = await Promise.all([sesionCelebrar(), prefijoDeLaPeticion()]);
  const volver = conPrefijo(RUTA.appPartner, prefijo);
  if (!sesion) redirect(conPrefijo(RUTA.entrar, prefijo));
  const ficha = fichaDelFormulario(formData);
  if (ficha.nombre_comercial.length < 2) redirect(`${volver}?aviso=${encodeURIComponent("Contanos el nombre de tu negocio.")}`);

  const supabase = await createClient();
  const slug = slugify(ficha.nombre_comercial).slice(0, 60) || null;
  const { error } = await supabase.from("celebrar_partners").insert({ id: sesion.id, ...ficha, slug });
  if (error) {
    // El slug ya lo usa otro partner: sin slug (se puede fijar después).
    if (error.code === "23505" && /slug/.test(error.message)) {
      const { error: e2 } = await supabase.from("celebrar_partners").insert({ id: sesion.id, ...ficha, slug: null });
      if (!e2) {
        revalidarPartner();
        redirect(`${volver}?aviso=${encodeURIComponent("¡Solicitud recibida! La revisamos en menos de 48 horas.")}`);
      }
    }
    redirect(`${volver}?aviso=${encodeURIComponent(traducirErrorDeBase(error.message, error.code).mensaje ?? error.message)}`);
  }
  revalidarPartner();
  redirect(`${volver}?aviso=${encodeURIComponent("¡Solicitud recibida! La revisamos en menos de 48 horas y te avisamos por correo.")}`);
}

/** El partner edita lo suyo (estado y descuento los toca solo el equipo). */
export async function actualizarFichaPartner(formData: FormData): Promise<void> {
  const [sesion, prefijo, actual] = await Promise.all([sesionCelebrar(), prefijoDeLaPeticion(), miPartner()]);
  const volver = conPrefijo(RUTA.appPartner, prefijo);
  if (!sesion || !actual) redirect(volver);
  const ficha = fichaDelFormulario(formData);
  if (ficha.nombre_comercial.length < 2) redirect(`${volver}?aviso=${encodeURIComponent("El nombre del negocio no puede quedar vacío.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("celebrar_partners").update(ficha).eq("id", sesion.id);
  if (error) redirect(`${volver}?aviso=${encodeURIComponent(traducirErrorDeBase(error.message, error.code).mensaje ?? error.message)}`);
  revalidarPartner();
  redirect(`${volver}?aviso=${encodeURIComponent("Ficha guardada.")}`);
}

/**
 * GUARDAR UNA INVITACIÓN COMO PLANTILLA PROPIA: el documento tal cual
 * (estilo + secciones), para arrancar la próxima celebración con el
 * estilo de la casa. Solo partners aprobados.
 */
export async function guardarComoPlantillaPartner(celebracionId: string, nombre: string): Promise<Resultado> {
  const partner = await partnerAprobado();
  if (!partner) return { ok: false, mensaje: "Las plantillas propias son del programa de partners." };
  const [c, inv] = await Promise.all([celebracionPorId(celebracionId), invitacionDe(celebracionId)]);
  if (!c || !inv) return { ok: false, mensaje: "No encontramos esa invitación." };
  const limpio = nombre.trim().slice(0, 80) || `Plantilla de ${c.nombre}`;
  const supabase = await createClient();
  const { error } = await supabase.from("celebrar_partner_plantillas").insert({
    partner_id: partner.id,
    nombre: limpio,
    tipo: c.tipo,
    documento: normalizarDocumento(inv.contenido),
  });
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };
  revalidarPartner();
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.appPlantillas}`);
  return { ok: true };
}

export async function borrarPlantillaPartner(formData: FormData): Promise<void> {
  const [sesion, prefijo] = await Promise.all([sesionCelebrar(), prefijoDeLaPeticion()]);
  const volver = conPrefijo(RUTA.appPartner, prefijo);
  if (!sesion) redirect(volver);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("celebrar_partner_plantillas").delete().eq("id", id).eq("partner_id", sesion.id);
  revalidarPartner();
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.appPlantillas}`);
  redirect(volver);
}

/**
 * USAR UNA PLANTILLA PROPIA en una celebración: copia el documento y
 * lo rellena con los datos de la celebración (nombre, fecha, lugar).
 * Después, al editor.
 */
export async function usarPlantillaPartner(celebracionId: string, plantillaId: string): Promise<Resultado> {
  const [c, p] = await Promise.all([celebracionPorId(celebracionId), plantillaPartnerPorId(plantillaId)]);
  if (!c) return { ok: false, mensaje: "No encontramos esa celebración en tu cuenta." };
  if (!p) return { ok: false, mensaje: "Esa plantilla ya no existe." };
  const doc = rellenarConCelebracion({ ...normalizarDocumento(p.documento), plantilla: `partner:${p.id}` }, datosParaDocumento(c));
  const supabase = await createClient();
  const { error } = await supabase.from("celebrar_invitaciones").upsert(
    { celebracion_id: c.id, tipo: "invitacion", contenido: doc, plantilla_slug: null, version: 1 },
    { onConflict: "celebracion_id,tipo" },
  );
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
  return { ok: true };
}

export async function usarPlantillaPartnerYEditar(formData: FormData): Promise<void> {
  const prefijo = await prefijoDeLaPeticion();
  const celebracionId = String(formData.get("celebracion") ?? "");
  const plantillaId = String(formData.get("plantilla") ?? "");
  const r = await usarPlantillaPartner(celebracionId, plantillaId);
  if (!r.ok) redirect(`${conPrefijo(RUTA.appPartner, prefijo)}?aviso=${encodeURIComponent(r.mensaje)}`);
  redirect(conPrefijo(rutaEditor(celebracionId), prefijo));
}
