/**
 * ═══════════════════════════════════════════════════════════════════
 *  POR DÓNDE ENTRÓ CADA SELLO
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── LA PREGUNTA QUE EL PANEL NO PODÍA CONTESTAR ─────────────────────
 *
 * Pedido del dueño: «control completo de a quién se le entregan
 * sellos». La pantalla de Actividad mostraba QUIÉN (el colaborador,
 * o «sistema») y CUÁNTO, pero no POR DÓNDE. Y eso importa más de lo que
 * parece, porque «sistema» tapaba tres cosas muy distintas:
 *
 *   · un sello por cita cumplida (`motor.ts`),
 *   · un descuento del cron de vencimiento (`vencer-sellos.ts`),
 *   · y un sello dado por la API pública, donde `usuario_id` va en null
 *     A PROPÓSITO (`acreditaciones/route.ts`: «quién fue de verdad
 *     queda en llave_id y en la bitácora») — pero `llave_id` no se
 *     mostraba en ninguna pantalla.
 *
 * O sea: un integrador con una llave filtrada podía repartir sellos y
 * en el panel se veía igual que un premio automático por una cita.
 *
 * ── DE DÓNDE SALE LA RESPUESTA, SIN MIGRACIÓN ───────────────────────
 *
 * `transacciones_puntos` NO tiene columna de canal. Pero cada camino ya
 * viene estampando un prefijo propio en `referencia`, que es una
 * columna que existe desde la 0060 y que el panel nunca mostró:
 *
 *   `mostrador:…`  la caja, atendiendo a mano (atencion-manual.tsx)
 *   `escaneo:…`    el escáner de QR (escaner-actions.ts)
 *   `panel:…`      el panel, sin número de factura
 *   `canje:…`      un canje hecho desde el panel
 *   `api:…`        la API pública v1 (entrada.ts, prefijo obligatorio)
 *   `cita:…`       el automatismo de citas cumplidas
 *   `venc:…`       el corte por vencimiento de sellos
 *
 * Se lee de ahí y no de una columna nueva porque el dato YA ESTÁ
 * GUARDADO en todas las filas históricas: una columna nueva contestaría
 * solo por los sellos de mañana, y la pregunta del dueño es sobre los
 * de ayer.
 *
 * ── LO QUE ESTO **NO** PUEDE CONTESTAR ──────────────────────────────
 *
 * Y hay que decirlo, porque un badge que se equivoca es peor que no
 * tener badge:
 *
 *   · Cuando el POS manda su NÚMERO DE FACTURA, ese número reemplaza la
 *     referencia entera y con ella el prefijo. Esa fila cae en `panel`
 *     por descarte (hay un `usuario_id`, o sea que la originó una
 *     persona identificada del equipo) y no en un canal preciso.
 *   · No hay IP ni dispositivo en el ledger para NINGÚN camino. Para la
 *     API existen en `bitacora_api_lealtad` (`ip_hmac`, `user_agent`),
 *     enlazables por `llave_id` + `referencia`; para el mostrador y el
 *     escáner no existen en ninguna parte.
 *   · No se sabe desde QUÉ TELÉFONO del local se dio un sello, solo con
 *     qué cuenta de colaborador.
 *
 * Función pura: recibe la fila ya leída y decide. Se prueba entera sin
 * base, que es donde vive el riesgo (la tabla de prefijos).
 */

export type CanalDelSello =
  /** La caja, buscando al cliente por nombre y sumando a mano. */
  | "mostrador"
  /** El escáner de QR del modo mostrador. */
  | "escaner"
  /** El panel del dueño (incluye el canje y el POS con factura). */
  | "panel"
  /** La API pública v1, con llave de un desarrollador. */
  | "api"
  /** El automatismo: una cita marcada como cumplida. */
  | "cita"
  /** El cron que reinicia los sellos vencidos. */
  | "vencimiento"
  /** No hay con qué decidir. Se dice así, no se adivina. */
  | "desconocido";

/** Prefijo de `referencia` → canal. El orden no importa: son exactos. */
const POR_PREFIJO: readonly (readonly [string, CanalDelSello])[] = [
  ["mostrador:", "mostrador"],
  ["escaneo:", "escaner"],
  ["panel:", "panel"],
  ["canje:", "panel"],
  ["api:", "api"],
  ["cita:", "cita"],
  ["venc:", "vencimiento"],
];

/**
 * Por dónde entró este movimiento.
 *
 * `llaveId` GANA sobre el prefijo, y es la única señal estructurada que
 * hay en toda la tabla: la 0178 la puso justamente para poder revertir
 * en bloque lo de una llave filtrada. Si está, es de la API y punto —
 * aunque el integrador haya mandado una referencia con cualquier forma.
 */
export function canalDelMovimiento(fila: {
  referencia?: string | null;
  llaveId?: string | null;
  usuarioId?: string | null;
}): CanalDelSello {
  if (fila.llaveId) return "api";

  const ref = (fila.referencia ?? "").trim();
  for (const [prefijo, canal] of POR_PREFIJO) {
    if (ref.startsWith(prefijo)) return canal;
  }

  // Sin prefijo reconocible: si hay una persona del equipo detrás, fue
  // por el panel con un número de factura propio. Si no hay nadie, no
  // se inventa un canal — «desconocido» es la respuesta honesta y la
  // que hace que se note si aparece un camino nuevo sin prefijo.
  return fila.usuarioId ? "panel" : "desconocido";
}

/** Cómo se lee en pantalla. Corto: va en una píldora, al lado de otras. */
export const ETIQUETA_CANAL: Record<CanalDelSello, string> = {
  mostrador: "mostrador",
  escaner: "escáner",
  panel: "panel",
  api: "API",
  cita: "cita",
  vencimiento: "vencimiento",
  desconocido: "sin origen",
};

/**
 * Los canales que NO son una persona del equipo dándole un sello a
 * alguien enfrente. Se pintan distinto porque son los que el dueño
 * mira con otro ojo cuando algo no cuadra.
 */
export const CANALES_AUTOMATICOS: readonly CanalDelSello[] = [
  "api",
  "cita",
  "vencimiento",
  "desconocido",
];
