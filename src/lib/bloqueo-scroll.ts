/**
 * ════════════════════════════════════════════════════════════════════
 *  UN SOLO CANDADO PARA EL SCROLL DEL BODY, CON CONTADOR
 * ════════════════════════════════════════════════════════════════════
 *
 * Cuando algo se abre encima de la página (un modal, una hoja inferior)
 * hay que congelar el scroll de atrás. La forma obvia —y la que había
 * en dos lugares distintos— es:
 *
 *     const anterior = document.body.style.overflow;
 *     document.body.style.overflow = "hidden";
 *     return () => { document.body.style.overflow = anterior; };
 *
 * Funciona con UNA capa. Con dos deja la página rota, y no de a poco:
 *
 *   1. La hoja abre  → guarda "" (el valor real) y pone "hidden".
 *   2. El modal abre → guarda "hidden" (¡el de la hoja, no el real!)
 *                      y pone "hidden".
 *   3. La hoja cierra→ restaura "" ... con el modal todavía abierto:
 *                      el fondo scrollea detrás del modal.
 *   4. El modal cierra→ restaura "hidden" — el valor que le robó a la
 *                      hoja. LA PÁGINA QUEDA CONGELADA PARA SIEMPRE.
 *                      Sin nada abierto, sin error en consola, sin
 *                      pista de por qué. La única salida es recargar.
 *
 * El paso 4 es el grave: no se degrada, se rompe, y el síntoma aparece
 * lejos de la causa.
 *
 * La cura es no guardar el valor por capa sino CONTAR capas. Se guarda
 * el valor real una sola vez —cuando el contador pasa de 0 a 1— y se
 * restaura una sola vez, cuando vuelve a 0. Cuántas capas se apilen en
 * el medio deja de importar.
 *
 * ⚠️ SIRVE SOLO SI LO USAN TODOS. Una capa que siga haciendo el
 * guardar/restaurar a mano vuelve a meter exactamente el paso 4. Si
 * agregás un modal nuevo, usá esto.
 */

let capas = 0;
let overflowOriginal: string | null = null;

/**
 * Congela el scroll del body y devuelve la función que lo suelta.
 *
 * Pensado para usarse como cuerpo de un `useEffect`:
 *
 *     useEffect(() => bloquearScroll(), []);
 *
 * Soltar dos veces la misma capa NO descuenta dos veces: cada llamada
 * entrega una función que solo actúa una vez. En React 18 en modo
 * estricto los efectos se montan, desmontan y vuelven a montar, y sin
 * esa guarda el contador quedaría desbalanceado.
 */
export function bloquearScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (capas === 0) overflowOriginal = document.body.style.overflow;
  capas += 1;
  document.body.style.overflow = "hidden";

  let soltada = false;
  return () => {
    if (soltada) return;
    soltada = true;
    capas -= 1;
    if (capas <= 0) {
      capas = 0;
      document.body.style.overflow = overflowOriginal ?? "";
      overflowOriginal = null;
    }
  };
}
