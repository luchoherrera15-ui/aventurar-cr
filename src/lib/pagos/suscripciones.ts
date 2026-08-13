import type { PlanId } from "@/lib/lealtad/planes";
import {
  daDerechoAlPlan,
  estadoDesdeStripe,
  planDePrecio,
  type Entorno,
  type EstadoSuscripcion,
  type Periodo,
} from "./precios";

/**
 * QUÉ HACE BOOKEA CON CADA EVENTO DE STRIPE.
 *
 * El motor del webhook, y el único lugar donde se decide si un plan se
 * activa. Recibe el evento ya VERIFICADO y una «puerta» con las cuatro
 * cosas que necesita del mundo (registrar el evento, leer la
 * suscripción en Stripe, guardarla, escribir el plan). Nada de
 * Supabase ni de red acá adentro: por eso se puede probar entero, que
 * en código que mueve plata no es un lujo.
 *
 * ------------------------------------------------------------------
 * LAS TRES REGLAS QUE SOSTIENEN ESTO
 * ------------------------------------------------------------------
 *
 * 1. EL WEBHOOK ES LA ÚNICA FUENTE DE VERDAD. Un plan NUNCA se activa
 *    porque el navegador volvió a la página de éxito: esa URL se
 *    escribe a mano y cualquiera se regalaría el paquete de $89. Se
 *    activa acá, con un evento firmado por Stripe.
 *
 * 2. IDEMPOTENCIA PRIMERO. Stripe reintenta —es cómo garantiza la
 *    entrega— así que lo PRIMERO que pasa es registrar el
 *    `stripe_event_id` contra una llave única. El segundo pase del
 *    mismo evento sale por arriba sin tocar nada. Misma doctrina que
 *    `llaveDeCanje` en el mostrador (0137).
 *
 * 3. EL PRECIO MANDA, Y SE MAPEA POR ENTORNO. El plan no sale de la
 *    metadata que viajó por el navegador: sale del `price_id` que
 *    Stripe dice que se está cobrando, traducido por las variables
 *    `STRIPE_PRICE_<PLAN>_<PERIODO>`. Si ese precio no está mapeado,
 *    la suscripción se REGISTRA pero no activa nada — perder el
 *    registro de un cobro real es peor que no activarlo.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE MOTOR NO HACE: DEGRADAR
 * ------------------------------------------------------------------
 * Ni una cancelación ni una mora le bajan el plan al negocio. Se
 * guarda el estado nuevo y se avisa por correo, y una persona decide.
 * Bajar de `ilimitado` a `prueba` automáticamente recorta el cupo de
 * 1.150 clientes a 25 en el mismo segundo, y el primero en enterarse
 * sería el cliente que no puede agregar su tarjeta en el mostrador.
 */

// ── Lo que el motor necesita del mundo ───────────────────────────────

/** Una suscripción, ya normalizada desde lo que dice Stripe. */
export type DatosSuscripcion = {
  ranchoId: string | null;
  cuentaId: string | null;
  clienteStripe: string;
  suscripcionStripe: string;
  precioStripe: string | null;
  /** null = el price_id no está mapeado en el entorno. */
  plan: PlanId | null;
  periodo: Periodo;
  estado: EstadoSuscripcion;
  periodoInicio: string | null;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
};

export type Puerta = {
  /**
   * Registra el evento contra la llave única. «ya_procesado» = este
   * evento ya se procesó ENTERO antes; el que quedó a medias vuelve
   * como «nuevo» para que se reintente (las escrituras son upserts).
   */
  registrarEvento(e: {
    id: string;
    tipo: string;
    payload: unknown;
  }): Promise<"nuevo" | "ya_procesado">;
  marcarProcesado(id: string): Promise<void>;
  /** La suscripción tal como la ve Stripe HOY. null = no se pudo leer. */
  leerSuscripcion(id: string): Promise<Record<string, unknown> | null>;
  /**
   * Guarda (upsert por `stripe_subscription_id`) y devuelve de quién
   * es la suscripción DESPUÉS de mezclar con lo que ya había: los
   * eventos de `customer.subscription.*` no traen `client_reference_id`,
   * así que el dueño puede venir solo de la fila que dejó el checkout.
   * null = no hay dueño por ningún lado y no se pudo guardar.
   */
  guardarSuscripcion(
    d: DatosSuscripcion,
  ): Promise<{ ranchoId: string | null; cuentaId: string | null } | null>;
  /** Escribe el plan en el negocio (ranchos.plan_lealtad + cuentas.plan). */
  aplicarPlan(d: {
    ranchoId: string | null;
    cuentaId: string | null;
    plan: PlanId;
  }): Promise<void>;
  avisar(a: { asunto: string; detalle: string }): Promise<void>;
};

