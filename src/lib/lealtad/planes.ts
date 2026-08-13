/**
 * Los planes de la plataforma de lealtad (migración 0124).
 *
 * Viven acá y no en la base a propósito: son producto de Bookea, o sea
 * iguales para todos los clientes. Una tabla editable sugeriría que
 * cada negocio puede tener su propia definición de "Básico", y abriría
 * la puerta a cambiarle el tope a cien negocios de un tecleo.
 *
 * Lógica pura, sin Supabase: se puede testear entera.
 */

/**
 * Básico → Estándar → Enterprise. Están en orden creciente a
 * propósito: hay código y tests que dependen de que el índice mayor
 * incluya todo lo del menor.
 */
export const PLANES_ID = ["basico", "estandar", "enterprise"] as const;
export type PlanId = (typeof PLANES_ID)[number];

/**
 * Cada llave es una capacidad que se puede pedir con `puede()`.
 *
 * Los nombres describen lo que el NEGOCIO puede hacer, no la
 * implementación: cuando cambie cómo se mandan las notificaciones, el
 * nombre sigue sirviendo.
 */
export type Capacidad =
  /** Tarjeta en Apple/Google Wallet con la marca del negocio. */
  | "wallet"
  /** Mandar push a la pantalla bloqueada del cliente. */
  | "notificaciones"
  /** Que la tarjeta salga sola cuando el cliente pasa cerca del local. */
  | "cercania"
  /** Regalo de bienvenida y de cumpleaños. */
  | "bienvenida_cumpleanos"
  /** Programa de referidos. */
  | "referidos"
  /** Niveles Silver / Gold / Platinum. */
  | "niveles"
  /** Sorteos y misiones. */
  | "misiones"
  /** Códigos promocionales. */
  | "codigos_promo"
  /** Crédito y saldo prepago. */
  | "prepago"
  /** Segmentar clientes: VIP, inactivos, en riesgo de abandono. */
  | "segmentacion"
  /** Acceso por API e integraciones con POS. */
  | "api";

export type DefinicionPlan = {
  id: PlanId;
  nombre: string;
  /** Tope de miembros. null = sin tope. */
  limiteMiembros: number | null;
  /**
   * Colones por mes. null = todavía sin definir por el dueño de la
   * plataforma: las pantallas simplemente no muestran precio (nunca se
   * inventa una cifra que después haya que cobrar).
   */
  precioMensual: number | null;
  capacidades: readonly Capacidad[];
};

/**
 * Cada plan INCLUYE lo del anterior. Se escriben completos igual, en
 * vez de heredar en cadena: una lista explícita se lee de un vistazo y
 * no obliga a seguir tres saltos para saber si Élite manda push.
 */
export const PLANES: Record<PlanId, DefinicionPlan> = {
  basico: {
    id: "basico",
    nombre: "Básico",
    limiteMiembros: 500,
    precioMensual: 9_900,
    // Lo mínimo que hace útil una tarjeta: existe, acumula y se canjea.
    // Sin push, sin cercanía y sin segmentación — que es justo lo que
    // hace que valga la pena subir de plan.
    capacidades: ["wallet"],
  },
  estandar: {
    id: "estandar",
    nombre: "Estándar",
    limiteMiembros: 2500,
    precioMensual: 14_900,
    capacidades: [
      "wallet",
      "notificaciones",
      "bienvenida_cumpleanos",
      "referidos",
      "segmentacion",
    ],
  },
  enterprise: {
    id: "enterprise",
    nombre: "Enterprise",
    limiteMiembros: 5000,
    precioMensual: 24_900,
    capacidades: [
      "wallet",
      "notificaciones",
      "bienvenida_cumpleanos",
      "referidos",
      "segmentacion",
      // La cercanía entra recién acá: es la que más devuelve gente al
      // local y no tiene equivalente a mano.
      "cercania",
      "niveles",
      "misiones",
      "codigos_promo",
      "prepago",
      "api",
    ],
  },
};

/**
 * Cómo se le cuenta cada capacidad a un dueño de negocio. Vive junto a
 * las capacidades para que agregar una NUEVA obligue a pensar su
 * etiqueta (TypeScript exige la llave) — una capacidad sin nombre
 * visible no se puede vender.
 */
export const ETIQUETAS_CAPACIDAD: Record<Capacidad, string> = {
  wallet: "Tarjeta en Apple Wallet con tu marca",
  notificaciones: "Notificaciones push al teléfono del cliente",
  cercania: "La tarjeta aparece sola cerca de tu local",
  bienvenida_cumpleanos: "Regalos de bienvenida y cumpleaños",
  referidos: "Programa de referidos",
  niveles: "Niveles Silver / Gold / Platinum",
  misiones: "Sorteos y misiones",
  codigos_promo: "Códigos promocionales",
  prepago: "Crédito y saldo prepago",
  segmentacion: "Segmentación de clientes (VIP, inactivos, en riesgo)",
  api: "Acceso por API e integración con POS",
};

export function esPlan(valor: string | null): valor is PlanId {
  return valor !== null && (PLANES_ID as readonly string[]).includes(valor);
}

export function definicionDe(plan: string | null): DefinicionPlan | null {
  return esPlan(plan) ? PLANES[plan] : null;
}

/**
 * ¿Este negocio puede usar esta capacidad?
 *
 * La trae el plan O la regala un complemento suelto. Nunca al revés:
 * un complemento no puede QUITAR algo que el plan incluye, porque
 * quitar no es lo que un complemento hace — y si pudiera, apagar un
 * add-on por error degradaría a un cliente que pagó el plan alto.
 */
export function puede(
  plan: string | null,
  capacidad: Capacidad,
  addonsRegalados: readonly string[] = [],
): boolean {
  const def = definicionDe(plan);
  if (def?.capacidades.includes(capacidad)) return true;
  // Convención: el complemento que regala una capacidad se llama
  // `pases_<capacidad>` (ej. `pases_cercania`, 0123).
  return addonsRegalados.includes(`pases_${capacidad}`);
}

export type EstadoLimite = {
  miembros: number;
  limite: number | null;
  /** Cuántos caben todavía. null = sin tope. */
  disponibles: number | null;
  /** Ya no entran más. */
  lleno: boolean;
  /** Pasó el 90%: conviene avisar antes de que se tope. */
  cerca: boolean;
};

/**
 * Cómo va el negocio contra el tope de su plan.
 *
 * El tope NO se guarda en la fila del negocio: sale de la definición
 * del plan, y los miembros se cuentan. Guardarlo crearía un número que
 * hay que actualizar en cada cambio de plan.
 */
export function estadoDelLimite(plan: string | null, miembros: number): EstadoLimite {
  const limite = definicionDe(plan)?.limiteMiembros ?? null;

  if (limite === null) {
    return { miembros, limite: null, disponibles: null, lleno: false, cerca: false };
  }

  const disponibles = Math.max(0, limite - miembros);
  return {
    miembros,
    limite,
    disponibles,
    lleno: miembros >= limite,
    // El aviso llega antes de toparse: enterarse cuando ya no entra
    // nadie significa haber perdido clientes sin saberlo.
    cerca: miembros >= limite * 0.9,
  };
}
