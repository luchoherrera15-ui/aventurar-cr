/**
 * ════════════════════════════════════════════════════════════════════
 *  PAÍSES Y MONEDAS DE LATINOAMÉRICA — de México a Chile
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): «todo está basado en colones y no
 * debería: se adapta a la moneda de cada país. Ofrecemos el servicio
 * desde México hasta Chile — implementá todas, todas las monedas, con
 * sus símbolos e íconos para diferenciarlas».
 *
 * ── UN SOLO CATÁLOGO, SIN RED ──────────────────────────────────────
 * Módulo neutral: sin `process.env`, sin Supabase, sin React. Lo
 * importan el panel (cliente), las páginas públicas (servidor), las
 * actions y los tests. Todo lo que el sitio sabe de un país o una
 * moneda sale de acá; el resto del código pide `fmtMoneda(monto,
 * moneda)` y no vuelve a escribir un «₡» a mano.
 *
 * ── POR QUÉ NO `Intl.NumberFormat(style: "currency")` ─────────────
 * El estilo `currency` decide el símbolo por locale, y decide mal para
 * este mercado: en un servidor con ICU en inglés `MXN` sale como
 * «MX$», `CRC` como «CRC 8,900» y `COP` como «COP 15,000». Un cliente
 * en Bogotá lee «$15.000», no «COP 15,000». Así que el NÚMERO lo
 * agrupa Intl con el locale del país (que sí acierta: punto o coma,
 * espacio en Costa Rica) y el SÍMBOLO lo pone este catálogo.
 *
 * ── EL PAÍS Y LA MONEDA VAN SEPARADOS ──────────────────────────────
 * Panamá, Ecuador, El Salvador y Puerto Rico cobran en dólares; en
 * Venezuela muchos negocios ponen los precios en USD aunque la moneda
 * sea el bolívar. Por eso el negocio elige país (que decide el
 * prefijo del WhatsApp y la moneda SUGERIDA) y moneda (la que él usa),
 * y las dos cosas se guardan aparte (0236).
 */

export const PAISES = [
  "MX", "GT", "BZ", "HN", "SV", "NI", "CR", "PA",
  "CO", "VE", "EC", "PE", "BO", "PY", "UY", "AR", "CL", "BR",
  "DO", "CU", "PR",
] as const;
export type Pais = (typeof PAISES)[number];

export const MONEDAS = [
  "MXN", "GTQ", "BZD", "HNL", "USD", "NIO", "CRC", "PAB",
  "COP", "VES", "PEN", "BOB", "PYG", "UYU", "ARS", "CLP", "BRL",
  "DOP", "CUP",
] as const;
export type Moneda = (typeof MONEDAS)[number];

export type DefinicionMoneda = {
  nombre: string;
  /** El nombre en inglés, para el menú público en otros idiomas. */
  nombreEn: string;
  simbolo: string;
  /** Espacio entre el símbolo y el número («S/ 25», «Bs. 10»). */
  espacio: boolean;
  /** Cuántos decimales se muestran. 0 en las monedas sin centavos vivos. */
  decimales: number;
  /** El locale que agrupa los miles como en ese país. */
  locale: string;
};

export const MONEDA: Record<Moneda, DefinicionMoneda> = {
  MXN: { nombre: "Peso mexicano", nombreEn: "Mexican peso", simbolo: "$", espacio: false, decimales: 2, locale: "es-MX" },
  GTQ: { nombre: "Quetzal", nombreEn: "Guatemalan quetzal", simbolo: "Q", espacio: false, decimales: 2, locale: "es-GT" },
  BZD: { nombre: "Dólar beliceño", nombreEn: "Belize dollar", simbolo: "BZ$", espacio: false, decimales: 2, locale: "en-BZ" },
  HNL: { nombre: "Lempira", nombreEn: "Honduran lempira", simbolo: "L", espacio: true, decimales: 2, locale: "es-HN" },
  USD: { nombre: "Dólar", nombreEn: "US dollar", simbolo: "$", espacio: false, decimales: 2, locale: "en-US" },
  NIO: { nombre: "Córdoba", nombreEn: "Nicaraguan córdoba", simbolo: "C$", espacio: false, decimales: 2, locale: "es-NI" },
  CRC: { nombre: "Colón", nombreEn: "Costa Rican colón", simbolo: "₡", espacio: false, decimales: 0, locale: "es-CR" },
  PAB: { nombre: "Balboa", nombreEn: "Panamanian balboa", simbolo: "B/.", espacio: true, decimales: 2, locale: "es-PA" },
  COP: { nombre: "Peso colombiano", nombreEn: "Colombian peso", simbolo: "$", espacio: false, decimales: 0, locale: "es-CO" },
  VES: { nombre: "Bolívar", nombreEn: "Venezuelan bolívar", simbolo: "Bs.", espacio: true, decimales: 2, locale: "es-VE" },
  PEN: { nombre: "Sol", nombreEn: "Peruvian sol", simbolo: "S/", espacio: true, decimales: 2, locale: "es-PE" },
  BOB: { nombre: "Boliviano", nombreEn: "Bolivian boliviano", simbolo: "Bs", espacio: true, decimales: 2, locale: "es-BO" },
  PYG: { nombre: "Guaraní", nombreEn: "Paraguayan guaraní", simbolo: "₲", espacio: false, decimales: 0, locale: "es-PY" },
  UYU: { nombre: "Peso uruguayo", nombreEn: "Uruguayan peso", simbolo: "$U", espacio: true, decimales: 0, locale: "es-UY" },
  ARS: { nombre: "Peso argentino", nombreEn: "Argentine peso", simbolo: "$", espacio: false, decimales: 0, locale: "es-AR" },
  CLP: { nombre: "Peso chileno", nombreEn: "Chilean peso", simbolo: "$", espacio: false, decimales: 0, locale: "es-CL" },
  BRL: { nombre: "Real", nombreEn: "Brazilian real", simbolo: "R$", espacio: true, decimales: 2, locale: "pt-BR" },
  DOP: { nombre: "Peso dominicano", nombreEn: "Dominican peso", simbolo: "RD$", espacio: false, decimales: 2, locale: "es-DO" },
  CUP: { nombre: "Peso cubano", nombreEn: "Cuban peso", simbolo: "$", espacio: false, decimales: 2, locale: "es-CU" },
};

