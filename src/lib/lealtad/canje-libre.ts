import { formatearCRC } from "../dinero";
import { traducirMotivo } from "./mostrador";
import type { ConfigBeneficio } from "./tipos-tarjeta";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL CASHBACK SE USA EN EL MONTO QUE EL CLIENTE QUIERA (0253)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (2 oct 2026, desde Foorkie): «¿la tarjeta del cashback
 * cómo está funcionando, que veo que dice algo de 1000? La forma correcta
 * es que uno acumule cashback y cuando la persona desee canjear, lo hará».
 *
 * Hasta acá el cashback se usaba en TRAMOS: `canjear_recompensa` descuenta
 * un costo FIJO, así que la tarjeta nacía con la recompensa «₡1 000 de tu
 * cashback» (`TRAMO_CASHBACK`, mostrador.ts) y el pase decía «CANJEÁ POR
 * ₡1 000 de tu cashback». Con el canje libre la caja descuenta el MONTO
 * que el cliente quiera de su saldo —entre el mínimo de la tarjeta y lo
 * que tiene—, con el RPC `canjear_monto_lealtad` (0253): atómico, bajo el
 * mismo lock que acreditar y canjear, idempotente por la referencia.
 *
 * ── QUIÉN LO TIENE ──────────────────────────────────────────────────
 * Las tarjetas de cashback con `beneficio.canjeLibre = true`. Hoy, SOLO
 * las de Foorkie (`lealtad_por_foorkie`): lo prende el alta de Foorkie
 * (`/negocio`), sus reglas (`programa/reglas/guardar`) y la 0253 para las
 * que ya existían. Las de Bookea —Pura Matcha y las propias— no lo
 * tienen y no cambian en nada: ni el pase ni la caja.
 *
 * Que la marca viva en el `beneficio` y no en una consulta a Foorkie es a
 * propósito: así el pase de Apple, el de Google, la caja y la vista previa
 * leen lo mismo de la misma fila, sin que cada uno tenga que preguntar de
 * quién es la tarjeta. La caja SÍ pregunta (`localDeFoorkieDeLaTarjeta`)
 * antes de descontar: el dinero no se mueve por un campo de un jsonb.
 *
 * Todo lo de este archivo es puro: sin base y sin reloj.
 */

/** El mismo techo que el monto de una compra (`revisarMonto`). */
export const TOPE_CANJE_LIBRE = 10_000_000;

/** El canje libre de una tarjeta: lo mínimo que se puede usar de una vez (null = desde ₡1). */
export type CanjeLibre = { minimo: number | null };

/**
 * ¿Esta tarjeta usa el cashback en monto libre? null = no (tramos, o no
 * es cashback). Un mínimo de ₡1 es lo mismo que no tener mínimo.
 */
export function canjeLibreDe(beneficio: ConfigBeneficio | null | undefined): CanjeLibre | null {
  if (!beneficio || beneficio.tipo !== "cashback" || beneficio.canjeLibre !== true) return null;
  const m = beneficio.minimoCanje;
  const minimo = typeof m === "number" && Number.isInteger(m) && m > 1 && m <= TOPE_CANJE_LIBRE ? m : null;
  return { minimo };
}

/**
 * Una tarjeta de cashback que nace en Foorkie (`/api/plataforma/foorkie/
 * negocio`) nace con canje libre. Lo demás pasa tal cual: lo valida
 * `validarTarjetaDeAlta`, como siempre.
 */
export function beneficioDeFoorkie(beneficio: unknown): unknown {
  if (!beneficio || typeof beneficio !== "object" || Array.isArray(beneficio)) return beneficio;
  const b = beneficio as Record<string, unknown>;
  return b.tipo === "cashback" ? { ...b, canjeLibre: true } : beneficio;
}

/** El monto que llega de afuera: colones enteros de 1 a ₡10.000.000, o null. */
export function leerMontoLibre(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= TOPE_CANJE_LIBRE ? v : null;
}

/** La referencia del canje libre en el ledger: el prefijo `canje:` que la caja ya reconoce. */
export function referenciaCanjeLibre(miembroId: string, intentoId: string): string {
  return `canje:${miembroId}:cashback:${intentoId}`;
}

