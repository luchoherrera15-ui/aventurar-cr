import type { PlanId } from "@/lib/lealtad/planes";
import { decidirPorCobro, motivoDeCorte, type MotivoDeCorte } from "./corte";
import {
  datosDePagoDeInvitacion,
  decidirCobroDeInvitacion,
  type PedidoInvitacion,
} from "./invitaciones-pagadas";
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
 * EL COBRO DE ALGUIEN QUE TODAVÍA NO TIENE NEGOCIO
 * ------------------------------------------------------------------
 * En /lealtad/planes compra gente que no tiene nada en Bookea. Ahí el
 * cobro no puede traer un `rancho_id` —el negocio no existe— y trae en
 * cambio un `solicitud_id`: la fila de `solicitudes_lealtad` SIN rancho
 * que el servidor dejó antes de mandar a pagar (una solicitud de ALTA,
 * la misma forma de la 0130).
 *
 * COBRAR PRIMERO, CREAR DESPUÉS. El negocio nace acá, con el cobro ya
 * confirmado, y nunca antes: un rancho creado al abrir Checkout sería,
 * en la mayoría de los casos, basura —el checkout abandonado es la
 * norma— con su slug tomado, su panel accesible y su aprobación de
 * lealtad puesta. Es exactamente el problema que la 0130 resolvió
 * cuando dio vuelta el flujo viejo («el rancho se creaba primero y
 * quedaba en hold»).
 *
 * Y el negocio se crea SOLO si el cobro da derecho al plan: una
 * suscripción que quedó `incomplete` no crea nada, avisa, y la
 * solicitud sigue en la cola de /admin/complementos como cualquier
 * otra.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE MOTOR NO HACE: DEGRADAR
 * ------------------------------------------------------------------
 * Ni una cancelación ni una mora le bajan el plan al negocio. Se
 * guarda el estado nuevo y se avisa por correo, y una persona decide.
 * Bajar de `ilimitado` a `prueba` automáticamente recorta el cupo de
 * 1.150 clientes a 25 en el mismo segundo, y el primero en enterarse
 * sería el cliente que no puede agregar su tarjeta en el mostrador.
 *
 * ------------------------------------------------------------------
 * LO QUE SÍ HACE: EL INTERRUPTOR
 * ------------------------------------------------------------------
 * Degradar y APAGAR no son lo mismo, y por eso conviven.
 *
 * Cuando el período pagado se termina de verdad, el programa deja de
 * OPERAR: se pausa. El paquete —y con él el cupo, y con el cupo los
 * miembros— se queda intacto, esperando. Es exactamente el estado
 * `pausado` que el panel ya ofrece con el botón «Pausar», el que
 * promete «conserva todo», y esa promesa acá se cumple al pie de la
 * letra: **jamás se borra un miembro, un sello, un pase ni un
 * movimiento**. Son los clientes del negocio, no nuestros, y el dueño
 * puede renovar mañana.
 *
 * La simetría es la mitad del diseño: si la vuelta no funcionara,
 * cancelar sería una trampa. Al renovar, `reanudarPrograma` levanta
 * SOLO lo que este corte pausó —nunca lo que el dueño pausó él— y el
 * paquete vuelve a escribirse con el precio que Stripe cobra.
 *
 * El criterio de CUÁNDO se apaga vive aparte, en `corte.ts`, y es
 * lógica pura: el corte al final del período, la mora que avisa en vez
 * de apagar, y el negocio que paga por SINPE y no se apaga nunca.
 */

// ── Lo que el motor necesita del mundo ───────────────────────────────

/** Una suscripción, ya normalizada desde lo que dice Stripe. */
export type DatosSuscripcion = {
  ranchoId: string | null;
  cuentaId: string | null;
  /**
   * La solicitud de ALTA que espera este cobro, cuando el negocio
   * todavía no existe. Solo la ponen las sesiones de /lealtad/planes.
   */
  solicitudId: string | null;
  clienteStripe: string;
  suscripcionStripe: string;
  precioStripe: string | null;
  /** null = el price_id no está mapeado en el entorno. */
  plan: PlanId | null;
  periodo: Periodo;
  estado: EstadoSuscripcion;
  /**
   * El `status` CRUDO de Stripe (`active`, `past_due`, `unpaid`…).
   *
   * Se guarda además del `estado` normalizado porque los cuatro
   * estados de la base COLAPSAN distinciones que el interruptor
   * necesita: `past_due` y `unpaid` son los dos `morosa`, y son
   * justamente «avisale» y «apagalo». No va a ninguna columna: existe
   * para que `decidirPorCobro` pueda mirar el original.
   */
  statusStripe: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
};

/** De quién es una suscripción, ya resuelto contra la base. */
export type Dueno = { ranchoId: string | null; cuentaId: string | null };