export type EventoEntrante = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type ResultadoEvento =
  | { tipo: "repetido" }
  | { tipo: "ignorado"; evento: string }
  | { tipo: "sin_suscripcion"; evento: string }
  | { tipo: "sin_dueno"; suscripcion: string }
  | { tipo: "sin_mapeo"; suscripcion: string; precio: string | null }
  | {
      tipo: "guardado";
      suscripcion: string;
      plan: PlanId;
      estado: EstadoSuscripcion;
      /** true = se le escribió el plan al negocio. */
      activado: boolean;
    };

/**
 * Los eventos que este motor entiende.
 *
 * `customer.subscription.created` está aunque el encargo pedía cuatro:
 * Stripe lo manda igual y atenderlo hace que el plan quede activo
 * incluso si el `checkout.session.completed` llega después o se pierde.
 * Los demás eventos de la cuenta se responden 200 y se ignoran — un
 * webhook que devuelve error por un evento que no le interesa termina
 * deshabilitado por Stripe.
 */
export const EVENTOS_ATENDIDOS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

// ── Leer lo que manda Stripe, sin `any` ──────────────────────────────

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/**
 * Stripe manda las referencias de dos formas según si el campo viene
 * expandido: `"sub_123"` o `{ id: "sub_123", … }`. Las dos son
 * legítimas y hay que aceptar las dos.
 */
export function idDeReferencia(valor: unknown): string | null {
  const directo = texto(valor);
  if (directo) return directo;
  return texto(objeto(valor)?.id);
}

/** Un timestamp de Stripe (segundos) → ISO, o null. */
function fechaDeUnix(valor: unknown): string | null {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return null;
  return new Date(valor * 1000).toISOString();
}

function primerItem(sub: Record<string, unknown>): Record<string, unknown> | null {
  const datos = objeto(sub.items)?.data;
  return Array.isArray(datos) ? objeto(datos[0]) : null;
}

/**
 * De qué suscripción es una factura.
 *
 * Stripe movió este campo de lugar: hasta 2025 era `invoice.subscription`
 * y después pasó a `invoice.parent.subscription_details.subscription`.
 * Las dos formas siguen circulando según la versión de API con la que
 * esté configurado el endpoint, así que se prueban las dos y el
 * renglón de la factura como tercera. Suponer una sola era garantizar
 * que la mitad de las moras no se registren.
 */
export function idDeSuscripcionDeFactura(factura: Record<string, unknown>): string | null {
  const directo = idDeReferencia(factura.subscription);
  if (directo) return directo;

  const porPadre = idDeReferencia(
    objeto(objeto(factura.parent)?.subscription_details)?.subscription,
  );
  if (porPadre) return porPadre;

  const lineas = objeto(factura.lines)?.data;
  const primera = Array.isArray(lineas) ? objeto(lineas[0]) : null;
  if (!primera) return null;
  const padre = objeto(primera.parent);
  return (
    idDeReferencia(objeto(padre?.subscription_item_details)?.subscription) ??
    idDeReferencia(primera.subscription)
  );
}

/**
 * La suscripción de Stripe, normalizada a lo que la base guarda.
 *
 * El período (`current_period_start/end`) también se mudó de lugar en
 * las versiones nuevas de la API: antes colgaba de la suscripción y
 * ahora de cada ítem. Se miran los dos lados — si solo se mirara el
 * viejo, «tu plan está pago hasta el …» saldría vacío para siempre.
 */
