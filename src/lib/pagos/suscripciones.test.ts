import { describe, expect, it } from "vitest";
import type { Entorno } from "./precios";
import {
  datosDeSuscripcion,
  idDeReferencia,
  idDeSuscripcionDeFactura,
  procesarEventoStripe,
  type DatosSuscripcion,
  type EventoEntrante,
  type Puerta,
} from "./suscripciones";

/**
 * Cada caso de acá es algo que, sin este motor, terminaría en un cobro
 * mal aplicado: el mismo evento activando dos veces, un precio ajeno
 * dando un paquete al azar, una cancelación dejando a un negocio sin
 * cupo en medio de un mostrador lleno.
 */

const ENTORNO: Entorno = {
  STRIPE_PRICE_IMPULSO_MENSUAL: "price_impulso_mes",
  STRIPE_PRICE_ARRANQUE_ANUAL: "price_arranque_anio",
};

const RANCHO = "11111111-1111-1111-1111-111111111111";
const CUENTA = "22222222-2222-2222-2222-222222222222";
const SOLICITUD = "33333333-3333-3333-3333-333333333333";
const RANCHO_NUEVO = "44444444-4444-4444-4444-444444444444";

/** Una suscripción como la devuelve la API de Stripe. */
function suscripcionStripe(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    current_period_start: 1_770_000_000,
    current_period_end: 1_772_600_000,
    metadata: { rancho_id: RANCHO, cuenta_id: CUENTA },
    items: { data: [{ price: { id: "price_impulso_mes" } }] },
    ...extra,
  };
}

/**
 * Un programa de lealtad como lo ve la base: los cuatro estados
 * guardados de la 0125 más la marca de la 0146.
 */
type ProgramaFalso = {
  id: string;
  /** null = una fila de la 0060: su estado se deriva de `activo`. */
  estado: "borrador" | "activo" | "pausado" | "archivado" | null;
  activo: boolean;
  pausadoPorCobro: boolean;
};

/**
 * ¿Este programa opera? La MISMA regla que `estadoDelPrograma`
 * (reglas.ts), que el `coalesce` del RPC de la 0125 y que el filtro
 * `OPERANDO` de la puerta de verdad. Mirando solo `estado = 'activo'`
 * se dejarían operando justo los programas más viejos —los que tienen
 * `estado` en null— que son los que más miembros tienen.
 */
function opera(p: ProgramaFalso): boolean {
  return p.estado === "activo" || (p.estado === null && p.activo);
}

/**
 * LO QUE NUNCA SE PUEDE PERDER.
 *
 * No es decoración del test: es el contrato. Son los clientes del
 * negocio —sus tarjetas, sus sellos, su historial— y el corte por falta
 * de pago no puede tocarlos ni uno. Se guardan acá para poder afirmar
 * «después del corte esto sigue idéntico» en vez de suponerlo.
 */
const INTOCABLES = {
  miembros: ["mie_1", "mie_2", "mie_3"],
  sellos: 47,
  pases: ["pase_1", "pase_2", "pase_3"],
  movimientos: ["tx_1", "tx_2", "tx_3", "tx_4"],
};

type Registro = {
  eventos: Map<string, boolean>;
  guardadas: DatosSuscripcion[];
  planes: { ranchoId: string | null; cuentaId: string | null; plan: string }[];
  avisos: { asunto: string; detalle: string }[];
  lecturas: string[];
  /** Cada alta que se pidió crear, para poder contar las creaciones. */
  altas: { solicitudId: string; plan: string }[];
  /** Los negocios que la base «tiene» creados, por solicitud. */
  negociosCreados: Map<string, string>;
  /** El estado del módulo de lealtad, que el interruptor mueve. */
  programas: ProgramaFalso[];
  /** Copia viva de lo intocable: si algo la modifica, el test lo ve. */
  base: typeof INTOCABLES;
  /** Los correos que le llegaron al DUEÑO (no al equipo de Bookea). */
  avisosAlDueno: { clase: string; plan: string | null; hasta: string | null }[];
  /** Cuántas veces se pidió el aviso previo (una sola tiene que salir). */
  avisosPreviosReclamados: number;
};

function programasPorDefecto(): ProgramaFalso[] {
  return [
    { id: "p_operando", estado: "activo", activo: true, pausadoPorCobro: false },
    // El de la 0060: sin `estado`, solo el booleano. También opera, y
    // olvidarlo dejaría operando justo a los programas más viejos.
    { id: "p_viejo", estado: null, activo: true, pausadoPorCobro: false },
    // Los que el DUEÑO decidió. El corte no los toca y la vuelta
    // tampoco: esa decisión no la puede pisar un cobro.
    { id: "p_pausado_por_el_dueno", estado: "pausado", activo: false, pausadoPorCobro: false },
    { id: "p_borrador", estado: "borrador", activo: false, pausadoPorCobro: false },
    { id: "p_archivado", estado: "archivado", activo: false, pausadoPorCobro: false },
  ];
}

