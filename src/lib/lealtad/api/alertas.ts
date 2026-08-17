/**
 * LAS ALERTAS DE ANOMALÍA — en la entrega 1, no después.
 *
 * Sin detección, todo lo demás de este directorio es teoría: el hash de
 * la llave, el `ref` opaco y los límites sirven para que un incidente
 * sea acotado y reversible, pero alguien tiene que ENTERARSE. La
 * diferencia entre «lo detectamos en horas» y «lo detectamos cuando el
 * dueño se quejó» es todo lo que le pasa a los clientes en el medio.
 *
 * Las tres señales, y por qué cada una:
 *
 * · IP NUEVA. Un POS instalado en una barbería llama desde una o dos
 *   direcciones. La primera petición desde una huella que nunca se vio
 *   es, casi siempre, el `.env` del integrador corriendo en otro lado.
 * · VOLUMEN. Más de tres veces la mediana de los últimos 30 días.
 *   Contra la mediana y no contra el promedio: un solo día raro no
 *   corre la mediana, y justamente los días raros son los que se
 *   quieren detectar.
 * · MIEMBROS DISTINTOS. Mil llamadas a la misma tarjeta es un POS con
 *   un bug; mil llamadas a mil tarjetas distintas es otra cosa. Es la
 *   señal que separa el error del barrido.
 *
 * Lógica pura, sin base y sin reloj: cada umbral se prueba contra un
 * caso concreto en vez de esperar a que pase de verdad.
 */

export type SenalesDeUso = {
  /** Llamadas del día que se está juzgando. */
  llamadasHoy: number;
  /** La mediana de llamadas diarias de los 30 días previos. */
  medianaPrevia: number;
  /** Huellas de IP que nunca se habían visto para esta llave. */
  ipsNuevas: number;
  /** Tarjetas distintas tocadas hoy. */
  miembrosHoy: number;
  /** La mediana de tarjetas distintas por día, de los 30 previos. */
  medianaMiembros: number;
  /** Respuestas 429 del día: alguien empujando contra el techo. */
  bloqueos429: number;
};

export type Veredicto = {
  nivel: "ninguna" | "aviso" | "suspender";
  motivos: string[];
};

/** Por debajo de esto no hay estadística que valga: son tres llamadas. */
const PISO_DE_RUIDO = 20;

/** Tres veces la mediana avisa; diez veces apaga. */
const FACTOR_AVISO = 3;
const FACTOR_SUSPENDER = 10;

/** 429 sostenidos: alguien está empujando el techo a propósito. */
const BLOQUEOS_QUE_IMPORTAN = 50;

export function evaluarAnomalias(senales: SenalesDeUso): Veredicto {
  const motivos: string[] = [];
  let suspender = false;

  if (senales.ipsNuevas > 0) {
    motivos.push(
      senales.ipsNuevas === 1
        ? "La llave se usó desde una dirección desde la que nunca se había usado."
        : `La llave se usó desde ${senales.ipsNuevas} direcciones nuevas.`,
    );
  }

  // El piso evita el falso positivo del primer día: pasar de 2 a 8
  // llamadas es cuadruplicar, y no significa nada.
  const hayBase = senales.medianaPrevia >= PISO_DE_RUIDO;
  if (hayBase && senales.llamadasHoy > senales.medianaPrevia * FACTOR_SUSPENDER) {
    suspender = true;
    motivos.push(
      `Volumen ${Math.round(senales.llamadasHoy / senales.medianaPrevia)}× lo normal ` +
        `(${senales.llamadasHoy} contra una mediana de ${senales.medianaPrevia}).`,
    );
  } else if (hayBase && senales.llamadasHoy > senales.medianaPrevia * FACTOR_AVISO) {
    motivos.push(
      `Volumen ${Math.round(senales.llamadasHoy / senales.medianaPrevia)}× lo normal ` +
        `(${senales.llamadasHoy} contra una mediana de ${senales.medianaPrevia}).`,
    );
  }

  // El barrido: muchas tarjetas distintas donde antes había pocas.
  const hayBaseMiembros = senales.medianaMiembros >= PISO_DE_RUIDO;
  if (hayBaseMiembros && senales.miembrosHoy > senales.medianaMiembros * FACTOR_SUSPENDER) {
    suspender = true;
    motivos.push(
      `Se tocaron ${senales.miembrosHoy} tarjetas distintas en un día ` +
        `(la mediana es ${senales.medianaMiembros}). Eso parece un barrido, no un mostrador.`,
    );
  } else if (hayBaseMiembros && senales.miembrosHoy > senales.medianaMiembros * FACTOR_AVISO) {
    motivos.push(
      `Se tocaron ${senales.miembrosHoy} tarjetas distintas en un día ` +
        `(la mediana es ${senales.medianaMiembros}).`,
    );
  }

  if (senales.bloqueos429 >= BLOQUEOS_QUE_IMPORTAN) {
    motivos.push(
      `${senales.bloqueos429} peticiones rechazadas por límite: algo está empujando el techo.`,
    );
  }

  if (motivos.length === 0) return { nivel: "ninguna", motivos: [] };
  return { nivel: suspender ? "suspender" : "aviso", motivos };
}

/**
 * La mediana de una serie. Sin dependencias y sin sorpresas: con la
 * lista vacía devuelve 0, que combinado con el piso de ruido significa
 * «todavía no hay con qué comparar».
 */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
}
