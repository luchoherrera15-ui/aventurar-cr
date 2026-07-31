/**
 * El catálogo de modelos de IA que puede usar Bookea, con sus precios
 * y todo lo que el panel necesita para explicarlos.
 *
 * Anthropic cobra en dólares por millón de tokens. Como el resto de la
 * plataforma habla en colones, acá vive también la conversión: cada
 * costo se puede leer en las dos monedas con el mismo tipo de cambio
 * que el admin configura.
 */

export type ModeloIA =
  | "claude-haiku-4-5"
  | "claude-sonnet-5"
  | "claude-opus-5"
  | "claude-fable-5";

/** Cada punto del producto que gasta tokens. Es lo que va en uso_ia.agente. */
export type AgenteIA =
  | "invitacion_chat"
  | "invitacion_brief"
  | "invitacion_generar"
  | "invitacion_refinar"
  | "agenda_leer"
  | "asistente_negocio";

export interface InfoModelo {
  id: ModeloIA;
  nombre: string;
  /** Para qué conviene, en una línea y sin jerga. */
  paraQue: string;
  /** USD por millón de tokens de entrada. */
  entradaUSD: number;
  /** USD por millón de tokens de salida. */
  salidaUSD: number;
  /** Precio de lanzamiento, si está vigente. */
  promo?: { entradaUSD: number; salidaUSD: number; hasta: string };
  /** Tokens que caben en una conversación. */
  contexto: number;
  /** Tope de tokens que puede responder de una vez. */
  salidaMaxima: number;
  /**
   * Si acepta output_config.effort. Haiku 4.5 NO: mandárselo devuelve
   * un error 400, así que el código tiene que preguntarlo antes.
   */
  soportaEsfuerzo: boolean;
  /**
   * Si razona por su cuenta sin pedírselo. En los modelos que sí, ese
   * razonamiento comparte el tope de max_tokens con el texto de la
   * respuesta — por eso los briefs largos necesitan margen de sobra.
   */
  razonaPorDefecto: boolean;
}

/** Ordenados de más barato a más caro: así se pintan en el panel. */
export const MODELOS: Record<ModeloIA, InfoModelo> = {
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    nombre: "Haiku 4.5",
    paraQue: "El más barato y rápido. Ideal para conversar y responder dudas cortas.",
    entradaUSD: 1,
    salidaUSD: 5,
    contexto: 200_000,
    salidaMaxima: 64_000,
    soportaEsfuerzo: false,
    razonaPorDefecto: false,
  },
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    nombre: "Sonnet 5",
    paraQue: "Equilibrado: casi la calidad de Opus por bastante menos plata.",
    entradaUSD: 3,
    salidaUSD: 15,
    promo: { entradaUSD: 2, salidaUSD: 10, hasta: "2026-08-31" },
    contexto: 1_000_000,
    salidaMaxima: 128_000,
    soportaEsfuerzo: true,
    razonaPorDefecto: true,
  },
  "claude-opus-5": {
    id: "claude-opus-5",
    nombre: "Opus 5",
    paraQue: "El que mejor diseña. Es el que genera las invitaciones.",
    entradaUSD: 5,
    salidaUSD: 25,
    contexto: 1_000_000,
    salidaMaxima: 128_000,
    soportaEsfuerzo: true,
    razonaPorDefecto: true,
  },
  "claude-fable-5": {
    id: "claude-fable-5",
    nombre: "Fable 5",
    paraQue: "El más capaz de todos, y el más caro: cuesta el doble que Opus.",
    entradaUSD: 10,
    salidaUSD: 50,
    contexto: 1_000_000,
    salidaMaxima: 128_000,
    soportaEsfuerzo: true,
    razonaPorDefecto: true,
  },
};

/** El catálogo como lista, del más barato al más caro. */
export const LISTA_MODELOS: InfoModelo[] = [
  MODELOS["claude-haiku-4-5"],
  MODELOS["claude-sonnet-5"],
  MODELOS["claude-opus-5"],
  MODELOS["claude-fable-5"],
];

export const AGENTES: { id: AgenteIA; nombre: string; queHace: string; columna: string }[] = [
  {
    id: "invitacion_chat",
    nombre: "Chat del diseñador",
    queHace:
      "Conversa con el cliente hasta entender la invitación que quiere. Es la llamada que más se repite.",
    columna: "ia_modelo_chat",
  },
  {
    id: "invitacion_brief",
    nombre: "Cierre del diseño",
    queHace:
      "Cuando el cliente aprieta Generar, resume toda la conversación en las instrucciones finales. Se corre una sola vez por invitación.",
    columna: "ia_modelo_brief",
  },
  {
    id: "invitacion_generar",
    nombre: "Generador de la invitación",
    queHace: "Escribe el HTML animado de la invitación a partir de esas instrucciones.",
    columna: "ia_modelo_generar",
  },
  {
    id: "invitacion_refinar",
    nombre: "Variantes de prompt",
    queHace: "Propone versiones alternativas de una descripción.",
    columna: "ia_modelo_refinar",
  },
  {
    id: "agenda_leer",
    nombre: "Lector de agenda",
    queHace: "Lee agendas en texto o foto y las convierte en citas. Es el add-on que se cobra aparte.",
    columna: "ia_modelo_agenda",
  },
  {
    id: "asistente_negocio",
    nombre: "Asistente del chat",
    queHace: "Le contesta a los clientes que escriben a un negocio, con los datos de ese negocio.",
    columna: "ia_modelo_asistente",
  },
];

