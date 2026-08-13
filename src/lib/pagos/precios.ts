import { PLANES, PLANES_OFRECIDOS, type PlanId } from "@/lib/lealtad/planes";

/**
 * EL MAPEO price_id ↔ PLAN, y nada más.
 *
 * Lógica pura: sin Stripe, sin Supabase, sin red. Se puede probar
 * entera, y por eso vive separada del cliente (`stripe.ts`) y del
 * motor del webhook (`suscripciones.ts`).
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL MAPEO VA POR VARIABLES DE ENTORNO
 * ------------------------------------------------------------------
 * Un `price_id` de Stripe (`price_1Q…`) es un identificador de una
 * CUENTA de Stripe concreta. El de la cuenta de prueba y el de la
 * cuenta de producción son distintos, y los de producción ni siquiera
 * existen todavía cuando este código se escribe.
 *
 * Escribirlos a mano en el código tendría tres consecuencias, todas
 * malas: un despliegue para cada precio nuevo, el modo prueba y el
 * modo producción peleados en el mismo archivo, y —la peor— la
 * tentación de «arreglar» un cobro editando una constante.
 *
 * Así, en cambio: seis variables, `STRIPE_PRICE_<PLAN>_<PERIODO>`, que
 * el dueño llena en Vercel. El código no conoce ningún precio.
 *
 * ------------------------------------------------------------------
 * EL PLAN DE PRUEBA NO ESTÁ ACÁ, Y NO ES UN OLVIDO
 * ------------------------------------------------------------------
 * `PLANES_CON_COBRO` sale del catálogo filtrando por precio mayor que
 * cero, así que `prueba` ($0) queda afuera solo. Es la regla explícita
 * del dueño: el plan gratis se activa al instante
 * (`crearGratisAlInstante`) y NUNCA pasa por Stripe. Derivarlo del
 * catálogo —en vez de escribir los tres ids a mano— hace que el día
 * que aparezca un cuarto paquete de pago, se pueda cobrar sin tocar
 * este archivo; y que el día que un paquete baje a $0, deje de
 * cobrarse sin que nadie se acuerde de venir acá.
 */

export const PERIODOS = ["mensual", "anual"] as const;
export type Periodo = (typeof PERIODOS)[number];

/** Cómo se llama cada período para una persona. */
export const ETIQUETA_PERIODO: Record<Periodo, string> = {
  mensual: "por mes",
  anual: "por año",
};

/**
 * Lo que se puede cobrar con tarjeta: los paquetes ofrecidos que
 * cuestan algo. `prueba` queda afuera por su propio precio.
 */
export const PLANES_CON_COBRO: readonly PlanId[] = PLANES_OFRECIDOS.filter(
  (id) => (PLANES[id].precioMensual ?? 0) > 0,
);

export function esPlanConCobro(valor: string | null | undefined): valor is PlanId {
  return !!valor && (PLANES_CON_COBRO as readonly string[]).includes(valor);
}

export function esPeriodo(valor: string | null | undefined): valor is Periodo {
  return !!valor && (PERIODOS as readonly string[]).includes(valor);
}

/**
 * El entorno como dato y no como global: así los tests no tienen que
 * escribir `process.env` (que en vitest es compartido por todos los
 * hilos y se filtra de un archivo a otro).
 */
export type Entorno = Record<string, string | undefined>;

