/**
 * El contrato entre el asistente de reservas y el modelo que le
 * contesta — hoy solo lo implementa `ClaudeProvider`
 * (claude-provider.ts), pero el resto del código (empezando por
 * `asistente-ia.ts`) ya no habla con Anthropic directamente: habla
 * con esta interfaz.
 *
 * Mínimo a propósito: representa solo lo que `asistente-ia.ts`
 * necesita hoy (mandar un system + un historial de turnos, recibir
 * texto o un motivo de por qué no lo hay) — no una superficie pensada
 * para todas las capacidades futuras de Gemini u otro proveedor. Eso
 * se amplía cuando haga falta, no antes.
 */

/** Un turno de la conversación, ya fusionado y en el orden que exige
 *  cualquier API de chat: alternando `user`/`assistant`. */
export type TurnoIA = { role: "user" | "assistant"; content: string };

export type SolicitudIA = {
  /** El identificador de modelo, tal como lo entiende el proveedor
   *  (hoy un id de Claude, p. ej. "claude-haiku-4-5"). */
  modelo: string;
  maxTokens: number;
  system: string;
  turnos: TurnoIA[];
  /**
   * «No pienses, contestá» — para respuestas cortas donde razonar es
   * puro costo y pura espera.
   *
   * NO ES UNA MICRO-OPTIMIZACIÓN. Los Gemini 3.x razonan por defecto, y
   * ese razonamiento se cobra COMO SALIDA (la parte cara: $2,50 el
   * millón contra $0,30 de entrada). Medido contra la API con el chat
   * de la landing de Lealtad: **172 segundos** para una pregunta de una
   * línea cuya respuesta son tres oraciones. El visitante daba el chat
   * por muerto y se iba.
   *
   * Solo lo respeta `GeminiProvider` (`thinkingBudget: 0`).
   * `ClaudeProvider` lo ignora: los modelos de Anthropic no razonan
   * salvo que se les pida, así que acá no habría nada que apagar.
   */
  sinRazonamiento?: boolean;
};

/**
 * El consumo de la llamada, ya en nombres genéricos — nunca los que
 * usa Anthropic en su respuesta (`input_tokens`, `cache_read_input_tokens`,
 * etc.). `asistente-ia.ts` los vuelve a traducir al pasarlos a
 * `registrar-uso.ts`, que todavía espera la forma de Anthropic — esa
 * capa de registro/costeo queda fuera de esta fase a propósito (ver
 * el comentario de `UsageAnthropic` en registrar-uso.ts).
 *
 * `tokensCacheEscritura`/`tokensCacheLectura` admiten `null` (no `0`)
 * a propósito: `0` diría "se reportó, y fue cero", pero un proveedor
 * puede simplemente no tener ese concepto. Gemini es el caso real —
 * su caché de contexto se crea explícitamente aparte (`ai.caches`),
 * no como un costo inline de cada llamada como en Claude, así que no
 * hay ningún número honesto que poner ahí. Inventar un 0 sería mentir
 * en el panel de costos; `null` dice "este proveedor no lo reporta".
 */
export type UsoIAProveedor = {
  tokensEntrada: number;
  tokensSalida: number;
  tokensCacheEscritura: number | null;
  tokensCacheLectura: number | null;
};

/**
 * Qué pasó con la llamada, en una semántica genérica en vez de los
 * `stop_reason` textuales de Anthropic ("refusal", "max_tokens"...).
 * `asistente-ia.ts` decide qué hacer (loguear, cobrar, insertar el
 * mensaje) mirando SOLO `outcome` — nunca un string específico de un
 * proveedor.
 *
 *  - `success`: hay texto para mostrarle al cliente.
 *  - `refused`: el modelo declinó responder (moderación del proveedor).
 *  - `max_output`: se cortó por el tope de salida antes de terminar.
 *  - `empty_response`: terminó "bien" pero sin ningún bloque de texto
 *    — `detalleProveedor` lleva el motivo crudo del proveedor SOLO
 *    para el mensaje de diagnóstico (nunca para decidir el `outcome`,
 *    que ya lo decidió el provider).
 *  - `provider_error`: la llamada en sí falló (HTTP no-2xx). Fallas de
 *    red o de parseo no entran acá: igual que antes de este refactor,
 *    esas se dejan propagar como excepción — `responderConAsistente`
 *    ya las atrapa en su try/catch general.
 */
export type ResultadoIA =
  | { outcome: "success"; texto: string; usage: UsoIAProveedor | null }
  | { outcome: "refused"; usage: UsoIAProveedor | null }
  | { outcome: "max_output"; usage: UsoIAProveedor | null }
  | { outcome: "empty_response"; usage: UsoIAProveedor | null; detalleProveedor: string | null }
  | { outcome: "provider_error"; mensaje: string };

export interface AIProvider {
  generar(solicitud: SolicitudIA): Promise<ResultadoIA>;
}
