import {
  definicionDe,
  esPlanSinCosto,
  estadoDelLimite,
  PLANES,
  tiposDelPlan,
  type PlanId,
} from "./planes";
import { TIPOS_TARJETA, type TipoTarjeta } from "./tipos-tarjeta";

/**
 * REGALÍAS Y CAMBIOS DE PAQUETE, en lógica pura.
 *
 * Dos cosas que la administración del módulo de Lealtad necesitaba y no
 * tenía:
 *
 *   1. PODER DISTINGUIR LO REGALADO DE LO VENDIDO. Hasta la 0173, un
 *      complemento de cortesía y uno pagado eran la MISMA fila: la
 *      duración «1 mes (cortesía)» escribía exactamente lo mismo que
 *      una venta de un mes, y la única diferencia quedaba enterrada en
 *      el texto libre de `notas`. Una auditoría de ingresos que tuviera
 *      que restar las cortesías tendría que parsear español escrito a
 *      mano — o contarlas como plata que entró.
 *
 *   2. PODER AVISAR ANTES DE BAJAR A ALGUIEN DE PAQUETE, con los
 *      números concretos. Bajar de plan no rompe nada de inmediato,
 *      pero deja al negocio en un estado del que no puede salir solo, y
 *      hasta hoy el desplegable lo hacía en silencio.
 *
 * Sin Supabase y sin React a propósito: lo usan la acción del servidor
 * y la pantalla, y así se puede probar entero.
 */

// ── El concepto de un movimiento de plan (0173) ────────────────────

/**
 * QUÉ FUE ESTE CAMBIO DE PAQUETE. Es la columna que separa la plata del
 * regalo, y por eso es obligatoria: sin ella, la administración vuelve
 * al estado en que estaba —donde lo único que distinguía una cortesía
 * de una venta era una frase escrita a mano.
 */
export const CONCEPTOS_PLAN = ["venta", "cortesia", "correccion", "baja"] as const;

export type ConceptoPlan = (typeof CONCEPTOS_PLAN)[number];

export function esConceptoPlan(valor: string): valor is ConceptoPlan {
  return (CONCEPTOS_PLAN as readonly string[]).includes(valor);
}

/**
 * Cómo se llama cada concepto en la pantalla, y qué significa para la
 * plata. El segundo renglón no es decoración: quien mueve el
 * desplegable tiene que saber si lo que está haciendo va a aparecer o
 * no en un total de ingresos.
 */
export const CONCEPTO_LABEL: Record<ConceptoPlan, string> = {
  venta: "Venta — el negocio pagó",
  cortesia: "Regalía — se le da gratis",
  correccion: "Corrección — un dato mal cargado",
  baja: "Baja — se le quita el paquete",
};

export const CONCEPTO_AYUDA: Record<ConceptoPlan, string> = {
  venta: "Entró plata: SINPE, transferencia o tarjeta.",
  cortesia: "NO entró plata. Queda marcado para que ninguna auditoría lo cuente como ingreso.",
  correccion: "Ni venta ni regalo: el negocio queda como debía estar desde antes.",
  baja: "Se acabó la cortesía, dejó de pagar o se dio de baja.",
};

/** Lo que la base acepta en `historial_plan_lealtad.motivo` (0173). */
export const MOTIVO_MAX = 300;

/**
 * ¿Este movimiento necesita motivo escrito?
 *
 * La regalía SÍ, siempre. Una cortesía sin motivo es plata que se fue
 * sin explicación: dentro de tres meses nadie va a poder decir si ese
 * negocio tiene Impulso gratis porque es un caso de prueba, porque se
 * le compensó una caída o porque alguien movió el desplegable sin
 * querer. Los otros tres conceptos no lo exigen —una venta se explica
 * sola— pero lo aceptan.
 */
export function motivoObligatorio(concepto: ConceptoPlan): boolean {
  return concepto === "cortesia";
}

// ── El estado de una regalía ───────────────────────────────────────

