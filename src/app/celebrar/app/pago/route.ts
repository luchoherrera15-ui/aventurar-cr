import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { celebracionPorId } from "@/lib/celebrar/datos";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { acreditarCompraDeCreditos } from "@/lib/celebrar/pagos/acreditar";
import { leerSesionDeCompra } from "@/lib/celebrar/pagos/checkout-creditos";
import { cobrarPublicacion, marcarPublicada } from "@/lib/celebrar/publicacion";
import { PREFIJO_CELEBRAR, RUTA, rutaEditor, rutaFicha } from "@/lib/celebrar/rutas";
import { origenDeLaPeticion, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import { createClient } from "@/lib/supabase/server";

/**
 * LA VUELTA DE STRIPE AL PAGAR UNA INVITACIÓN.
 *
 *   /app/pago?c=<celebración>&accion=publicar|medida&pago=listo&sesion=cs_…
 *
 * No le cree a la URL: pide la sesión a Stripe con la llave secreta y
 * comprueba que es de CELEBRAR, que está pagada y que es de quien vuelve.
 * Recién ahí acredita (idempotente: si el webhook llegó antes, no
 * duplica), cobra la invitación con esos créditos y —si venía de
 * «Publicar»— la publica. Termina en el editor (publicar) o en la ficha
 * (a medida) con `?pago=ok|pendiente|cancelado|error`.
 *
 * Si la persona cierra la pestaña en Stripe, el webhook igual acredita:
 * los créditos quedan a favor y el próximo «Publicar» los usa sin
 * volver a pasar por la tarjeta.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const [prefijo, origen] = await Promise.all([prefijoDeLaPeticion(), origenDeLaPeticion()]);
  const ir = (ruta: string, estado: string) => NextResponse.redirect(`${origen}${conPrefijo(ruta, prefijo)}?pago=${estado}`, 303);

  const id = q.get("c") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return ir(RUTA.appCreditos, "error");
  const accion = q.get("accion") === "medida" ? "medida" : "publicar";
  const destino = accion === "medida" ? rutaFicha(id) : rutaEditor(id);

  if (q.get("pago") === "cancelado") return ir(destino, "cancelado");

  const sesion = await sesionCelebrar();
  if (!sesion) return NextResponse.redirect(`${origen}${conPrefijo(RUTA.entrar, prefijo)}`, 303);

  const pago = await leerSesionDeCompra(q.get("sesion") ?? "", sesion.id);
  if (!pago) return ir(destino, "error");
  if (!pago.pagado) return ir(destino, "pendiente");
  try {
    await acreditarCompraDeCreditos(pago);
  } catch (e) {
    console.error("[celebrar] La vuelta del pago de invitación no pudo acreditar; el webhook reintenta:", e);
    return ir(destino, "pendiente");
  }

  const c = await celebracionPorId(id);
  if (!c) return ir(RUTA.appCreditos, "error");
  const supabase = await createClient();
  const cobro = await cobrarPublicacion(supabase, c);
  if (!cobro.ok) return ir(destino, "pendiente");
  if (accion === "publicar" && c.estado === "borrador") {
    const r = await marcarPublicada(supabase, id);
    if (!r.ok) return ir(destino, "pendiente");
  }

  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.editor}`, "layout");
  return ir(destino, "ok");
}