/** Qué clase de aviso le llega al DUEÑO del negocio (no al equipo). */
export type ClaseDeAviso =
  /** «Tu programa funciona hasta el 30» — apenas se programa la baja. */
  | "corte_programado"
  /** «Tu programa quedó en pausa» — en el momento del corte. */
  | "programa_pausado"
  /** «Tu programa volvió a funcionar» — al renovar. */
  | "programa_reanudado"
  /** «No pudimos cobrar» — y el programa SIGUE funcionando. */
  | "cobro_fallido";

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
  /**
   * EL ALTA PAGADA: convierte la solicitud sin rancho (0130) en un
   * negocio de verdad y devuelve a quién quedó atribuido el cobro.
   *
   * Tiene que ser IDEMPOTENTE: `checkout.session.completed` y
   * `customer.subscription.created` llegan casi juntos y los dos traen
   * el mismo `solicitud_id`. Si esto creara un negocio por llamada, la
   * persona terminaría con dos.
   *
   * null = no se pudo (la solicitud no existe, ya la rechazaron, o le
   * falta un dato). El motor avisa y no activa nada.
   */
  crearNegocioDeSolicitud(d: {
    solicitudId: string;
    plan: PlanId;
  }): Promise<{ ranchoId: string; cuentaId: string | null } | null>;
  /** Escribe el plan en el negocio (ranchos.plan_lealtad + cuentas.plan). */
  aplicarPlan(d: {
    ranchoId: string | null;
    cuentaId: string | null;
    plan: PlanId;
  }): Promise<void>;
  avisar(a: { asunto: string; detalle: string }): Promise<void>;

  // ── El interruptor ─────────────────────────────────────────────────

  /**
   * ¿Este negocio sigue pago por otra vía, aunque ESTA suscripción se
   * haya terminado? Son dos casos y los dos son reales:
   *   · un depósito por SINPE o transferencia vigente (0128);
   *   · OTRA suscripción de Stripe activa — el que cambió de paquete
   *     deja la vieja cancelada y una nueva corriendo.
   *
   * true = no se apaga nada.
   *
   * Solo se pregunta cuando el corte está sobre la mesa: es una
   * consulta más, y en el 99% de los eventos (renovaciones al día) no
   * hace falta.
   */
  sigueCubierto(d: Dueno & { exceptoSuscripcion: string }): Promise<boolean>;

  /**
   * PAUSA lo que esté operando. No borra NADA: ni un miembro, ni un
   * sello, ni un pase, ni un movimiento.
   *
   * `aplicado: false` = no se pudo dejar constancia de que la pausa la
   * puso el cobro (falta la migración 0146), y entonces NO se pausa
   * nada: una pausa que después no se sabe deshacer convierte cancelar
   * en una trampa. Ver puerta-supabase.ts.
   */
  pausarPrograma(
    d: Dueno & { suscripcionStripe: string; plan: PlanId | null },
  ): Promise<{ pausados: number; aplicado: boolean }>;

  /**
   * La vuelta: reactiva SOLO lo que el corte pausó. Lo que el dueño
   * pausó él —o dejó en borrador, o archivó— se queda como está: esa
   * decisión no la puede pisar un cobro.
   */
  reanudarPrograma(
    d: Dueno & { suscripcionStripe: string },
  ): Promise<{ reanudados: number; aplicado: boolean }>;

  /**
   * Reclama el aviso previo de esta suscripción. true = mandalo;
   * false = ya se mandó antes.
   *
   * Hace falta porque Stripe manda varios `customer.subscription.updated`
   * con `cancel_at_period_end` en true, y la idempotencia por
   * `stripe_event_id` no los frena: son eventos DISTINTOS.
   */
  reclamarAvisoPrevio(d: { suscripcionStripe: string }): Promise<boolean>;

  /** El correo al DUEÑO del negocio. Nunca lanza. */
  avisarAlDueno(a: Dueno & { clase: ClaseDeAviso; plan: PlanId | null; hasta: string | null }): Promise<void>;

  // ── Las invitaciones digitales (pago suelto, no suscripción) ────────

  /**
   * El pedido tal como está en la base AHORA. null = ese pedido NO
   * existe.
   *
   * La distinción importa: «no existe» hace que el motor avise de un
   * cobro huérfano, así que un error de base tiene que LANZAR (el
   * webhook devuelve 500 y Stripe reintenta), nunca devolver null.
   */
  leerPedidoInvitacion(id: string): Promise<PedidoInvitacion | null>;
  /**
   * RECLAMA el pedido: lo pasa a `estado` solo si venía sin cobrar.
   *
   * true = lo reclamó ESTE evento; false = ya estaba cobrado. Es lo que
   * garantiza que los correos salgan una sola vez aunque Stripe entregue
   * dos eventos distintos por el mismo cobro (`completed` y
   * `async_payment_succeeded` no comparten `stripe_event_id`, así que la
   * idempotencia de `eventos_stripe` no los frena). Mismo patrón que
   * `reclamarAvisoPrevio`.
   */
  cobrarPedidoInvitacion(d: {
    pedidoId: string;
    estado: "pagado" | "en_revision";
    sesionStripe: string;
  }): Promise<boolean>;
  /** Los correos del pedido pagado (al cliente y al equipo). Nunca lanza. */
  avisarInvitacionPagada(d: { pedidoId: string; conRevision: boolean }): Promise<void>;
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
  /**
   * Un cobro de alguien SIN negocio que no se pudo convertir en negocio.
   * La solicitud queda en la cola y el equipo la resuelve a mano — el
   * cobro no se pierde: el evento entero está en `eventos_stripe`.
   */
  | {
      tipo: "alta_sin_resolver";
      solicitud: string;
      motivo: "sin_plan" | "no_da_derecho" | "no_se_pudo";
    }
  /** Una invitación digital que quedó cobrada por este evento. */
  | {
      tipo: "invitacion_cobrada";
      pedido: string;
      /** `en_revision` = entró la plata pero no cuadra; lo mira una persona. */
      estado: "pagado" | "en_revision";
    }
  /** Un cobro de invitación que no cambió nada (ver el motivo). */
  | {
      tipo: "invitacion_sin_efecto";
      motivo: "sin_cobrar" | "sin_pedido" | "ya_cobrado" | "no_cobrable";
    }
  | {
      tipo: "guardado";
      suscripcion: string;
      plan: PlanId;
      estado: EstadoSuscripcion;
      /** true = se le escribió el plan al negocio. */
      activado: boolean;
      /** true = este evento CREÓ el negocio (un alta pagada con tarjeta). */
      creado?: true;
      /**
       * Qué hizo el interruptor. Ausente cuando no hizo nada, que es
       * el caso normal (una renovación al día no apaga ni prende).
       */
      corte?: EfectoDelCorte;
    };