export type EstadoCortesia = {
  /** Sin fecha de fin. */
  indefinida: boolean;
  /** Ya se pasó la fecha que se había anotado. */
  vencida: boolean;
  /** Días enteros que faltan. null = indefinida o ya vencida. */
  diasRestantes: number | null;
};

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * En qué punto está una regalía con fecha.
 *
 * El plan sigue sin gate por tiempo EN LA BASE: `ranchos.plan_lealtad`
 * y `cuentas.plan` son columnas de texto que nadie compara contra un
 * reloj, y la única fecha que la base hace cumplir es
 * `addons_negocio.vence_en`.
 *
 * Hasta el 4 nov 2026 eso significaba que `cortesia_hasta` era un
 * compromiso anotado: la fecha se pasaba y el negocio seguía igual. La
 * bandeja del admin era lo único que lo mostraba, y una regalía vencida
 * que nadie mira es una suscripción regalada para siempre. Desde esa
 * fecha manda `membresiaVencidaDe`, acá abajo: el panel se cierra con el
 * aviso «¡MEMBRESÍA VENCIDA!» hasta que el negocio pague.
 */
export function estadoDeCortesia(hasta: string | null, ahora: Date = new Date()): EstadoCortesia {
  if (!hasta) return { indefinida: true, vencida: false, diasRestantes: null };

  const fin = new Date(hasta).getTime();
  // Una fecha ilegible no puede convertirse en «vencida»: sin dato
  // confiable no se toma ninguna decisión automática.
  if (Number.isNaN(fin)) return { indefinida: true, vencida: false, diasRestantes: null };

  const faltan = fin - ahora.getTime();
  if (faltan <= 0) return { indefinida: false, vencida: true, diasRestantes: null };

  return { indefinida: false, vencida: false, diasRestantes: Math.floor(faltan / UN_DIA) };
}

// ── La membresía vencida ───────────────────────────────────────────

export type MembresiaVencida = {
  /**
   * Qué se venció. `paquete` es una regalía del paquete
   * (`historial_plan_lealtad.cortesia_hasta`). `complemento` es la fecha
   * de `addons_negocio.vence_en`: la de un complemento regalado, o el
   * fin de lo que cubría un pago por SINPE o transferencia.
   */
  origen: "paquete" | "complemento";
  /** Cuándo venció, tal cual está guardado. */
  hasta: string;
  /** El paquete que tenía. null = no se sabe. */
  plan: string | null;
};

/**
 * ¿La membresía de este negocio ya venció?
 *
 * Son dos fechas, y las dos terminan en el mismo aviso: la de la regalía
 * y la del complemento. Un pago por SINPE no tiene cobro recurrente que
 * se corte solo, así que lo que cubre se escribe en `vence_en` al
 * aprobarlo (`finDelPagoManual`) y vence igual que una regalía.
 *
 * La Prueba de 14 días queda afuera a propósito: también usa `vence_en`,
 * pero tiene su propia pantalla, que explica que la prueba se terminó.
 * No es una membresía que venció.
 *
 * Mira el ÚLTIMO movimiento del plan y no «alguna regalía vencida»: si
 * después de la regalía hubo una venta (SINPE aprobado, o «Ya paga —
 * cerrar la regalía»), una corrección, una baja o una regalía nueva con
 * otra fecha, esa es la que manda. Sin esto, un negocio que ya pagó
 * seguiría viendo el aviso por una fila vieja.
 *
 * Una regalía SIN fecha nunca vence (los convenios), y una fecha
 * ilegible tampoco: sin dato confiable no se bloquea a nadie.
 *
 * Lo que esta función NO sabe es si hay una suscripción de Stripe: el
 * webhook no escribe en la bitácora, así que la regalía sigue siendo el
 * último movimiento aunque el negocio ya esté pagando con tarjeta. Eso
 * lo resuelve `bloqueoPorMembresia`, que es la única que hay que llamar
 * desde una pantalla.
 */
export function membresiaVencidaDe(
  d: {
    ultimoMovimiento: {
      concepto: string;
      planDespues: string | null;
      cortesiaHasta: string | null;
    } | null;
    complemento: { activo: boolean; venceEn: string | null; esCortesia: boolean } | null;
    /** El paquete del negocio. Solo hace falta si el complemento venció. */
    plan?: string | null;
  },
  ahora: Date = new Date(),
): MembresiaVencida | null {
  const mov = d.ultimoMovimiento;
  if (mov?.concepto === "cortesia" && mov.cortesiaHasta) {
    if (estadoDeCortesia(mov.cortesiaHasta, ahora).vencida) {
      return { origen: "paquete", hasta: mov.cortesiaHasta, plan: mov.planDespues };
    }
  }

  const c = d.complemento;
  if (complementoVencio(c, ahora) && c?.venceEn) {
    const plan = d.plan ?? null;
    if (c.esCortesia || !esPlanSinCosto(plan)) {
      return { origen: "complemento", hasta: c.venceEn, plan };
    }
  }

  return null;
}

