"use server";

import { redirect } from "next/navigation";
import { acreditarCompraDeCreditos, type ResultadoAcreditacion } from "@/lib/celebrar/pagos/acreditar";
import { abrirCheckoutDeCreditos, leerSesionDeCompra } from "@/lib/celebrar/pagos/checkout-creditos";
import { paqueteDePartner, paquetePublico } from "@/lib/celebrar/creditos";
import { partnerAprobado } from "@/lib/celebrar/partners";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { origenDeLaPeticion, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";

/**
 * COMPRAR UN PAQUETE: abre Stripe Checkout y manda al navegador ahí.
 *
 * Del formulario solo llega el id del paquete; el dueño, el correo y la
 * URL de vuelta los pone el servidor. Si no se pudo abrir (sin Stripe en
 * este servidor, paquete inexistente), vuelve a /app/creditos con el
 * motivo en la URL para mostrarlo.
 */
export async function comprarCreditos(formData: FormData): Promise<void> {
  const [sesion, prefijo, origen] = await Promise.all([sesionCelebrar(), prefijoDeLaPeticion(), origenDeLaPeticion()]);
  const volver = `${origen}${conPrefijo(RUTA.appCreditos, prefijo)}`;
  if (!sesion) redirect(conPrefijo(RUTA.entrar, prefijo));

  const paqueteId = String(formData.get("paquete") ?? "");
  // Público, o mayorista si la cuenta es un partner APROBADO (el precio
  // sale de su descuento, que fijó el equipo; nunca del formulario).
  let paquete = paquetePublico(paqueteId);
  if (!paquete) {
    const partner = await partnerAprobado();
    if (partner) paquete = paqueteDePartner(paqueteId, partner.descuento_pct);
  }
  if (!paquete) redirect(`${volver}?pago=error&motivo=${encodeURIComponent("Ese paquete no existe o no está disponible para tu cuenta.")}`);

  const r = await abrirCheckoutDeCreditos({ ownerId: sesion.id, correo: sesion.email, paquete, volverA: volver });
  if (!r.ok) redirect(`${volver}?pago=error&motivo=${encodeURIComponent(r.motivo)}`);
  redirect(r.url);
}

export type EstadoDeVuelta =
  | { tipo: "acreditado"; creditos: number }
  | { tipo: "ya_estaba"; creditos: number }
  | { tipo: "pendiente" }
  | { tipo: "no_es_tuya" };

/**
 * LA VUELTA DESDE STRIPE (`?pago=listo&sesion=cs_…`).
 *
 * No le cree a la URL: pide la sesión a Stripe con la llave secreta,
 * comprueba que es una compra de créditos de CELEBRAR, pagada y de la
 * cuenta que está mirando, y recién ahí acredita — con la sesión como
 * referencia única, así que si el webhook llegó antes no duplica.
 */
export async function confirmarVueltaDeStripe(sesionId: string): Promise<EstadoDeVuelta> {
  const sesion = await sesionCelebrar();
  if (!sesion) return { tipo: "no_es_tuya" };
  const pago = await leerSesionDeCompra(sesionId, sesion.id);
  if (!pago) return { tipo: "no_es_tuya" };
  if (!pago.pagado) return { tipo: "pendiente" };

  let r: ResultadoAcreditacion;
  try {
    r = await acreditarCompraDeCreditos(pago);
  } catch (e) {
    console.error("[celebrar] La vuelta de Stripe no pudo acreditar; el webhook lo va a reintentar:", e);
    return { tipo: "pendiente" };
  }
  if (r.tipo === "acreditado") return { tipo: "acreditado", creditos: r.creditos };
  if (r.tipo === "ya_acreditado") return { tipo: "ya_estaba", creditos: r.creditos };
  return { tipo: "pendiente" };
}
