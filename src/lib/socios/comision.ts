/**
 * ════════════════════════════════════════════════════════════════════
 *  LO QUE COBRA UN SOCIO COMERCIAL
 * ════════════════════════════════════════════════════════════════════
 *
 * Un socio comercial es alguien que sale a colocar Bookea Lealtad en
 * negocios. Cada negocio que se da de alta con SU código referido le
 * genera una comisión mensual.
 *
 * ── ESTE MÓDULO ES PURO, Y ESO NO ES CASUAL ─────────────────────────
 *
 * Sin Supabase, sin React, sin `process.env`. Acá vive la aritmética de
 * la plata y nada más, para que se pueda probar entera en milisegundos
 * y para que la MISMA cuenta la hagan el panel del socio, el panel de
 * admin y el día que haya un cierre de mes. Tres lugares calculando
 * comisiones a mano es cómo se termina pagando distinto a dos personas
 * con los mismos negocios.
 *
 * Es el mismo criterio con el que `layout-tira.ts` vive aparte de
 * `imagenes.ts`.
 *
 * ── LOS PLANES SE LLAMAN DISTINTO DE COMO SE MUESTRAN ───────────────
 *
 * ⚠️ NO EXISTE NINGÚN PLAN CON ID "starter". El que el dueño llama
 * «Starter» —y que la UI muestra así— tiene id `arranque` y cuesta $12
 * al mes. Confundirlos hace que la comisión se calcule sobre un
 * conjunto vacío y que todos los socios cobren cero sin que falle nada.
 *
 *     id "arranque"  → se muestra "Starter"  → $12/mes
 *     id "impulso"   → "Impulso"             → $42/mes
 *
 * Los otros dos paquetes (`prueba`, gratis, e `ilimitado`) NO generan
 * comisión hoy: el dueño definió la escala solo para esos dos.
 */

