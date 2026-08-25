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
  | "claude-fable-5"
  | "gemini-3.5-flash-lite";

/**
 * ════════════════════════════════════════════════════════════════════
 *  DOS LISTAS DE AGENTES, Y LA DIFERENCIA IMPORTA
 * ════════════════════════════════════════════════════════════════════
 *
 * `AgenteIA` — TODO punto del producto que gasta tokens. Es lo que va
 * en `uso_ia.agente` y lo que el panel de Gasto muestra.
 *
 * `AgenteConfigurable` — el subconjunto cuyo modelo ELIGE el admin
 * desde /admin/ia. Cada uno necesita su columna en
 * `configuracion_plataforma` (ver `AGENTES`), así que sumar uno cuesta
 * una migración.
 *
 * Antes eran la misma lista porque todo agente era configurable. Se
 * separaron al entrar `lealtad_chat`: ese gasta plata y tiene que
 * verse en el panel, pero su modelo NO se elige — está clavado a
 * Gemini a pedido del dueño, y ofrecerlo en el selector junto a los
 * modelos de Anthropic sería una trampa (el selector le ofrece TODOS
 * los modelos a TODOS los agentes, ver modelos-panel.tsx). Elegir un
 * Claude para el chat de Lealtad, o un Gemini para el generador de
 * invitaciones, rompería esa llamada en la primera visita.
 */
export type AgenteConfigurable =
  | "invitacion_chat"
  | "invitacion_brief"
  | "invitacion_generar"
  | "invitacion_imprimir"
  | "invitacion_refinar"
  | "agenda_leer"
  | "asistente_negocio";

/** Cada punto del producto que gasta tokens. Es lo que va en uso_ia.agente. */
export type AgenteIA = AgenteConfigurable | "lealtad_chat";

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
  /**
   * EL ÚNICO QUE NO ES DE ANTHROPIC — lo usa el chat de la landing de
   * Lealtad (`/lealtad`, ver agente-actions.ts), por pedido del dueño.
   *
   * Precios de la tabla oficial de Google (ai.google.dev/gemini-api/docs/pricing,
   * consultada ago 2026): $0,30 el millón de entrada, $2,50 el de
   * salida. Barato de leer y caro de escribir — por eso importa lo de
   * abajo.
   *
   * ⚠️ `razonaPorDefecto: true` NO es un detalle: Gemini 3.x piensa
   * salvo que se le diga que no, y esos tokens de razonamiento SE
   * FACTURAN COMO SALIDA, la parte cara. Medido contra la API: 172
   * segundos y un montón de tokens pensando una respuesta de tres
   * oraciones. Por eso el chat le pasa `sinRazonamiento` (ver
   * ai-provider.ts) — sin eso, esta fila estaría subestimando el gasto
   * real además de hacer esperar al visitante.
   *
   * NO ESTÁ EN `LISTA_MODELOS` a propósito — ver el comentario de esa
   * constante.
   */
  "gemini-3.5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    nombre: "Gemini 3.5 Flash Lite",
    paraQue: "El chat de la landing de Lealtad. Barato y rápido, para dudas cortas de visitantes.",
    entradaUSD: 0.3,
    salidaUSD: 2.5,
    contexto: 1_000_000,
    salidaMaxima: 64_000,
    soportaEsfuerzo: false,
    razonaPorDefecto: true,
  },
};

/**
 * LOS MODELOS QUE EL ADMIN PUEDE ELEGIR, del más barato al más caro.
 *
 * ⚠️ NO es `Object.values(MODELOS)`, y la diferencia es deliberada:
 * `MODELOS` es el catálogo para PONERLE PRECIO Y NOMBRE a lo que ya se
 * gastó (incluido Gemini); esta lista es la que pinta el SELECTOR de
 * /admin/ia, y ahí solo pueden aparecer modelos de Anthropic.
 *
 * El motivo: el selector le ofrece la lista entera a CADA agente (ver
 * modelos-panel.tsx). Si Gemini entrara acá, un admin podría elegirlo
 * para el generador de invitaciones —que habla con el SDK de
 * Anthropic— y romper esa llamada en la primera visita, sin que nada
 * avise. El chat de Lealtad, al revés, tiene su modelo clavado en el
 * código y no se configura (ver `AgenteConfigurable`).
 */
