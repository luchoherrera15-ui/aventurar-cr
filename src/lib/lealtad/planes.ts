/**
 * Los planes del MÓDULO DE LEALTAD.
 *
 * Son planes del producto Lealtad y de nadie más: no reemplazan ni se
 * mezclan con los planes generales de Bookea (marketplace, invitaciones).
 * Un negocio puede pagar Lealtad sin tener nada más, y al revés.
 *
 * Viven acá y no en la base a propósito: son producto, o sea iguales
 * para todos los clientes. Una tabla editable sugeriría que cada
 * cuenta puede tener su propia definición de "Crece", y abriría la
 * puerta a cambiarle el tope a cien cuentas de un tecleo.
 *
 * Lógica pura, sin Supabase: se puede testear entera.
 *
 * ------------------------------------------------------------------
 * DOS LISTAS, Y LA DIFERENCIA IMPORTA
 * ------------------------------------------------------------------
 * `PLANES_OFRECIDOS` es lo que se VENDE hoy. `PLANES_ID` es todo lo
 * que la base puede tener GUARDADO, e incluye los planes retirados.
 *
 * Los retirados no se borran: hay negocios con esos valores (Rancho
 * Las Torres tiene «Básico») y el CHECK de la base los acepta. Sacarlos
 * de acá haría que `definicionDe('basico')` devolviera null y esas
 * cuentas se quedarían sin plan, sin topes y sin capacidades —
 * degradadas de un día para otro por un cambio de catálogo.
 */

/** Lo que se ofrece hoy, de menor a mayor. */
export const PLANES_OFRECIDOS = ["prueba", "esencial", "crece", "pro", "empresa"] as const;

/**
 * Planes de la etapa anterior: ya no se venden, pero siguen
 * resolviendo para quien los tiene. NUNCA se quitan mientras exista
 * una fila con ese valor.
 */
export const PLANES_RETIRADOS = ["gratis", "basico", "estandar", "enterprise"] as const;

/**
 * OJO: agregar un plan acá pide también ampliar los CHECK de la base
 * (`ranchos.plan_lealtad` y `solicitudes_lealtad.plan`) — la 0131 lo
 * hizo para 'gratis' y la 0133 para el catálogo de Lealtad.
 */
export const PLANES_ID = [...PLANES_OFRECIDOS, ...PLANES_RETIRADOS] as const;
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
  /** Los ocho tipos de tarjeta (sellos, puntos, cupón, descuento,
   *  membresía, gift card, evento, cashback). Desde el primer plan:
   *  decisión de producto — el tipo de tarjeta no es lo que se cobra. */
  | "tipos_de_tarjeta"
  /** Reglas activables y vencimientos. */
  | "reglas_y_vencimientos"
  /** Mandar notificaciones al pase del cliente. */
  | "notificaciones"
  /** Que el pase aparezca solo en la pantalla bloqueada cuando el
   *  cliente pasa cerca del local. Es nativo de Wallet y se regala
   *  también con el complemento `pases_cercania` (0123). */
  | "cercania"
  /** Analítica básica del programa. */
  | "analitica"
  /** Analítica avanzada: cohortes, rendimiento por programa. */
  | "analitica_avanzada"
  /** Segmentar clientes: VIP, inactivos, en riesgo de abandono. */
  | "segmentacion"
  /** Programar campañas para una fecha futura. */
  | "campanas_programadas"
  /** Webhooks salientes. */
  | "webhooks"
  /** Acceso por API. */
  | "api"
  /** Exportar datos. */
  | "exportacion"
  /** Integración con el punto de venta. */
  | "pos"
  /** Roles y permisos avanzados por colaborador. */
  | "roles_avanzados"
  /** Franquicias y multi-marca. */
  | "franquicias"
  /** Acuerdo de nivel de servicio. */
  | "sla"
  /** Marca blanca. */
  | "marca_blanca"
  /** Soporte dedicado. */
  | "soporte_dedicado";