function puertaFalsa(opciones: {
  enStripe?: Record<string, unknown> | null;
  /** null = la suscripción no tiene dueño por ningún lado. */
  dueno?: { ranchoId: string | null; cuentaId: string | null } | null;
  /** false = el alta no se puede crear (la solicitud no existe, etc.). */
  altaPosible?: boolean;
  /**
   * true = el negocio sigue pago por otra vía (SINPE, u otra
   * suscripción de Stripe activa): no se apaga.
   */
  sigueCubierto?: boolean;
  /** false = falta la migración 0146 y NO se puede pausar. */
  puedeMarcarLaPausa?: boolean;
  registro?: Registro;
}): { puerta: Puerta; registro: Registro } {
  const registro: Registro = opciones.registro ?? {
    eventos: new Map(),
    guardadas: [],
    planes: [],
    avisos: [],
    lecturas: [],
    altas: [],
    negociosCreados: new Map(),
    programas: programasPorDefecto(),
    base: structuredClone(INTOCABLES),
    avisosAlDueno: [],
    avisosPreviosReclamados: 0,
  };

  const dueno =
    opciones.dueno === undefined ? { ranchoId: RANCHO, cuentaId: CUENTA } : opciones.dueno;

  const puerta: Puerta = {
    async registrarEvento({ id }) {
      // El mismo índice único de la 0143, en memoria: el segundo pase
      // del mismo evento ya procesado no vuelve a entrar.
      if (registro.eventos.get(id) === true) return "ya_procesado";
      if (!registro.eventos.has(id)) registro.eventos.set(id, false);
      return "nuevo";
    },
    async marcarProcesado(id) {
      registro.eventos.set(id, true);
    },
    async leerSuscripcion(id) {
      registro.lecturas.push(id);
      return opciones.enStripe === undefined ? suscripcionStripe() : opciones.enStripe;
    },
    async guardarSuscripcion(d) {
      registro.guardadas.push(d);
      // Un alta ya creó su negocio: el dueño de esa suscripción es ESE
      // negocio, no el de las pruebas del camino normal.
      if (d.ranchoId === RANCHO_NUEVO) return { ranchoId: RANCHO_NUEVO, cuentaId: null };
      return dueno;
    },

    async crearNegocioDeSolicitud({ solicitudId, plan }) {
      registro.altas.push({ solicitudId, plan });
      if (opciones.altaPosible === false) return null;
      // IDEMPOTENTE, igual que la implementación de verdad: la segunda
      // llamada devuelve el negocio que creó la primera, no uno nuevo.
      const yaEsta = registro.negociosCreados.get(solicitudId);
      if (yaEsta) return { ranchoId: yaEsta, cuentaId: null };
      registro.negociosCreados.set(solicitudId, RANCHO_NUEVO);
      return { ranchoId: RANCHO_NUEVO, cuentaId: null };
    },
    async aplicarPlan(d) {
      registro.planes.push(d);
    },
    async avisar(a) {
      registro.avisos.push(a);
    },

    // ── Las invitaciones digitales ───────────────────────────────────
    // No las ejercita ninguna prueba de este archivo (el cobro suelto se
    // prueba entero en invitaciones-pagadas.test.ts, que es donde vive
    // su decisión). Van igual porque `Puerta` las exige: una puerta a
    // medias compilaría con `as` y taparía justo el día que el motor
    // empiece a llamarlas.
    async leerPedidoInvitacion() {
      return null;
    },
    async cobrarPedidoInvitacion() {
      return false;
    },
    async avisarInvitacionPagada() {},

    // ── El interruptor ───────────────────────────────────────────────
    async sigueCubierto() {
      return opciones.sigueCubierto === true;
    },

    async pausarPrograma() {
      // Sin la columna de la 0146 no se pausa NADA: una pausa que
      // después no se sabe deshacer deja al negocio apagado para
      // siempre. Es la misma decisión que toma la puerta de verdad.
      if (opciones.puedeMarcarLaPausa === false) return { pausados: 0, aplicado: false };

      let pausados = 0;
      for (const p of registro.programas) {
        // Solo lo que está OPERANDO.
        if (!opera(p)) continue;
        p.estado = "pausado";
        p.activo = false;
        p.pausadoPorCobro = true;
        pausados++;
      }
      return { pausados, aplicado: true };
    },

    async reanudarPrograma() {
      if (opciones.puedeMarcarLaPausa === false) return { reanudados: 0, aplicado: false };

      let reanudados = 0;
      for (const p of registro.programas) {
        if (!p.pausadoPorCobro) continue;
        p.estado = "activo";
        p.activo = true;
        p.pausadoPorCobro = false;
        reanudados++;
      }
      return { reanudados, aplicado: true };
    },

    async reclamarAvisoPrevio() {
      // El update condicional de la puerta de verdad: gana el primero.
      registro.avisosPreviosReclamados++;
      return registro.avisosPreviosReclamados === 1;
    },

    async avisarAlDueno({ clase, plan, hasta }) {
      registro.avisosAlDueno.push({ clase, plan, hasta });
    },
  };

  return { puerta, registro };
}

/** Los programas que están operando ahora mismo, por id. */
function operando(registro: Registro): string[] {
  return registro.programas.filter(opera).map((p) => p.id);
}

function evento(tipo: string, objeto: Record<string, unknown>, id = "evt_1"): EventoEntrante {
  return { id, type: tipo, data: { object: objeto } };
}

const SESION_OK = {
  id: "cs_1",
  mode: "subscription",
  subscription: "sub_1",
  client_reference_id: RANCHO,
  metadata: { cuenta_id: CUENTA, plan: "impulso", periodo: "mensual" },
};

// ── El camino feliz ───────────────────────────────────────────────────