/** El complemento sigue encendido, pero su fecha ya se pasó. */
export function complementoVencio(
  c: { activo: boolean; venceEn: string | null } | null,
  ahora: Date = new Date(),
): boolean {
  return !!c?.activo && !!c.venceEn && estadoDeCortesia(c.venceEn, ahora).vencida;
}

// ── Lo que cubre un pago por SINPE o transferencia ─────────────────

/**
 * Las opciones al registrar un pago. Las decide quien lo aprueba, porque
 * es quien vio el comprobante: ni `solicitudes_lealtad` ni la bitácora
 * guardan el monto, así que el sistema no puede deducir si esa plata era
 * un mes o un año.
 */
export const PERIODOS_PAGADOS = [
  { meses: 1, etiqueta: "1 mes" },
  { meses: 3, etiqueta: "3 meses" },
  { meses: 6, etiqueta: "6 meses" },
  { meses: 12, etiqueta: "1 año" },
] as const;

export function esPeriodoPagado(meses: unknown): meses is number {
  return PERIODOS_PAGADOS.some((p) => p.meses === meses);
}

/**
 * Hasta cuándo queda pagado un negocio con este pago.
 *
 * Suma desde la fecha que ya tenía si todavía no llegó: quien renueva
 * unos días antes no pierde esos días. Si ya venció, o no tenía fecha,
 * cuenta desde hoy.
 *
 * Son meses de calendario y no 30 días, y sin desbordarse: del 31 de
 * enero más un mes es el 28 de febrero, no el 3 de marzo.
 */
export function finDelPagoManual(
  meses: number,
  venceActual: string | null,
  ahora: Date = new Date(),
): string {
  const actual = venceActual ? new Date(venceActual).getTime() : Number.NaN;
  const base = new Date(Math.max(ahora.getTime(), Number.isNaN(actual) ? 0 : actual));

  const dia = base.getUTCDate();
  const fin = new Date(base);
  fin.setUTCDate(1);
  fin.setUTCMonth(fin.getUTCMonth() + meses);
  const ultimoDelMes = new Date(
    Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 0),
  ).getUTCDate();
  fin.setUTCDate(Math.min(dia, ultimoDelMes));
  return fin.toISOString();
}

/**
 * ¿Esta suscripción de Stripe suelta el bloqueo?
 *
 * `morosa` también, a propósito: es una tarjeta que falló y que Stripe
 * está reintentando. Ese caso ya tiene su propio camino (avisos por
 * correo y la pausa al terminar el mes); cerrarle el panel acá sería
 * cortarle el servicio antes de tiempo a alguien que sí venía pagando.
 * Solo `cancelada` deja de contar.
 */
export function suscripcionSueltaElBloqueo(estado: string): boolean {
  return estado === "activa" || estado === "en_prueba" || estado === "morosa";
}

// ── Qué pasa si le cambio el paquete ───────────────────────────────

export type AvisoCambio = {
  /** Para la `key` de React y para poder probar sin comparar prosa. */
  id: string;
  /**
   * `tope` — el negocio queda POR ENCIMA de lo que el paquete nuevo
   * permite. No se le quita nada, pero no puede sumar más.
   * `sin_candado` — el cambio AFLOJA los topes en vez de apretarlos.
   * `pierde` — deja de tener algo que el paquete viejo traía.
   */
  clase: "tope" | "sin_candado" | "pierde";
  texto: string;
};

