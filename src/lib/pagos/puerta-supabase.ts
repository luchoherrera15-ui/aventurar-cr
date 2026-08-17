import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import {
  plantillaCobroFallido,
  plantillaCorteProgramado,
  plantillaProgramaPausado,
  plantillaProgramaReanudado,
} from "@/lib/correo/suscripcion";
import { enviarCorreo } from "@/lib/email";
import { fechaISOCR, fechaLargaCR } from "@/lib/fechas";
import { notificarPedidoPagado } from "@/lib/invitaciones/pedido";
import { crearNegocioDesdeSolicitud } from "@/lib/lealtad/alta-desde-solicitud";
import { PLANES, type PlanId } from "@/lib/lealtad/planes";
import { stripeDelEntorno } from "./stripe";
import type { ClaseDeAviso, DatosSuscripcion, Dueno, Puerta } from "./suscripciones";

/**
 * La «puerta» del motor del webhook, implementada contra Supabase y
 * Stripe de verdad.
 *
 * Vive separada de `suscripciones.ts` por la misma razón por la que el
 * motor del canje vive separado del mostrador: la decisión —qué se
 * activa y cuándo— se prueba sola, y acá queda solamente la plomería.
 *
 * TODO se escribe con la LLAVE DE SERVICIO. No es comodidad: es la
 * regla. La RLS de la 0143 no le da a `authenticated` ni un insert
 * sobre `suscripciones`, y `eventos_stripe` no tiene ninguna política.
 * Este archivo es el único escritor de las dos tablas.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Códigos de Postgres/PostgREST que significan «esa tabla no existe». */
function faltaLaTabla(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message ?? "")
  );
}

/**
 * «Esa COLUMNA no existe» — o sea, falta correr la 0146.
 *
 * Se distingue de `faltaLaTabla` porque la consecuencia es otra: sin la
 * tabla el webhook no puede ni anotar el evento y corta; sin la columna
 * puede hacer todo menos apagar, y apagar sin poder desapagar es peor
 * que no apagar.
 */
function faltaLaColumna(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(error.message ?? "")
  );
}

/**
 * El filtro de «este programa está OPERANDO ahora mismo», en el
 * lenguaje de PostgREST.
 *
 * Tiene dos ramas porque la 0125 dejó `estado` anulable: las filas
 * viejas (las de la 0060) tienen `estado` en null y su estado se deriva
 * del booleano `activo`. Es la misma regla que `estadoDelPrograma` en
 * reglas.ts y que el `coalesce` del RPC de acumulación — mirando solo
 * `estado = 'activo'` se dejarían operando justamente los programas más
 * antiguos, que son los que más miembros tienen.
 */
const OPERANDO = "estado.eq.activo,and(estado.is.null,activo.eq.true)";

export function puertaSupabase(): Puerta | null {
  const db = createAdminClient();
  const stripe = stripeDelEntorno();
  if (!db || !stripe) return null;

  return {
    // ── La idempotencia ───────────────────────────────────────────────
    // Se INSERTA primero y se pregunta después, no al revés: un
    // «¿existe? entonces no inserto» tiene una ventana entre la
    // pregunta y la respuesta por la que pasan las dos entregas
    // simultáneas del mismo evento. El índice único no tiene ventana.
    async registrarEvento({ id, tipo, payload }) {
      const { error } = await db
        .from("eventos_stripe")
        .insert({ stripe_event_id: id, tipo, payload });

      if (!error) return "nuevo";

      if (faltaLaTabla(error)) {
        // Sin la 0143 pegada no hay dónde anotar, y sin anotar no hay
        // idempotencia. Se corta acá y se lanza: el que llama devuelve
        // 500, Stripe reintenta, y cuando la migración esté puesta el
        // evento entra. Procesar sin red de idempotencia sería peor.
        throw new Error(
          "Falta correr la migración 0143 en Supabase: no existe `eventos_stripe`.",
        );
      }

      // 23505 = choque contra la llave primaria: ya habíamos recibido
      // este evento. Si el anterior terminó, se ignora; si quedó a
      // medias (`procesado_en` en null), se vuelve a intentar — todas
      // las escrituras de abajo son upserts, repetirlas no duplica.
      if (error.code !== "23505") throw new Error(error.message);

      const { data } = await db
        .from("eventos_stripe")
        .select("procesado_en")
        .eq("stripe_event_id", id)
        .maybeSingle();

      return data?.procesado_en ? "ya_procesado" : "nuevo";
    },

    async marcarProcesado(id) {
      await db
        .from("eventos_stripe")
        .update({ procesado_en: new Date().toISOString() })
        .eq("stripe_event_id", id);
    },

    async leerSuscripcion(id) {
      try {
        const sub = await stripe.subscriptions.retrieve(id);
        return sub as unknown as Record<string, unknown>;
      } catch (e) {
        console.error("[stripe] No se pudo leer la suscripción", id, e);
        return null;
      }
    },

    async guardarSuscripcion(datos) {
      return guardarSuscripcionEn(db, datos);
    },

    async crearNegocioDeSolicitud({ solicitudId, plan }) {
      return crearNegocioDeSolicitudEn(db, solicitudId, plan);
    },

    async aplicarPlan({ ranchoId, cuentaId, plan }) {
      await aplicarPlanEn(db, { ranchoId, cuentaId, plan });
    },

    async avisar({ asunto, detalle }) {
      // Al log SIEMPRE, y al correo si se puede. Si un día el correo
      // no sale, el rastro de por qué un cobro no activó nada tiene
      // que existir igual.
      console.warn(`[stripe] ${asunto} — ${detalle}`);
      await avisarAAdministradores({
        subject: `[Stripe] ${asunto}`,
        html: `<p>${escapar(detalle)}</p>
          <p style="margin-top:12px">Se atiende en
            <a href="https://www.bookea.lat/admin/complementos">/admin/complementos</a>
            y en el <a href="https://dashboard.stripe.com">panel de Stripe</a>.</p>`,
      });
    },

    // ── El interruptor ────────────────────────────────────────────────

    async sigueCubierto({ exceptoSuscripcion, ...quien }) {
      return (
        (await pagaPorFueraEn(db, quien)) ||
        (await tieneOtraSuscripcionViva(db, quien, exceptoSuscripcion))
      );
    },

    async pausarPrograma({ suscripcionStripe, plan, ...quien }) {
      const r = await pausarProgramasEn(db, quien);
      if (r.aplicado) await marcarCorte(db, suscripcionStripe, plan);
      return r;
    },

    async reanudarPrograma({ suscripcionStripe, ...quien }) {
      const r = await reanudarProgramasEn(db, quien);
      if (r.reanudados > 0) await marcarCorte(db, suscripcionStripe, null, true);
      return r;
    },

    async reclamarAvisoPrevio({ suscripcionStripe }) {
      return reclamarAvisoPrevioEn(db, suscripcionStripe);
    },

    async avisarAlDueno(aviso) {
      await avisarAlDuenoEn(db, aviso);
    },

    // ── Las invitaciones digitales ────────────────────────────────────

    async leerPedidoInvitacion(id) {
      return leerPedidoInvitacionEn(db, id);
    },

    async cobrarPedidoInvitacion(d) {
      return cobrarPedidoInvitacionEn(db, d);
    },

    async avisarInvitacionPagada({ pedidoId, conRevision }) {
      await avisarInvitacionPagadaEn(db, pedidoId, conRevision);
    },
  };
}