/** Lo que el interruptor terminó haciendo con el programa. */
export type EfectoDelCorte =
  | { hizo: "nada" }
  /** Se le contó al dueño en qué fecha se apaga. */
  | { hizo: "aviso_previo" }
  /** Se le avisó que el cobro rebotó — y el programa sigue operando. */
  | { hizo: "aviso_mora" }
  | { hizo: "pausado"; programas: number }
  | { hizo: "reanudado"; programas: number }
  /** Correspondía apagar pero el negocio paga por SINPE. */
  | { hizo: "protegido"; motivo: MotivoDeCorte }
  /** Falta la migración 0146: no se pausó nada, y alguien tiene que verlo. */
  | { hizo: "no_se_pudo" };

/**
 * Los eventos que este motor entiende.
 *
 * `customer.subscription.created` está aunque el encargo pedía cuatro:
 * Stripe lo manda igual y atenderlo hace que el plan quede activo
 * incluso si el `checkout.session.completed` llega después o se pierde.
 * Los demás eventos de la cuenta se responden 200 y se ignoran — un
 * webhook que devuelve error por un evento que no le interesa termina
 * deshabilitado por Stripe.
 *
 * ------------------------------------------------------------------
 * QUÉ EVENTO HACE QUÉ, CON EL INTERRUPTOR
 * ------------------------------------------------------------------
 *   · checkout.session.completed   → activa (y REANUDA si estaba cortado)
 *   · customer.subscription.created→ ídem
 *   · customer.subscription.updated→ el que lleva casi todo el trabajo:
 *       activa, reanuda, manda el AVISO PREVIO cuando aparece
 *       `cancel_at_period_end`, y CORTA si el status ya es terminal.
 *   · customer.subscription.deleted→ CORTA. Stripe lo manda cuando el
 *       período pagado se terminó de verdad, no cuando el cliente
 *       cancela: por eso el corte cae solo en la fecha correcta.
 *   · invoice.payment_failed       → AVISA y NO apaga.
 *
 * Y aparte, por el mismo endpoint, los cobros SUELTOS de invitaciones
 * digitales (`mode: "payment"`), que no son suscripciones y no tienen
 * nada que ver con el interruptor:
 *   · checkout.session.completed (mode payment)  → cobra el pedido
 *   · checkout.session.async_payment_succeeded   → ídem, para el medio
 *       de pago que acredita más tarde. Llega con OTRO `stripe_event_id`
 *       que el `completed` del mismo cobro, así que la idempotencia real
 *       de este caso es el reclamo del pedido, no la tabla de eventos.
 *
 * ------------------------------------------------------------------
 * LOS QUE NO SE ATIENDEN, Y POR QUÉ
 * ------------------------------------------------------------------
 *   · `invoice.paid` / `invoice.payment_succeeded` — la renovación ya
 *     llega por `customer.subscription.updated`, que además trae el
 *     precio y el período. Atender los dos duplicaría el correo de
 *     «tu programa volvió» sin agregar un solo caso nuevo.
 *   · `invoice.upcoming` — sería el candidato natural para el «faltan
 *     tres días», pero Stripe NO genera factura próxima para una
 *     suscripción marcada para cancelarse: para el caso que importa,
 *     ese evento no llega nunca. El aviso previo sale en cuanto se
 *     conoce la fecha, que es semanas antes.
 *   · `customer.subscription.paused` / `.resumed` — el `status` ya
 *     viaja en el `updated` que Stripe manda junto con ellos.
 */