/** `STRIPE_PRICE_ARRANQUE_MENSUAL`, y así. */
export function variableDePrecio(plan: PlanId, periodo: Periodo): string {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${periodo.toUpperCase()}`;
}

/**
 * El `price_id` de un plan y período, o null si esa variable no está
 * puesta.
 *
 * El `.trim()` y el rechazo del vacío importan más de lo que parece:
 * `.env.example` deja todas las variables declaradas y VACÍAS. Sin
 * esto, `precioDePlan()` devolvería `""`, la sesión de Checkout se
 * crearía con un precio vacío y el mapa de vuelta haría calzar
 * CUALQUIER evento sin precio con el primer plan de la lista.
 */
export function precioDePlan(
  plan: PlanId,
  periodo: Periodo,
  env: Entorno = process.env,
): string | null {
  const valor = env[variableDePrecio(plan, periodo)]?.trim();
  return valor ? valor : null;
}

/**
 * El mapa de vuelta: `price_id` → qué plan y qué período es.
 *
 * Se arma en cada llamada a propósito. Cachearlo en un módulo haría
 * que un cambio de variable en Vercel no tuviera efecto hasta el
 * siguiente arranque en frío, y el síntoma —«pagué y no se activó»—
 * mandaría a mirar el webhook, que estaría bien.
 */
export function mapaDePrecios(env: Entorno = process.env): Map<string, { plan: PlanId; periodo: Periodo }> {
  const mapa = new Map<string, { plan: PlanId; periodo: Periodo }>();
  for (const plan of PLANES_CON_COBRO) {
    for (const periodo of PERIODOS) {
      const precio = precioDePlan(plan, periodo, env);
      // El primero gana: si dos variables tienen el mismo price_id
      // (copiar y pegar mal), se cobra el paquete de abajo, que es el
      // error barato de los dos.
      if (precio && !mapa.has(precio)) mapa.set(precio, { plan, periodo });
    }
  }
  return mapa;
}

export function planDePrecio(
  priceId: string | null | undefined,
  env: Entorno = process.env,
): { plan: PlanId; periodo: Periodo } | null {
  const id = priceId?.trim();
  if (!id) return null;
  return mapaDePrecios(env).get(id) ?? null;
}

/**
 * Qué paquetes se pueden pagar con tarjeta HOY, con los períodos que
 * tengan precio. Lista vacía = Stripe no está configurado, y la
 * pantalla no muestra ningún botón de tarjeta: el SINPE sigue siendo
 * el único camino y todo funciona igual que antes.
 */
export function planesConPrecio(
  env: Entorno = process.env,
): { plan: PlanId; periodos: Periodo[] }[] {
  return PLANES_CON_COBRO.map((plan) => ({
    plan,
    periodos: PERIODOS.filter((periodo) => precioDePlan(plan, periodo, env) !== null),
  })).filter((p) => p.periodos.length > 0);
}

// ── El estado de la suscripción ──────────────────────────────────────

export const ESTADOS_SUSCRIPCION = ["activa", "en_prueba", "morosa", "cancelada"] as const;
export type EstadoSuscripcion = (typeof ESTADOS_SUSCRIPCION)[number];

/**
 * Los estados de Stripe, traducidos a los cuatro que la base guarda.
 *
 * El default es `morosa` y NO `activa`: un estado que este código no
 * conoce —porque Stripe agregó uno nuevo— no puede terminar
 * habilitando un plan de $89. Cuando la duda cuesta plata, la duda no
 * activa.
 */
export function estadoDesdeStripe(status: string | null | undefined): EstadoSuscripcion {
  switch (status) {
    case "active":
      return "activa";
    case "trialing":
      return "en_prueba";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "morosa";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "cancelada";
    default:
      return "morosa";
  }
}

/**
 * ¿Este estado da derecho al plan?
 *
 * Solo dos. `morosa` no lo da y `cancelada` tampoco — pero ojo: NO
 * dar derecho no es lo mismo que QUITAR el plan. El webhook nunca
 * degrada a nadie por su cuenta (ver el encabezado de la 0143): baja
 * el estado, avisa por correo, y la decisión la toma una persona.
 */
export function daDerechoAlPlan(estado: EstadoSuscripcion): boolean {
  return estado === "activa" || estado === "en_prueba";
}

/** Cómo se le cuenta el estado a un dueño de negocio. */
export const ETIQUETA_ESTADO: Record<EstadoSuscripcion, string> = {
  activa: "Al día",
  en_prueba: "En período de prueba",
  morosa: "Pago pendiente",
  cancelada: "Cancelada",
};
