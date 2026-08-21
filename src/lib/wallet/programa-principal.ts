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
 * ------------------------------------------------------------------
 * EL DESEMPATE PASÓ DE SER "SIEMPRE LA MISMA" A SER "LA MÁS VIEJA"
 * ------------------------------------------------------------------
 * Antes se ordenaba POR ID (uuid). Eso resolvía la mitad del problema
 * —que dos pantallas no se contradijeran— pero dejaba la otra mitad
 * abierta, y es la que le explotó al dueño en la cara:
 *
 *   el uuid de la tarjeta NUEVA puede ordenar ANTES que el de la vieja.
 *
 * O sea que crear una segunda tarjeta podía cambiar cuál es la
 * "principal" del negocio — y con eso, a qué tarjeta lleva el QR YA
 * IMPRESO Y PEGADO en el mostrador. Un QR de papel que cambia de
 * destino sin que nadie lo toque no es un detalle: es el póster del
 * local repartiendo la tarjeta equivocada.
 *
 * Ahora el orden es `created_at` ascendente y el id queda solo como
 * desempate de último recurso (dos filas creadas en el mismo
 * microsegundo, o una base sin la columna). Sigue siendo estable
 * —Postgres no promete orden sin `order by`, y las cuatro pantallas
 * consultan con filtros distintos— y además es INMUTABLE: la fecha de
 * creación de una tarjeta ya existente no cambia nunca, así que crear
 * la número dos, tres o seis no puede reordenar a la número uno.
 *
 * ------------------------------------------------------------------
 * Y EL LINK VIEJO TIENE SU PROPIA FUNCIÓN (`laDelLinkDelNegocio`)
 * ------------------------------------------------------------------
 * `elegirPrograma` sigue prefiriendo la que emite: es lo correcto para
 * el PANEL, donde "la tarjeta principal" quiere decir "la que le estás
 * dando a tus clientes ahora". Pero para `/tarjeta/<negocio>` —la URL
 * impresa— eso no alcanza: si el dueño pausa la original, "la primera
 * que emita" saltaría a la SEGUNDA tarjeta y el póster de la calle
 * empezaría a entregar otra cosa. Ver la función, abajo del todo.
 */

/** Lo mínimo para ubicar una tarjeta y poder desempatar. */
export type FilaElegible = FilaPrograma & {
  id: string;
  /**
   * `programa_lealtad.created_at` (0060: `not null default now()`).
   * Opcional en el tipo porque hay llamadores que arman la fila a mano
   * y porque `resumenDeFila` lee filas crudas de bases a medio migrar:
   * sin fecha, el desempate cae al id, que es lo que había antes.
   */
  created_at?: string | null;
};

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
    created_at: typeof fila.created_at === "string" ? fila.created_at : null,
  };
}

/**
 * El orden estable: la MÁS VIEJA primero. Ver la cabecera.
 *
 * Las filas sin `created_at` van al final y no al principio: una fila
 * sin fecha es una incógnita, y una incógnita no puede ganarle el
 * primer puesto —el que sirve el link impreso— a una tarjeta cuya
 * antigüedad sí consta.
 */