describe("checkout.session.completed · el pago que entra", () => {
  it("guarda la suscripción y le escribe el paquete al negocio", async () => {
    const { puerta, registro } = puertaFalsa({});
    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_OK),
      puerta,
      ENTORNO,
    );

    expect(r).toEqual({
      tipo: "guardado",
      suscripcion: "sub_1",
      plan: "impulso",
      estado: "activa",
      activado: true,
    });
    expect(registro.planes).toEqual([{ ranchoId: RANCHO, cuentaId: CUENTA, plan: "impulso" }]);
    expect(registro.guardadas[0].estado).toBe("activa");
    expect(registro.guardadas[0].periodo).toBe("mensual");
  });

  it("el paquete sale del PRECIO que Stripe cobra, no de la metadata", async () => {
    // La metadata dice «impulso» (viajó por el navegador); el precio
    // que Stripe está cobrando de verdad es el anual de Arranque. Manda
    // el precio.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({
        items: { data: [{ price: { id: "price_arranque_anio" } }] },
      }),
    });
    await procesarEventoStripe(
      evento("checkout.session.completed", SESION_OK),
      puerta,
      ENTORNO,
    );

    expect(registro.planes).toEqual([{ ranchoId: RANCHO, cuentaId: CUENTA, plan: "arranque" }]);
    expect(registro.guardadas[0].periodo).toBe("anual");
  });

  it("relee la suscripción en Stripe en vez de creerle a la sesión", async () => {
    const { puerta, registro } = puertaFalsa({});
    await procesarEventoStripe(evento("checkout.session.completed", SESION_OK), puerta, ENTORNO);
    expect(registro.lecturas).toEqual(["sub_1"]);
  });

  it("una suscripción en prueba (`trialing`) también da el paquete", async () => {
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "trialing" }),
    });
    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_OK),
      puerta,
      ENTORNO,
    );
    expect(r).toMatchObject({ estado: "en_prueba", activado: true });
    expect(registro.planes.length).toBe(1);
  });
});

// ── EL PAGO DE ALGUIEN QUE TODAVÍA NO TIENE NEGOCIO ───────────────────

/**
 * Es el caso de /lealtad/planes: la persona llegó de la landing, no
 * tiene nada en Bookea y paga con tarjeta. Lo único que existe antes
 * del cobro es una solicitud de ALTA sin rancho (0130); el negocio nace
 * acá, con el evento firmado en la mano.
 */
const SESION_ALTA = {
  id: "cs_alta",
  mode: "subscription",
  subscription: "sub_1",
  // Lo que ve el panel de Stripe. NO es un rancho, y por eso viaja
  // también `solicitud_id`: sin eso, el motor lo leería como negocio.
  client_reference_id: SOLICITUD,
  metadata: { solicitud_id: SOLICITUD, plan: "impulso", periodo: "mensual" },
};

/** La suscripción que Stripe devuelve para ese cobro: sin rancho. */
function suscripcionDeAlta(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return suscripcionStripe({ metadata: { solicitud_id: SOLICITUD }, ...extra });
}