export function datosDeSuscripcion(
  sub: Record<string, unknown>,
  extra: {
    ranchoId?: string | null;
    cuentaId?: string | null;
    /** Para `customer.subscription.deleted`, donde el estado es un hecho. */
    estadoForzado?: EstadoSuscripcion;
  } = {},
  env: Entorno = process.env,
): DatosSuscripcion | null {
  const suscripcionStripe = texto(sub.id);
  const clienteStripe = idDeReferencia(sub.customer);
  if (!suscripcionStripe || !clienteStripe) return null;

  const item = primerItem(sub);
  const precioStripe = idDeReferencia(objeto(item?.price)?.id ?? item?.price);
  const mapeo = planDePrecio(precioStripe, env);

  const meta = objeto(sub.metadata) ?? {};

  return {
    ranchoId: extra.ranchoId ?? texto(meta.rancho_id),
    cuentaId: extra.cuentaId ?? texto(meta.cuenta_id),
    clienteStripe,
    suscripcionStripe,
    precioStripe,
    plan: mapeo?.plan ?? null,
    // Sin mapeo no se inventa nada raro: `mensual` es el default de la
    // columna y solo se usa para mostrar.
    periodo: mapeo?.periodo ?? "mensual",
    estado: extra.estadoForzado ?? estadoDesdeStripe(texto(sub.status)),
    periodoInicio: fechaDeUnix(sub.current_period_start ?? item?.current_period_start),
    periodoFin: fechaDeUnix(sub.current_period_end ?? item?.current_period_end),
    cancelaAlFinal: sub.cancel_at_period_end === true,
  };
}

// ── El motor ─────────────────────────────────────────────────────────

/**
 * Procesa UN evento ya verificado.
 *
 * Lanza si la puerta lanza: quien llama devuelve 500 y Stripe
 * reintenta, que es exactamente lo que se quiere cuando la base no
 * respondió. Como el evento quedó registrado con `procesado_en` en
 * null, ese reintento SÍ vuelve a entrar.
 */
export async function procesarEventoStripe(
  evento: EventoEntrante,
  puerta: Puerta,
  env: Entorno = process.env,
): Promise<ResultadoEvento> {
  // ── 1. La puerta de la idempotencia, antes que nada ────────────────
  const marca = await puerta.registrarEvento({
    id: evento.id,
    tipo: evento.type,
    payload: evento,
  });
  if (marca === "ya_procesado") return { tipo: "repetido" };

  const resultado = await despachar(evento, puerta, env);

  // Un evento ignorado también está procesado: marcarlo evita que un
  // reintento vuelva a recorrer todo esto para no hacer nada.
  await puerta.marcarProcesado(evento.id);
  return resultado;
}

async function despachar(
  evento: EventoEntrante,
  puerta: Puerta,
  env: Entorno,
): Promise<ResultadoEvento> {
  const objetoDelEvento = evento.data.object;

  switch (evento.type) {
    case "checkout.session.completed": {
      // Solo las sesiones de SUSCRIPCIÓN. Un pago suelto (`payment`)
      // no es un plan de Lealtad y no tiene nada que activar.
      if (texto(objetoDelEvento.mode) !== "subscription") {
        return { tipo: "ignorado", evento: evento.type };
      }
      const suscripcionId = idDeReferencia(objetoDelEvento.subscription);
      if (!suscripcionId) {
        await puerta.avisar({
          asunto: "Stripe: checkout completado SIN suscripción",
          detalle: `El evento ${evento.id} no trae qué suscripción se creó. Revisar en el panel de Stripe.`,
        });
        return { tipo: "sin_suscripcion", evento: evento.type };
      }

      const meta = objeto(objetoDelEvento.metadata) ?? {};
      // `client_reference_id` lo pone el servidor al crear la sesión
      // (ver suscripcion-actions.ts) después de comprobar que quien
      // paga es dueño del negocio. Nunca lo escribe el navegador.
      const ranchoId = texto(objetoDelEvento.client_reference_id) ?? texto(meta.rancho_id);
      const cuentaId = texto(meta.cuenta_id);

      return aplicarDesdeStripe(evento, suscripcionId, puerta, env, { ranchoId, cuentaId });
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const datos = datosDeSuscripcion(objetoDelEvento, {}, env);
      if (!datos) return { tipo: "sin_suscripcion", evento: evento.type };
      return guardarYActivar(datos, puerta);
    }

    case "customer.subscription.deleted": {
      // El estado se FUERZA: `deleted` es un hecho, no algo a deducir
      // del `status` que venga en el objeto.
      const datos = datosDeSuscripcion(objetoDelEvento, { estadoForzado: "cancelada" }, env);
      if (!datos) return { tipo: "sin_suscripcion", evento: evento.type };

      const dueno = await puerta.guardarSuscripcion(datos);
      await puerta.avisar({
        asunto: "Stripe: se canceló una suscripción de Lealtad",
        detalle:
          `Suscripción ${datos.suscripcionStripe} (plan ${datos.plan ?? "sin mapear"}) cancelada. ` +
          `Negocio ${dueno?.ranchoId ?? datos.ranchoId ?? "—"}. ` +
          "El plan NO se bajó solo: si corresponde bajarlo, se hace desde /admin/complementos.",
      });
      if (!dueno) return { tipo: "sin_dueno", suscripcion: datos.suscripcionStripe };
      return {
        tipo: "guardado",
        suscripcion: datos.suscripcionStripe,
        plan: datos.plan ?? "prueba",
        estado: "cancelada",
        activado: false,
      };
    }

    case "invoice.payment_failed": {
      const suscripcionId = idDeSuscripcionDeFactura(objetoDelEvento);
      if (!suscripcionId) {
        await puerta.avisar({
          asunto: "Stripe: falló un cobro que no se pudo atribuir",
          detalle: `El evento ${evento.id} no dice de qué suscripción es la factura.`,
        });
        return { tipo: "sin_suscripcion", evento: evento.type };
      }
      const resultado = await aplicarDesdeStripe(evento, suscripcionId, puerta, env, {});
      await puerta.avisar({
        asunto: "Stripe: falló el cobro de una suscripción de Lealtad",
        detalle:
          `Suscripción ${suscripcionId}. Stripe reintenta solo. El plan NO se bajó: ` +
          "si el cobro no entra, la baja se decide desde /admin/complementos.",
      });
      return resultado;
    }

    default:
      return { tipo: "ignorado", evento: evento.type };
  }
}

