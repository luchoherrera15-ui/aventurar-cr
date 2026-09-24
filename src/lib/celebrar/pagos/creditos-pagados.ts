import { CLAVE_PRODUCTO } from "@/lib/pagos/invitaciones-pagadas";
import { PAQUETES, PAQUETES_LEGADO, PAQUETES_PARTNER } from "@/lib/celebrar/creditos";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LA COMPRA DE CRÉDITOS DE CELEBRAR — la decisión, sin red ni base
 * ══════════════════════════════════════════════════════════════════
 *
 * Una compra de créditos es un pago SUELTO de Stripe (`mode: "payment"`)
 * que llega por el mismo webhook que las suscripciones de Lealtad y las
 * invitaciones digitales de Bookea. Lo que la distingue es la marca en
 * la metadata de la sesión: `bookea_producto = "celebrar_creditos"`.
 *
 * Acá vive lo que se puede probar sin Stripe ni Supabase: leer la sesión
 * y decidir cuántos créditos acreditar. Quien escribe en el libro
 * (`celebrar_acreditar_creditos`, con la sesión como referencia única)
 * es `acreditar.ts`, y lo llaman DOS caminos —el webhook firmado y la
 * vuelta del navegador tras verificar la sesión contra la API de
 * Stripe— sin riesgo de duplicar: la referencia única lo impide.
 */

export const PRODUCTO_CELEBRAR_CREDITOS = "celebrar_creditos";
export const CLAVE_DUENO = "celebrar_owner_id";
export const CLAVE_PAQUETE = "celebrar_paquete";
export const CLAVE_CREDITOS = "celebrar_creditos";
/** El precio en colones que el servidor calculó al abrir la sesión (los paquetes partner varían por descuento). */
export const CLAVE_PRECIO = "celebrar_precio_crc";

export type PaqueteId = (typeof PAQUETES)[number]["id"] | (typeof PAQUETES_LEGADO)[number]["id"] | (typeof PAQUETES_PARTNER)[number]["id"];