/**
 * Los topes del plan. `null` = sin tope.
 *
 * Se guardan como números y no como texto porque el servidor los HACE
 * CUMPLIR: son la diferencia entre un tope real y uno decorativo.
 */
export type LimitesPlan = {
  /**
   * Personas con al menos un pase VIGENTE en el periodo.
   *
   * La definición importa y es deliberada:
   *   · varias tarjetas de la misma persona = UN cliente;
   *   · Apple Wallet y Google Wallet del mismo pase NO duplican;
   *   · los pases vencidos o archivados no cuentan;
   *   · los contactos del CRM son ilimitados — esto cuenta PASES, no
   *     agenda de contactos.
   */
  clientesActivos: number | null;
  /** Programas (plantillas de tarjeta) publicables a la vez. */
  programas: number | null;
  /**
   * Notificaciones de campaña por mes. Las notificaciones OPERATIVAS
   * de una reserva no consumen esta bolsa: son otro producto.
   */
  notificacionesMes: number | null;
  /** Personas del equipo con acceso al panel de Lealtad. */
  administradores: number | null;
  /** Sedes o sucursales participantes. */
  sedes: number | null;
  /** Automatizaciones activas a la vez. */
  automatizaciones: number | null;
};

export type DefinicionPlan = {
  id: PlanId;
  nombre: string;
  /** Para quién es, en una línea. */
  descripcion: string;
  /** Dólares por mes. null = precio a convenir. */
  precioMensual: number | null;
  /** Dólares por año. null = no se vende anual (o es a convenir). */
  precioAnual: number | null;
  limites: LimitesPlan;
  capacidades: readonly Capacidad[];
  /** Días de prueba sin tarjeta. 0 = no es una prueba. */
  diasPrueba: number;
  /** false = retirado: resuelve para quien lo tiene, no se ofrece. */
  vigente: boolean;
};

/** Todo ilimitado — se repite en Empresa y en los planes retirados. */
const SIN_TOPES: LimitesPlan = {
  clientesActivos: null,
  programas: null,
  notificacionesMes: null,
  administradores: null,
  sedes: null,
  automatizaciones: null,
};

/** Lo que trae CUALQUIER plan, incluida la prueba. */
const BASE: readonly Capacidad[] = [
  "wallet",
  // Los ocho tipos desde el primer plan: lo que se cobra es la
  // ESCALA (cuánta gente, cuántos programas, cuántos envíos), no
  // desbloquear una funcionalidad que ya está escrita.
  "tipos_de_tarjeta",
  "reglas_y_vencimientos",
  "notificaciones",
  "analitica",
];

/**
 * Cada plan INCLUYE lo del anterior. Se escriben completos igual, en
 * vez de heredar en cadena: una lista explícita se lee de un vistazo y
 * no obliga a seguir tres saltos para saber si Pro trae webhooks.
 */
