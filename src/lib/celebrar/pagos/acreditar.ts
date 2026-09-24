import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { conceptoDeCompra, decidirAcreditacion, type DatosPagoCreditos } from "./creditos-pagados";

/**
 * ESCRIBIR LA COMPRA EN EL LIBRO — el único lugar que lo hace.
 *
 * Lo llaman dos caminos, y los dos pueden llegar por la misma compra:
 *   · el webhook de Stripe (`checkout.session.completed`), firmado;
 *   · la vuelta del navegador a /app/creditos?pago=listo&sesion=…, que
 *     NO le cree a la URL: va a la API de Stripe con la llave secreta,
 *     lee la sesión y comprueba que está pagada y que es de quien mira.
 *
 * La referencia del movimiento es la sesión de Stripe y el índice es
 * único: el segundo que llegue recibe `false` y no escribe nada. Por eso
 * el navegador puede acreditar al instante sin esperar el webhook, y el
 * webhook sigue siendo la red de seguridad si la persona cerró la pestaña.
 */
export type ResultadoAcreditacion =
  | { tipo: "acreditado"; creditos: number; aviso: string | null }
  | { tipo: "ya_acreditado"; creditos: number }
  | { tipo: "sin_cobrar" }
  | { tipo: "sin_base" };

export async function acreditarCompraDeCreditos(pago: DatosPagoCreditos): Promise<ResultadoAcreditacion> {
  const veredicto = decidirAcreditacion(pago);
  if (veredicto.estado === "ignorar") return { tipo: "sin_cobrar" };

  const db = createAdminClient();
  if (!db) return { tipo: "sin_base" };

  const { data, error } = await db.rpc("celebrar_acreditar_creditos", {
    p_owner: pago.ownerId,
    p_cantidad: veredicto.creditos,
    p_tipo: "compra",
    p_concepto: conceptoDeCompra(pago, veredicto.creditos),
    p_referencia: pago.sesionStripe,
    p_monto_crc: veredicto.montoCrc,
  });
  // Un error de base LANZA: el webhook devuelve 500 y Stripe reintenta;
  // la vuelta del navegador muestra «ya casi» y el webhook lo resuelve.
  if (error) throw new Error(`celebrar_acreditar_creditos: ${error.message}`);

  return data === true
    ? { tipo: "acreditado", creditos: veredicto.creditos, aviso: veredicto.aviso }
    : { tipo: "ya_acreditado", creditos: veredicto.creditos };
}