/** Los planes que generan comisión. Ver el aviso de arriba sobre los ids. */
export const PLAN_STARTER = "arranque" as const;
export const PLAN_IMPULSO = "impulso" as const;

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA ESCALA, CONFIRMADA POR EL DUEÑO (26 ago 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * Starter va POR TRÍOS, con los sueltos valiendo menos:
 *
 *     cada grupo de 3 negocios ─────────── $6
 *     cada negocio que sobra ───────────── $1
 *
 * Que da esta tabla, que es la que el dueño aprobó textualmente:
 *
 *     1 → $1     4 → $7     7 → $13
 *     2 → $2     5 → $8     8 → $14
 *     3 → $6     6 → $12    9 → $18
 *
 * ⚠️ EL SALTO DE $2 A $6 AL LLEGAR A 3 ES INTENCIONAL, no un error de
 * redondeo. Es lo que premia completar el trío, y es la razón de ser de
 * toda la escala: «el mínimo para pagar en Starter son $6». Si alguien
 * la ve rara y la "arregla" a algo lineal, le baja la comisión a todos
 * los socios que tienen tríos completos.
 */
const DOLARES_POR_TRIO_STARTER = 6;
const DOLARES_POR_STARTER_SUELTO = 1;
const NEGOCIOS_POR_TRIO = 3;

/**
 * Cuánto paga cada negocio de Impulso, al mes.
 *
 * ⚠️ PENDIENTE DE CONFIRMAR SI ES MENSUAL O UNA SOLA VEZ. El dueño dijo
 * «cada negocio con el plan Impulso la persona va a ganar $10 por
 * negocio referido» sin aclarar la periodicidad, mientras que para
 * Starter sí dijo «$6 MENSUALES».
 *
 * Se toma como MENSUAL por dos razones: es lo coherente con la otra
 * mitad de la escala, y es como se paga una comisión de software que se
 * cobra todos los meses. Si resulta ser pago único, lo que cambia es
 * DÓNDE se cuenta —una vez al alta en vez de en cada cierre— y no este
 * número; por eso el aviso está acá y no solo en un comentario suelto.
 */
const DOLARES_POR_IMPULSO_AL_MES = 10;

/** Los negocios de un socio, ya clasificados por su plan EFECTIVO. */
export type NegociosDelSocio = {
  /** Cuántos están hoy en el paquete que se muestra como «Starter». */
  starter: number;
  /** Cuántos están hoy en «Impulso». */
  impulso: number;
};

export type DesgloseComision = {
  /** Tríos completos de Starter. */
  triosStarter: number;
  /** Negocios de Starter que no llegan a completar un trío. */
  sueltosStarter: number;
  /** Lo que aportan los tríos, en dólares. */
  montoTrios: number;
  /** Lo que aportan los sueltos, en dólares. */
  montoSueltos: number;
  /** Lo que aportan los de Impulso, en dólares. */
  montoImpulso: number;
  /** El total del mes, en dólares. */
  total: number;
  /**
   * Cuántos negocios de Starter faltan para el próximo trío.
   *
   * Existe para la pantalla, y no es adorno: sin esto un socio con 5
   * negocios ve «$8» y no tiene forma de saber que con UNO más pasa a
   * $12. Un incentivo que no se ve no incentiva nada.
   *
   * Con los tríos justos (3, 6, 9…) devuelve 3: son los que faltan para
   * el SIGUIENTE salto, no cero.
   */
  faltanParaElTrio: number;
};

/**
 * El desglose completo de lo que cobra un socio este mes.
 *
 * Devuelve el detalle y no solo el total a propósito: el socio tiene
 * que poder ver de dónde sale cada dólar, o el número se lee como una
 * cifra que alguien inventó. Y cuando reclame, se puede comparar línea
 * por línea en vez de discutir un total.
 *
 * Los negativos y los decimales se tratan como dato roto y se llevan a
 * cero: un conteo de negocios no puede ser 2,5 ni −1, y una cuenta de
 * plata no es lugar para propagar un `NaN`.
 */
export function calcularComision(negocios: NegociosDelSocio): DesgloseComision {
  const starter = enteroSano(negocios.starter);
  const impulso = enteroSano(negocios.impulso);

  const triosStarter = Math.floor(starter / NEGOCIOS_POR_TRIO);
  const sueltosStarter = starter % NEGOCIOS_POR_TRIO;

  const montoTrios = triosStarter * DOLARES_POR_TRIO_STARTER;
  const montoSueltos = sueltosStarter * DOLARES_POR_STARTER_SUELTO;
  const montoImpulso = impulso * DOLARES_POR_IMPULSO_AL_MES;

  return {
    triosStarter,
    sueltosStarter,
    montoTrios,
    montoSueltos,
    montoImpulso,
    total: montoTrios + montoSueltos + montoImpulso,
    faltanParaElTrio: NEGOCIOS_POR_TRIO - sueltosStarter,
  };
}

/**
 * Un conteo de negocios que se pueda sumar sin miedo.
 *
 * Lo que llega acá sale de un `count` de la base, y una consulta que
 * falló puede devolver `null`. Sin este filtro, un `null` se convierte
 * en `NaN` al multiplicar y el socio ve «$NaN» en su panel — o peor,
 * un cierre de mes escribe eso en una fila.
 */
function enteroSano(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.floor(valor));
}

/** «$8» — el formato en que se muestra una comisión. */
export function formatearDolares(monto: number): string {
  const sano = Number.isFinite(monto) ? monto : 0;
  // Sin decimales: todos los montos de la escala son enteros, y un
  // «$8,00» en una tabla de comisiones solo agrega ruido.
  return `$${Math.round(sano).toLocaleString("es-CR")}`;
}

/**
 * ¿Este plan genera comisión?
 *
 * Se pregunta acá y no con un `===` suelto en cada pantalla: el día que
 * el dueño sume `ilimitado` a la escala, hay UN lugar donde cambiarlo.
 */
export function planGeneraComision(plan: string | null | undefined): boolean {
  return plan === PLAN_STARTER || plan === PLAN_IMPULSO;
}