export const PLANES: Record<PlanId, DefinicionPlan> = {
  prueba: {
    id: "prueba",
    nombre: "Prueba",
    descripcion: "14 días para armar tu primera tarjeta, sin tarjeta de crédito.",
    precioMensual: 0,
    precioAnual: null,
    limites: {
      clientesActivos: 25,
      programas: 1,
      notificacionesMes: 200,
      administradores: 1,
      sedes: 1,
      automatizaciones: 1,
    },
    capacidades: BASE,
    diasPrueba: 14,
    vigente: true,
  },
  esencial: {
    id: "esencial",
    nombre: "Esencial",
    descripcion: "Para el local que arranca su programa de fidelización.",
    precioMensual: 9,
    // Dos meses de regalo: 9 × 12 = 108, y el anual sale 90.
    precioAnual: 90,
    limites: {
      clientesActivos: 75,
      programas: 2,
      notificacionesMes: 1_000,
      administradores: 3,
      sedes: 1,
      automatizaciones: 2,
    },
    capacidades: BASE,
    diasPrueba: 0,
    vigente: true,
  },
  crece: {
    id: "crece",
    nombre: "Crece",
    descripcion: "Para el que ya tiene clientes y quiere hacerlos volver.",
    precioMensual: 27,
    precioAnual: 270,
    limites: {
      clientesActivos: 225,
      programas: 6,
      notificacionesMes: 3_500,
      administradores: 6,
      sedes: 3,
      automatizaciones: 10,
    },
    capacidades: [
      ...BASE,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
    ],
    diasPrueba: 0,
    vigente: true,
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "Para operaciones con varias sedes y sistemas propios.",
    precioMensual: 69,
    precioAnual: 690,
    limites: {
      clientesActivos: 750,
      programas: 15,
      notificacionesMes: 12_000,
      administradores: 15,
      sedes: 10,
      automatizaciones: null,
    },
    capacidades: [
      ...BASE,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
      "api",
      "exportacion",
      "pos",
      "roles_avanzados",
      "cercania",
    ],
    diasPrueba: 0,
    vigente: true,
  },
  empresa: {
    id: "empresa",
    nombre: "Empresa",
    descripcion: "Franquicias y volumen, con acuerdo y soporte dedicado.",
    // A convenir: es el tramo que se cotiza caso por caso. Sin cifra,
    // /admin/finanzas no le inventa un monto esperado — que es lo
    // correcto para un precio negociado.
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: [
      ...BASE,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
      "api",
      "exportacion",
      "pos",
      "roles_avanzados",
      "franquicias",
      "sla",
      "marca_blanca",
      "soporte_dedicado",
      "cercania",
    ],
    diasPrueba: 0,
    vigente: true,
  },

  // ── Retirados ─────────────────────────────────────────────────────
  // Existen para que las cuentas que ya los tienen sigan funcionando.
  // Sin topes: bajarle el tope a alguien que ya pagó por un cambio de
  // catálogo sería quitarle lo comprado.
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: 0,
    precioAnual: null,
    limites: { ...SIN_TOPES, clientesActivos: 5 },
    capacidades: BASE,
    diasPrueba: 0,
    vigente: false,
  },
  basico: {
    id: "basico",
    nombre: "Básico",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: BASE,
    diasPrueba: 0,
    vigente: false,
  },
  estandar: {
    id: "estandar",
    nombre: "Estándar",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: [...BASE, "segmentacion", "analitica_avanzada"],
    diasPrueba: 0,
    vigente: false,
  },
  enterprise: {
    id: "enterprise",
    nombre: "Enterprise",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    precioMensual: null,
    precioAnual: null,
    limites: SIN_TOPES,
    capacidades: [
      ...BASE,
      "segmentacion",
      "campanas_programadas",
      "analitica_avanzada",
      "webhooks",
      "api",
      "exportacion",
      "pos",
      "roles_avanzados",
    ],
    diasPrueba: 0,
    vigente: false,
  },
};

/** Las definiciones que se ofrecen, en orden. */
export const PLANES_VIGENTES: readonly DefinicionPlan[] = PLANES_OFRECIDOS.map(
  (id) => PLANES[id],
);

/** El plan que se marca como «Más popular» en la grilla. */
export const PLAN_DESTACADO: PlanId = "crece";

/**
 * Cómo se le cuenta cada capacidad a un dueño de negocio. Vive junto a
 * las capacidades para que agregar una NUEVA obligue a pensar su
 * etiqueta (TypeScript exige la llave) — una capacidad sin nombre
 * visible no se puede vender.
 */
export const ETIQUETAS_CAPACIDAD: Record<Capacidad, string> = {
  wallet: "Pases en Apple Wallet y Google Wallet",
  tipos_de_tarjeta: "Los ocho tipos de tarjeta",
  reglas_y_vencimientos: "Reglas, límites y vencimientos",
  notificaciones: "Notificaciones al pase del cliente",
  analitica: "Analítica básica",
  analitica_avanzada: "Analítica avanzada",
  cercania: "El pase aparece solo cerca de tu local",
  segmentacion: "Segmentación de clientes",
  campanas_programadas: "Campañas programadas",
  webhooks: "Webhooks",
  api: "Acceso por API",
  exportacion: "Exportación de datos",
  pos: "Integración con tu punto de venta",
  roles_avanzados: "Roles y permisos avanzados",
  franquicias: "Franquicias y multi-marca",
  sla: "Acuerdo de nivel de servicio",
  marca_blanca: "Marca blanca",
  soporte_dedicado: "Soporte dedicado",
};

