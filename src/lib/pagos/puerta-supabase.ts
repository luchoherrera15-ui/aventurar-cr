import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { crearNegocioDesdeSolicitud } from "@/lib/lealtad/alta-desde-solicitud";
import { stripeDelEntorno } from "./stripe";
import type { DatosSuscripcion, Puerta } from "./suscripciones";

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
  };
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