export type DefinicionPais = {
  nombre: string;
  moneda: Moneda;
  /** Código telefónico sin el «+». */
  telefono: string;
  /**
   * Lo que wa.me necesita ANTES del número local. Casi siempre es el
   * código del país; Argentina exige el «9» de celular después del 54.
   */
  prefijoWhatsapp: string;
  /** Largos válidos de un número local (sin código de país). */
  largoLocal: number[];
  /** Cómo se llama el documento de identidad, para el pedido. */
  documento: string;
};

export const PAIS: Record<Pais, DefinicionPais> = {
  MX: { nombre: "México", moneda: "MXN", telefono: "52", prefijoWhatsapp: "52", largoLocal: [10], documento: "RFC o CURP" },
  GT: { nombre: "Guatemala", moneda: "GTQ", telefono: "502", prefijoWhatsapp: "502", largoLocal: [8], documento: "DPI o NIT" },
  BZ: { nombre: "Belice", moneda: "BZD", telefono: "501", prefijoWhatsapp: "501", largoLocal: [7], documento: "Social Security" },
  HN: { nombre: "Honduras", moneda: "HNL", telefono: "504", prefijoWhatsapp: "504", largoLocal: [8], documento: "DNI o RTN" },
  SV: { nombre: "El Salvador", moneda: "USD", telefono: "503", prefijoWhatsapp: "503", largoLocal: [8], documento: "DUI o NIT" },
  NI: { nombre: "Nicaragua", moneda: "NIO", telefono: "505", prefijoWhatsapp: "505", largoLocal: [8], documento: "Cédula o RUC" },
  CR: { nombre: "Costa Rica", moneda: "CRC", telefono: "506", prefijoWhatsapp: "506", largoLocal: [8], documento: "Cédula" },
  PA: { nombre: "Panamá", moneda: "USD", telefono: "507", prefijoWhatsapp: "507", largoLocal: [7, 8], documento: "Cédula o RUC" },
  CO: { nombre: "Colombia", moneda: "COP", telefono: "57", prefijoWhatsapp: "57", largoLocal: [10], documento: "Cédula o NIT" },
  VE: { nombre: "Venezuela", moneda: "VES", telefono: "58", prefijoWhatsapp: "58", largoLocal: [10], documento: "Cédula o RIF" },
  EC: { nombre: "Ecuador", moneda: "USD", telefono: "593", prefijoWhatsapp: "593", largoLocal: [9], documento: "Cédula o RUC" },
  PE: { nombre: "Perú", moneda: "PEN", telefono: "51", prefijoWhatsapp: "51", largoLocal: [9], documento: "DNI o RUC" },
  BO: { nombre: "Bolivia", moneda: "BOB", telefono: "591", prefijoWhatsapp: "591", largoLocal: [8], documento: "CI o NIT" },
  PY: { nombre: "Paraguay", moneda: "PYG", telefono: "595", prefijoWhatsapp: "595", largoLocal: [9], documento: "CI o RUC" },
  UY: { nombre: "Uruguay", moneda: "UYU", telefono: "598", prefijoWhatsapp: "598", largoLocal: [8], documento: "CI o RUT" },
  AR: { nombre: "Argentina", moneda: "ARS", telefono: "54", prefijoWhatsapp: "549", largoLocal: [10], documento: "DNI o CUIT" },
  CL: { nombre: "Chile", moneda: "CLP", telefono: "56", prefijoWhatsapp: "56", largoLocal: [9], documento: "RUT" },
  BR: { nombre: "Brasil", moneda: "BRL", telefono: "55", prefijoWhatsapp: "55", largoLocal: [10, 11], documento: "CPF ou CNPJ" },
  DO: { nombre: "República Dominicana", moneda: "DOP", telefono: "1", prefijoWhatsapp: "1", largoLocal: [10], documento: "Cédula o RNC" },
  CU: { nombre: "Cuba", moneda: "CUP", telefono: "53", prefijoWhatsapp: "53", largoLocal: [8], documento: "Carné de identidad" },
  PR: { nombre: "Puerto Rico", moneda: "USD", telefono: "1", prefijoWhatsapp: "1", largoLocal: [10], documento: "Licencia o SSN" },
};

