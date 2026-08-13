import { estadoVisible, operaAhora, type FilaPrograma } from "@/lib/lealtad/programas";

/**
 * CUÁL DE LAS TARJETAS DEL NEGOCIO MANDA.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * Hasta la 0134 había UNA tarjeta por negocio (`unique(rancho_id)`) y
 * medio módulo la leía con `.maybeSingle()`. Cuando la migración liberó
 * ese único, `maybeSingle` dejó de ser "traeme la que hay" y pasó a ser
 * "fallá si hay más de una": con dos tarjetas devuelve error y `data` en
 * null. El síntoma es siempre el mismo y siempre miente — «este negocio
 * todavía no tiene programa de lealtad»— y le pega justo al negocio más
 * avanzado, el que armó una segunda tarjeta.
 *
 * Ya rompió la página pública `/tarjeta/[slug]`, que es a donde apunta
 * el QR IMPRESO del mostrador: el póster deja de funcionar sin que nadie
 * toque nada.
 *
 * ------------------------------------------------------------------
 * UNA SOLA ELECCIÓN PARA TODAS LAS PANTALLAS
 * ------------------------------------------------------------------
 * El panel del negocio, la página pública y los dos generadores de pases
 * (Apple y Google) tienen que elegir LA MISMA. Que cada uno eligiera "la
 * primera que devuelva su consulta" sería peor que el bug original: el
 * dueño configuraría una tarjeta y el cliente recibiría la otra, sin
 * ningún error a la vista.
 *
 * El orden de preferencia:
 *
 *   1. la que está EMITIENDO ahora (`operaAhora`);
 *   2. si ninguna emite, la primera que no esté archivada — el panel
 *      tiene algo que mostrar y que arreglar;
 *   3. si todas están archivadas, la primera.
 *
 * Y el desempate es POR ID, no por el orden en que llegó la consulta.
 * No es que gane "la más vieja": es que gana SIEMPRE LA MISMA. Postgres
 * no garantiza el orden de un `select` sin `order by`, y las cuatro
 * pantallas consultan con filtros distintos —o sea, con planes
 * distintos—; sin un desempate estable, dos de ellas podrían elegir
 * tarjetas distintas en la misma visita.
 */

/** Lo mínimo para ubicar una tarjeta y poder desempatar. */
export type FilaElegible = FilaPrograma & { id: string };

/**
 * Lo que hace falta de una fila CRUDA (`select *`).
 *
 * Se lee campo por campo con `typeof` porque la fila puede venir de una
 * base que todavía no corrió la 0125 (sin `estado`) o la 0136 (sin las
 * vigencias): lo que no está es null, y `estadoVisible` ya sabe
 * derivarlo del booleano `activo` de la 0060.
 */
export function resumenDeFila(fila: Record<string, unknown>): FilaElegible {
  return {
    id: typeof fila.id === "string" ? fila.id : "",
    estado: typeof fila.estado === "string" ? fila.estado : null,
    activo: fila.activo === true,
    vigente_desde: typeof fila.vigente_desde === "string" ? fila.vigente_desde : null,
    vigente_hasta: typeof fila.vigente_hasta === "string" ? fila.vigente_hasta : null,
  };
}

/** El desempate estable. Ver arriba: siempre la misma, no la más vieja. */
function porId<T extends FilaElegible>(filas: readonly T[]): T[] {
  return [...filas].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * La tarjeta que representa al negocio. Nunca falla: si el negocio tiene
 * filas, devuelve una.
 *
 * `ahoraCR` es el momento actual en hora de Costa Rica
 * ("2026-08-13T14:30"), el mismo que usa `estadoVisible`.
 */
export function elegirPrograma<T extends FilaElegible>(
  filas: readonly T[],
  ahoraCR: string,
): T | null {
  const orden = porId(filas);
  return (
    orden.find((f) => operaAhora(f, ahoraCR)) ??
    orden.find((f) => estadoVisible(f, ahoraCR) !== "archivado") ??
    orden[0] ??
    null
  );
}

/**
 * La tarjeta que puede ENTREGARLE un pase a un cliente ahora mismo, o
 * null si el negocio no tiene ninguna operando.
 *
 * Sale de `elegirPrograma` a propósito, en vez de buscar por su cuenta:
 * así la que emite el pase es exactamente la que el panel muestra como
 * principal, y no una hermana suya.
 */
export function programaQueEmite<T extends FilaElegible>(
  filas: readonly T[],
  ahoraCR: string,
): T | null {
  const elegida = elegirPrograma(filas, ahoraCR);
  return elegida && operaAhora(elegida, ahoraCR) ? elegida : null;
}

type ConFila = FilaElegible & { fila: Record<string, unknown> };

function pares(filas: readonly Record<string, unknown>[]): ConFila[] {
  return filas.map((f) => ({ ...resumenDeFila(f), fila: f }));
}

/** `elegirPrograma` para quien trabaja con filas crudas (`select *`). */
export function elegirDeFilasCrudas(
  filas: readonly Record<string, unknown>[],
  ahoraCR: string,
): Record<string, unknown> | null {
  return elegirPrograma(pares(filas), ahoraCR)?.fila ?? null;
}

/** `programaQueEmite` para quien trabaja con filas crudas (`select *`). */
export function emisoraDeFilasCrudas(
  filas: readonly Record<string, unknown>[],
  ahoraCR: string,
): Record<string, unknown> | null {
  return programaQueEmite(pares(filas), ahoraCR)?.fila ?? null;
}