describe("un cobro sin negocio: el negocio se crea DESPUÉS del pago", () => {
  it("crea el negocio, guarda la suscripción a su nombre y le activa el paquete", async () => {
    const { puerta, registro } = puertaFalsa({ enStripe: suscripcionDeAlta() });

    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_ALTA),
      puerta,
      ENTORNO,
    );

    expect(r).toEqual({
      tipo: "guardado",
      suscripcion: "sub_1",
      plan: "impulso",
      estado: "activa",
      activado: true,
      creado: true,
    });
    // El negocio nació de la solicitud, con el paquete que el PRECIO
    // dice — no el que decía la metadata del navegador.
    expect(registro.altas).toEqual([{ solicitudId: SOLICITUD, plan: "impulso" }]);
    expect(registro.guardadas[0].ranchoId).toBe(RANCHO_NUEVO);
    expect(registro.guardadas[0].solicitudId).toBe(SOLICITUD);
    expect(registro.planes).toEqual([
      { ranchoId: RANCHO_NUEVO, cuentaId: null, plan: "impulso" },
    ]);
  });

  it("el `client_reference_id` del alta NO se lee como negocio", async () => {
    // Es el id de una SOLICITUD. Tomarlo por un rancho escribiría el
    // paquete en un id que no es de ningún negocio — o en el de otro.
    const { puerta, registro } = puertaFalsa({ enStripe: suscripcionDeAlta() });
    await procesarEventoStripe(
      evento("checkout.session.completed", SESION_ALTA),
      puerta,
      ENTORNO,
    );
    expect(registro.planes.some((p) => p.ranchoId === SOLICITUD)).toBe(false);
  });

  it("dos eventos del mismo cobro crean UN solo negocio", async () => {
    // `checkout.session.completed` y `customer.subscription.created`
    // llegan casi juntos y los dos traen el mismo `solicitud_id`. Son
    // eventos DISTINTOS, así que la idempotencia por evento no los
    // frena: los frena que crear el alta sea idempotente.
    const { puerta, registro } = puertaFalsa({ enStripe: suscripcionDeAlta() });

    await procesarEventoStripe(
      evento("checkout.session.completed", SESION_ALTA, "evt_checkout"),
      puerta,
      ENTORNO,
    );
    await procesarEventoStripe(
      evento("customer.subscription.created", suscripcionDeAlta(), "evt_sub"),
      puerta,
      ENTORNO,
    );

    expect(registro.negociosCreados.size).toBe(1);
    expect(registro.planes.every((p) => p.ranchoId === RANCHO_NUEVO)).toBe(true);
  });

  it("si el cobro NO quedó al día, no se crea ningún negocio", async () => {
    // La tarjeta que se quedó a medias en el 3-D Secure. Si después se
    // completa, Stripe manda otro evento y ahí sí nace.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionDeAlta({ status: "incomplete" }),
    });

    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_ALTA),
      puerta,
      ENTORNO,
    );

    expect(r).toEqual({
      tipo: "alta_sin_resolver",
      solicitud: SOLICITUD,
      motivo: "no_da_derecho",
    });
    expect(registro.altas).toEqual([]);
    expect(registro.guardadas).toEqual([]);
    expect(registro.planes).toEqual([]);
    expect(registro.avisos.length).toBe(1);
  });

  it("un precio que no está mapeado no crea nada, y se avisa", async () => {
    // Sin saber qué paquete se pagó, el negocio nacería sin topes.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionDeAlta({
        items: { data: [{ price: { id: "price_que_nadie_configuro" } }] },
      }),
    });

    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_ALTA),
      puerta,
      ENTORNO,
    );

    expect(r).toEqual({ tipo: "alta_sin_resolver", solicitud: SOLICITUD, motivo: "sin_plan" });
    expect(registro.altas).toEqual([]);
    expect(registro.planes).toEqual([]);
    expect(registro.avisos[0].detalle).toContain("price_que_nadie_configuro");
  });

  it("si el negocio no se pudo crear, se avisa Y NO se activa nada", async () => {
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionDeAlta(),
      altaPosible: false,
    });

    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_ALTA),
      puerta,
      ENTORNO,
    );

    expect(r).toEqual({ tipo: "alta_sin_resolver", solicitud: SOLICITUD, motivo: "no_se_pudo" });
    expect(registro.planes).toEqual([]);
    // El correo tiene que decir que el cobro ENTRÓ: es lo único que
    // convierte esto en una tarea de alguien.
    expect(registro.avisos[0].detalle).toContain("A MANO");
  });

  it("un cobro CON negocio nunca pasa por el alta", async () => {
    const { puerta, registro } = puertaFalsa({});
    await procesarEventoStripe(
      evento("checkout.session.completed", SESION_OK),
      puerta,
      ENTORNO,
    );
    expect(registro.altas).toEqual([]);
  });

  it("la renovación de un alta ya creada no vuelve a crear el negocio", async () => {
    // La suscripción sigue llevando `solicitud_id` en su metadata para
    // siempre, pero ya tiene rancho guardado: el motor no debe tocar
    // nada del alta.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionDeAlta({
        metadata: { solicitud_id: SOLICITUD, rancho_id: RANCHO },
      }),
    });

    await procesarEventoStripe(
      evento(
        "customer.subscription.updated",
        suscripcionDeAlta({ metadata: { solicitud_id: SOLICITUD, rancho_id: RANCHO } }),
        "evt_renovacion",
      ),
      puerta,
      ENTORNO,
    );

    expect(registro.altas).toEqual([]);
    expect(registro.planes).toEqual([{ ranchoId: RANCHO, cuentaId: CUENTA, plan: "impulso" }]);
  });
});

// ── IDEMPOTENCIA ──────────────────────────────────────────────────────

describe("el mismo evento dos veces se procesa UNA", () => {
  it("el segundo pase no guarda ni activa nada", async () => {
    const { puerta, registro } = puertaFalsa({});
    const uno = evento("checkout.session.completed", SESION_OK, "evt_repetido");

    const primero = await procesarEventoStripe(uno, puerta, ENTORNO);
    const segundo = await procesarEventoStripe(uno, puerta, ENTORNO);

    expect(primero.tipo).toBe("guardado");
    expect(segundo).toEqual({ tipo: "repetido" });
    // Lo que importa: UNA sola activación, no dos.
    expect(registro.planes.length).toBe(1);
    expect(registro.guardadas.length).toBe(1);
    expect(registro.lecturas.length).toBe(1);
  });

  it("tres entregas seguidas siguen siendo una sola activación", async () => {
    const { puerta, registro } = puertaFalsa({});
    const uno = evento("customer.subscription.updated", suscripcionStripe(), "evt_x");
    await procesarEventoStripe(uno, puerta, ENTORNO);
    await procesarEventoStripe(uno, puerta, ENTORNO);
    await procesarEventoStripe(uno, puerta, ENTORNO);
    expect(registro.planes.length).toBe(1);
  });

  it("el que quedó A MEDIAS sí se vuelve a intentar", async () => {
    // Si el primer intento se cayó antes de terminar, el evento quedó
    // anotado con `procesado_en` en null y Stripe lo reintenta: ese
    // tiene que entrar, o el cobro se pierde para siempre.
    const registro: Registro = {
      eventos: new Map([["evt_a_medias", false]]),
      guardadas: [],
      planes: [],
      avisos: [],
      lecturas: [],
      altas: [],
      negociosCreados: new Map(),
      programas: programasPorDefecto(),
      base: structuredClone(INTOCABLES),
      avisosAlDueno: [],
      avisosPreviosReclamados: 0,
    };
    const { puerta } = puertaFalsa({ registro });
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe(), "evt_a_medias"),
      puerta,
      ENTORNO,
    );
    expect(r.tipo).toBe("guardado");
    expect(registro.planes.length).toBe(1);
  });

  it("un evento ignorado también queda marcado, para no recorrerlo de nuevo", async () => {
    const { puerta, registro } = puertaFalsa({});
    const otro = evento("payment_intent.succeeded", { id: "pi_1" }, "evt_ignorado");
    expect(await procesarEventoStripe(otro, puerta, ENTORNO)).toEqual({
      tipo: "ignorado",
      evento: "payment_intent.succeeded",
    });
    expect(await procesarEventoStripe(otro, puerta, ENTORNO)).toEqual({ tipo: "repetido" });
    expect(registro.guardadas).toEqual([]);
    expect(registro.planes).toEqual([]);
  });
});