/**
 * Lee la suscripción EN STRIPE y aplica lo que diga.
 *
 * Se relee a propósito en vez de confiar en el objeto del evento: la
 * sesión de checkout no trae el precio, y una factura menos todavía.
 * Además, entre que el evento se emitió y llegó pudo cambiar algo —los
 * eventos pueden llegar desordenados— y lo que vale es el estado de
 * ahora.
 */
async function aplicarDesdeStripe(
  evento: EventoEntrante,
  suscripcionId: string,
  puerta: Puerta,
  env: Entorno,
  extra: { ranchoId?: string | null; cuentaId?: string | null },
): Promise<ResultadoEvento> {
  const sub = await puerta.leerSuscripcion(suscripcionId);
  if (!sub) {
    await puerta.avisar({
      asunto: "Stripe: no se pudo leer una suscripción",
      detalle: `Evento ${evento.id} (${evento.type}) sobre ${suscripcionId}: Stripe no devolvió la suscripción.`,
    });
    return { tipo: "sin_suscripcion", evento: evento.type };
  }

  const datos = datosDeSuscripcion(sub, extra, env);
  if (!datos) return { tipo: "sin_suscripcion", evento: evento.type };
  return guardarYActivar(datos, puerta);
}

async function guardarYActivar(
  datos: DatosSuscripcion,
  puerta: Puerta,
): Promise<ResultadoEvento> {
  const dueno = await puerta.guardarSuscripcion(datos);

  if (!dueno) {
    await puerta.avisar({
      asunto: "Stripe: hay un cobro sin negocio al que atribuirlo",
      detalle:
        `La suscripción ${datos.suscripcionStripe} (cliente ${datos.clienteStripe}) no dice ` +
        "de qué negocio es: ni `client_reference_id` ni metadata. Hay que atarla a mano.",
    });
    return { tipo: "sin_dueno", suscripcion: datos.suscripcionStripe };
  }

  // ── El price_id que no conocemos ───────────────────────────────────
  // Queda GUARDADO (arriba) pero no activa nada. Pasa cuando el dueño
  // crea un precio nuevo en Stripe y todavía no puso su variable, o
  // cuando el servidor corre con las llaves de prueba y el cobro entró
  // por las de producción.
  if (!datos.plan) {
    await puerta.avisar({
      asunto: "Stripe: cobro con un precio que Bookea no reconoce",
      detalle:
        `La suscripción ${datos.suscripcionStripe} se cobra con el precio ` +
        `${datos.precioStripe ?? "(sin precio)"}, que no está en ninguna variable ` +
        "STRIPE_PRICE_<PLAN>_<MENSUAL|ANUAL>. Quedó registrada SIN activar el plan.",
    });
    return {
      tipo: "sin_mapeo",
      suscripcion: datos.suscripcionStripe,
      precio: datos.precioStripe,
    };
  }

  const activar = daDerechoAlPlan(datos.estado);
  if (activar) {
    await puerta.aplicarPlan({
      ranchoId: dueno.ranchoId,
      cuentaId: dueno.cuentaId,
      plan: datos.plan,
    });
  }

  return {
    tipo: "guardado",
    suscripcion: datos.suscripcionStripe,
    plan: datos.plan,
    estado: datos.estado,
    activado: activar,
  };
}