/**
 * La bandera como emoji, calculada del código: dos «regional
 * indicator» seguidos. No hay tabla que mantener, y es la única cosa
 * del sitio que va en emoji a propósito: una bandera dibujada a mano
 * en 21 versiones sería un archivo de íconos entero, y el sistema
 * operativo las dibuja bien en todos lados.
 */
export function banderaDe(pais: Pais): string {
  return pais
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function esPais(v: unknown): v is Pais {
  return typeof v === "string" && (PAISES as readonly string[]).includes(v);
}
export function esMoneda(v: unknown): v is Moneda {
  return typeof v === "string" && (MONEDAS as readonly string[]).includes(v);
}

/** Lee la columna cruda y devuelve un valor de la lista cerrada. */
export function paisDe(v: unknown): Pais {
  return esPais(v) ? v : "CR";
}
export function monedaDe(v: unknown): Moneda {
  return esMoneda(v) ? v : "CRC";
}
export function monedaDelPais(pais: Pais): Moneda {
  return PAIS[pais]?.moneda ?? "CRC";
}

/** Redondea a los decimales que la moneda muestra. */
export function redondearMonto(n: number, moneda: Moneda): number {
  const d = MONEDA[moneda]?.decimales ?? 0;
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
}

/**
 * «₡8900», «$120.50», «$15.000», «S/ 25.00», «R$ 1.200,50».
 *
 * El símbolo lo pone el catálogo; la agrupación de miles y la coma o
 * el punto decimal los pone Intl con el locale del país (ver arriba
 * por qué no `style: "currency"`). Los negativos llevan el signo
 * delante del símbolo: «-₡500».
 */
export function fmtMoneda(n: number, moneda: Moneda): string {
  const m = MONEDA[moneda] ?? MONEDA.CRC;
  const valor = redondearMonto(n, moneda);
  const numero = new Intl.NumberFormat(m.locale, {
    minimumFractionDigits: m.decimales,
    maximumFractionDigits: m.decimales,
  }).format(Math.abs(valor));
  const signo = valor < 0 ? "-" : "";
  return `${signo}${m.simbolo}${m.espacio ? " " : ""}${numero}`;
}

/**
 * El nombre de la moneda para una frase («precios en pesos mexicanos»).
 * En español o en inglés; el resto de idiomas del menú usan el código
 * ISO, que es lo que entiende cualquiera («prix en MXN»).
 */
export function nombreDeMoneda(moneda: Moneda, idioma: string): string {
  const m = MONEDA[moneda] ?? MONEDA.CRC;
  if (idioma === "es") return `${m.nombre.toLowerCase()} (${moneda})`;
  if (idioma === "en") return `${m.nombreEn} (${moneda})`;
  return moneda;
}

/** El paso del <input type=number> de un precio: 1 sin decimales, 0.01 con. */
export function pasoDePrecio(moneda: Moneda): number {
  return (MONEDA[moneda]?.decimales ?? 0) > 0 ? 0.01 : 1;
}

/**
 * El número que wa.me exige: solo dígitos, con país.
 *
 * Un número con el largo LOCAL del país recibe su prefijo; uno más
 * largo se asume que ya lo trae (quien pega «+52 55 1234 5678» ya
 * puso el país). Antes esto vivía en solutions/whatsapp.ts y solo
 * sabía de Costa Rica: ocho dígitos ⇒ 506.
 */
export function numeroInternacional(crudo: string, pais: Pais = "CR"): string {
  const d = (crudo ?? "").replace(/\D/g, "");
  if (!d) return "";
  const p = PAIS[pais] ?? PAIS.CR;
  if (p.largoLocal.includes(d.length)) return `${p.prefijoWhatsapp}${d}`;
  // Ya trae el código del país, pero le falta el 9 argentino.
  if (pais === "AR" && d.startsWith("54") && !d.startsWith("549") && d.length === 12) return `549${d.slice(2)}`;
  return d;
}

/** Cómo se ve un teléfono local de ejemplo en ese país, para un placeholder. */
export function ejemploTelefono(pais: Pais): string {
  const largo = (PAIS[pais] ?? PAIS.CR).largoLocal[0];
  return "8".repeat(Math.min(2, largo)) + "7".repeat(Math.max(0, largo - 2));
}
