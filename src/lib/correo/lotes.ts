/**
 * ════════════════════════════════════════════════════════════════════
 *  MANDAR UNA TANDA DE CORREOS SIN SATURAR AL PROVEEDOR
 * ════════════════════════════════════════════════════════════════════
 *
 * Este bucle estaba escrito DOS VECES, con los mismos números literales
 * (`TAMANO_LOTE = 10`, `PAUSA_ENTRE_LOTES_MS = 1000`): una en
 * `admin/campanas/actions.ts` y otra en `lib/campanas/citas.ts`. Dos
 * copias del mismo criterio de throttling son dos verdades el día que
 * Resend cambie su límite — y la que nadie actualice va a empezar a
 * perder correos en silencio.
 *
 * ── POR QUÉ LOTES Y NO TODO DE UNA ──────────────────────────────────
 *
 * Un `Promise.all` sobre 500 correos abre 500 conexiones a la vez.
 * Resend responde 429 a la mitad, y como `enviarCorreo` se traga los
 * errores y devuelve `{enviado:false}`, el resultado sería «250
 * fallidos» sin ninguna pista de por qué. Los lotes con pausa
 * mantienen el ritmo por debajo del límite.
 *
 * ── LA PAUSA VA ENTRE LOTES, NUNCA DESPUÉS DEL ÚLTIMO ───────────────
 *
 * Es la parte que se hace mal si se escribe rápido: un `sleep` al final
 * de cada vuelta agrega un segundo muerto a TODA campaña, incluidas las
 * de un solo lote. Con 10 destinatarios eso es un segundo entero de
 * nada mientras el admin mira una pantalla trabada.
 */

/** Cuántos correos salen a la vez. */
export const TAMANO_LOTE = 10;

/** Cuánto se espera entre un lote y el siguiente. */
export const PAUSA_ENTRE_LOTES_MS = 1000;

export type ResultadoLotes = { enviados: number; fallidos: number };

/**
 * Recorre `destinatarios` en lotes, llamando a `enviarUno` con cada uno.
 *
 * `enviarUno` devuelve `{enviado}` — la misma forma que `enviarCorreo`,
 * así que se le puede pasar casi directo. Nunca lanza: si una promesa
 * revienta, ese correo cuenta como fallido y la tanda sigue. Una
 * campaña a 300 personas no se puede caer entera porque el número 47
 * tenga un problema.
 *
 * `alTerminarLote` corre después de cada lote, con los correos que
 * acaban de salir. Existe para que quien lleve bitácora la escriba
 * LOTE A LOTE y no al final: si el proceso se corta a la mitad, lo que
 * ya salió tiene que quedar registrado, o se le reenvía a gente que ya
 * lo recibió.
 */
export async function enviarEnLotes(
  destinatarios: string[],
  enviarUno: (correo: string) => Promise<{ enviado: boolean }>,
  alTerminarLote?: (correos: string[]) => Promise<void> | void,
): Promise<ResultadoLotes> {
  let enviados = 0;
  let fallidos = 0;

  for (let i = 0; i < destinatarios.length; i += TAMANO_LOTE) {
    const lote = destinatarios.slice(i, i + TAMANO_LOTE);

    // `allSettled` y no `all`: una promesa rechazada acá cortaría la
    // campaña entera y dejaría a la mitad de la lista sin correo.
    const resultados = await Promise.allSettled(lote.map((c) => enviarUno(c)));

    const salieron: string[] = [];
    resultados.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value.enviado) {
        enviados += 1;
        salieron.push(lote[j]);
      } else {
        fallidos += 1;
      }
    });

    if (alTerminarLote && salieron.length > 0) await alTerminarLote(salieron);

    // Solo si queda otro lote. Ver la cabecera.
    if (i + TAMANO_LOTE < destinatarios.length) {
      await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_LOTES_MS));
    }
  }

  return { enviados, fallidos };
}
