import { estadoVisible, type FilaPrograma } from "@/lib/lealtad/programas";
import { resumenDeFila, type FilaElegible } from "@/lib/wallet/programa-principal";

/**
 * CUÁLES TARJETAS OCUPAN EL CUPO DEL PAQUETE.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO ES UNA SOLA FUNCIÓN Y NO DOS PARECIDAS
 * ------------------------------------------------------------------
 * El tope de tarjetas lo cuentan DOS lados: el panel, para decidir si
 * pinta «Crear una tarjeta» o «Llegaste al tope», y el servidor
 * (`crear-actions.ts`), para dejar crear o no. Cada uno lo contaba a su
 * manera y las dos maneras no eran la misma:
 *
 *   · el panel contaba TODAS las filas, archivadas incluidas;
 *   · el servidor contaba con `.neq("estado", "archivado")`.
 *
 * El resultado era el peor final posible para el dueño: el aviso le
 * decía «archivá una o subí de paquete», archivaba una, y el panel
 * seguía diciendo «Llegaste al tope» con el botón de crear reemplazado.
 * Obedeció la instrucción y el producto le quedó muerto.
 *
 * (Y de paso, el `.neq` del servidor tampoco era el criterio correcto:
 * en SQL, `estado <> 'archivado'` descarta también las filas con
 * `estado` NULL — las de antes de la 0125, que están vivas y sí ocupan
 * cupo. `estadoVisible` las resuelve por el booleano `activo`.)
 *
 * Ahora los dos preguntan lo mismo acá.
 */

/**
 * ¿Esta tarjeta le ocupa un lugar al negocio?
 *
 * Archivada = no. Para volver a emitir hay que crear otra, no reanimar
 * la archivada (`transicionValida` en reglas.ts: con historial, archivar
 * es para siempre). Todo lo demás —borrador, pausada, programada,
 * vencida— sí ocupa: existe, se puede editar y se puede reactivar.
 */
export function ocupaCupo(fila: FilaPrograma, ahoraCR: string): boolean {
  return estadoVisible(fila, ahoraCR) !== "archivado";
}

/** Las que cuentan contra el tope, de una lista cualquiera. */
export function lasQueOcupanCupo<T extends FilaPrograma>(
  filas: readonly T[],
  ahoraCR: string,
): T[] {
  return filas.filter((f) => ocupaCupo(f, ahoraCR));
}

/**
 * ¿Ya no caben más? `tope` en null = el paquete no pone límite.
 *
 * Es `>=` y no `===`: un negocio puede quedar por encima del tope si
 * baja de paquete, y ahí tampoco se crea una más.
 */
export function cupoLleno({ ocupadas, tope }: { ocupadas: number; tope: number | null }): boolean {
  return tope !== null && ocupadas >= tope;
}

/** Una tarjeta contada, con lo que hace falta para NOMBRARLA en el aviso. */
export type TarjetaDelCupo = FilaElegible & { nombre: string };

/**
 * Lee una fila cruda (`select *`) para contarla.
 *
 * El nombre se lee acá porque el aviso del servidor las lista: un
 * «llegaste al tope» que no dice QUÉ lo ocupa es un callejón sin salida
 * —ya le pasó al dueño con una tarjeta en borrador que ninguna pantalla
 * mostraba.
 */
export function tarjetaDelCupo(fila: Record<string, unknown>): TarjetaDelCupo {
  return {
    ...resumenDeFila(fila),
    nombre: typeof fila.nombre === "string" && fila.nombre.trim() ? fila.nombre : "Tarjeta",
  };
}