export const EVENTOS_ATENDIDOS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
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
    solicitudId?: string | null;
    /** Para `customer.subscription.deleted`, donde el estado es un hecho. */
    estadoForzado?: EstadoSuscripcion;
    /**
     * El status CRUDO forzado, por el mismo motivo. Van los dos y no
     * uno derivado del otro: `estadoDesdeStripe` no tiene vuelta —
     * `morosa` no dice si venía de `past_due` o de `unpaid`.
     */
    statusForzado?: string;
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
  const statusStripe = extra.statusForzado ?? texto(sub.status);

  return {
    ranchoId: extra.ranchoId ?? texto(meta.rancho_id),
    cuentaId: extra.cuentaId ?? texto(meta.cuenta_id),
    // La copia en `subscription_data.metadata` es la que hace que un
    // `customer.subscription.created` que llegue ANTES que el checkout
    // —o en vez del checkout— sepa igual que esto es un alta.
    solicitudId: extra.solicitudId ?? texto(meta.solicitud_id),
    clienteStripe,
    suscripcionStripe,
    precioStripe,
    plan: mapeo?.plan ?? null,
    // Sin mapeo no se inventa nada raro: `mensual` es el default de la
    // columna y solo se usa para mostrar.
    periodo: mapeo?.periodo ?? "mensual",
    estado: extra.estadoForzado ?? estadoDesdeStripe(statusStripe),
    statusStripe,
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
    // El cobro DIFERIDO de una invitación: la sesión ya se había
    // completado (y en ese momento no se activó nada, porque el
    // `payment_status` venía en "unpaid") y recién ahora acreditó.
    case "checkout.session.async_payment_succeeded":
      return cobrarInvitacion(objetoDelEvento, puerta, evento.type);

    case "checkout.session.completed": {
      // Un pago SUELTO no es un plan de Lealtad: o es una invitación
      // digital —y entonces lo que se cobra es un pedido, no una
      // suscripción— o no es nuestro y se ignora.
      if (texto(objetoDelEvento.mode) === "payment") {
        return cobrarInvitacion(objetoDelEvento, puerta, evento.type);
      }
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
      // `solicitud_id` MANDA sobre todo lo demás: si está, esta sesión
      // es un ALTA (el negocio no existe todavía) y el
      // `client_reference_id` lleva la SOLICITUD, no un negocio.
      // Leerlo como rancho activaría el plan en un id que no es de
      // ningún rancho — o, peor, en el de otro.
      const solicitudId = texto(meta.solicitud_id);
      // `client_reference_id` lo pone el servidor al crear la sesión
      // (ver checkout.ts) después de comprobar que quien paga es dueño
      // del negocio. Nunca lo escribe el navegador.
      const ranchoId = solicitudId
        ? texto(meta.rancho_id)
        : (texto(objetoDelEvento.client_reference_id) ?? texto(meta.rancho_id));
      const cuentaId = texto(meta.cuenta_id);

      return aplicarDesdeStripe(evento, suscripcionId, puerta, env, {
        ranchoId,
        cuentaId,
        solicitudId,
      });
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
      //
      // ESTE ES EL MOMENTO DEL CORTE, y por eso llega solo en la fecha
      // correcta: Stripe manda `deleted` cuando el período pagado se
      // TERMINÓ, no cuando el cliente apretó «cancelar». El que canceló
      // el día 3 con el mes pagado hasta el 30 recibe este evento el
      // 30 — nosotros no calculamos ninguna fecha.
      const datos = datosDeSuscripcion(
        objetoDelEvento,
        { estadoForzado: "cancelada", statusForzado: "canceled" },
        env,
      );
      if (!datos) return { tipo: "sin_suscripcion", evento: evento.type };

      const dueno = await puerta.guardarSuscripcion(datos);
      if (!dueno) {
        await puerta.avisar({
          asunto: "Stripe: se canceló una suscripción sin negocio al que atribuirla",
          detalle:
            `Suscripción ${datos.suscripcionStripe} (plan ${datos.plan ?? "sin mapear"}) ` +
            "cancelada, pero no dice de qué negocio es. No se apagó nada.",
        });
        return { tipo: "sin_dueno", suscripcion: datos.suscripcionStripe };
      }

      const corte = await aplicarVeredicto(datos, dueno, puerta, {});
      await puerta.avisar({
        asunto: "Stripe: se canceló una suscripción de Lealtad",
        detalle:
          `Suscripción ${datos.suscripcionStripe} (plan ${datos.plan ?? "sin mapear"}) cancelada. ` +
          `Negocio ${dueno.ranchoId ?? datos.ranchoId ?? "—"}. ` +
          `${describirCorte(corte)} El paquete NO se bajó: el programa queda PAUSADO ` +
          "(conserva miembros, sellos, pases y movimientos) y vuelve solo al renovar.",
      });
      return {
        tipo: "guardado",
        suscripcion: datos.suscripcionStripe,
        plan: datos.plan ?? "prueba",
        estado: "cancelada",
        activado: false,
        ...(corte.hizo === "nada" ? {} : { corte }),
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
      // `avisarMora`: el correo al dueño sale de ACÁ y no del veredicto,
      // aunque el veredicto también vea la mora. Stripe manda los dos
      // eventos por el mismo hecho —`invoice.payment_failed` y un
      // `customer.subscription.updated` a `past_due`— y avisando en los
      // dos, al dueño le llegarían dos correos idénticos por un solo
      // rebote de tarjeta.
      const resultado = await aplicarDesdeStripe(evento, suscripcionId, puerta, env, {}, {
        avisarMora: true,
      });
      await puerta.avisar({
        asunto: "Stripe: falló el cobro de una suscripción de Lealtad",
        detalle:
          `Suscripción ${suscripcionId}. Stripe reintenta solo durante días. NO se apagó ` +
          "nada: un rebote de tarjeta es un accidente, no una cancelación. Si el cobro " +
          "nunca entra, Stripe cierra la suscripción y ahí sí se pausa el programa.",
      });
      return resultado;
    }

    default:
      return { tipo: "ignorado", evento: evento.type };
  }
}

