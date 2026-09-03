/**
 * Las reglas de acumulación del programa de lealtad (migración 0125).
 *
 * Lógica pura y en UN solo lugar: la usan el panel (para mostrar
 * cuántos sellos va a dar una compra ANTES de confirmarla) y el RPC la
 * reimplementa en SQL con estas mismas fórmulas. Si las dos versiones
 * divergen, el panel promete una cosa y la base otorga otra — por eso
 * los tests de acá son el contrato de ambas.
 *
 * Sobre el dinero: TODO en colones ENTEROS. El colón no usa céntimos en
 * la práctica y toda la base ya guarda `numeric` de colones enteros
 * (precio, monto_total, deposito_citas). Un float acá produce el bug
 * clásico de 0.1+0.2: puntos que aparecen o desaparecen por redondeo.
 */

export type ReglasAcumulacion = {
  /** Puntos (o sellos) fijos por visita/operación. */
  puntosPorVisita: number;
  /** Puntos por cada colón gastado. 0.05 = 5% de vuelta. */
  puntosPorColon: number;
  /** Compra mínima para acumular. null = sin mínimo. */
  compraMinima: number | null;
  /** Tope de puntos por operación. null = sin tope. */
  maxPorTransaccion: number | null;
  /** Tope de puntos por cliente por día. null = sin tope. */
  maxDiarioCliente: number | null;
};

export type ResultadoAcumulacion =
  | { otorga: true; puntos: number; recortadoPor: "transaccion" | "dia" | null }
  | { otorga: false; motivo: string };

/**
 * Cuántos puntos da una operación.
 *
 * La fórmula base es la MISMA que usa el flujo de citas desde la 0060:
 * `puntosPorVisita + floor(puntosPorColon × monto)`. El redondeo es
 * SIEMPRE hacia abajo: la regla de la casa es que un redondeo nunca
 * regala puntos — ₡1.999 con 1 punto por mil son 1 punto, no 2.
 *
 * @param monto  colones enteros de la compra. null = visita sin monto
 *               (una tarjeta de sellos pura no pregunta cuánto gastó).
 * @param otorgadosHoy  puntos que este cliente ya ganó hoy, para el
 *               tope diario. Los cuenta el servidor, nunca el navegador.
 */
export function calcularAcumulacion(
  reglas: ReglasAcumulacion,
  monto: number | null,
  otorgadosHoy = 0,
): ResultadoAcumulacion {
  if (monto !== null && (!Number.isInteger(monto) || monto < 0)) {
    return { otorga: false, motivo: "El monto debe ser una cantidad entera de colones." };
  }

  // La compra mínima solo aplica si la operación TRAE monto: una
  // tarjeta de sellos por visita no pregunta cuánto se gastó, y
  // exigirle un mínimo que nadie digita bloquearía todos los sellos.
  if (reglas.compraMinima !== null && monto !== null && monto < reglas.compraMinima) {
    return {
      otorga: false,
      motivo: `La compra mínima para acumular es ₡${reglas.compraMinima.toLocaleString("es-CR")}.`,
    };
  }

  // La multiplicación va por enteros, no por flotantes. Un
  // `floor(0.29 × 100)` ingenuo da 28 porque 0.29 no existe exacto en
  // IEEE-754: la tasa se fija a seis decimales como entero de
  // micro-puntos y se multiplica entero por entero (cabe de sobra en
  // los 2^53 seguros de Number: tasa ≤ 10^7 × monto ≤ 10^7).
  const microTasa = Math.round(reglas.puntosPorColon * 1e6);
  const porColon = monto === null ? 0 : Math.floor((microTasa * monto) / 1e6);
  let puntos = reglas.puntosPorVisita + porColon;
  let recortadoPor: "transaccion" | "dia" | null = null;

  if (puntos <= 0) {
    return { otorga: false, motivo: "Esta operación no genera puntos." };
  }

  if (reglas.maxPorTransaccion !== null && puntos > reglas.maxPorTransaccion) {
    puntos = reglas.maxPorTransaccion;
    recortadoPor = "transaccion";
  }

  if (reglas.maxDiarioCliente !== null) {
    const espacioHoy = Math.max(0, reglas.maxDiarioCliente - otorgadosHoy);
    if (espacioHoy === 0) {
      return { otorga: false, motivo: "Este cliente ya llegó a su tope de hoy." };
    }
    if (puntos > espacioHoy) {
      puntos = espacioHoy;
      recortadoPor = "dia";
    }
  }

  return { otorga: true, puntos, recortadoPor };
}