export const LISTA_MODELOS: InfoModelo[] = [
  MODELOS["claude-haiku-4-5"],
  MODELOS["claude-sonnet-5"],
  MODELOS["claude-opus-5"],
  MODELOS["claude-fable-5"],
];

/** true si el admin puede elegir este modelo para un agente configurable. */
export function esModeloSeleccionable(valor: unknown): valor is ModeloIA {
  return typeof valor === "string" && LISTA_MODELOS.some((m) => m.id === valor);
}

/**
 * Los agentes CONFIGURABLES: los que aparecen en el selector de modelo
 * de /admin/ia. `columna` es dónde se guarda lo elegido en
 * `configuracion_plataforma` — sumar uno acá exige una migración que
 * agregue esa columna.
 *
 * Un agente que gasta pero no se configura (hoy `lealtad_chat`) NO va
 * acá: va en `AgenteIA` y en `NOMBRE_AGENTE`, y con eso ya se ve en el
 * panel de Gasto.
 */
export const AGENTES: { id: AgenteConfigurable; nombre: string; queHace: string; columna: string }[] = [
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
    id: "invitacion_imprimir",
    nombre: "Invitación para imprimir",
    queHace:
      "Compone la versión de UNA hoja para papel, con la misma identidad del diseño digital. Se corre una vez por invitación del paquete Plus.",
    columna: "ia_modelo_imprimir",
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

/**
 * El nombre legible de CADA agente que gasta — configurable o no.
 *
 * Los configurables salen de `AGENTES` (una sola fuente, para que el
 * nombre del selector y el del panel de Gasto no se separen nunca). Los
 * que no se configuran se agregan a mano acá abajo.
 *
 * El `Record<AgenteIA, ...>` es lo que hace que esto no se pueda
 * olvidar: sumar un agente a `AgenteIA` sin darle nombre acá NO
 * COMPILA. Sin esta red, el agente nuevo se vería en /admin como su id
 * crudo (`lealtad_chat`) y nadie se enteraría hasta mirar el panel.
 */
export const NOMBRE_AGENTE: Record<AgenteIA, string> = {
  ...AGENTES.reduce(
    (acc, a) => ({ ...acc, [a.id]: a.nombre }),
    {} as Record<AgenteConfigurable, string>,
  ),
  lealtad_chat: "Chat de la landing de Lealtad",
};

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
  /**
   * Un id que no está en el catálogo NO puede tumbar el registro del
   * gasto. `calcularCosto` lo llama desde `registrarUsoIA`
   * (registrar-uso.ts) FUERA del try/catch que protege el insert, así
   * que un `undefined` acá se convertía en un TypeError que subía hasta
   * el llamador — o sea: un modelo mal escrito no dejaba sin costear la
   * llamada, dejaba sin RESPUESTA al cliente.
   *
   * Se cobra en 0 y se avisa por consola: el panel muestra la llamada
   * con costo cero (raro y visible, que es lo que se quiere) en vez de
   * romper el producto por un problema de contabilidad.
   */
  if (!info) {
    console.error(`[modelos] Sin precios para "${modelo}" — se cuenta en 0. Agregalo a MODELOS.`);
    return { entradaUSD: 0, salidaUSD: 0, enPromo: false, promoHasta: null };
  }
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
 * El formato de la plata se mudó a `src/lib/dinero.ts`.
 *
 * Vivía acá porque este panel fue el primero que lo necesitó, pero el de
 * almacenamiento pide exactamente lo mismo y dos copias del formato de
 * colón conviviendo en /admin es cómo se termina con el mismo número
 * escrito de dos formas en dos pantallas.
 *
 * Se REEXPORTA para que ningún llamador de este módulo tenga que
 * cambiar, y el comportamiento es idéntico al que había.
 *
 * Se importa ADEMÁS de reexportar: un `export ... from` solo reexporta y
 * no trae los nombres al ámbito de este archivo, donde `etiquetaPrecio`
 * y `etiquetaPrecioAmbas` los usan unas líneas más abajo.
 */
import { formatearAmbas, formatearUSD } from "@/lib/dinero";

export { formatearAmbas, formatearCRC, formatearUSD } from "@/lib/dinero";

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