/**
 * Lo que hay que decirle a quien está por guardar un cambio de paquete,
 * CON LOS NÚMEROS DE ESTE NEGOCIO.
 *
 * ------------------------------------------------------------------
 * QUÉ PASA DE VERDAD AL BAJAR DE PAQUETE (verificado en el código)
 * ------------------------------------------------------------------
 * Nada se apaga y nadie pierde su tarjeta. Los topes se hacen cumplir
 * SOLO en el momento de sumar algo:
 *
 *   · clientes — `generar.ts` y `google.ts` preguntan por
 *     `personasActivasDe` ANTES de insertar en `miembros`, y contestan
 *     «El programa de este negocio está lleno por ahora». Los pases ya
 *     emitidos siguen funcionando;
 *   · tarjetas — `crear-actions.ts` cuenta las que ocupan cupo y rebota
 *     la creación. Las publicadas siguen publicadas;
 *   · equipo — `equipo-actions.ts` frena las invitaciones nuevas y no
 *     expulsa a nadie;
 *   · tipos — `crear-actions.ts` rebota crear una tarjeta de un tipo
 *     que el paquete no trae. Las que ya están armadas siguen.
 *
 * Por eso ninguno de estos avisos BLOQUEA: el estado resultante es
 * válido, solo es un estado del que el negocio no puede salir solo. Lo
 * que no se puede hacer es guardarlo en silencio.
 *
 * ------------------------------------------------------------------
 * EL CASO QUE PARECE INOFENSIVO Y ES EL PEOR: «Sin plan»
 * ------------------------------------------------------------------
 * Quitarle el plan a un negocio NO lo apaga: lo deja SIN TOPES. Con
 * plan null, `definicionDe` devuelve null, `estadoDelLimite` no
 * encuentra límite y `tiposDelPlan` devuelve los ocho tipos. Es la
 * misma trampa que `planes.ts` documenta sobre retirar un paquete mal
 * («no lo apaga, lo vuelve gratis e infinito»), y desde el desplegable
 * del admin está a un clic de distancia.
 */