// ── Estados del programa (0125) ─────────────────────────────────────

export const ESTADOS_PROGRAMA = ["borrador", "activo", "pausado", "archivado"] as const;
export type EstadoPrograma = (typeof ESTADOS_PROGRAMA)[number];

/**
 * El estado efectivo de un programa. La columna `estado` es nueva y
 * anulable (0125): un programa viejo sin estado se deriva del booleano
 * `activo` que existía desde la 0060, para que ninguna fila necesite
 * backfill.
 */
export function estadoDelPrograma(fila: {
  estado?: string | null;
  activo: boolean;
}): EstadoPrograma {
  const e = fila.estado;
  if (e && (ESTADOS_PROGRAMA as readonly string[]).includes(e)) return e as EstadoPrograma;
  return fila.activo ? "activo" : "pausado";
}

/** Solo un programa ACTIVO acumula y canjea. Pausado conserva todo. */
export function programaOpera(fila: { estado?: string | null; activo: boolean }): boolean {
  return estadoDelPrograma(fila) === "activo";
}

/**
 * ¿Se puede activar? La regla de la spec: sin reglas que otorguen algo
 * y sin al menos una recompensa válida, activar produce una tarjeta que
 * se ve perfecta y nunca avanza ni promete nada.
 *
 * ------------------------------------------------------------------
 * LA RECOMPENSA SOLO SE LE PIDE A QUIEN LA USA
 * ------------------------------------------------------------------
 * La exigencia de «al menos una recompensa activa» estaba escrita para
 * las tarjetas de sellos y puntos, que son las únicas donde el saldo
 * no significa nada por sí solo: «7» no es un premio, el premio es la
 * recompensa que se canjea con esos 7.
 *
 * Aplicada a los otros seis tipos (0135) producía un callejón sin
 * salida REAL, verificado: un cupón, un descuento, una membresía, un
 * evento o un cashback nunca nacen con una recompensa sembrada —su
 * beneficio viaja adentro de la tarjeta— así que el dueño que pausaba
 * uno de esos programas ya no lo podía reactivar nunca. La pantalla le
 * contestaba «Agregá al menos una recompensa activa»: una instrucción
 * que no tenía cómo obedecer, porque tampoco había dónde agregarla.
 *
 * Quién la pide lo decide `pideRecompensa()` (src/lib/lealtad/editable.ts).
 * Llega como booleano y no como tipo para no cruzar los dos módulos:
 * este archivo es el contrato con el SQL del RPC y no debe saber del
 * catálogo de tipos.
 *
 * Por defecto `true`, o sea el comportamiento de siempre: quien no lo
 * pase recibe exactamente el veredicto que recibía antes.
 */
export function puedeActivarse(programa: {
  puntos_por_visita: number;
  puntos_por_colon: number;
  recompensasActivas: number;
  /** ¿Esta clase de tarjeta necesita una recompensa para prometer algo? */
  pideRecompensa?: boolean;
}): { puede: true } | { puede: false; motivo: string } {
  if (programa.puntos_por_visita <= 0 && programa.puntos_por_colon <= 0) {
    return {
      puede: false,
      motivo: "El programa tiene que dar algo: puntos por visita, por colón, o los dos.",
    };
  }
  if ((programa.pideRecompensa ?? true) && programa.recompensasActivas < 1) {
    return {
      puede: false,
      motivo: "Agregá al menos una recompensa activa antes de activar el programa.",
    };
  }
  return { puede: true };
}

/**
 * Las transiciones permitidas.
 *
 * Una archivada se RESTAURA a `pausado`: no se borra nada al archivar
 * —el historial y los sellos quedan— así que tampoco hay nada que
 * impida volver. Que el destino sea `pausado` y no `activo` es
 * deliberado: la activación tiene que volver a pasar por
 * `puedeActivarse` (y el que llama debe comprobar el cupo del paquete,
 * porque restaurar re-ocupa un lugar — ver `cambiarEstadoPrograma`).
 *
 * A borrador solo se vuelve sin movimientos: con historial encima, el
 * historial no se borra ni se "resetea".
 */
export function transicionValida(
  de: EstadoPrograma,
  a: EstadoPrograma,
  tieneMovimientos: boolean,
): boolean {
  if (de === a) return false;
  if (de === "archivado") return a === "pausado" || (!tieneMovimientos && a === "borrador");
  if (a === "borrador") return de === "pausado" && !tieneMovimientos;
  return true; // borrador→activo (validado aparte), activo↔pausado, *→archivado
}