/**
 * El motivo que queda en el ledger para siempre. Empieza con «Canje: »
 * como los de `canjear_recompensa`, así el historial de la caja de
 * Foorkie y la Actividad de Bookea lo leen igual que un canje. `quien` es
 * el concepto de la caja («Caja Foorkie · Ana»): en un canje no hay otro
 * lugar donde anotar quién lo hizo.
 */
export function motivoCanjeLibre(quien?: string | null): string {
  const q = (quien ?? "").replace(/\s+/g, " ").trim();
  const motivo = q ? `Canje: Cashback usado (${q})` : "Canje: Cashback usado";
  return motivo.length <= 200 ? motivo : `${motivo.slice(0, 199)}…`;
}

/** Lo que devolvió `canjear_monto_lealtad` cuando dijo que no. */
export type RechazoCanjeLibre = {
  codigo?: string | null;
  motivo?: string | null;
  saldo?: number | null;
  minimo?: number | null;
};

/**
 * El rechazo del RPC en palabras de la caja. Los códigos son los de la
 * 0253; una frase que el RPC ya escribió para una persona pasa tal cual
 * (`traducirMotivo`), un identificador nunca.
 */
export function motivoDelCanjeLibre(r: RechazoCanjeLibre): string {
  switch (r.codigo) {
    case "saldo_insuficiente":
      return typeof r.saldo === "number"
        ? `No le alcanza: tiene ${formatearCRC(r.saldo)} de cashback.`
        : "No le alcanza el cashback para ese monto.";
    case "debajo_del_minimo":
      return typeof r.minimo === "number"
        ? `Lo mínimo que se puede usar de una vez es ${formatearCRC(r.minimo)}.`
        : "Ese monto está por debajo del mínimo de la tarjeta.";
    case "canje_no_libre":
      return "Esta tarjeta no usa el cashback en el monto que se quiera.";
    case "monto_invalido":
      return "El monto tiene que ser una cantidad entera de colones.";
    case "verificacion_pendiente":
      return "Falta confirmar el WhatsApp o el correo antes de canjear.";
    case "membresia_inactiva":
      return "Esa membresía no está activa.";
    default:
      return traducirMotivo(r.motivo, "No se pudo usar el cashback.");
  }
}

// ════════════════════════════════════════════════════════════════════
//  Lo que dice el pase
// ════════════════════════════════════════════════════════════════════

type Renglon = { label: string; value: string };

/**
 * Las dos líneas del frente de una tarjeta de cashback libre (el saldo va
 * arriba, como siempre). Sin «CANJEÁ POR…»: no hay un tramo que alcanzar.
 *
 *   · sin saldo:            «TU CASHBACK — Se suma con cada compra»
 *   · con mínimo sin llegar: «TU CASHBACK — Te faltan ₡650 para usarlo»
 *   · si no:                «TU CASHBACK — Usalo cuando quieras»
 *
 * Con mínimo, el renglón chico lo dice («SE USA DESDE ₡1 000»).
 */
export function textosCashbackLibre(saldo: number, libre: CanjeLibre): { detalle: Renglon; regalia: Renglon | null } {
  const s = Number.isFinite(saldo) ? Math.max(0, Math.floor(saldo)) : 0;
  let valor: string;
  if (s <= 0) valor = "Se suma con cada compra";
  else if (libre.minimo !== null && s < libre.minimo) valor = `Te faltan ${formatearCRC(libre.minimo - s)} para usarlo`;
  else valor = "Usalo cuando quieras";
  return {
    detalle: { label: "TU CASHBACK", value: valor },
    regalia: libre.minimo !== null ? { label: "SE USA DESDE", value: formatearCRC(libre.minimo) } : null,
  };
}

/** El dorso de una tarjeta de cashback libre: cómo se usa, en dos frases. */
export function ayudaCashbackLibre(libre: CanjeLibre): string {
  const minimo = libre.minimo !== null ? ` Se usa desde ${formatearCRC(libre.minimo)}.` : "";
  return (
    "Presentá esta tarjeta al pagar. Tu cashback crece con cada compra y lo usás cuando quieras: " +
    `decís cuánto y se descuenta de tu saldo.${minimo}`
  );
}