/**
 * EL COBRO DE UNA INVITACIÓN DIGITAL.
 *
 * Un pago suelto, sin renovación ni corte: lo único que pasa es que un
 * pedido de `pedidos_invitacion` deja de estar esperando plata. Por eso
 * no toca nada de la maquinaria de arriba —ni `guardarSuscripcion`, ni
 * el plan, ni el interruptor— y cabe en veinte renglones.
 *
 * ------------------------------------------------------------------
 * LA IDEMPOTENCIA ACÁ ES EL RECLAMO, NO LA TABLA DE EVENTOS
 * ------------------------------------------------------------------
 * `eventos_stripe` frena el REINTENTO del mismo evento, pero no dos
 * eventos distintos por el mismo cobro —y son dos: el `completed` y el
 * `async_payment_succeeded`—. Lo que garantiza que el pedido se cobre y
 * se avise UNA vez es `cobrarPedidoInvitacion`, que solo devuelve true
 * si fue ÉL quien lo movió de estado.
 *
 * ------------------------------------------------------------------
 * QUÉ PASA SI LO COBRADO NO CUADRA CON EL PEDIDO
 * ------------------------------------------------------------------
 * El pedido igual queda registrado como pagado con tarjeta —la plata
 * entró, y no reconocerla sería lo peor que se puede hacer— pero en
 * `en_revision` en vez de `pagado`, y con un aviso al equipo. Nadie
 * pasa a diseño con un monto que no cuadra, y nadie que pagó se queda
 * sin constancia de haber pagado.
 */
