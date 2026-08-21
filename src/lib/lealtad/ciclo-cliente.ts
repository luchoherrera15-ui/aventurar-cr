/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL CICLO DE VIDA DE UN CLIENTE DE LEALTAD
 * ═══════════════════════════════════════════════════════════════════
 *
 * Módulo PURO: sin Supabase y sin reloj. Quien llama trae las fechas y
 * el día de hoy; acá solo se clasifica. Es el patrón del resto de
 * `lib/lealtad` y lo que hace que estas reglas —que deciden a quién se
 * le manda un mensaje— se puedan probar sin base de datos.
 *
 * ── EL PROBLEMA ────────────────────────────────────────────────────
 * La mayoría de los clientes no se van enojados: se van sin darse
 * cuenta. Dejan de pasar una semana, después un mes, y nadie los
 * llama. El negocio ni se entera, porque un cliente que no vuelve no
 * genera ningún evento — su ausencia es invisible en una lista
 * ordenada por fecha de afiliación.
 *
 * Este módulo convierte esa ausencia en un dato: cuántos días lleva
 * sin venir cada quien, y en qué tramo del ciclo está.
 *
 * ── POR QUÉ EL UMBRAL LO PONE EL NEGOCIO ───────────────────────────
 * "Dejó de venir" no significa lo mismo en una cafetería que en un
 * lavacar que en un casillero. Alguien que va por café todos los días
 * está perdido a los diez; alguien que manda un paquete al mes es
 * normal a los treinta. Un umbral fijo en el código haría que la mitad
 * de los negocios reciba alarmas falsas y la otra mitad se entere
 * tarde. Por eso `RITMOS` y no una constante.
 */

/** Cada cuánto vuelve un cliente sano de ESTE negocio. Lo elige el
 *  dueño; de acá salen los tramos. */
export type RitmoNegocio = "diario" | "semanal" | "quincenal" | "mensual";

export const RITMOS: Record<
  RitmoNegocio,
  { etiqueta: string; ejemplo: string; enRiesgo: number; dormido: number; perdido: number }
> = {
  diario: {
    etiqueta: "Vienen casi a diario",
    ejemplo: "Cafeterías, sodas, panaderías",
    enRiesgo: 7,
    dormido: 21,
    perdido: 60,
  },
  semanal: {
    etiqueta: "Vienen cada semana",
    ejemplo: "Lavacares, restaurantes, gasolineras",
    enRiesgo: 21,
    dormido: 45,
    perdido: 120,
  },
  quincenal: {
    etiqueta: "Vienen cada quince días",
    ejemplo: "Barberías, carnicerías",
    enRiesgo: 35,
    dormido: 75,
    perdido: 180,
  },
  mensual: {
    etiqueta: "Vienen una vez al mes",
    ejemplo: "Salas de belleza, casilleros, clínicas",
    enRiesgo: 60,
    dormido: 120,
    perdido: 270,
  },
};

/**
 * En qué tramo está un cliente.
 *
 *   nuevo     Se afilió y todavía no vino ni una vez. No es lo mismo
 *             que dormido: nunca empezó. Si hay muchos, el problema
 *             está en el mostrador, no en el programa.
 *   activo    Vino dentro de su ritmo normal. Todo bien.
 *   en_riesgo Se pasó del ritmo pero hace poco. Es EL tramo que
 *             importa: acá un mensaje todavía lo trae de vuelta.
 *   dormido   Hace rato que no viene. Se puede recuperar, cuesta más.
 *   perdido   Pasó tanto que escribirle es empezar de nuevo.
 */
export type TramoCliente = "nuevo" | "activo" | "en_riesgo" | "dormido" | "perdido";

export const TRAMOS: Record<
  TramoCliente,
  { etiqueta: string; explica: string; tono: "neutro" | "bien" | "aviso" | "alerta" }
> = {
  nuevo: {
    etiqueta: "Sin estrenar",
    explica: "Agregó la tarjeta y todavía no recibió ni un sello.",
    tono: "neutro",
  },
  activo: {
    etiqueta: "Activo",
    explica: "Vino dentro del ritmo normal de tu negocio.",
    tono: "bien",
  },
  en_riesgo: {
    etiqueta: "En riesgo",
    explica: "Se pasó de su ritmo hace poco. Es el momento de escribirle.",
    tono: "aviso",
  },
  dormido: {
    etiqueta: "Dormido",
    explica: "Hace rato que no viene. Todavía se puede recuperar.",
    tono: "alerta",
  },
  perdido: {
    etiqueta: "Perdido",
    explica: "Pasó tanto tiempo que traerlo de vuelta es empezar de nuevo.",
    tono: "alerta",
  },
};

/** Días enteros entre dos fechas ISO (YYYY-MM-DD), por UTC — nunca por
 *  resta de texto, que se rompe en los cambios de mes. */
export function diasEntre(desde: string, hasta: string): number | null {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * En qué tramo cae un cliente.
 *
 * `ultimaVisita` null = nunca recibió un sello. Devuelve "nuevo" sin
 * mirar los umbrales: alguien que se afilió ayer y alguien que se
 * afilió hace un año sin volver son el mismo problema —nunca
 * arrancaron— y meterlos en "perdido" los mezclaría con los que sí
 * fueron clientes y se fueron, que es un problema distinto y se
 * arregla distinto.
 */
export function tramoDelCliente(
  ultimaVisita: string | null,
  hoy: string,
  ritmo: RitmoNegocio,
): { tramo: TramoCliente; dias: number | null } {
  if (ultimaVisita === null) return { tramo: "nuevo", dias: null };

  const dias = diasEntre(ultimaVisita, hoy);
  if (dias === null) return { tramo: "nuevo", dias: null };

  const u = RITMOS[ritmo];
  // Una visita con fecha futura (reloj torcido, carga a mano) se trata
  // como recién ocurrida en vez de reventar la cuenta.
  if (dias < u.enRiesgo) return { tramo: "activo", dias: Math.max(0, dias) };
  if (dias < u.dormido) return { tramo: "en_riesgo", dias };
  if (dias < u.perdido) return { tramo: "dormido", dias };
  return { tramo: "perdido", dias };
}

/** Los tramos a los que tiene sentido escribirles para que vuelvan.
 *  «Perdido» queda afuera a propósito: gastar cupo de notificaciones
 *  en quien se fue hace medio año le resta al que todavía se puede
 *  recuperar. */
export const TRAMOS_RESCATABLES: readonly TramoCliente[] = ["en_riesgo", "dormido"];

export function esRescatable(tramo: TramoCliente): boolean {
  return TRAMOS_RESCATABLES.includes(tramo);
}