export function avisosDeCambioDePlan(d: {
  planActual: string | null;
  planNuevo: string | null;
  /** Clientes activos del negocio (mismo conteo que la puerta de Wallet). */
  clientes: number;
  /** Tarjetas que ocupan cupo. null = no se pudo contar. */
  tarjetas: number | null;
}): AvisoCambio[] {
  const avisos: AvisoCambio[] = [];
  if (d.planActual === d.planNuevo) return avisos;

  const nuevo = definicionDe(d.planNuevo);
  const viejo = definicionDe(d.planActual);

  // 1. Sin paquete = sin candados.
  if (!nuevo) {
    avisos.push({
      id: "sin_plan",
      clase: "sin_candado",
      texto:
        "«Sin plan» no le apaga nada: lo deja SIN TOPES. Sin paquete asignado no hay tope de " +
        "clientes, ni de tarjetas, ni de equipo, y puede armar los ocho tipos de tarjeta. Si la " +
        "idea es cortarle el servicio, lo que se apaga es el complemento «Lealtad y pases» de " +
        "más abajo.",
    });
    return avisos;
  }

  // 2. Un paquete retirado tampoco pone topes: van sin ninguno a
  //    propósito, porque no se le quita lo comprado a quien ya lo
  //    tenía. Hoy el catálogo no arrastra ninguno, así que esta rama
  //    solo se alcanza con el paquete inyectado en las pruebas — el día
  //    que se retire uno de verdad, este aviso es lo que impide que un
  //    admin le suelte los topes a un negocio creyendo que lo sube.
  if (!nuevo.vigente) {
    avisos.push({
      id: "retirado",
      clase: "sin_candado",
      texto: `«${nuevo.nombre}» es un paquete retirado: ya no se vende y viene sin ningún tope. Está en la lista para poder CORREGIR la fila de un negocio que ya lo tenía, no para asignárselo a alguien nuevo.`,
    });
  }

  // 3. Clientes: el número que el dueño pidió ver en pantalla.
  const clientes = estadoDelLimite(d.planNuevo, "clientesActivos", d.clientes);
  if (clientes.limite !== null && d.clientes > clientes.limite) {
    avisos.push({
      id: "clientes",
      clase: "tope",
      texto: `Este negocio tiene ${d.clientes.toLocaleString("es-CR")} clientes y «${nuevo.nombre}» permite ${clientes.limite.toLocaleString("es-CR")}. Nadie pierde su tarjeta y los pases que ya están en los teléfonos siguen funcionando, pero ningún cliente NUEVO va a poder afiliarse hasta que baje de ${clientes.limite.toLocaleString("es-CR")}.`,
    });
  } else if (clientes.limite !== null && clientes.cerca) {
    avisos.push({
      id: "clientes_cerca",
      clase: "tope",
      texto: `Le queda poco margen: ${d.clientes.toLocaleString("es-CR")} clientes de los ${clientes.limite.toLocaleString("es-CR")} que permite «${nuevo.nombre}».`,
    });
  }

  // 4. Tarjetas. `null` = no se pudo contar, y entonces no se dice nada:
  //    inventar un número en la pantalla que decide un cambio de plan es
  //    peor que no mostrarlo.
  const topeTarjetas = nuevo.limites.programas;
  if (d.tarjetas !== null && topeTarjetas !== null && d.tarjetas > topeTarjetas) {
    avisos.push({
      id: "tarjetas",
      clase: "tope",
      texto: `Tiene ${d.tarjetas} tarjetas y «${nuevo.nombre}» permite ${topeTarjetas}. Las que ya están siguen funcionando; no va a poder crear otra hasta archivar ${d.tarjetas - topeTarjetas}.`,
    });
  }

  // 5. Tipos de tarjeta que el paquete nuevo no trae.
  const antes = new Set(tiposDelPlan(d.planActual));
  const despues = new Set(tiposDelPlan(d.planNuevo));
  const perdidos: TipoTarjeta[] = [...antes].filter((t) => !despues.has(t));
  if (perdidos.length > 0) {
    const nombres = perdidos.map((t) => TIPOS_TARJETA[t].nombre.toLowerCase());
    avisos.push({
      id: "tipos",
      clase: "pierde",
      texto: `«${nuevo.nombre}» no arma tarjetas de ${nombres.join(", ")}. Las que ya tenga armadas de esos tipos siguen funcionando, pero no va a poder crear otra.`,
    });
  }

  // 6. Equipo. No se cuenta acá (contar colaboradores de cada negocio
  //    en una lista sería una consulta por fila), así que el aviso dice
  //    el tope y no un «tiene N»: prometer un número que no se midió es
  //    exactamente lo que esta pantalla no puede hacer.
  const equipoAntes = viejo?.limites.administradores ?? null;
  const equipoDespues = nuevo.limites.administradores;
  if (equipoDespues !== null && (equipoAntes === null || equipoAntes > equipoDespues)) {
    avisos.push({
      id: "equipo",
      clase: "tope",
      texto: `«${nuevo.nombre}» permite ${equipoDespues} persona${equipoDespues === 1 ? "" : "s"} en el equipo, contando al dueño. A nadie se le quita el acceso; lo que se frena son las invitaciones nuevas.`,
    });
  }

  // 7. Capacidades que el paquete viejo traía y el nuevo no.
  for (const cap of viejo?.capacidades ?? []) {
    if (!nuevo.capacidades.includes(cap)) {
      if (cap === "cercania") {
        avisos.push({
          id: "cercania",
          clase: "pierde",
          texto:
            "Pierde el aviso por cercanía (la tarjeta ya no aparece sola en la pantalla bloqueada). Si lo tiene además como complemento suelto «Aviso por cercanía», lo conserva por ahí.",
        });
      }
      if (cap === "diseno_a_medida") {
        avisos.push({
          id: "diseno",
          clase: "pierde",
          texto: "Pierde el diseño a medida hecho por Bookea.",
        });
      }
    }
  }

  return avisos;
}

/**
 * El texto corto de un paquete para el desplegable: nombre, precio y
 * tope de clientes. Sale de una sola función para que la lista del
 * admin y la ficha del negocio no describan el mismo paquete distinto.
 */
export function resumenDePlan(id: PlanId): string {
  const def = PLANES[id];
  const tope =
    def.limites.clientesActivos === null
      ? "clientes ilimitados"
      : `hasta ${def.limites.clientesActivos.toLocaleString("es-CR")} clientes`;
  const precio =
    def.precioMensual === null
      ? "a convenir"
      : def.precioMensual === 0
        ? "$0"
        : `$${def.precioMensual}/mes`;
  return `${def.nombre}${def.vigente ? "" : " (retirado)"} · ${precio} · ${tope}`;
}