async function cobrarInvitacion(
  sesion: Record<string, unknown>,
  puerta: Puerta,
  tipoEvento: string,
): Promise<ResultadoEvento> {
  const pago = datosDePagoDeInvitacion(sesion);
  // No lleva nuestra marca: es de Lealtad o de algo que no es nuestro.
  if (!pago) return { tipo: "ignorado", evento: tipoEvento };

  const pedido = await puerta.leerPedidoInvitacion(pago.pedidoId);
  const veredicto = decidirCobroDeInvitacion({ pago, pedido });

  if (veredicto.estado === "ignorar") {
    // Los dos casos en que entró plata y NO quedó atada a nada. Los
    // otros dos —«todavía no acreditó» y «ya estaba cobrado»— son
    // normales y no molestan a nadie.
    if (veredicto.motivo === "sin_pedido") {
      await puerta.avisar({
        asunto: "Stripe: entró el pago de una invitación sin pedido",
        detalle:
          `La sesión ${pago.sesionStripe} cobró una invitación para el pedido ` +
          `${pago.pedidoId}, que NO existe en la base. HAY QUE ATENDERLO A MANO: ` +
          "el cobro entró. El evento completo quedó en `eventos_stripe`.",
      });
    }
    if (veredicto.motivo === "no_cobrable") {
      await puerta.avisar({
        asunto: "Stripe: se pagó una invitación de un pedido cancelado",
        detalle:
          `El pedido ${pago.pedidoId} está en un estado que ya no admite cobro y aun así ` +
          `entró el pago de la sesión ${pago.sesionStripe}. HAY QUE ATENDERLO A MANO: ` +
          "hay que devolverle la plata a esa persona o rehacerle el pedido.",
      });
    }
    return { tipo: "invitacion_sin_efecto", motivo: veredicto.motivo };
  }

  const aRevision = veredicto.estado === "revisar";
  const estado = aRevision ? ("en_revision" as const) : ("pagado" as const);

  const reclamado = await puerta.cobrarPedidoInvitacion({
    pedidoId: pago.pedidoId,
    estado,
    sesionStripe: pago.sesionStripe,
  });

  // Todo lo que AVISA va detrás del reclamo: si el pedido lo movió otro
  // evento de este mismo cobro, no hay nada nuevo que contar y repetirlo
  // sería mandarle dos veces «recibimos tu pago» a la misma persona.
  if (reclamado) {
    if (aRevision) {
      await puerta.avisar({
        asunto: "Stripe: se cobró una invitación por un monto que no cuadra",
        detalle:
          `El pedido ${pago.pedidoId} se pagó con la sesión ${pago.sesionStripe} y ` +
          `${veredicto.detalle}. Quedó en «en revisión» —NO en «pagado»— para que ` +
          "alguien lo mire antes de mandarlo a diseño. La plata entró igual.",
      });
    }
    await puerta.avisarInvitacionPagada({
      pedidoId: pago.pedidoId,
      conRevision: aRevision,
    });
  }

  return { tipo: "invitacion_cobrada", pedido: pago.pedidoId, estado };
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
  extra: { ranchoId?: string | null; cuentaId?: string | null; solicitudId?: string | null },
  opciones: OpcionesDeAviso = {},
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
  return guardarYActivar(datos, puerta, opciones);
}

/** Qué correos de más corresponde mandar, según de qué evento venimos. */
type OpcionesDeAviso = {
  /** Solo `invoice.payment_failed`: avisale al dueño que rebotó. */
  avisarMora?: boolean;
};

async function guardarYActivar(
  datos: DatosSuscripcion,
  puerta: Puerta,
  opciones: OpcionesDeAviso = {},
): Promise<ResultadoEvento> {
  const alta = await resolverAlta(datos, puerta);
  if ("corte" in alta) return alta.corte;
  const { datos: d, creado } = alta;

  const dueno = await puerta.guardarSuscripcion(d);

  if (!dueno) {
    await puerta.avisar({
      asunto: "Stripe: hay un cobro sin negocio al que atribuirlo",
      detalle:
        `La suscripción ${d.suscripcionStripe} (cliente ${d.clienteStripe}) no dice ` +
        "de qué negocio es: ni `client_reference_id` ni metadata. Hay que atarla a mano.",
    });
    return { tipo: "sin_dueno", suscripcion: d.suscripcionStripe };
  }

  // ── El paquete ─────────────────────────────────────────────────────
  // Primero el plan y después el interruptor: si las dos cosas pasan en
  // el mismo evento (una renovación que además reanuda), el correo de
  // «tu programa volvió» sale con el paquete ya escrito.
  const activar = daDerechoAlPlan(d.estado);
  if (d.plan && activar) {
    await puerta.aplicarPlan({
      ranchoId: dueno.ranchoId,
      cuentaId: dueno.cuentaId,
      plan: d.plan,
    });
  }

  // ── El interruptor ─────────────────────────────────────────────────
  // Va ANTES del corte por precio sin mapear a propósito: apagar (o
  // volver a prender) no necesita saber qué paquete se cobraba. Una
  // suscripción cancelada apaga el programa aunque su price_id nos sea
  // desconocido — que es justo cuando más falta hace que apague.
  const efecto = await aplicarVeredicto(d, dueno, puerta, opciones);

  // ── El price_id que no conocemos ───────────────────────────────────
  // Queda GUARDADO (arriba) pero no activa nada. Pasa cuando el dueño
  // crea un precio nuevo en Stripe y todavía no puso su variable, o
  // cuando el servidor corre con las llaves de prueba y el cobro entró
  // por las de producción.
  if (!d.plan) {
    await puerta.avisar({
      asunto: "Stripe: cobro con un precio que Bookea no reconoce",
      detalle:
        `La suscripción ${d.suscripcionStripe} se cobra con el precio ` +
        `${d.precioStripe ?? "(sin precio)"}, que no está en ninguna variable ` +
        "STRIPE_PRICE_<PLAN>_<MENSUAL|ANUAL>. Quedó registrada SIN activar el plan.",
    });
    return {
      tipo: "sin_mapeo",
      suscripcion: d.suscripcionStripe,
      precio: d.precioStripe,
    };
  }

  return {
    tipo: "guardado",
    suscripcion: d.suscripcionStripe,
    plan: d.plan,
    estado: d.estado,
    activado: activar,
    // Solo cuando el negocio nació con este evento. Ausente en el caso
    // normal para que el resultado siga siendo el de siempre.
    ...(creado ? { creado: true as const } : {}),
    // Ídem: ausente cuando el interruptor no movió nada, que es lo que
    // pasa en la enorme mayoría de los eventos.
    ...(efecto.hizo === "nada" ? {} : { corte: efecto }),
  };
}

