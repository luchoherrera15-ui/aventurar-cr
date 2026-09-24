import "server-only";
import { saldoCreditos } from "@/lib/celebrar/datos";
import type { Celebracion } from "@/lib/celebrar/tipos";
import { creditosDePublicar, leerPago } from "@/lib/celebrar/creditos";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import type { createClient } from "@/lib/supabase/server";

/**
 * ══════════════════════════════════════════════════════════════════
 *  COBRAR Y PUBLICAR UNA INVITACIÓN — el único lugar que lo decide
 * ══════════════════════════════════════════════════════════════════
 *
 * Desde el 24 sep 2026 la gente paga POR INVITACIÓN: ₡7 500 la de
 * plantilla (se cobra al publicar) y ₡10 500 la a medida (se cobra al
 * pedírsela al equipo). Por dentro sigue siendo el libro de créditos
 * (0245): el pago con tarjeta acredita exactamente esa cantidad y acá
 * se consume para ESTA celebración.
 *
 * Lo llaman el botón «Publicar» del editor y la vuelta de Stripe
 * (/app/pago): los dos pueden llegar por la misma invitación, y por eso
 * la regla de oro es que una celebración PAGADA no se cobra nunca más
 * —ni al despublicar y volver a publicar, ni si se pagó con los precios
 * viejos de WhatsApp/panel—.
 */

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Si la persona le pidió al equipo esta invitación a medida (0249, alcance «a_medida»). */
export async function esAMedida(supabase: Supa, celebracionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("celebrar_ayuda_diseno")
    .select("id")
    .eq("celebracion_id", celebracionId)
    .eq("alcance", "a_medida")
    .limit(1);
  return !!data && data.length > 0;
}

export type Cobro =
  | { ok: true; cobrado: number }
  | { ok: false; mensaje: string; faltan: number; costo: number }
  | { ok: false; mensaje: string; faltan?: undefined; costo?: undefined };

/**
 * Lo que cuesta publicar ESTA celebración ahora, en créditos: 0 si ya
 * está pagada; si no, el precio de plantilla o el de a medida.
 */
export async function costoDePublicar(supabase: Supa, c: Pick<Celebracion, "id" | "pago_publicacion">): Promise<{ costo: number; aMedida: boolean }> {
  const aMedida = await esAMedida(supabase, c.id);
  const pago = leerPago(c.pago_publicacion);
  // Pagada = no se cobra más. La excepción: la publicó de plantilla y
  // DESPUÉS pidió que el equipo se la haga a medida; eso es un servicio
  // aparte y se cobra entero.
  if (pago && (pago.plan === "medida" || !aMedida)) return { costo: 0, aMedida };
  return { costo: creditosDePublicar(aMedida), aMedida };
}

/** Descuenta del saldo lo que cuesta la invitación (si no estaba pagada) y la marca pagada. */
export async function cobrarPublicacion(supabase: Supa, c: Pick<Celebracion, "id" | "pago_publicacion">): Promise<Cobro> {
  const { costo, aMedida } = await costoDePublicar(supabase, c);
  if (costo === 0) return { ok: true, cobrado: 0 };

  const { error } = await supabase.rpc("celebrar_consumir_creditos", {
    p_celebracion: c.id,
    p_concepto: aMedida ? "Invitación a medida, diseñada por el equipo" : "Publicar la invitación de plantilla",
    p_cantidad: costo,
    p_referencia: null,
  });
  if (error) {
    if (/Saldo insuficiente/i.test(error.message)) {
      const saldo = await saldoCreditos();
      return { ok: false, mensaje: "Falta el pago de la invitación.", faltan: costo - saldo, costo };
    }
    return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };
  }
  await supabase
    .from("celebrar_celebraciones")
    .update({ pago_publicacion: { plan: aMedida ? "medida" : "plantilla", creditos: (leerPago(c.pago_publicacion)?.creditos ?? 0) + costo, en: new Date().toISOString() } })
    .eq("id", c.id);
  return { ok: true, cobrado: costo };
}

/** Pasa la celebración a publicada (solo desde borrador). */
export async function marcarPublicada(supabase: Supa, celebracionId: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("celebrar_celebraciones")
    .update({ estado: "publicada", publicada_en: ahora })
    .eq("id", celebracionId)
    .eq("estado", "borrador")
    .select("id");
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };
  if (!data || data.length === 0) return { ok: false, mensaje: "La celebración no está en un estado que permita publicarla." };
  await supabase.from("celebrar_invitaciones").update({ publicada_en: ahora }).eq("celebracion_id", celebracionId).eq("tipo", "invitacion");
  return { ok: true };
}