export type DatosPagoCreditos = {
  sesionStripe: string;
  ownerId: string;
  paqueteId: string;
  /** Los créditos que la sesión dice (los escribió el servidor al abrirla). */
  creditos: number;
  /** Lo cobrado según Stripe, en la unidad menor (céntimos de colón). */
  cobrado: number | null;
  moneda: string | null;
  pagado: boolean;
  /** Lo que el servidor esperaba cobrar, en colones (null en sesiones viejas). */
  precioEsperadoCrc: number | null;
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** El paquete del catálogo (público o partner) por id; el partner no trae precio fijo. */
export function paquetePorId(id: string | null | undefined): { id: string; creditos: number; precioCRC: number | null; partner: boolean } | null {
  // Los de hoy y los que se vendieron antes (un pago viejo puede llegar tarde).
  const pub = PAQUETES.find((p) => p.id === id) ?? PAQUETES_LEGADO.find((p) => p.id === id);
  if (pub) return { id: pub.id, creditos: pub.creditos, precioCRC: pub.precioCRC, partner: false };
  const par = PAQUETES_PARTNER.find((p) => p.id === id);
  if (par) return { id: par.id, creditos: par.creditos, precioCRC: null, partner: true };
  return null;
}

/**
 * Lee una sesión de Checkout. null = no es una compra de créditos de
 * CELEBRAR (es de Lealtad, de invitaciones, o de nadie).
 */
export function datosDePagoDeCreditos(sesion: Record<string, unknown>): DatosPagoCreditos | null {
  const meta = objeto(sesion.metadata) ?? {};
  if (texto(meta[CLAVE_PRODUCTO]) !== PRODUCTO_CELEBRAR_CREDITOS) return null;

  const sesionStripe = texto(sesion.id);
  // `client_reference_id` como respaldo del dueño: van los dos por si
  // un solo campo perdido dejara un cobro sin cuenta a la que acreditar.
  const ownerId = texto(meta[CLAVE_DUENO]) ?? texto(sesion.client_reference_id);
  const paqueteId = texto(meta[CLAVE_PAQUETE]);
  const creditos = Number(texto(meta[CLAVE_CREDITOS]));
  if (!sesionStripe || !ownerId || !paqueteId || !Number.isInteger(creditos) || creditos <= 0) return null;

  const precio = Number(texto(meta[CLAVE_PRECIO]));
  return {
    sesionStripe,
    ownerId,
    paqueteId,
    creditos,
    precioEsperadoCrc: Number.isInteger(precio) && precio > 0 ? precio : null,
    cobrado: numero(sesion.amount_total),
    moneda: texto(sesion.currency)?.toLowerCase() ?? null,
    // "paid" y nada más: "unpaid" es un medio diferido que todavía no
    // acreditó (llega después como async_payment_succeeded).
    pagado: texto(sesion.payment_status) === "paid",
  };
}

export type VeredictoAcreditacion =
  /** Acreditar estos créditos, con este monto en colones en el libro. */
  | { estado: "acreditar"; creditos: number; montoCrc: number | null; aviso: string | null }
  | { estado: "ignorar"; motivo: "sin_cobrar" };

/**
 * Cuántos créditos acreditar por esta sesión.
 *
 * Los créditos salen del PAQUETE del catálogo (la fuente de verdad del
 * precio), no de la metadata: si un día cambia un paquete entre que se
 * abrió la sesión y llegó el pago, manda lo que se cobró. Si el monto
 * cobrado no cuadra con el paquete, igual se acredita —la plata entró y
 * no reconocerla sería lo peor— pero con un aviso al equipo.
 */
export function decidirAcreditacion(pago: DatosPagoCreditos): VeredictoAcreditacion {
  if (!pago.pagado) return { estado: "ignorar", motivo: "sin_cobrar" };

  const paquete = paquetePorId(pago.paqueteId);
  const creditos = paquete?.creditos ?? pago.creditos;
  const montoCrc = pago.cobrado !== null && pago.moneda === "crc" ? Math.round(pago.cobrado / 100) : null;

  // Lo que DEBÍA cobrarse: el precio fijo del paquete público, o el que
  // el servidor calculó para el partner (viaja en la sesión).
  const esperado = paquete?.precioCRC ?? pago.precioEsperadoCrc;
  let aviso: string | null = null;
  if (!paquete) {
    aviso = `El paquete «${pago.paqueteId}» ya no existe en el catálogo; se acreditaron los ${creditos} créditos que decía la sesión.`;
  } else if (pago.moneda !== "crc") {
    aviso = `Se cobró en «${pago.moneda ?? "?"}» y no en colones.`;
  } else if (montoCrc !== null && esperado !== null && montoCrc !== esperado) {
    aviso = `Se cobraron ₡${montoCrc.toLocaleString("es-CR")} y el paquete ${paquete.id} valía ₡${esperado.toLocaleString("es-CR")}.`;
  }

  return { estado: "acreditar", creditos, montoCrc, aviso };
}

/** El texto del movimiento en el libro. */
export function conceptoDeCompra(pago: DatosPagoCreditos, creditos: number): string {
  const paquete = paquetePorId(pago.paqueteId);
  if (!paquete) return `Compra de ${creditos} créditos (tarjeta)`;
  if (paquete.partner) return `Paquete partner de ${paquete.creditos.toLocaleString("es-CR")} créditos (tarjeta)`;
  if (paquete.id === "inv") return "Pago de la invitación de plantilla (tarjeta)";
  if (paquete.id === "medida") return "Pago de la invitación a medida (tarjeta)";
  if (paquete.id === "ia") return `Créditos para la IA: ${paquete.creditos} (tarjeta)`;
  return `Paquete de ${paquete.creditos} créditos (tarjeta)`;
}
