import { formatearCRC } from "../dinero";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA MONEDA DE UNA TARJETA DE CASHBACK (Foorkie, 8 nov 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño: «el cashback debería poderse en cualquier país y que
 * se adapte a la moneda del país». Hasta acá el cashback era solo de
 * colones: el pase, la caja y los mensajes escribían `formatearCRC`, y
 * Foorkie lo apagaba fuera de Costa Rica para que un local de México no
 * viera «SALDO ₡1 250».
 *
 * ── CÓMO QUEDA ──────────────────────────────────────────────────────
 * Una tarjeta de cashback guarda en su `beneficio` la MONEDA (código ISO,
 * `moneda: "USD"`) y la ESCALA (`escala: 100`): cuántas unidades del
 * ledger hacen una unidad de la moneda. El ledger, las funciones de la
 * base (`acreditar_lealtad`, `canjear_monto_lealtad`) y sus CHECK siguen
 * contando ENTEROS, como siempre; en una tarjeta en dólares esos enteros
 * son CENTAVOS. Por eso no hizo falta tocar el esquema:
 *
 *   compra de $15.50 al 5 %  →  1550 unidades × 0,05  →  77 unidades
 *                            →  el pase dice «SALDO $0.77»
 *
 * La escala se GUARDA (no se deduce de la tabla cada vez) a propósito: si
 * mañana la tabla de monedas cambia los decimales de una moneda, las
 * tarjetas que ya existen no pueden empezar a leer su saldo ×100.
 *
 * ── LO QUE YA EXISTÍA NO CAMBIA ─────────────────────────────────────
 * Una tarjeta sin `moneda` —todas las anteriores a esto, las de Bookea y
 * las de Foorkie— es de colones con escala 1: `aUnidades` y `aMoneda` son
 * la identidad y `formatearMonto` es `formatearCRC`, carácter por
 * carácter. Una tarjeta de cashback NUEVA en colones guarda `moneda:
 * "CRC", escala: 1` y se lee exactamente igual.
 *
 * ── LA FRONTERA ─────────────────────────────────────────────────────
 * Afuera del motor (Foorkie, la caja, el panel) los montos van en la
 * moneda tal cual («15.5» dólares). La conversión a unidades del ledger
 * se hace en el núcleo (`operar-core.ts`) y en las rutas de Foorkie que
 * leen o escriben montos; ningún otro módulo debería multiplicar por la
 * escala por su cuenta.
 *
 * Módulo puro: sin red, sin base, sin `process.env`.
 */

/**
 * Las monedas en las que puede nacer una tarjeta de cashback: el ESPEJO de
 * `MONEDAS` de Foorkie (`lib/paises.ts`), con el mismo símbolo y los
 * mismos decimales, para que el pase y la caja de Foorkie digan lo mismo.
 * Si Foorkie agrega una moneda, se agrega acá; hasta entonces una tarjeta
 * en esa moneda no se puede crear (el alta la rechaza con nombre).
 */
export const MONEDAS_TARJETA: Readonly<Record<string, { simbolo: string; decimales: 0 | 2 }>> = {
  ARS: { simbolo: "$", decimales: 0 },
  BOB: { simbolo: "Bs", decimales: 2 },
  BRL: { simbolo: "R$", decimales: 2 },
  CLP: { simbolo: "$", decimales: 0 },
  COP: { simbolo: "$", decimales: 0 },
  CRC: { simbolo: "₡", decimales: 0 },
  DOP: { simbolo: "RD$", decimales: 0 },
  USD: { simbolo: "$", decimales: 2 },
  GTQ: { simbolo: "Q", decimales: 2 },
  HNL: { simbolo: "L", decimales: 2 },
  MXN: { simbolo: "$", decimales: 0 },
  NIO: { simbolo: "C$", decimales: 2 },
  PYG: { simbolo: "₲", decimales: 0 },
  PEN: { simbolo: "S/", decimales: 2 },
  UYU: { simbolo: "$", decimales: 0 },
  VES: { simbolo: "Bs", decimales: 2 },
  CUP: { simbolo: "$", decimales: 0 },
  EUR: { simbolo: "€", decimales: 2 },
  GBP: { simbolo: "£", decimales: 2 },
  CAD: { simbolo: "C$", decimales: 2 },
};

/** Cuántas unidades del ledger hacen una unidad de la moneda: 1 (sin decimales) o 100 (centavos). */
export type Escala = 1 | 100;

export type MonedaTarjeta = { codigo: string; escala: Escala };

/** La moneda de toda tarjeta que no dice otra cosa: colones enteros, la de siempre. */
export const MONEDA_DE_SIEMPRE: MonedaTarjeta = Object.freeze({ codigo: "CRC", escala: 1 });

/** El techo de un monto en UNIDADES del ledger: el mismo `check` de la base (0197, 0253). */
export const TOPE_UNIDADES = 10_000_000;

/** «usd», « USD » → «USD»; null si no es una moneda de la tabla. */
export function codigoDeMoneda(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const codigo = valor.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(MONEDAS_TARJETA, codigo) ? codigo : null;
}

/** La moneda con la que nace una tarjeta nueva en ese código; null si no está en la tabla. */
export function monedaParaCrear(valor: unknown): MonedaTarjeta | null {
  const codigo = codigoDeMoneda(valor);
  if (!codigo) return null;
  return { codigo, escala: MONEDAS_TARJETA[codigo].decimales === 2 ? 100 : 1 };
}

/**
 * La moneda de una tarjeta, leída de su `beneficio` (el jsonb crudo o ya
 * leído). Solo el CASHBACK la lleva; cualquier otra cosa —otro tipo, un
 * beneficio viejo, uno roto, una moneda que no conocemos— es
 * `MONEDA_DE_SIEMPRE`, que es como se leyó siempre.
 */
export function monedaDeTarjeta(beneficio: unknown): MonedaTarjeta {
  const crudo = typeof beneficio === "string" ? intentarJson(beneficio) : beneficio;
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return MONEDA_DE_SIEMPRE;
  const b = crudo as Record<string, unknown>;
  if (b.tipo !== "cashback") return MONEDA_DE_SIEMPRE;
  const codigo = codigoDeMoneda(b.moneda);
  if (!codigo) return MONEDA_DE_SIEMPRE;
  // La escala guardada manda; si falta o está rota, la de la tabla.
  const escala: Escala = b.escala === 100 || b.escala === 1 ? b.escala : MONEDAS_TARJETA[codigo].decimales === 2 ? 100 : 1;
  return { codigo, escala };
}

/**
 * ¿Es un cashback que guardó su moneda (los nacidos desde el 8 nov 2026)?
 * Los de antes no: para ellos todo sale exactamente como salía.
 */
export function tieneMonedaGuardada(beneficio: unknown): boolean {
  const crudo = typeof beneficio === "string" ? intentarJson(beneficio) : beneficio;
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return false;
  const b = crudo as Record<string, unknown>;
  return b.tipo === "cashback" && codigoDeMoneda(b.moneda) !== null;
}

/** ¿Esta tarjeta cuenta centavos? (para decidir si un monto puede traer decimales) */
export const llevaCentavos = (m: MonedaTarjeta) => m.escala !== 1;

/**
 * De la moneda a unidades del ledger: $15.50 → 1550; ₡4 500 → 4500.
 * Redondea al centavo (o al entero, con escala 1): un monto que llega con
 * más decimales de los que la moneda usa no se rechaza, se redondea, como
 * hace cualquier caja.
 */
export function aUnidades(monto: number, m: MonedaTarjeta): number {
  // `toFixed` antes de redondear evita el 1.005 × 100 = 100.49999…
  return Math.round(Number((monto * m.escala).toFixed(6)));
}

/** De unidades del ledger a la moneda: 1550 → 15.5 (con escala 1, el mismo número). */
export function aMoneda(unidades: number, m: MonedaTarjeta): number {
  if (m.escala === 1) return unidades;
  return Math.round(unidades) / m.escala;
}

/** `aMoneda` que deja pasar null/undefined tal cual (para campos opcionales de una respuesta). */
export function aMonedaOpcional<T extends number | null | undefined>(unidades: T, m: MonedaTarjeta): T {
  return (typeof unidades === "number" && Number.isFinite(unidades) ? aMoneda(unidades, m) : unidades) as T;
}

/**
 * Un monto en UNIDADES del ledger, escrito para una persona.
 *
 *   · colones (la de siempre): «₡1 250» — `formatearCRC`, sin un carácter
 *     de diferencia con lo que el pase dice hoy;
 *   · cualquier otra: el símbolo de la tabla con miles con coma y los
 *     decimales de la moneda, como `formatPrecio` de Foorkie: «$0.77»,
 *     «$1,250.00», «S/12.50», «$12,500» (pesos colombianos).
 */
export function formatearMonto(unidades: number, m: MonedaTarjeta): string {
  if (m.codigo === "CRC" && m.escala === 1) return formatearCRC(unidades);
  const info = MONEDAS_TARJETA[m.codigo];
  const simbolo = info ? info.simbolo : `${m.codigo} `;
  const decimales = m.escala === 100 ? 2 : 0;
  const valor = Number.isFinite(unidades) ? aMoneda(unidades, m) : 0;
  const [entero, fraccion] = Math.abs(valor).toFixed(decimales).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${valor < 0 ? "-" : ""}${simbolo}${conMiles}${fraccion ? `.${fraccion}` : ""}`;
}

/**
 * Un monto que llega de AFUERA (Foorkie, la caja), en la moneda, pasado a
 * unidades del ledger. null si no es un número finito, si es negativo o
 * si se pasa del techo de la base. `minimo` en unidades (1 para un
 * canje: no se usa un monto de cero).
 */
export function leerMontoDeAfuera(v: unknown, m: MonedaTarjeta, minimo = 0): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  const unidades = aUnidades(v, m);
  return unidades >= minimo && unidades <= TOPE_UNIDADES ? unidades : null;
}

/**
 * El beneficio como lo lee AFUERA (Foorkie): en un cashback con centavos,
 * `compraMinima`, `topePorCompra` y `minimoCanje` pasan de unidades a la
 * moneda (500 → 5). Cualquier otra tarjeta sale tal cual, el mismo
 * objeto. Nunca se guarda lo que devuelve esto: es solo para responder.
 */
export function beneficioEnMoneda<T>(beneficio: T): T {
  const m = monedaDeTarjeta(beneficio);
  if (m.escala === 1 || !beneficio || typeof beneficio !== "object") return beneficio;
  const b = beneficio as Record<string, unknown>;
  const enMoneda = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? aMoneda(v, m) : v);
  return {
    ...b,
    compraMinima: enMoneda(b.compraMinima),
    topePorCompra: enMoneda(b.topePorCompra),
    ...(b.minimoCanje !== undefined ? { minimoCanje: enMoneda(b.minimoCanje) } : {}),
  } as T;
}

/** «colones», «dólares»… para las frases que nombran la moneda sin un número delante. */
export function nombreDeMoneda(m: MonedaTarjeta): string {
  return NOMBRES[m.codigo] ?? m.codigo;
}

const NOMBRES: Record<string, string> = {
  ARS: "pesos",
  BOB: "bolivianos",
  BRL: "reales",
  CLP: "pesos",
  COP: "pesos",
  CRC: "colones",
  DOP: "pesos",
  USD: "dólares",
  GTQ: "quetzales",
  HNL: "lempiras",
  MXN: "pesos",
  NIO: "córdobas",
  PYG: "guaraníes",
  PEN: "soles",
  UYU: "pesos",
  VES: "bolívares",
  CUP: "pesos",
  EUR: "euros",
  GBP: "libras",
  CAD: "dólares",
};

function intentarJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}