export function porAntiguedad<T extends FilaElegible>(filas: readonly T[]): T[] {
  return [...filas].sort((a, b) => {
    const fa = a.created_at ?? "";
    const fb = b.created_at ?? "";
    if (fa !== fb) {
      if (fa === "") return 1;
      if (fb === "") return -1;
      return fa < fb ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
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
  const orden = porAntiguedad(filas);
  return (
    orden.find((f) => operaAhora(f, ahoraCR)) ??
    orden.find((f) => estadoVisible(f, ahoraCR) !== "archivado") ??
    orden[0] ??
    null
  );
}

/**
 * LA TARJETA A LA QUE APUNTA EL LINK VIEJO, `/tarjeta/<negocio>`.
 *
 * Es la MÁS VIEJA del negocio y punto: no "la que emite", no "la
 * principal". Sin condiciones y sin fallback a otra tarjeta.
 *
 * El razonamiento, que es todo el motivo de que esta función exista
 * separada de `elegirPrograma`:
 *
 *   · ese link está IMPRESO en un póster pegado en la pared de un
 *     local, y hay clientes que ya lo escanearon. Un papel no se puede
 *     re-desplegar;
 *   · cuando se imprimió, el negocio tenía UNA sola tarjeta — o sea,
 *     necesariamente la más vieja de las que tiene hoy;
 *   · `created_at` no cambia nunca. Crear la tarjeta número 2, 3 o 10
 *     no puede mover cuál es la número 1, así que la respuesta de esta
 *     función es la misma hoy, mañana y con seis tarjetas más;
 *   · y si la original está pausada o archivada, la respuesta correcta
 *     es «esta tarjeta no está repartiendo pases» —exactamente lo que
 *     ve hoy un negocio de una sola tarjeta— y NO servir calladamente
 *     una tarjeta distinta de la que promete el póster.
 *
 * Quien quiera repartir la SEGUNDA tarjeta tiene su propio link y su
 * propio QR: `/tarjeta/<negocio>/<llave>` (ver `llave-tarjeta.ts`).
 */
export function laDelLinkDelNegocio<T extends FilaElegible>(filas: readonly T[]): T | null {
  return porAntiguedad(filas)[0] ?? null;
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

/**
 * CUÁL TARJETA SE LE ENTREGA AL PASE, Y SI VA MARCADA COMO PAUSADA.
 *
 * Vive acá, pura y aparte de `generar.ts`, porque es la decisión que
 * más caro sale equivocada —el cliente ve una tarjeta y se lleva otra—
 * y adentro de `generar.ts` no se puede probar sin certificados de
 * Apple, `sharp` y una base.
 *
 * `programaPedido` es el id que manda quien llama:
 *
 *   · la página pública, con el id de la tarjeta que acaba de dibujar;
 *   · el refresco de Wallet, con el `programa_id` DEL MIEMBRO — que es
 *     el suyo, no «alguna del negocio»;
 *   · null desde cualquier llamador viejo, y entonces se elige como
 *     siempre.
 *
 * Se comprueba contra las filas del negocio (`ajena` si no está): el id
 * viaja por la URL y no se le cree.
 *
 * `pausado` solo se tolera para la tarjeta que se iba a entregar igual.
 * Una archivada, una vencida o un borrador siguen sin entregar nada,
 * porque ninguna de esas vuelve sola — y entregar en su lugar la
 * tarjeta hermana sería reescribirle el pase al cliente con algo que
 * nunca pidió.
 */
export type TarjetaDelPase =
  | { fila: Record<string, unknown>; pausado: boolean; motivo: null }
  | { fila: null; pausado: false; motivo: "ajena" | "sin_programa" };

export function tarjetaDelPase(
  filas: readonly Record<string, unknown>[],
  ahoraCR: string,
  programaPedido: string | null,
): TarjetaDelPase {
  const pedida = programaPedido
    ? (filas.find((f) => f.id === programaPedido) ?? null)
    : null;
  if (programaPedido && !pedida) return { fila: null, pausado: false, motivo: "ajena" };

  const emisora = pedida
    ? emisoraDeFilasCrudas([pedida], ahoraCR)
    : emisoraDeFilasCrudas(filas, ahoraCR);
  const principal = pedida ?? emisora ?? elegirDeFilasCrudas(filas, ahoraCR);
  const pausado =
    !emisora && !!principal && estadoVisible(resumenDeFila(principal), ahoraCR) === "pausado";

  const fila = emisora ?? (pausado ? principal : null);
  if (!fila) return { fila: null, pausado: false, motivo: "sin_programa" };
  return { fila, pausado, motivo: null };
}

/** `laDelLinkDelNegocio` para quien trabaja con filas crudas. */
export function laDelLinkDeFilasCrudas(
  filas: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
  return laDelLinkDelNegocio(pares(filas))?.fila ?? null;
}

/**
 * Las filas crudas ordenadas de la más vieja a la más nueva.
 *
 * Lo usan el panel (para listar los links de cada tarjeta) y la
 * búsqueda por llave: ante dos tarjetas que derivan el mismo slug —solo
 * posible mientras la 0199 no esté pegada— gana la más vieja, que es el
 * mismo criterio que protege al QR impreso.
 */
export function filasCrudasPorAntiguedad(
  filas: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return porAntiguedad(pares(filas)).map((p) => p.fila);
}