// ── EL PRECIO DESCONOCIDO ─────────────────────────────────────────────

describe("un price_id que Bookea no conoce", () => {
  it("no activa nada, pero la suscripción QUEDA REGISTRADA", async () => {
    // Pasa cuando el dueño crea un precio en Stripe y todavía no puso
    // su variable, o cuando el servidor corre con llaves de prueba y el
    // cobro entró por las de producción. Perder el registro de un cobro
    // real sería mucho peor que no activarlo.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({
        items: { data: [{ price: { id: "price_que_nadie_configuro" } }] },
      }),
    });

    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_OK),
      puerta,
      ENTORNO,
    );

    expect(r).toEqual({
      tipo: "sin_mapeo",
      suscripcion: "sub_1",
      precio: "price_que_nadie_configuro",
    });
    expect(registro.planes).toEqual([]);
    expect(registro.guardadas.length).toBe(1);
    expect(registro.guardadas[0].plan).toBeNull();
    expect(registro.guardadas[0].precioStripe).toBe("price_que_nadie_configuro");
    // Y alguien se tiene que enterar.
    expect(registro.avisos.length).toBe(1);
    expect(registro.avisos[0].detalle).toContain("price_que_nadie_configuro");
  });

  it("una suscripción sin ningún precio tampoco activa", async () => {
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ items: { data: [] } }),
    });
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ items: { data: [] } })),
      puerta,
      ENTORNO,
    );
    expect(r.tipo).toBe("sin_mapeo");
    expect(registro.planes).toEqual([]);
  });
});

// ── LO QUE NO ACTIVA ──────────────────────────────────────────────────

describe("lo que no da derecho al paquete", () => {
  it("una suscripción morosa se guarda pero no activa", async () => {
    const { puerta, registro } = puertaFalsa({});
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ status: "past_due" })),
      puerta,
      ENTORNO,
    );
    expect(r).toMatchObject({ estado: "morosa", activado: false });
    expect(registro.planes).toEqual([]);
    expect(registro.guardadas[0].estado).toBe("morosa");
  });

  it("una cancelación NO le baja el paquete al negocio", async () => {
    // Bajar de `ilimitado` a `prueba` recorta el cupo de 1.150 clientes
    // a 25 en el mismo segundo, y el primero en enterarse sería un
    // cliente parado en el mostrador. Se guarda el estado y se avisa;
    // la baja la decide una persona.
    const { puerta, registro } = puertaFalsa({});
    const r = await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({ estado: "cancelada", activado: false });
    expect(registro.planes).toEqual([]);
    expect(registro.guardadas[0].estado).toBe("cancelada");
    expect(registro.avisos[0].detalle).toContain("NO se bajó");
  });

  it("`deleted` fuerza el estado aunque el objeto diga otra cosa", async () => {
    const { puerta, registro } = puertaFalsa({});
    await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "active" })),
      puerta,
      ENTORNO,
    );
    expect(registro.guardadas[0].estado).toBe("cancelada");
    expect(registro.planes).toEqual([]);
  });

  it("un pago suelto (no suscripción) se ignora entero", async () => {
    const { puerta, registro } = puertaFalsa({});
    const r = await procesarEventoStripe(
      evento("checkout.session.completed", { id: "cs_2", mode: "payment" }),
      puerta,
      ENTORNO,
    );
    expect(r).toEqual({ tipo: "ignorado", evento: "checkout.session.completed" });
    expect(registro.guardadas).toEqual([]);
    expect(registro.lecturas).toEqual([]);
  });
});

describe("un cobro que no se puede atribuir a ningún negocio", () => {
  it("no se guarda a ciegas: se avisa para atarlo a mano", async () => {
    const { puerta, registro } = puertaFalsa({ dueno: null });
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ metadata: {} })),
      puerta,
      ENTORNO,
    );
    expect(r).toEqual({ tipo: "sin_dueno", suscripcion: "sub_1" });
    expect(registro.planes).toEqual([]);
    expect(registro.avisos.length).toBe(1);
  });

  it("si Stripe no devuelve la suscripción, no se inventa nada", async () => {
    const { puerta, registro } = puertaFalsa({ enStripe: null });
    const r = await procesarEventoStripe(
      evento("checkout.session.completed", SESION_OK),
      puerta,
      ENTORNO,
    );
    expect(r).toEqual({ tipo: "sin_suscripcion", evento: "checkout.session.completed" });
    expect(registro.guardadas).toEqual([]);
    expect(registro.planes).toEqual([]);
    expect(registro.avisos.length).toBe(1);
  });
});

// ── EL COBRO QUE FALLA ────────────────────────────────────────────────