/**
 * EL INTERRUPTOR: apagar, prender, o avisar.
 *
 * `corte.ts` decide QUÉ corresponde; esto lo ejecuta. La separación es
 * la misma de siempre —el criterio se prueba solo, la plomería queda
 * afuera— y acá se ve entero en veinte renglones qué le puede pasar a
 * un negocio por un evento de cobro.
 *
 * Lo único que NUNCA pasa: borrar algo. La pausa es reversible por
 * construcción.
 */
async function aplicarVeredicto(
  d: DatosSuscripcion,
  dueno: Dueno,
  puerta: Puerta,
  opciones: OpcionesDeAviso,
): Promise<EfectoDelCorte> {
  // La cobertura solo se consulta cuando el corte está sobre la mesa:
  // es una consulta más contra la base y en una renovación al día no
  // aporta nada.
  const sigueCubierto = motivoDeCorte(d.statusStripe)
    ? await puerta.sigueCubierto({ ...dueno, exceptoSuscripcion: d.suscripcionStripe })
    : false;

  const veredicto = decidirPorCobro({
    statusStripe: d.statusStripe,
    cancelaAlFinal: d.cancelaAlFinal,
    sigueCubierto,
  });

  switch (veredicto.estado) {
    case "opera": {
      // LA VUELTA. Se intenta siempre, no solo cuando sabemos que hubo
      // corte: la única forma de saberlo es preguntándole a la base, y
      // preguntar cuesta lo mismo que reactivar cero filas.
      const vuelta = await puerta.reanudarPrograma({
        ...dueno,
        suscripcionStripe: d.suscripcionStripe,
      });
      if (vuelta.reanudados > 0) {
        await puerta.avisarAlDueno({
          ...dueno,
          clase: "programa_reanudado",
          plan: d.plan,
          hasta: d.periodoFin,
        });
        return { hizo: "reanudado", programas: vuelta.reanudados };
      }

      // EL AVISO PREVIO. `cancel_at_period_end` es lo más cerca que
      // Stripe deja estar del «faltan unos días»: se sabe la fecha
      // exacta del corte, normalmente con semanas de anticipación.
      if (veredicto.avisoPrevio && (await puerta.reclamarAvisoPrevio(d))) {
        await puerta.avisarAlDueno({
          ...dueno,
          clase: "corte_programado",
          plan: d.plan,
          hasta: d.periodoFin,
        });
        return { hizo: "aviso_previo" };
      }
      return { hizo: "nada" };
    }

    case "en_mora": {
      // NO SE APAGA NADA, y esto es deliberado: ver el punto 2 del
      // encabezado de corte.ts. Stripe reintenta durante semanas.
      if (opciones.avisarMora) {
        await puerta.avisarAlDueno({
          ...dueno,
          clase: "cobro_fallido",
          plan: d.plan,
          hasta: d.periodoFin,
        });
        return { hizo: "aviso_mora" };
      }
      return { hizo: "nada" };
    }

    case "corta": {
      const pausa = await puerta.pausarPrograma({
        ...dueno,
        suscripcionStripe: d.suscripcionStripe,
        plan: d.plan,
      });
      if (!pausa.aplicado) {
        // No se pudo dejar constancia de que la pausa la puso el cobro,
        // así que no se pausó nada — una pausa que no se sabe deshacer
        // deja al negocio apagado para siempre. Alguien lo tiene que
        // ver: es la migración 0146 sin correr.
        await puerta.avisar({
          asunto: "Stripe: no se pudo apagar un programa vencido",
          detalle:
            `La suscripción ${d.suscripcionStripe} terminó (${veredicto.motivo}) y el programa ` +
            `del negocio ${dueno.ranchoId ?? dueno.cuentaId ?? "—"} NO se pausó: falta correr ` +
            "la migración 0146 (`programa_lealtad.pausado_por_cobro`). Sin esa columna, " +
            "reanudar al renovar reactivaría también lo que el dueño pausó a mano, así que " +
            "se prefiere no apagar. Corré la 0146 y reenviá el evento desde el panel de Stripe.",
        });
        return { hizo: "no_se_pudo" };
      }
      await puerta.avisarAlDueno({
        ...dueno,
        clase: "programa_pausado",
        plan: d.plan,
        hasta: d.periodoFin,
      });
      return { hizo: "pausado", programas: pausa.pausados };
    }

    case "protegido": {
      // El negocio sigue pago por otro lado (SINPE, o la suscripción
      // nueva de un cambio de paquete). No se apaga nada, y tampoco se
      // le manda ningún correo: para él no cambió nada. El aviso es
      // interno, para que quede el rastro.
      await puerta.avisar({
        asunto: "Stripe: una suscripción terminó y el negocio sigue cubierto",
        detalle:
          `La suscripción ${d.suscripcionStripe} terminó (${veredicto.motivo}) y NO se apagó ` +
          `nada: el negocio ${dueno.ranchoId ?? dueno.cuentaId ?? "—"} sigue pago por otra vía ` +
          "—un depósito por SINPE o transferencia vigente, u otra suscripción de Stripe " +
          "activa (el que cambió de paquete).",
      });
      return { hizo: "protegido", motivo: veredicto.motivo };
    }
  }
}