// ── EL COBRO DE UNA INVITACIÓN DIGITAL ───────────────────────────────

/**
 * El pedido, leído con la LLAVE DE SERVICIO.
 *
 * Tiene que ser así: la RLS de la 0075 solo le deja ver el pedido al
 * cliente que lo hizo, y acá no hay ninguna sesión — el que golpea este
 * código es Stripe.
 *
 * Un error de base LANZA en vez de devolver null, y la diferencia es
 * toda la que hay: `null` significa «ese pedido no existe» y hace que el
 * motor avise de un cobro huérfano. Si una caída de Supabase se
 * disfrazara de null, un cobro perfectamente bueno terminaría anotado
 * como huérfano y el pedido quedaría sin cobrar para siempre. Lanzando,
 * el webhook devuelve 500 y Stripe lo reintenta.
 */
async function leerPedidoInvitacionEn(
  db: Admin,
  id: string,
): Promise<{ id: string; montoCrc: number | null; estado: string } | null> {
  const { data, error } = await db
    .from("pedidos_invitacion")
    .select("id, monto_crc, estado")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el pedido ${id}: ${error.message}`);
  if (!data) return null;

  const monto = Number(data.monto_crc);
  return {
    id: String(data.id),
    montoCrc: Number.isFinite(monto) ? monto : null,
    estado: String(data.estado),
  };
}

/**
 * EL RECLAMO: mueve el pedido, y solo si nadie lo movió antes.
 *
 * Todo el peso está en el WHERE, no en el SET:
 *
 *   · `estado in (pendiente_pago, en_revision)` — solo un pedido que
 *     todavía espera plata. Uno ya pagado, en diseño, entregado o
 *     cancelado no se toca.
 *   · `metodo_pago is null or metodo_pago <> 'stripe'` — y que no lo
 *     haya cobrado YA una tarjeta. Sin esta segunda mitad, el pedido que
 *     el propio webhook dejó en `en_revision` (porque el monto no
 *     cuadraba) seguiría siendo reclamable, y el segundo evento del
 *     mismo cobro le mandaría al cliente un segundo «recibimos tu pago».
 *     `metodo_pago = 'stripe'` solo lo escribe este archivo.
 *
 * Es un UPDATE condicional atómico, la misma forma que `reclamarAvisoPrevio`
 * y que la reserva de la solicitud en el alta pagada: la fila es la
 * llave, y solo uno de los eventos simultáneos se la lleva.
 *
 * `pagado_en` se sella igual cuando el pedido va a revisión: es la fecha
 * en que ENTRÓ la plata, que es lo que suma el reporte de Finanzas, y
 * entró lo mismo cuadre o no. Es también lo que hace el camino de SINPE
 * (`registrar_pago_pedido` de la 0087), que sella la fecha al adjuntar
 * el comprobante y no al aprobarlo.
 */
async function cobrarPedidoInvitacionEn(
  db: Admin,
  d: { pedidoId: string; estado: "pagado" | "en_revision"; sesionStripe: string },
): Promise<boolean> {
  const { data, error } = await db
    .from("pedidos_invitacion")
    .update({
      estado: d.estado,
      metodo_pago: "stripe",
      // La sesión de Checkout hace de comprobante: con ella se busca el
      // cobro en el panel de Stripe. No hay captura que adjuntar.
      referencia_pago: d.sesionStripe,
      pagado_en: new Date().toISOString(),
    })
    .eq("id", d.pedidoId)
    .in("estado", ["pendiente_pago", "en_revision"])
    .or("metodo_pago.is.null,metodo_pago.neq.stripe")
    .select("id");

  // Lanza: quien llama devuelve 500 y Stripe reintenta. Tragarse el
  // error dejaría un cobro entrado con el pedido esperando plata.
  if (error) {
    throw new Error(`No se pudo cobrar el pedido ${d.pedidoId}: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Los dos correos del pedido pagado con tarjeta: el «ya lo recibimos» al
 * cliente y el aviso al equipo. Nunca lanza — el cobro ya quedó escrito,
 * y un correo caído no puede tumbar un pago que entró.
 */
async function avisarInvitacionPagadaEn(
  db: Admin,
  pedidoId: string,
  conRevision: boolean,
): Promise<void> {
  try {
    const { data } = await db
      .from("pedidos_invitacion")
      .select("paquete, nombre_evento, fecha_evento, contacto_correo, contacto_nombre")
      .eq("id", pedidoId)
      .maybeSingle();
    if (!data?.contacto_correo) return;

    await notificarPedidoPagado(
      {
        paquete: String(data.paquete),
        nombre_evento: data.nombre_evento as string | null,
        fecha_evento: data.fecha_evento as string | null,
        contacto_correo: String(data.contacto_correo),
        contacto_nombre: data.contacto_nombre as string | null,
      },
      // Con tarjeta el pago ya está confirmado y no hay comprobante que
      // revisar: los correos lo dicen así. Salvo que el monto no haya
      // cuadrado, y entonces sí hay algo que mirar.
      { porTarjeta: true, conRevision },
    );
  } catch (e) {
    console.error("[stripe] No se pudieron mandar los correos de la invitación:", e);
  }
}

// ── ¿PAGA POR FUERA DE STRIPE? ───────────────────────────────────────

/**
 * El negocio que paga por SINPE o transferencia, que NO se apaga nunca
 * por un evento de Stripe.
 *
 * El SINPE con comprobante (0126 + 0128 + 0130) es lo único que cobra
 * dinero de verdad hoy, y esa gente no tiene suscripción de Stripe —
 * muchas tarjetas costarricenses vienen bloqueadas para compras
 * internacionales, y la LLC cobra desde Estados Unidos.
 *
 * En el caso normal ni se rozan: sin suscripción de Stripe no llega
 * ningún evento y no hay nada que apagar. Lo que esto cubre es el caso
 * MIXTO —el que probó con tarjeta, la canceló, y hoy paga por
 * depósito—, donde el evento de Stripe apagaría un programa que está
 * pago al día. Por eso la pregunta es explícita.
 *
 * Se mira `solicitudes_lealtad`, que es donde vive el comprobante:
 * una solicitud ATENDIDA con `metodo_pago` de depósito es, literal, un
 * pago aceptado a mano por un administrador.
 *
 * ANTE LA DUDA, PROTEGE. Si la consulta falla se devuelve `true`: no
 * apagar de más es un error que se arregla con un clic, y apagar de
 * menos un negocio que pagó es una llamada furiosa y un cliente que se
 * va.
 */
async function pagaPorFueraEn(db: Admin, quien: Dueno): Promise<boolean> {
  const ranchoIds = await ranchosDe(db, quien);
  if (ranchoIds.length === 0) return false;

  const { data, error } = await db
    .from("solicitudes_lealtad")
    .select("id")
    .in("rancho_id", ranchoIds)
    .eq("estado", "atendida")
    .in("metodo_pago", ["sinpe", "transferencia"])
    .limit(1);

  if (error) {
    // `metodo_pago` la agregó la 0128: si esa migración no está, no se
    // puede distinguir y se protege.
    if (faltaLaTabla(error) || faltaLaColumna(error)) return true;
    console.error("[stripe] No se pudo comprobar si el negocio paga por SINPE:", error.message);
    return true;
  }

  return (data ?? []).length > 0;
}

/**
 * ¿El negocio tiene OTRA suscripción de Stripe viva?
 *
 * El caso real: subir de paquete deja la suscripción vieja cancelada y
 * una nueva activa. Los eventos de Stripe pueden llegar desordenados,
 * así que el `deleted` de la vieja puede aterrizar DESPUÉS de que la
 * nueva ya activó todo — y apagaría a un negocio que acaba de pagar
 * más plata que antes.
 *
 * Se excluye la suscripción del evento a propósito: para cuando esto
 * corre, esa fila ya se guardó con su estado nuevo (`cancelada`), así
 * que preguntar por «alguna activa» sin excluirla igual funcionaría —
 * pero excluirla deja la intención escrita y no depende del orden en
 * que se escribió.
 *
 * ANTE LA DUDA, PROTEGE: si la consulta falla se devuelve `true`. Es la
 * misma regla que en el SINPE — apagar de menos se arregla con un clic,
 * apagar de más es un cliente que se va.
 */
async function tieneOtraSuscripcionViva(
  db: Admin,
  quien: Dueno,
  exceptoSuscripcion: string,
): Promise<boolean> {
  const filtro = await filtroDeDueno(db, quien);
  if (!filtro) return false;

  const { data, error } = await db
    .from("suscripciones")
    .select("stripe_subscription_id")
    .in(filtro.columna, filtro.valores)
    .neq("stripe_subscription_id", exceptoSuscripcion)
    // Los dos estados que dan derecho al plan (`daDerechoAlPlan`).
    .in("estado", ["activa", "en_prueba"])
    .limit(1);

  if (error) {
    if (faltaLaTabla(error)) return false;
    console.error("[stripe] No se pudo buscar otra suscripción viva:", error.message);
    return true;
  }

  return (data ?? []).length > 0;
}

// ── PAUSAR Y REANUDAR ────────────────────────────────────────────────

/**
 * EL CORTE: se pausa lo que está operando, y NADA MÁS.
 *
 * Lo que NO hace, y es la mitad del diseño: no borra un solo miembro,
 * ni un sello, ni un pase, ni un movimiento. `pausado` es exactamente
 * el estado del botón «Pausar» del panel —el que promete «conserva
 * todo»— y desde la 0125 el mostrador ya lo respeta: `autorizarCanje`
 * rechaza el canje y el RPC de acumulación no otorga puntos. O sea que
 * apagar es cambiar UN campo, no tocar los datos de nadie.
 *
 * Y solo lo que estaba OPERANDO: un borrador sigue borrador, una
 * archivada sigue archivada, y la que el dueño pausó él sigue pausada
 * sin la marca —para que la vuelta no se la lleve puesta.
 */
async function pausarProgramasEn(
  db: Admin,
  quien: Dueno,
): Promise<{ pausados: number; aplicado: boolean }> {
  const filtro = await filtroDeDueno(db, quien);
  if (!filtro) return { pausados: 0, aplicado: true };

  const { data, error } = await db
    .from("programa_lealtad")
    .update({ estado: "pausado", activo: false, pausado_por_cobro: true })
    .in(filtro.columna, filtro.valores)
    .or(OPERANDO)
    .select("id");

  if (error) {
    if (faltaLaColumna(error) || faltaLaTabla(error)) {
      // NO se pausa nada. Sin la columna, la vuelta al renovar tendría
      // que reactivar «todo lo pausado» y se llevaría por delante la
      // promoción que el dueño pausó a mano. Un negocio apagado que no
      // sabemos volver a prender es peor que uno que sigue operando un
      // mes de más: el motor avisa al equipo y alguien corre la 0146.
      console.error(
        "[stripe] No se pausó ningún programa: falta la migración 0146 " +
          "(programa_lealtad.pausado_por_cobro).",
      );
      return { pausados: 0, aplicado: false };
    }
    throw new Error(`No se pudo pausar el programa: ${error.message}`);
  }

  return { pausados: (data ?? []).length, aplicado: true };
}

/**
 * LA VUELTA: se reactiva SOLO lo que este corte pausó.
 *
 * La simetría no es elegancia: si la vuelta no funcionara, cancelar
 * sería una trampa. Por eso el filtro es `pausado_por_cobro` y no «lo
 * que esté pausado» — la promoción que el dueño pausó a mano el mes
 * pasado porque se le acabó el producto NO puede reaparecer sola
 * porque pagó una factura.
 */
async function reanudarProgramasEn(
  db: Admin,
  quien: Dueno,
): Promise<{ reanudados: number; aplicado: boolean }> {
  const filtro = await filtroDeDueno(db, quien);
  if (!filtro) return { reanudados: 0, aplicado: true };

  // `estado: 'activo'` explícito aunque la fila viniera con `estado` en
  // null (una de la 0060): no se pierde nada —null significaba
  // exactamente «mirá el booleano», y el booleano queda en true— y
  // deja la fila diciendo lo mismo por los dos lados.
  const { data, error } = await db
    .from("programa_lealtad")
    .update({ estado: "activo", activo: true, pausado_por_cobro: false })
    .in(filtro.columna, filtro.valores)
    .eq("pausado_por_cobro", true)
    .select("id");

  if (error) {
    if (faltaLaColumna(error) || faltaLaTabla(error)) {
      // Sin la columna tampoco se pausó nunca nada, así que no hay
      // nada que devolver: no es un problema, es coherencia.
      return { reanudados: 0, aplicado: false };
    }
    throw new Error(`No se pudo reanudar el programa: ${error.message}`);
  }

  return { reanudados: (data ?? []).length, aplicado: true };
}

/**
 * Deja escrito en la suscripción desde cuándo está cortada y con qué
 * paquete se apagó (0146).
 *
 * Es CONTABILIDAD, no una decisión: nada del interruptor lee estas
 * columnas para decidir nada —lo que manda siempre es lo que dice
 * Stripe— y por eso un fallo acá solo se registra. Sirven para
 * responder «¿desde cuándo está apagado?» sin abrir el panel de Stripe
 * y para poder contar después cuántos negocios se recuperaron.
 */
async function marcarCorte(
  db: Admin,
  suscripcionStripe: string,
  plan: PlanId | null,
  reanudando = false,
): Promise<void> {
  const { error } = await db
    .from("suscripciones")
    .update(
      reanudando
        ? { cortada_en: null, plan_al_cortar: null }
        : { cortada_en: new Date().toISOString(), plan_al_cortar: plan },
    )
    .eq("stripe_subscription_id", suscripcionStripe);

  // Sin la 0146 no existen las columnas y no pasa nada: el programa ya
  // quedó pausado (o reanudado), que es lo que le importa al negocio.
  if (error && !faltaLaColumna(error) && !faltaLaTabla(error)) {
    console.error("[stripe] No se pudo marcar el corte en la suscripción:", error.message);
  }
}

/**
 * Con qué filtrar las tablas que cuelgan de un negocio
 * (`programa_lealtad`, `suscripciones`): las dos tienen `rancho_id` y
 * `cuenta_id`.
 *
 * Un programa cuelga de un rancho (0060) o de una cuenta (0134), y hay
 * negocios de las dos épocas. Se prefiere el rancho porque es la
 * columna que todas las filas tienen; la cuenta es el camino de los
 * negocios de Lealtad sin marketplace.
 */
async function filtroDeDueno(
  db: Admin,
  quien: Dueno,
): Promise<{ columna: "rancho_id" | "cuenta_id"; valores: string[] } | null> {
  const ranchoIds = await ranchosDe(db, quien);
  if (ranchoIds.length > 0) return { columna: "rancho_id", valores: ranchoIds };
  if (quien.cuentaId) return { columna: "cuenta_id", valores: [quien.cuentaId] };
  return null;
}

/**
 * Los ranchos de este dueño: el suyo, más el que cuelgue de su cuenta.
 * Una cuenta puede tener rancho (`cuentas.rancho_id`, la costura de la
 * 0134) y el evento de Stripe puede traer solo uno de los dos.
 */
async function ranchosDe(db: Admin, quien: Dueno): Promise<string[]> {
  const ids = new Set<string>();
  if (quien.ranchoId) ids.add(quien.ranchoId);

  if (quien.cuentaId) {
    const { data } = await db
      .from("cuentas")
      .select("rancho_id")
      .eq("id", quien.cuentaId)
      .maybeSingle();
    const deLaCuenta = (data?.rancho_id as string | null) ?? null;
    if (deLaCuenta) ids.add(deLaCuenta);
  }

  return [...ids];
}

// ── EL AVISO PREVIO, UNA SOLA VEZ ────────────────────────────────────

/**
 * Reclama el aviso previo con un UPDATE CONDICIONAL, no con un «¿ya
 * se mandó? entonces no lo mando».
 *
 * Es la misma doctrina del alta pagada y del canje (0137): la pregunta
 * seguida de la escritura tiene una ventana por la que pasan las dos
 * entregas simultáneas, y el dueño recibe dos correos idénticos. El
 * update condicional lo resuelve el motor con un lock de fila.
 *
 * Sin la columna (0146 sin correr) devuelve true: un correo repetido
 * molesta; no avisarle a nadie que su programa se apaga es perder al
 * cliente, que es exactamente lo que este aviso viene a evitar.
 */
async function reclamarAvisoPrevioEn(db: Admin, suscripcionStripe: string): Promise<boolean> {
  const { data, error } = await db
    .from("suscripciones")
    .update({ aviso_previo_en: new Date().toISOString() })
    .eq("stripe_subscription_id", suscripcionStripe)
    .is("aviso_previo_en", null)
    .select("id");

  if (error) {
    if (faltaLaColumna(error)) return true;
    if (faltaLaTabla(error)) return false;
    console.error("[stripe] No se pudo reclamar el aviso previo:", error.message);
    return false;
  }

  return (data ?? []).length > 0;
}

// ── EL CORREO AL DUEÑO ───────────────────────────────────────────────

/**
 * El aviso al dueño del negocio (no al equipo de Bookea).
 *
 * Vive en la puerta y no en el motor porque el motor decide QUÉ decir
 * y esto sabe A QUIÉN: el correo del dueño, el nombre del negocio y si
 * ese buzón todavía recibe.
 *
 * Nunca lanza. Un correo que no sale no puede hacer que Stripe
 * reintente un evento que ya movió el estado — el reintento volvería a
 * pausar (idempotente, no molesta) pero también volvería a mandar el
 * correo, y ahí sí se duplica.
 */
async function avisarAlDuenoEn(
  db: Admin,
  aviso: Dueno & { clase: ClaseDeAviso; plan: PlanId | null; hasta: string | null },
): Promise<void> {
  try {
    const quien = await duenoDelNegocio(db, aviso);
    if (!quien) {
      console.warn(`[stripe] Sin correo del dueño: no salió el aviso «${aviso.clase}».`);
      return;
    }

    // Rebotes duros y quejas de spam (0082): a ese buzón no se le
    // escribe más, ni siquiera algo transaccional. Insistirle quema la
    // reputación del dominio entero y se lleva puestos los correos de
    // todos los demás negocios.
    const { data: supresion, error: eSupresion } = await db
      .from("supresiones_correo")
      .select("correo")
      .eq("correo", quien.correo)
      .maybeSingle();
    if (eSupresion) {
      console.warn("[stripe] No se pudo leer supresiones_correo:", eSupresion.message);
    }
    if (supresion) {
      console.warn(`[stripe] El correo del dueño está suprimido: no sale «${aviso.clase}».`);
      return;
    }

    const datos = {
      nombreNegocio: quien.nombreNegocio,
      ranchoId: quien.ranchoId,
      nombrePlan: aviso.plan ? PLANES[aviso.plan].nombre : null,
      hasta: fechaParaPersona(aviso.hasta),
    };

    const { asunto, html } = correoDeClase(aviso.clase, datos, quien.nombreNegocio);
    await enviarCorreo({ to: quien.correo, subject: asunto, html });
  } catch (e) {
    console.error(`[stripe] No se pudo avisar al dueño («${aviso.clase}»):`, e);
  }
}

type DuenoResuelto = {
  correo: string;
  nombreNegocio: string;
  ranchoId: string | null;
};

/** El correo del dueño y el nombre del negocio, por rancho o por cuenta. */
async function duenoDelNegocio(db: Admin, quien: Dueno): Promise<DuenoResuelto | null> {
  let ownerId: string | null = null;
  let nombreNegocio = "tu negocio";
  let ranchoId: string | null = quien.ranchoId ?? null;

  if (quien.ranchoId) {
    const { data } = await db
      .from("ranchos")
      .select("nombre, owner_id")
      .eq("id", quien.ranchoId)
      .maybeSingle();
    ownerId = (data?.owner_id as string | null) ?? null;
    nombreNegocio = ((data?.nombre as string | null) ?? "").trim() || nombreNegocio;
  }

  if (!ownerId && quien.cuentaId) {
    const { data } = await db
      .from("cuentas")
      .select("nombre, owner_id, rancho_id")
      .eq("id", quien.cuentaId)
      .maybeSingle();
    ownerId = (data?.owner_id as string | null) ?? null;
    nombreNegocio = ((data?.nombre as string | null) ?? "").trim() || nombreNegocio;
    ranchoId = ranchoId ?? ((data?.rancho_id as string | null) ?? null);
  }

  if (!ownerId) return null;

  const { data: perfil } = await db
    .from("perfiles")
    .select("email")
    .eq("id", ownerId)
    .maybeSingle();

  const correo = ((perfil?.email as string | null) ?? "").trim().toLowerCase();
  // Mismo criterio de validez que el CHECK de la 0082.
  if (correo.indexOf("@") <= 0 || /\s/.test(correo)) return null;

  return { correo, nombreNegocio, ranchoId };
}

/** El asunto y el HTML de cada clase de aviso. */
function correoDeClase(
  clase: ClaseDeAviso,
  datos: {
    nombreNegocio: string;
    ranchoId: string | null;
    nombrePlan: string | null;
    hasta: string | null;
  },
  nombreNegocio: string,
): { asunto: string; html: string } {
  switch (clase) {
    case "corte_programado":
      return {
        asunto: datos.hasta
          ? `${nombreNegocio}: tu programa de lealtad funciona hasta el ${datos.hasta}`
          : `${nombreNegocio}: cancelaste tu suscripción de lealtad`,
        html: plantillaCorteProgramado(datos),
      };
    case "programa_pausado":
      return {
        asunto: `${nombreNegocio}: tu programa de lealtad quedó en pausa`,
        html: plantillaProgramaPausado({ ...datos, motivo: "cancelada" }),
      };
    case "programa_reanudado":
      return {
        asunto: `${nombreNegocio}: tu programa de lealtad volvió a funcionar`,
        html: plantillaProgramaReanudado(datos),
      };
    case "cobro_fallido":
      return {
        asunto: `${nombreNegocio}: no pudimos cobrar tu suscripción`,
        html: plantillaCobroFallido(datos),
      };
  }
}

/**
 * El ISO que manda Stripe → «Domingo 30 de agosto de 2026».
 *
 * Pasa por `fechaISOCR` primero para que el día sea el día EN COSTA
 * RICA: un `periodo_fin` a las 23:30 del 30 en UTC es todavía el 30 acá
 * (UTC-6), pero uno a las 03:00 del 31 en UTC también — y sin la
 * conversión, el correo diría «hasta el 31» un día de más.
 */
function fechaParaPersona(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return fechaLargaCR(fechaISOCR(t));
}

/**
 * El upsert de la suscripción, con la mezcla del dueño.
 *
 * POR QUÉ SE LEE LA FILA ANTES: los eventos de `customer.subscription.*`
 * NO traen `client_reference_id`, y su metadata solo tiene lo que
 * nosotros le pusimos al crear la sesión. Un evento que llegue sin
 * dueño no puede BORRAR el dueño que dejó el checkout — por eso el
 * valor viejo gana cuando el nuevo viene vacío.
 */
async function guardarSuscripcionEn(
  db: Admin,
  datos: DatosSuscripcion,
): Promise<{ ranchoId: string | null; cuentaId: string | null } | null> {
  const { data: previa, error: errorLectura } = await db
    .from("suscripciones")
    .select("rancho_id, cuenta_id")
    .eq("stripe_subscription_id", datos.suscripcionStripe)
    .maybeSingle();

  if (faltaLaTabla(errorLectura)) {
    throw new Error("Falta correr la migración 0143 en Supabase: no existe `suscripciones`.");
  }

  const ranchoId = datos.ranchoId ?? ((previa?.rancho_id as string | null) ?? null);
  let cuentaId = datos.cuentaId ?? ((previa?.cuenta_id as string | null) ?? null);

  // Si se sabe el rancho pero no la cuenta, se busca: desde la 0134 el
  // plan efectivo sale de `cuentas.plan`, así que sin este id el plan
  // se escribiría solo en el lugar viejo y la mitad del panel seguiría
  // mostrando el paquete anterior.
  if (!cuentaId && ranchoId) {
    const { data: cuenta } = await db
      .from("cuentas")
      .select("id")
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    cuentaId = (cuenta?.id as string | null) ?? null;
  }

  // El CHECK de la 0143 exige al menos uno. Sin dueño no se guarda: el
  // motor avisa por correo para que alguien la ate a mano.
  if (!ranchoId && !cuentaId) return null;

  const { error } = await db.from("suscripciones").upsert(
    {
      rancho_id: ranchoId,
      cuenta_id: cuentaId,
      stripe_customer_id: datos.clienteStripe,
      stripe_subscription_id: datos.suscripcionStripe,
      stripe_price_id: datos.precioStripe,
      plan: datos.plan,
      periodo: datos.periodo,
      estado: datos.estado,
      periodo_inicio: datos.periodoInicio,
      periodo_fin: datos.periodoFin,
      cancel_at_period_end: datos.cancelaAlFinal,
      actualizada_en: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(`No se pudo guardar la suscripción: ${error.message}`);

  return { ranchoId, cuentaId };
}

/**
 * EL ALTA PAGADA: la solicitud sin rancho (0130) se vuelve un negocio.
 *
 * ------------------------------------------------------------------
 * LA RESERVA ES ATÓMICA, Y NO ES UN LUJO
 * ------------------------------------------------------------------
 * `checkout.session.completed` y `customer.subscription.created` llegan
 * casi juntos y los dos traen el mismo `solicitud_id`. Un «leo el
 * estado y después lo cambio» tiene una ventana entre la pregunta y la
 * respuesta por la que pasan los dos, y el resultado serían DOS
 * negocios para la misma persona, con dos slugs y dos paneles.
 *
 * Así que lo primero es un UPDATE CONDICIONAL —`where estado =
 * 'pendiente'`— que Postgres resuelve con un lock de fila: gana uno
 * solo. El que pierde no crea nada; relee la fila y devuelve el negocio
 * que creó el otro. Misma doctrina que `llaveDeCanje` en el mostrador
 * (0137) y que el índice único de `eventos_stripe`.
 *
 * ------------------------------------------------------------------
 * Y SI ALGO FALLA DESPUÉS DE RESERVAR, SE DEVUELVE A LA COLA
 * ------------------------------------------------------------------
 * Una solicitud marcada «atendida» SIN negocio es el peor estado
 * posible: el reintento de Stripe rebotaría contra la reserva, el
 * negocio no existiría, y el cobro quedaría cobrado y sin activar para
 * siempre. Por eso cualquier salida que no termine en negocio la
 * devuelve a `pendiente`.
 */
async function crearNegocioDeSolicitudEn(
  db: Admin,
  solicitudId: string,
  plan: string,
): Promise<{ ranchoId: string; cuentaId: string | null } | null> {
  const { data: reservadas, error } = await db
    .from("solicitudes_lealtad")
    .update({ estado: "atendida", atendida_en: new Date().toISOString() })
    // `atendida_por` queda en null: la atendió el sistema, igual que en
    // el alta gratis. Un registro sin autor es un rumor; con null como
    // autor conocido, no.
    .eq("id", solicitudId)
    .eq("estado", "pendiente")
    .select("*");

  if (error) throw new Error(`No se pudo reservar la solicitud ${solicitudId}: ${error.message}`);

  const solicitud = (reservadas ?? [])[0] as Record<string, unknown> | undefined;

  // No la reservamos: o la tomó el otro evento, o ya estaba atendida, o
  // la rechazaron. Lo que vale es si terminó con negocio.
  if (!solicitud) {
    const { data: previa } = await db
      .from("solicitudes_lealtad")
      .select("rancho_id")
      .eq("id", solicitudId)
      .maybeSingle();
    const ranchoId = (previa?.rancho_id as string | null) ?? null;
    return ranchoId ? { ranchoId, cuentaId: null } : null;
  }

  // Una solicitud de UPGRADE (ya trae negocio) no crea nada: se activa
  // sobre el que ya existe.
  const yaTiene = (solicitud.rancho_id as string | null) ?? null;
  if (yaTiene) return { ranchoId: yaTiene, cuentaId: null };

  try {
    // La MISMA función que usa /admin/complementos al aceptar un alta.
    const alta = await crearNegocioDesdeSolicitud(db, solicitud, {
      aprobadoPor: null, // el sistema: lo aprobó el cobro
      plan,
    });

    if (!alta.ok) {
      // Un problema de datos, no de red: reintentar mil veces daría
      // mil veces lo mismo. Vuelve a la cola y una persona lo mira.
      console.error("[stripe] El alta pagada no se pudo crear:", alta.motivo);
      await devolverALaCola(db, solicitudId);
      return null;
    }

    // El círculo se cierra: la solicitud queda apuntando al negocio que
    // creó, igual que cuando la aprueba un admin. Un fallo acá no
    // deshace nada —el negocio existe y el plan se le escribe igual—
    // pero deja la solicitud sin decir qué creó, y eso hay que verlo.
    const { error: eEnlace } = await db
      .from("solicitudes_lealtad")
      .update({ rancho_id: alta.ranchoId })
      .eq("id", solicitudId);
    if (eEnlace) {
      console.error(
        `[stripe] El negocio ${alta.ranchoId} nació de la solicitud ${solicitudId} pero la ` +
          `fila no quedó enlazada: ${eEnlace.message}. Enlazarla a mano.`,
      );
    }

    // `cuentaId` en null a propósito: un rancho recién creado no tiene
    // fila en `cuentas` (la 0134 fue un backfill, no un trigger), y si
    // algún día la tiene, `guardarSuscripcionEn` la busca sola por
    // rancho.
    return { ranchoId: alta.ranchoId, cuentaId: null };
  } catch (e) {
    await devolverALaCola(db, solicitudId);
    throw e;
  }
}

/** Deshace la reserva: el reintento de Stripe tiene que poder entrar. */
async function devolverALaCola(db: Admin, solicitudId: string): Promise<void> {
  const { error } = await db
    .from("solicitudes_lealtad")
    .update({ estado: "pendiente", atendida_en: null })
    .eq("id", solicitudId)
    .is("rancho_id", null);
  if (error) {
    console.error(
      `[stripe] La solicitud ${solicitudId} quedó ATENDIDA sin negocio y no se pudo ` +
        `devolver a la cola: ${error.message}. Hay que atenderla a mano.`,
    );
  }
}

/**
 * Escribe el plan donde el resto del código lo lee.
 *
 * En los DOS lugares, y en este orden de importancia: `cuentas.plan`
 * es la fuente de verdad desde la 0134 y `ranchos.plan_lealtad` es el
 * respaldo de la transición (ver `planEfectivo` en
 * src/lib/lealtad/cuenta.ts). Escribir uno solo dejaría medio panel
 * mostrando el paquete viejo.
 *
 * El id que se escribe SIEMPRE sale del catálogo por el mapeo
 * price→plan: los CHECK de la base solo aceptan esa lista, y un valor
 * inventado haría fallar el update entero — cobrado y sin activar.
 */
async function aplicarPlanEn(
  db: Admin,
  { ranchoId, cuentaId, plan }: { ranchoId: string | null; cuentaId: string | null; plan: string },
): Promise<void> {
  if (cuentaId) {
    const { error } = await db.from("cuentas").update({ plan }).eq("id", cuentaId);
    if (error && !faltaLaTabla(error)) {
      throw new Error(`No se pudo escribir el plan en la cuenta: ${error.message}`);
    }
  }

  if (ranchoId) {
    const { error } = await db
      .from("ranchos")
      .update({ plan_lealtad: plan })
      .eq("id", ranchoId);
    if (error) throw new Error(`No se pudo escribir el plan en el negocio: ${error.message}`);

    // El complemento que enciende el módulo (0077): sin él, el panel
    // dice «todavía no tiene el programa de lealtad» aunque el cobro
    // haya entrado. Es lo mismo que hace el alta gratis.
    const { error: errorAddon } = await db.from("addons_negocio").upsert(
      {
        rancho_id: ranchoId,
        addon: "lealtad",
        activo: true,
        vence_en: null,
        activado_en: new Date().toISOString(),
        notas: `Plan ${plan} — pagado con tarjeta (Stripe)`,
      },
      { onConflict: "rancho_id,addon" },
    );
    if (errorAddon) {
      console.error("[stripe] El complemento de lealtad no se pudo activar:", errorAddon.message);
    }
  }
}

/**
 * La suscripción de un negocio, para pintar la sección Plan y para
 * reusar el `stripe_customer_id` al abrir Checkout o el Portal.
 *
 * Tolerante a que la 0143 no esté corrida: devuelve null y la pantalla
 * sigue funcionando exactamente como antes de Stripe. Las migraciones
 * las pega el dueño a mano, así que siempre hay una ventana en la que
 * el código va adelante de la base.
 */
export type ResumenSuscripcion = {
  estado: string;
  plan: string | null;
  periodo: string;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
  clienteStripe: string;
};

export async function suscripcionDelNegocio(
  db: Admin,
  quien: { ranchoId?: string | null; cuentaId?: string | null },
): Promise<ResumenSuscripcion | null> {
  const filtro = quien.ranchoId
    ? { columna: "rancho_id", valor: quien.ranchoId }
    : quien.cuentaId
      ? { columna: "cuenta_id", valor: quien.cuentaId }
      : null;
  if (!filtro) return null;

  // `select *` y un `order` en vez de `.single()`: un negocio puede
  // tener una suscripción vieja cancelada y una nueva activa, y lo que
  // importa es la última que se movió.
  const { data, error } = await db
    .from("suscripciones")
    .select("*")
    .eq(filtro.columna, filtro.valor)
    .order("actualizada_en", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const fila = data[0] as Record<string, unknown>;
  return {
    estado: (fila.estado as string) ?? "morosa",
    plan: (fila.plan as string | null) ?? null,
    periodo: (fila.periodo as string) ?? "mensual",
    periodoFin: (fila.periodo_fin as string | null) ?? null,
    cancelaAlFinal: fila.cancel_at_period_end === true,
    clienteStripe: (fila.stripe_customer_id as string) ?? "",
  };
}

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