describe("invoice.payment_failed", () => {
  it("deja la suscripción en mora y avisa, sin tocar el paquete", async () => {
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "past_due" }),
    });
    const r = await procesarEventoStripe(
      evento("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }),
      puerta,
      ENTORNO,
    );
    expect(r).toMatchObject({ estado: "morosa", activado: false });
    expect(registro.planes).toEqual([]);
    expect(registro.avisos.some((a) => a.asunto.includes("falló el cobro"))).toBe(true);
  });

  it("encuentra la suscripción aunque Stripe haya movido el campo de lugar", async () => {
    // `invoice.subscription` era el campo de siempre; las versiones
    // nuevas de la API lo pasaron a `parent.subscription_details`. Las
    // dos formas circulan y hay que aceptar las dos, o la mitad de las
    // moras no se registran.
    expect(idDeSuscripcionDeFactura({ subscription: "sub_viejo" })).toBe("sub_viejo");
    expect(
      idDeSuscripcionDeFactura({
        parent: { subscription_details: { subscription: "sub_nuevo" } },
      }),
    ).toBe("sub_nuevo");
    expect(
      idDeSuscripcionDeFactura({
        lines: { data: [{ parent: { subscription_item_details: { subscription: "sub_linea" } } }] },
      }),
    ).toBe("sub_linea");
    expect(idDeSuscripcionDeFactura({ id: "in_x" })).toBeNull();
  });

  it("una factura que no dice de qué suscripción es, se avisa y no toca nada", async () => {
    const { puerta, registro } = puertaFalsa({});
    const r = await procesarEventoStripe(
      evento("invoice.payment_failed", { id: "in_2" }),
      puerta,
      ENTORNO,
    );
    expect(r).toEqual({ tipo: "sin_suscripcion", evento: "invoice.payment_failed" });
    expect(registro.guardadas).toEqual([]);
    expect(registro.avisos.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// EL INTERRUPTOR: se apaga al terminar el mes, y vuelve al renovar
// ══════════════════════════════════════════════════════════════════════

/** La suscripción cancelada el día 3, con el período pago hasta el 30. */
const HASTA_EL_30 = Math.floor(Date.UTC(2026, 7, 30, 12, 0, 0) / 1000);

function canceladaElDia3(): Record<string, unknown> {
  return suscripcionStripe({
    // Stripe NO la pone en `canceled` al cancelar: la deja activa con
    // la bandera. Ese es todo el mecanismo del «hasta el 30».
    status: "active",
    cancel_at_period_end: true,
    current_period_end: HASTA_EL_30,
  });
}

describe("cancelar el día 3 con el mes pagado hasta el 30", () => {
  it("NO apaga nada: el negocio opera hasta que termine lo que pagó", async () => {
    const { puerta, registro } = puertaFalsa({ enStripe: canceladaElDia3() });

    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", canceladaElDia3(), "evt_cancela"),
      puerta,
      ENTORNO,
    );

    // Sigue operando, con su paquete escrito como cualquier mes.
    expect(r).toMatchObject({ estado: "activa", activado: true });
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
    expect(registro.planes).toEqual([{ ranchoId: RANCHO, cuentaId: CUENTA, plan: "impulso" }]);
  });

  it("le avisa al dueño la FECHA exacta en que se apaga", async () => {
    const { puerta, registro } = puertaFalsa({ enStripe: canceladaElDia3() });
    await procesarEventoStripe(
      evento("customer.subscription.updated", canceladaElDia3(), "evt_cancela"),
      puerta,
      ENTORNO,
    );

    expect(registro.avisosAlDueno).toEqual([
      {
        clase: "corte_programado",
        plan: "impulso",
        hasta: new Date(HASTA_EL_30 * 1000).toISOString(),
      },
    ]);
  });

  it("ese aviso sale UNA sola vez, aunque Stripe mande varios eventos", async () => {
    // La idempotencia por `stripe_event_id` no lo frena: Stripe manda
    // varios `updated` distintos con la bandera puesta.
    const { puerta, registro } = puertaFalsa({ enStripe: canceladaElDia3() });
    await procesarEventoStripe(
      evento("customer.subscription.updated", canceladaElDia3(), "evt_a"),
      puerta,
      ENTORNO,
    );
    await procesarEventoStripe(
      evento("customer.subscription.updated", canceladaElDia3(), "evt_b"),
      puerta,
      ENTORNO,
    );

    expect(registro.avisosAlDueno.length).toBe(1);
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
  });
});

describe("al corte: se PAUSA, y no se borra nada", () => {
  it("pausa lo que estaba operando y le avisa al dueño", async () => {
    const { puerta, registro } = puertaFalsa({});

    const r = await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({
      estado: "cancelada",
      activado: false,
      corte: { hizo: "pausado", programas: 2 },
    });
    expect(operando(registro)).toEqual([]);
    expect(registro.avisosAlDueno.map((a) => a.clase)).toEqual(["programa_pausado"]);
  });

  it("NO borra miembros, sellos, pases ni movimientos", async () => {
    // Son los clientes del negocio, no nuestros. Y el dueño puede
    // renovar mañana: lo que se borre hoy no vuelve nunca.
    const { puerta, registro } = puertaFalsa({});
    await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    expect(registro.base).toEqual(INTOCABLES);
  });

  it("el paquete NO se baja: el cupo queda intacto para cuando vuelva", async () => {
    const { puerta, registro } = puertaFalsa({});
    await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );
    expect(registro.planes).toEqual([]);
  });

  it("no toca lo que el DUEÑO pausó, archivó o dejó en borrador", async () => {
    const { puerta, registro } = puertaFalsa({});
    await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    const suyo = registro.programas.find((p) => p.id === "p_pausado_por_el_dueno");
    expect(suyo).toMatchObject({ estado: "pausado", pausadoPorCobro: false });
    expect(registro.programas.find((p) => p.id === "p_borrador")?.estado).toBe("borrador");
    expect(registro.programas.find((p) => p.id === "p_archivado")?.estado).toBe("archivado");
  });

  it("`unpaid` también apaga: Stripe agotó los reintentos", async () => {
    // No es el primer rebote —eso es `past_due` y no apaga nada—: es
    // semanas después, con el período pagado terminado hace rato. Si
    // esto no cortara, el que dejó de pagar operaría gratis para
    // siempre, porque Stripe no manda ningún evento más.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "unpaid" }),
    });
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ status: "unpaid" })),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({ corte: { hizo: "pausado", programas: 2 } });
    expect(operando(registro)).toEqual([]);
    expect(registro.base).toEqual(INTOCABLES);
  });

  it("sin la migración 0146 NO se apaga nada, y el equipo se entera", async () => {
    // Pausar sin poder marcar QUIÉN pausó deja al negocio apagado sin
    // vuelta posible: la reanudación levantaría también lo que el dueño
    // pausó a mano. Se prefiere un mes de más operando.
    const { puerta, registro } = puertaFalsa({ puedeMarcarLaPausa: false });
    const r = await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({ corte: { hizo: "no_se_pudo" } });
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
    // Al dueño no se le miente diciéndole que quedó en pausa.
    expect(registro.avisosAlDueno).toEqual([]);
    expect(registro.avisos.some((a) => a.detalle.includes("0146"))).toBe(true);
  });
});