/** Una línea para el correo interno: qué terminó pasando. */
function describirCorte(corte: EfectoDelCorte): string {
  switch (corte.hizo) {
    case "pausado":
      return `Se pausaron ${corte.programas} programa(s).`;
    case "reanudado":
      return `Se reanudaron ${corte.programas} programa(s).`;
    case "protegido":
      return "NO se apagó: el negocio paga por fuera de Stripe.";
    case "no_se_pudo":
      return "NO se pudo apagar (falta la migración 0146).";
    default:
      return "No hubo nada que apagar.";
  }
}

/**
 * EL ALTA: el cobro entró y el negocio todavía no existe.
 *
 * Devuelve los mismos datos con el negocio ya puesto, o un `corte` con
 * el resultado final cuando no corresponde crear nada. Es la única
 * parte del motor que ESCRIBE algo fuera de `suscripciones`, y por eso
 * está separada: se lee de un vistazo qué tiene que pasar para que un
 * negocio nazca de un cobro.
 */
async function resolverAlta(
  datos: DatosSuscripcion,
  puerta: Puerta,
): Promise<{ datos: DatosSuscripcion; creado: boolean } | { corte: ResultadoEvento }> {
  // Con negocio (o con cuenta) no hay nada que crear: es el camino
  // normal, el del panel.
  if (datos.ranchoId || datos.cuentaId || !datos.solicitudId) {
    return { datos, creado: false };
  }

  const solicitud = datos.solicitudId;

  // Sin saber QUÉ paquete se pagó no se puede crear el negocio: nacería
  // sin plan, o sea sin topes. Se avisa y la solicitud sigue en la cola.
  if (!datos.plan) {
    await puerta.avisar({
      asunto: "Stripe: alta pagada con un precio que Bookea no reconoce",
      detalle:
        `El cobro de la suscripción ${datos.suscripcionStripe} corresponde a la solicitud ` +
        `${solicitud}, pero el precio ${datos.precioStripe ?? "(sin precio)"} no está en ` +
        "ninguna variable STRIPE_PRICE_<PLAN>_<MENSUAL|ANUAL>. El negocio NO se creó: " +
        "poné la variable y volvé a mandar el evento desde el panel de Stripe.",
    });
    return { corte: { tipo: "alta_sin_resolver", solicitud, motivo: "sin_plan" } };
  }

  // Y solo si el cobro DA DERECHO. Una suscripción `incomplete` —la
  // tarjeta que quedó a medias en el 3-D Secure— no crea ningún
  // negocio: si después se completa, Stripe manda otro evento y ahí sí.
  if (!daDerechoAlPlan(datos.estado)) {
    await puerta.avisar({
      asunto: "Stripe: un alta pagó pero la suscripción no quedó al día",
      detalle:
        `La solicitud ${solicitud} pagó la suscripción ${datos.suscripcionStripe}, que quedó ` +
        `en estado «${datos.estado}». El negocio NO se creó y la solicitud sigue pendiente ` +
        "en /admin/complementos.",
    });
    return { corte: { tipo: "alta_sin_resolver", solicitud, motivo: "no_da_derecho" } };
  }

  const nuevo = await puerta.crearNegocioDeSolicitud({ solicitudId: solicitud, plan: datos.plan });
  if (!nuevo) {
    await puerta.avisar({
      asunto: "Stripe: se cobró un alta y el negocio no se pudo crear",
      detalle:
        `La solicitud ${solicitud} pagó la suscripción ${datos.suscripcionStripe} (cliente ` +
        `${datos.clienteStripe}) y el negocio NO se creó. HAY QUE ATENDERLO A MANO: el cobro ` +
        "entró. El evento completo quedó guardado en `eventos_stripe`.",
    });
    return { corte: { tipo: "alta_sin_resolver", solicitud, motivo: "no_se_pudo" } };
  }

  return {
    datos: { ...datos, ranchoId: nuevo.ranchoId, cuentaId: nuevo.cuentaId ?? datos.cuentaId },
    creado: true,
  };
}
