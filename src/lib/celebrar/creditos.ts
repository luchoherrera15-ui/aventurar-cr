/**
 * ══════════════════════════════════════════════════════════════════
 *  LOS CRÉDITOS DE CELEBRAR — la lista de precios
 * ══════════════════════════════════════════════════════════════════
 *
 * Decisiones del dueño (21 sep 2026): TODO el proceso es gratis; lo que
 * se cobra es PUBLICAR. Desde el 24 sep 2026 el precio se muestra en
 * colones y por invitación (ver PRECIO_PLANTILLA_CRC más abajo).
 * 1 crédito = ₡50 para poder cobrar cosas chicas sin decimales y dejar
 * las grandes en números redondos. Los textos con IA van incluidos.
 *
 * Cambiar un precio es cambiar un número acá; la base solo guarda
 * movimientos (celebrar_creditos_movimientos, 0245).
 */

export const VALOR_CREDITO_CRC = 50;
export const TIPO_CAMBIO_REFERENCIA = 520;

/**
 * LOS DOS PRECIOS QUE VE LA GENTE (decisión del dueño, 24 sep 2026):
 * la invitación de plantilla —la que la persona edita— cuesta ₡7 500 y
 * la diseñada a medida por el equipo ₡10 500. Se paga al publicar (la de
 * plantilla) o al pedirla (la a medida). Los créditos siguen siendo el
 * motor por dentro (el libro 0245, el saldo, los partners), pero el
 * público ya no compra paquetes: paga por invitación.
 */
export const PRECIO_PLANTILLA_CRC = 7_500;
export const PRECIO_A_MEDIDA_CRC = 10_500;

export const PRECIOS = {
  /** Publicar una invitación de plantilla (con confirmación en la página y panel de invitados). */
  publicar: PRECIO_PLANTILLA_CRC / VALOR_CREDITO_CRC,
  /** La invitación a medida hecha por el equipo: se cobra al pedirla y cubre la publicación. */
  a_medida: PRECIO_A_MEDIDA_CRC / VALOR_CREDITO_CRC,
  /** La invitación completa generada con IA: el bot más económico (Chispa). Ver ia-modelos.ts. */
  invitacion_ia: 3,
} as const;

export type ConceptoPrecio = keyof typeof PRECIOS;

export const NOMBRE_CONCEPTO: Record<ConceptoPrecio, string> = {
  publicar: "Invitación de plantilla",
  a_medida: "Invitación diseñada a medida por el equipo",
  invitacion_ia: "Invitación generada con IA (desde)",
};

/**
 * Lo que se le vende al público con Stripe Checkout (0246). No son
 * «paquetes» para elegir: cada uno es UNA cosa concreta — publicar una
 * invitación, pedir una a medida, o recargar créditos para la IA.
 */
export const PAQUETES = [
  { id: "inv", creditos: PRECIOS.publicar, precioCRC: PRECIO_PLANTILLA_CRC, nota: "Publicar una invitación de plantilla" },
  { id: "medida", creditos: PRECIOS.a_medida, precioCRC: PRECIO_A_MEDIDA_CRC, nota: "Invitación a medida, diseñada por el equipo" },
  { id: "ia", creditos: 100, precioCRC: 5_000, nota: "Créditos para generar con IA" },
] as const;

/**
 * Los paquetes que se vendieron hasta el 24 sep 2026. Ya no se ofrecen,
 * pero un pago viejo que llegue tarde por el webhook (o un reembolso)
 * tiene que seguir reconociéndose con sus créditos.
 */
export const PAQUETES_LEGADO = [
  { id: "p100", creditos: 100, precioCRC: 5_000, nota: "Paquete de 100 créditos" },
  { id: "p250", creditos: 250, precioCRC: 11_500, nota: "Paquete de 250 créditos" },
  { id: "p500", creditos: 500, precioCRC: 21_000, nota: "Paquete de 500 créditos" },
] as const;

/**
 * Los paquetes MAYORISTAS del programa de partners (0247): el mismo
 * crédito, en volumen y con el descuento que el equipo le fijó a cada
 * partner (20 % por defecto). El partner publica al mismo precio en
 * créditos que todo el mundo y le cobra a su cliente lo que quiera: su
 * margen es el descuento. El precio se calcula en el servidor al abrir
 * el pago (`precioPaquetePartner`) y viaja en la sesión de Stripe.
 */
export const PAQUETES_PARTNER = [
  { id: "pp500", creditos: 500, nota: "Para empezar" },
  { id: "pp1000", creditos: 1_000, nota: "El más elegido", destacado: true },
  { id: "pp2500", creditos: 2_500, nota: "Para la temporada entera" },
] as const;

export type PaquetePartnerId = (typeof PAQUETES_PARTNER)[number]["id"];

/** ₡ de un paquete partner con el descuento de ESE partner, redondeado a la centena. */
export function precioPaquetePartner(creditos: number, descuentoPct: number): number {
  const bruto = creditos * VALOR_CREDITO_CRC * (1 - Math.min(60, Math.max(0, descuentoPct)) / 100);
  return Math.round(bruto / 100) * 100;
}

/** Un paquete listo para cobrar: público (precio fijo) o partner (precio por descuento). */
export type PaqueteACobrar = { id: string; creditos: number; precioCRC: number; nombre: string; partner: boolean };

export function paquetePublico(id: string): PaqueteACobrar | null {
  const p = PAQUETES.find((x) => x.id === id);
  return p ? { id: p.id, creditos: p.creditos, precioCRC: p.precioCRC, nombre: `CELEBRAR · ${p.nota}`, partner: false } : null;
}

export function paqueteDePartner(id: string, descuentoPct: number): PaqueteACobrar | null {
  const p = PAQUETES_PARTNER.find((x) => x.id === id);
  return p
    ? { id: p.id, creditos: p.creditos, precioCRC: precioPaquetePartner(p.creditos, descuentoPct), nombre: `CELEBRAR Partners · ${p.creditos.toLocaleString("es-CR")} créditos`, partner: true }
    : null;
}

/**
 * Cómo se pagó la publicación. «plantilla» y «medida» son los de hoy;
 * «whatsapp» y «panel» quedan en celebraciones pagadas antes del 24 sep
 * 2026 (cualquiera de los cuatro cuenta como pagada: no se vuelve a cobrar).
 */
export type PlanPublicacion = "plantilla" | "medida" | "whatsapp" | "panel";

export function creditosDePublicar(aMedida: boolean): number {
  return aMedida ? PRECIOS.a_medida : PRECIOS.publicar;
}

/** «₡7 500»: un monto en colones con el formato de la casa. */
export function colones(crc: number): string {
  return `₡${crc.toLocaleString("es-CR")}`;
}

export function enColones(creditos: number): string {
  return `₡${(creditos * VALOR_CREDITO_CRC).toLocaleString("es-CR")}`;
}

export function enDolares(creditos: number): string {
  return `$${((creditos * VALOR_CREDITO_CRC) / TIPO_CAMBIO_REFERENCIA).toFixed(0)}`;
}

/** Lo que quedó registrado en `celebrar_celebraciones.pago_publicacion`. */
export type PagoPublicacion = { plan: PlanPublicacion; creditos: number; en: string };

export function leerPago(v: unknown): PagoPublicacion | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!["plantilla", "medida", "whatsapp", "panel"].includes(o.plan as string) || typeof o.creditos !== "number" || typeof o.en !== "string") return null;
  return { plan: o.plan as PlanPublicacion, creditos: o.creditos, en: o.en };
}