describe("renovar: vuelve a operar con su paquete", () => {
  it("la vuelta es exacta — y solo levanta lo que el corte apagó", async () => {
    // La simetría es la mitad del diseño: si esto no funcionara,
    // cancelar sería una trampa.
    const registro: Registro = {
      eventos: new Map(),
      guardadas: [],
      planes: [],
      avisos: [],
      lecturas: [],
      altas: [],
      negociosCreados: new Map(),
      programas: programasPorDefecto(),
      base: structuredClone(INTOCABLES),
      avisosAlDueno: [],
      avisosPreviosReclamados: 0,
    };

    // 1. El corte.
    const corte = puertaFalsa({ registro });
    await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" }), "evt_fin"),
      corte.puerta,
      ENTORNO,
    );
    expect(operando(registro)).toEqual([]);

    // 2. Renuevan: paga otra vez y Stripe la vuelve a poner activa.
    const vuelta = puertaFalsa({ registro });
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe(), "evt_renueva"),
      vuelta.puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({
      estado: "activa",
      activado: true,
      corte: { hizo: "reanudado", programas: 2 },
    });
    // Vuelve TODO lo que operaba, incluido el programa viejo sin estado.
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
    // Y con su paquete.
    expect(registro.planes).toEqual([{ ranchoId: RANCHO, cuentaId: CUENTA, plan: "impulso" }]);
    // Lo que el dueño pausó a mano NO resucita por haber pagado.
    expect(registro.programas.find((p) => p.id === "p_pausado_por_el_dueno")?.estado).toBe(
      "pausado",
    );
    expect(registro.base).toEqual(INTOCABLES);
    expect(registro.avisosAlDueno.map((a) => a.clase)).toEqual([
      "programa_pausado",
      "programa_reanudado",
    ]);
  });

  it("una renovación normal (sin corte previo) no manda ningún correo", async () => {
    const { puerta, registro } = puertaFalsa({});
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe(), "evt_mes"),
      puerta,
      ENTORNO,
    );
    expect(r).not.toHaveProperty("corte");
    expect(registro.avisosAlDueno).toEqual([]);
  });
});

describe("el pago que rebota NO es una cancelación", () => {
  it("`invoice.payment_failed` avisa al dueño y NO apaga nada", async () => {
    // Una tarjeta vencida es un accidente. Stripe reintenta durante
    // días; apagar en el primer rebote es la forma más rápida de
    // perder un cliente que sí quería pagar.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "past_due" }),
    });

    const r = await procesarEventoStripe(
      evento("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({ estado: "morosa", corte: { hizo: "aviso_mora" } });
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
    expect(registro.avisosAlDueno.map((a) => a.clase)).toEqual(["cobro_fallido"]);
    expect(registro.base).toEqual(INTOCABLES);
  });

  it("el `updated` a past_due que llega junto NO duplica el correo", async () => {
    // Stripe manda los dos eventos por el mismo hecho. El aviso sale
    // solo del que significa «acaba de rebotar un cobro».
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "past_due" }),
    });
    await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ status: "past_due" })),
      puerta,
      ENTORNO,
    );
    expect(registro.avisosAlDueno).toEqual([]);
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
  });

  it("una suscripción que quedó `incomplete` tampoco apaga", async () => {
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "incomplete" }),
    });
    await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ status: "incomplete" })),
      puerta,
      ENTORNO,
    );
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
  });
});