/** Cómo se le cuenta cada tope. Mismo criterio que las capacidades. */
export const ETIQUETAS_LIMITE: Record<keyof LimitesPlan, string> = {
  clientesActivos: "Clientes activos",
  programas: "Programas",
  notificacionesMes: "Notificaciones por mes",
  administradores: "Administradores",
  sedes: "Sedes",
  automatizaciones: "Automatizaciones",
};

export function esPlan(valor: string | null): valor is PlanId {
  return valor !== null && (PLANES_ID as readonly string[]).includes(valor);
}

export function definicionDe(plan: string | null): DefinicionPlan | null {
  return esPlan(plan) ? PLANES[plan] : null;
}

/**
 * El precio, escrito para mostrar. Sale UNA sola función para que
 * ninguna pantalla decida por su cuenta cómo se escribe un monto.
 *
 * Los planes de Lealtad están en DÓLARES por decisión del dueño
 * (2026-08-12). El depósito se sigue haciendo por SINPE en colones: el
 * monto exacto lo confirma Bookea al tipo de cambio del día, y por eso
 * no se convierte acá — inventar un tipo de cambio en el código sería
 * cobrar mal.
 *
 * null = "a convenir": el que llama decide cómo lo dice.
 */
export function precioDe(def: DefinicionPlan, periodo: "mes" | "año" = "mes"): string | null {
  const monto = periodo === "año" ? def.precioAnual : def.precioMensual;
  if (monto === null) return null;
  if (monto === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    // Los precios son enteros ($9, $27, $69): pedir dos decimales
    // pintaría "$9.00", que se lee como un formulario y no un precio.
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto);
}

/**
 * Cuánto se ahorra pagando por año, en meses. El copy dice «Ahorrá 2
 * meses» y ese 2 sale de acá, no de un texto escrito a mano que se
 * desincroniza el día que cambie un precio.
 */
export function mesesDeAhorroAnual(def: DefinicionPlan): number {
  if (!def.precioMensual || !def.precioAnual) return 0;
  const ahorro = def.precioMensual * 12 - def.precioAnual;
  return Math.round(ahorro / def.precioMensual);
}

/**
 * ¿Esta cuenta puede usar esta capacidad?
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
  usado: number;
  limite: number | null;
  /** Cuántos caben todavía. null = sin tope. */
  disponibles: number | null;
  /** Ya no entran más. */
  lleno: boolean;
  /** Pasó el 80%: hay que avisar antes de que se tope. */
  cerca: boolean;
  /** 0..100. 0 cuando no hay tope. */
  porcentaje: number;
};

/**
 * Cómo va la cuenta contra un tope de su plan.
 *
 * El tope NO se guarda en la fila de la cuenta: sale de la definición
 * del plan, y lo usado se cuenta. Guardarlo crearía un número que hay
 * que actualizar en cada cambio de plan y que se desincroniza.
 *
 * El aviso salta al 80% —no al 95%— porque enterarse cuando ya casi no
 * entra nadie no deja tiempo de decidir nada.
 */
export function estadoDelLimite(
  plan: string | null,
  cual: keyof LimitesPlan,
  usado: number,
): EstadoLimite {
  const limite = definicionDe(plan)?.limites[cual] ?? null;

  if (limite === null) {
    return { usado, limite: null, disponibles: null, lleno: false, cerca: false, porcentaje: 0 };
  }

  return {
    usado,
    limite,
    disponibles: Math.max(0, limite - usado),
    lleno: usado >= limite,
    cerca: usado >= limite * 0.8,
    porcentaje: Math.min(100, Math.round((usado / limite) * 100)),
  };
}
