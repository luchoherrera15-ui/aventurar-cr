/**
 * EL LÍMITE DE PETICIONES — la tabla, la ventana y las cabeceras.
 *
 * Lógica pura: acá no se consulta nada. El conteo lo hace Postgres
 * (`api_rate_limit_tomar`, 0177) porque en Vercel cada invocación es un
 * proceso aislado y un contador en memoria cuenta una fracción
 * arbitraria del tráfico — o sea, no limita.
 *
 * ------------------------------------------------------------------
 * FALLA CERRADO, Y POR QUÉ ESO ES TOLERABLE EN UNA CAJA
 * ------------------------------------------------------------------
 * Si el contador no responde, la operación NO se ejecuta: 503. Eso solo
 * es aceptable porque `referencia` es obligatoria en
 * `POST /acreditaciones`: el POS reintenta, el reintento es idempotente
 * y el cliente espera dos segundos. Las dos piezas se sostienen
 * mutuamente — quitar la idempotencia obligatoria convertiría este
 * "falla cerrado" en "el sello se perdió".
 *
 * ------------------------------------------------------------------
 * POR QUÉ HAY UN TECHO POR NEGOCIO ADEMÁS DEL DE LA LLAVE
 * ------------------------------------------------------------------
 * Sin él, un integrador con tres llaves ahoga al mismo negocio por la
 * puerta de atrás y cada llave por separado se ve dentro de su límite.
 */

/** Los ámbitos del contador. El ámbito separa claves que no deben chocar. */
export type AmbitoLimite =
  | "llave"
  | "llavew"
  | "llaveh"
  | "rancho"
  | "saldo"
  | "authfail";

export type ReglaLimite = {
  ambito: AmbitoLimite;
  limite: number;
  ventanaSegundos: number;
  /** Para el mensaje al integrador. */
  descripcion: string;
};

export const LIMITES: Record<AmbitoLimite, ReglaLimite> = {
  /** Cualquier llamada de la llave. Lo toma `api_lealtad_autenticar`. */
  llave: { ambito: "llave", limite: 60, ventanaSegundos: 60, descripcion: "60 por minuto" },
  /** Las que ESCRIBEN. Más caras y más peligrosas: menos presupuesto. */
  llavew: { ambito: "llavew", limite: 30, ventanaSegundos: 60, descripcion: "30 por minuto" },
  /** El sostenido: mata al bucle que respeta el minuto y corre todo el día. */
  llaveh: { ambito: "llaveh", limite: 1000, ventanaSegundos: 3600, descripcion: "1000 por hora" },
  /** El techo del NEGOCIO, sumando todas sus llaves. */
  rancho: { ambito: "rancho", limite: 5000, ventanaSegundos: 3600, descripcion: "5000 por hora" },
  /**
   * `GET /saldo` tiene su propio límite, más duro que el general. Es el
   * único endpoint que devuelve algo derivado de una persona (las
   * iniciales), y el serial que lo abre es fotografiable desde la fila
   * del mostrador. Si algún día alguien junta serials, que no pueda
   * consultarlos en tandas.
   */
  saldo: { ambito: "saldo", limite: 20, ventanaSegundos: 60, descripcion: "20 por minuto" },
  /** Fallos de credencial por huella de IP. 20 en 10 minutos. */
  authfail: {
    ambito: "authfail",
    limite: 20,
    ventanaSegundos: 600,
    descripcion: "20 fallos en 10 minutos",
  },
};

/**
 * El inicio de la ventana actual, por TRUNCAMIENTO.
 *
 * Tiene que dar exactamente lo mismo que
 * `floor(extract(epoch from now()) / ventana) * ventana` de la 0177: si
 * las dos cuentas se separan, las cabeceras le mienten al integrador
 * sobre cuándo puede volver a intentar.
 */
export function inicioDeVentana(ahoraMs: number, ventanaSegundos: number): number {
  const segundos = Math.floor(ahoraMs / 1000);
  return Math.floor(segundos / ventanaSegundos) * ventanaSegundos;
}

/** Cuántos segundos faltan para que la ventana se reinicie (mínimo 1). */
export function segundosParaReinicio(ahoraMs: number, ventanaSegundos: number): number {
  const fin = inicioDeVentana(ahoraMs, ventanaSegundos) + ventanaSegundos;
  return Math.max(1, fin - Math.floor(ahoraMs / 1000));
}

/** Cuánto presupuesto queda. Nunca negativo: un "-7" no le dice nada a nadie. */
export function restante(limite: number, conteo: number): number {
  return Math.max(0, limite - Math.max(0, conteo));
}

/**
 * Las cabeceras del límite, en español y con nombres estables.
 *
 * `Retry-After` va en la respuesta 429 porque es el estándar que
 * cualquier cliente HTTP ya entiende; las tres `X-RateLimit-*` son para
 * el que está integrando y quiere frenar antes de chocar.
 */
export function cabecerasDeLimite(
  regla: ReglaLimite,
  conteo: number,
  ahoraMs: number,
): Record<string, string> {
  const reinicio = inicioDeVentana(ahoraMs, regla.ventanaSegundos) + regla.ventanaSegundos;
  return {
    "X-RateLimit-Limite": String(regla.limite),
    "X-RateLimit-Restante": String(restante(regla.limite, conteo)),
    "X-RateLimit-Reinicio": String(reinicio),
  };
}

/**
 * El límite de la llave puede venir ajustado por autorización (un
 * integrador con volumen real pide más). Nunca por debajo de 1, nunca
 * por encima del techo de la regla base multiplicado por diez: un valor
 * fuera de rango en la base no debería poder abrir la llave del todo.
 */
export function limiteEfectivo(base: ReglaLimite, configurado: number | null): ReglaLimite {
  if (configurado === null || !Number.isFinite(configurado)) return base;
  const limite = Math.min(Math.max(Math.trunc(configurado), 1), base.limite * 10);
  return { ...base, limite, descripcion: `${limite} por ${base.ventanaSegundos} s` };
}