describe("el negocio que paga por SINPE no se apaga JAMÁS", () => {
  it("una cancelación de Stripe no toca un negocio que paga por depósito", async () => {
    // Es lo único que cobra dinero de verdad hoy, y esa gente no tiene
    // —ni va a tener— suscripción de Stripe: muchas tarjetas
    // costarricenses vienen bloqueadas para compras internacionales.
    // El caso real es el MIXTO: probó con tarjeta, la canceló, y hoy
    // paga por SINPE.
    const { puerta, registro } = puertaFalsa({ sigueCubierto: true });

    const r = await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({ corte: { hizo: "protegido", motivo: "cancelada" } });
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
    // Y NO se le manda ningún correo de corte: para él no pasó nada.
    expect(registro.avisosAlDueno).toEqual([]);
    // El rastro queda internamente, para el equipo.
    expect(registro.avisos.some((a) => a.detalle.includes("SINPE"))).toBe(true);
    expect(registro.base).toEqual(INTOCABLES);
  });

  it("tampoco lo apaga un `unpaid`", async () => {
    const { puerta, registro } = puertaFalsa({
      sigueCubierto: true,
      enStripe: suscripcionStripe({ status: "unpaid" }),
    });
    const r = await procesarEventoStripe(
      evento("customer.subscription.updated", suscripcionStripe({ status: "unpaid" })),
      puerta,
      ENTORNO,
    );
    expect(r).toMatchObject({ corte: { hizo: "protegido", motivo: "incobrable" } });
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
  });
});

describe("lo que nunca activó nada no puede apagar nada", () => {
  it("un Checkout ABANDONADO no apaga al negocio que ya estaba pago", async () => {
    // El caso: un negocio al día abre Checkout para SUBIR de paquete y
    // se arrepiente. Stripe crea una suscripción `incomplete` y a las
    // 23 horas la archiva como `incomplete_expired`. Esa suscripción
    // nunca le dio el paquete a nadie — tratarla como un final apagaría
    // a un negocio que está pagando.
    const { puerta, registro } = puertaFalsa({
      enStripe: suscripcionStripe({ status: "incomplete_expired" }),
    });

    const r = await procesarEventoStripe(
      evento(
        "customer.subscription.updated",
        suscripcionStripe({ status: "incomplete_expired" }),
      ),
      puerta,
      ENTORNO,
    );

    expect(r).not.toHaveProperty("corte");
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
    expect(registro.avisosAlDueno).toEqual([]);
  });

  it("el que CAMBIÓ de paquete no se apaga cuando muere la suscripción vieja", async () => {
    // Subir de plan deja la vieja cancelada y una nueva activa, y los
    // eventos de Stripe pueden llegar desordenados: el `deleted` de la
    // vieja puede aterrizar después de que la nueva ya activó todo.
    const { puerta, registro } = puertaFalsa({ sigueCubierto: true });

    const r = await procesarEventoStripe(
      evento("customer.subscription.deleted", suscripcionStripe({ status: "canceled" })),
      puerta,
      ENTORNO,
    );

    expect(r).toMatchObject({ corte: { hizo: "protegido", motivo: "cancelada" } });
    expect(operando(registro)).toEqual(["p_operando", "p_viejo"]);
  });
});

// ── La lectura del objeto de Stripe ───────────────────────────────────

describe("datosDeSuscripcion", () => {
  it("acepta las referencias expandidas y sin expandir", () => {
    expect(idDeReferencia("cus_1")).toBe("cus_1");
    expect(idDeReferencia({ id: "cus_1", object: "customer" })).toBe("cus_1");
    expect(idDeReferencia(null)).toBeNull();
    expect(idDeReferencia(42)).toBeNull();
  });

  it("lee el período aunque cuelgue del ítem y no de la suscripción", () => {
    // Otro campo que Stripe movió de lugar. Mirando solo el viejo, «tu
    // plan está pago hasta el …» saldría vacío para siempre.
    const d = datosDeSuscripcion(
      {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        items: {
          data: [
            {
              price: { id: "price_impulso_mes" },
              current_period_start: 1_770_000_000,
              current_period_end: 1_772_600_000,
            },
          ],
        },
      },
      {},
      ENTORNO,
    );
    expect(d?.periodoInicio).toBe(new Date(1_770_000_000_000).toISOString());
    expect(d?.periodoFin).toBe(new Date(1_772_600_000_000).toISOString());
  });

  it("sin id o sin cliente no hay nada que guardar", () => {
    expect(datosDeSuscripcion({ customer: "cus_1" }, {}, ENTORNO)).toBeNull();
    expect(datosDeSuscripcion({ id: "sub_1" }, {}, ENTORNO)).toBeNull();
  });

  it("la cancelación programada se distingue de la cancelación", () => {
    const d = datosDeSuscripcion(
      suscripcionStripe({ cancel_at_period_end: true }),
      {},
      ENTORNO,
    );
    // Sigue activa: el negocio TIENE lo que pagó hasta que termine.
    expect(d?.estado).toBe("activa");
    expect(d?.cancelaAlFinal).toBe(true);
  });

  it("lo que se le pasa por fuera gana sobre la metadata", () => {
    // El `client_reference_id` de la sesión lo puso el servidor después
    // de comprobar que quien paga es dueño del negocio.
    const d = datosDeSuscripcion(
      suscripcionStripe(),
      { ranchoId: "otro-rancho", cuentaId: null },
      ENTORNO,
    );
    expect(d?.ranchoId).toBe("otro-rancho");
    // Sin valor por fuera, cae a la metadata que nosotros escribimos.
    expect(d?.cuentaId).toBe(CUENTA);
  });
});