export const NOMBRE_AGENTE: Record<AgenteIA, string> = AGENTES.reduce(
  (acc, a) => ({ ...acc, [a.id]: a.nombre }),
  {} as Record<AgenteIA, string>,
);

/** true si el texto es un modelo que conocemos. */
export function esModeloValido(valor: unknown): valor is ModeloIA {
  return typeof valor === "string" && valor in MODELOS;
}

/**
 * Resuelve cualquier texto a un modelo del catálogo. Tolera los IDs
 * con fecha que quedaron en el código viejo (claude-haiku-4-5-20251001)
 * y las etiquetas cortas del generador ("opus", "fable").
 */
export function normalizarModelo(valor: unknown, porDefecto: ModeloIA = "claude-opus-5"): ModeloIA {
  if (esModeloValido(valor)) return valor;
  if (typeof valor !== "string") return porDefecto;
  const v = valor.trim().toLowerCase();
  if (v === "opus") return "claude-opus-5";
  if (v === "fable") return "claude-fable-5";
  if (v === "sonnet") return "claude-sonnet-5";
  if (v === "haiku") return "claude-haiku-4-5";
  // "claude-haiku-4-5-20251001" y compañía: el alias es el prefijo.
  const encontrado = (Object.keys(MODELOS) as ModeloIA[]).find((id) => v.startsWith(id));
  return encontrado ?? porDefecto;
}

/**
 * El precio que rige hoy. Si el modelo trae precio de lanzamiento y
 * todavía no venció, ese manda — y así lo cobra Anthropic.
 */
export function preciosVigentes(
  modelo: ModeloIA,
  fecha: Date = new Date(),
): { entradaUSD: number; salidaUSD: number; enPromo: boolean; promoHasta: string | null } {
  const info = MODELOS[modelo];
  if (info.promo) {
    // El lanzamiento cubre el último día ENTERO en hora de Costa Rica
    // (UTC-6, sin horario de verano). Con una Z acá, el precio subía a
    // las 6 de la tarde del último día y cobrábamos de más media tarde.
    const vence = new Date(`${info.promo.hasta}T23:59:59.999-06:00`);
    if (fecha.getTime() <= vence.getTime()) {
      return {
        entradaUSD: info.promo.entradaUSD,
        salidaUSD: info.promo.salidaUSD,
        enPromo: true,
        promoHasta: info.promo.hasta,
      };
    }
  }
  return {
    entradaUSD: info.entradaUSD,
    salidaUSD: info.salidaUSD,
    enPromo: false,
    promoHasta: null,
  };
}

/**
 * Costo en dólares de una llamada, a partir de los tokens que reportó
 * la API. Redondeado a 6 decimales porque una respuesta de Haiku puede
 * costar menos de un centésimo de centavo.
 */
export function calcularCosto(
  modelo: ModeloIA,
  tokensInput: number,
  tokensOutput: number,
  fecha: Date = new Date(),
): number {
  const { entradaUSD, salidaUSD } = preciosVigentes(modelo, fecha);
  const costo =
    (tokensInput / 1_000_000) * entradaUSD + (tokensOutput / 1_000_000) * salidaUSD;
  return Math.round(costo * 1_000_000) / 1_000_000;
}

/** El tipo de cambio de respaldo cuando la base no responde. */
export const TIPO_CAMBIO_POR_DEFECTO = 520;

/**
 * Tipo de cambio de la variable de entorno. La configuración de la
 * base manda sobre esto; sirve para los puntos que no pueden consultarla.
 */
export function tipoCambioDeEntorno(): number {
  const v = Number(process.env.TIPO_CAMBIO_USD);
  return Number.isFinite(v) && v > 0 ? v : TIPO_CAMBIO_POR_DEFECTO;
}

/**
 * Formatea dólares con los decimales que hagan falta: los montos
 * chicos necesitan cuatro para no verse como "$0.00".
 */
export function formatearUSD(usd: number): string {
  const abs = Math.abs(usd);
  const decimales = abs > 0 && abs < 0.01 ? 4 : 2;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/** Formatea colones sin decimales: nadie cobra céntimos de colón. */
export function formatearCRC(crc: number): string {
  return `₡${Math.round(crc).toLocaleString("es-CR")}`;
}

/** "$0.0412 · ₡21" — el gasto siempre se muestra en las dos monedas. */
export function formatearAmbas(usd: number, tipoCambio: number): string {
  return `${formatearUSD(usd)} · ${formatearCRC(usd * tipoCambio)}`;
}

/** "$1.00 / $5.00 por millón" — el precio de lista de un modelo. */
export function etiquetaPrecio(modelo: ModeloIA, fecha: Date = new Date()): string {
  const { entradaUSD, salidaUSD } = preciosVigentes(modelo, fecha);
  return `${formatearUSD(entradaUSD)} entrada / ${formatearUSD(salidaUSD)} salida por millón`;
}

/**
 * El precio de un modelo en las dos monedas. Se le pasa la fecha desde
 * el servidor a propósito: si un componente de cliente la calculara por
 * su cuenta, el día que vence un precio de lanzamiento el servidor y el
 * navegador pintarían números distintos y React se quejaría.
 */
export function etiquetaPrecioAmbas(
  modelo: ModeloIA,
  tipoCambio: number,
  fecha: Date = new Date(),
): string {
  const { entradaUSD, salidaUSD } = preciosVigentes(modelo, fecha);
  return `${formatearAmbas(entradaUSD, tipoCambio)} entrada · ${formatearAmbas(
    salidaUSD,
    tipoCambio,
  )} salida, por millón de tokens`;
}
