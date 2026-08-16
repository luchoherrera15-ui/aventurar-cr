"use server";

import { verificarAccesoRancho } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  abrirCheckoutDeSuscripcion,
  sePuedeCobrar,
  SIN_STRIPE,
  type ResultadoPago,
} from "@/lib/pagos/checkout";
import { esPeriodo, esPlanConCobro } from "@/lib/pagos/precios";
import { suscripcionDelNegocio } from "@/lib/pagos/puerta-supabase";

/**
 * PAGAR EL PAQUETE CON TARJETA DESDE LA PÁGINA DE PAQUETES.
 *
 * Es el mismo Checkout del panel, con UNA diferencia que lo cambia
 * todo: acá el negocio puede NO EXISTIR TODAVÍA. En /lealtad/planes
 * entra tanto el que ya tiene su programa y quiere subir de paquete
 * como el que llegó de la landing y no tiene nada en Bookea.
 *
 * ------------------------------------------------------------------
 * LA DECISIÓN: LA SOLICITUD ANTES DEL PAGO, EL NEGOCIO DESPUÉS
 * ------------------------------------------------------------------
 * El NEGOCIO no se crea acá. Se crea en el webhook, cuando Stripe
 * confirma el cobro con un evento firmado. Crearlo antes dejaría un
 * rancho por cada checkout abandonado —que es la mayoría de los
 * checkouts— con su slug tomado, su panel accesible y su aprobación de
 * lealtad ya puesta. Es exactamente lo que la 0130 vino a arreglar:
 * «el flujo viejo creaba el rancho primero y lo dejaba en hold; el
 * definitivo es al revés».
 *
 * Pero ALGO tiene que existir antes del pago, y ese algo es la
 * SOLICITUD: una fila de `solicitudes_lealtad` sin rancho, exactamente
 * la forma que la 0130 le dio al alta. Existe por tres razones y las
 * tres importan:
 *
 *  1. GUARDA QUIÉN PAGA. `solicitante_id` sale de la sesión, en el
 *     servidor, y queda escrito en la base antes de que el navegador
 *     toque nada. El nombre del negocio podría viajar en la metadata de
 *     Stripe sin peligro; de quién es el negocio, no: eso decide a
 *     nombre de quién nace un rancho.
 *
 *  2. DA UNA LLAVE ATÓMICA. `checkout.session.completed` y
 *     `customer.subscription.created` llegan casi juntos con el mismo
 *     `solicitud_id`. La fila permite reservarla con un UPDATE
 *     condicional y que solo uno de los dos cree el negocio. Sin fila
 *     no hay contra qué reservar, y el resultado serían dos negocios.
 *
 *  3. NO PIERDE EL COBRO. Si Stripe confirma y algo falla al crear, la
 *     solicitud sigue en /admin/complementos con todo lo necesario para
 *     terminarla a mano.
 *
 * ------------------------------------------------------------------
 * EL SINPE NO SE TOCA
 * ------------------------------------------------------------------
 * Este archivo es TODO lo que agrega el pago con tarjeta a esta
 * pantalla. Sin llaves de Stripe, `sePuedeCobrar` dice que no, la
 * página no dibuja ningún botón de tarjeta y la compra por depósito con
 * comprobante (`actions.ts`) queda exactamente como estaba.
 */

/**
 * Lo que se le escribe en la solicitud al equipo, para que nadie la
 * apruebe a mano mientras el cobro está en curso: aprobarla regalaría
 * el paquete que la persona está justo pagando.
 */
const MARCA_TARJETA =
  "PAGO CON TARJETA EN CURSO (Stripe) — no aprobar a mano: el negocio y el paquete " +
  "se crean solos cuando Stripe confirma el cobro.";

export async function iniciarPagoDelPaquete(datos: {
  plan: string;
  periodo: string;
  /** El negocio que ya existe. Vacío = todavía no existe. */
  ranchoId: string;
  /** Cómo se llama el negocio a crear. Solo se usa si no hay `ranchoId`. */
  nombreNegocio: string;
}): Promise<ResultadoPago> {
  if (!esPlanConCobro(datos.plan)) {
    // Incluye el plan `prueba`: es gratis, se activa solo y NUNCA pasa
    // por Stripe (regla explícita del dueño).
    return { ok: false, motivo: "Ese paquete no se cobra con tarjeta." };
  }
  if (!esPeriodo(datos.periodo)) {
    return { ok: false, motivo: "Elegí si querés pagarlo por mes o por año." };
  }
  // Se pregunta ANTES de escribir nada: sin llaves no tiene sentido
  // dejar una solicitud esperando un cobro que no se va a poder abrir.
  if (!sePuedeCobrar(datos.plan, datos.periodo)) {
    return { ok: false, motivo: SIN_STRIPE };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para pagar." };

  // ── El negocio que YA existe: el camino del upgrade ─────────────────
  if (datos.ranchoId) {
    // `verificarAccesoRancho` es la que NO incluye colaboradores (0116):
    // comprar un paquete es plata, y la plata es del dueño. Y se
    // comprueba en el SERVIDOR — una petición armada a mano no pasa por
    // la pantalla, y sin esto cualquiera con sesión podría dejar el
    // cobro de su tarjeta atado a un negocio ajeno.
    const acceso = await verificarAccesoRancho(datos.ranchoId);
    if (!acceso.ok) {
      return { ok: false, motivo: "Solo el dueño del negocio puede pagar el paquete." };
    }

    // Lealtad se separó por completo del resto del sitio (14 ago 2026):
    // un negocio que TODAVÍA no tiene programa no puede comprarlo acá
    // encima de sí mismo — eso mezclaba negocios reales del directorio
    // con pases. Si YA tiene programa, esto es el upgrade que sí debe
    // seguir funcionando.
    const { data: yaTienePrograma } = await supabase
      .from("programa_lealtad")
      .select("id")
      .eq("rancho_id", datos.ranchoId)
      .maybeSingle();
    if (!yaTienePrograma) {
      return {
        ok: false,
        motivo: "Ese negocio todavía no tiene programa de lealtad — lealtad nace siempre en un negocio aparte.",
      };
    }

    // Un negocio en revisión (0129) no compra nada todavía. La pantalla
    // ya los filtra del selector; esto lo vuelve a comprobar acá, que es
    // donde no se puede saltar. Con la llave de servicio: `verificarAccesoRancho`
    // de arriba ya es el chequeo de seguridad real — esto solo necesita
    // poder pedir `*` sin mantener una lista de columnas a mano (desde
    // la 0155, `authenticated` no tiene permiso de tabla completa).
    const { data: rancho } = await (createAdminClient() ?? supabase)
      .from("ranchos")
      .select("*")
      .eq("id", datos.ranchoId)
      .maybeSingle();
    if (rancho && "lealtad_aprobado_en" in rancho && rancho.lealtad_aprobado_en === null) {
      return {
        ok: false,
        motivo: "Tu negocio está en revisión por Bookea — te avisamos al aprobarlo.",
      };
    }

    const { cuentaId, clienteStripe } = await fichaDeStripe(datos.ranchoId);

    return abrirCheckoutDeSuscripcion({
      plan: datos.plan,
      periodo: datos.periodo,
      correo: user.email ?? null,
      clienteStripe,
      ranchoId: datos.ranchoId,
      cuentaId,
      solicitudId: null,
      volverA: `/lealtad/panel/${datos.ranchoId}`,
      ancla: "plan",
    });
  }

  // ── El negocio que TODAVÍA NO EXISTE: el alta ──────────────────────
  const nombre = datos.nombreNegocio.trim();
  if (!nombre || nombre.length > 80) {
    return { ok: false, motivo: "Escribí el nombre de tu negocio (máximo 80)." };
  }

  const solicitud = await solicitudDeAlta(supabase, user.id, datos.plan, nombre);
  if (!solicitud.ok) return { ok: false, motivo: solicitud.motivo };

  return abrirCheckoutDeSuscripcion({
    plan: datos.plan,
    periodo: datos.periodo,
    correo: user.email ?? null,
    // Sin negocio no hay cliente de Stripe previo que reusar: es su
    // primera compra por definición.
    clienteStripe: null,
    ranchoId: null,
    cuentaId: null,
    solicitudId: solicitud.id,
    // Vuelve a la misma pantalla: el negocio todavía no tiene panel al
    // cual mandarla. La página de vuelta NO activa nada — lo dice y ya.
    volverA: "/lealtad/planes",
  });
}

/**
 * El cliente de Stripe y la cuenta (0134) que el negocio ya tenga.
 *
 * Reusar el `customer` importa: sin esto cada compra crearía un cliente
 * nuevo en Stripe y el mismo negocio terminaría con tres tarjetas
 * guardadas en tres fichas que no se ven entre sí.
 */
async function fichaDeStripe(
  ranchoId: string,
): Promise<{ cuentaId: string | null; clienteStripe: string | null }> {
  const admin = createAdminClient();
  if (!admin) return { cuentaId: null, clienteStripe: null };

  const { data: cuenta } = await admin
    .from("cuentas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  const cuentaId = (cuenta?.id as string | null) ?? null;

  const previa = await suscripcionDelNegocio(admin, { ranchoId, cuentaId });
  return { cuentaId, clienteStripe: previa?.clienteStripe || null };
}

/**
 * La solicitud de ALTA que va a esperar el cobro.
 *
 * El INSERT va con la SESIÓN de la persona, no con la llave de
 * servicio: así hereda la política "Pedir el alta de un negocio nuevo"
 * (0130), que exige rancho nulo, nombre presente, firma propia y estado
 * pendiente. Este archivo no decide permisos — los hereda.
 */
async function solicitudDeAlta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string,
  plan: string,
  nombre: string,
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const { data, error } = await supabase
    .from("solicitudes_lealtad")
    .insert({
      rancho_id: null,
      solicitante_id: usuarioId,
      negocio_nombre: nombre,
      // 'otro' es la respuesta honesta: acá no se le pregunta el rubro,
      // porque un negocio que nace solo para lealtad no se publica en
      // ningún directorio. El rancho se crea con una vertical válida.
      negocio_vertical: "otro",
      plan,
      // Sin `metodo_pago`: el CHECK de la 0128 solo acepta 'sinpe' y
      // 'transferencia'. Que esto se paga con tarjeta lo dice el
      // mensaje, que es lo que el equipo lee en /admin/complementos.
      personalizado: false,
      mensaje: MARCA_TARJETA,
    })
    .select("id")
    .single();

  if (!error && data) return { ok: true, id: data.id as string };

  // Ya tenía un alta pendiente (el unique parcial de la 0130). Puede ser
  // un checkout que abandonó, o una solicitud por SINPE esperando al
  // equipo. En los dos casos se REUSA: pagar con tarjeta es la forma
  // más rápida de resolver esa misma solicitud, y crear una segunda
  // dejaría dos filas compitiendo por el mismo negocio.
  //
  // Su `plan` puede haber quedado viejo si eligió otro paquete ahora, y
  // no se corrige a propósito: el paquete que se activa NUNCA sale de
  // esta fila, sale del `price_id` que Stripe dice que cobró.
  if (error?.code === "23505") {
    const { data: previa } = await supabase
      .from("solicitudes_lealtad")
      .select("id")
      .eq("solicitante_id", usuarioId)
      .eq("estado", "pendiente")
      .is("rancho_id", null)
      .maybeSingle();
    if (previa?.id) return { ok: true, id: previa.id as string };
  }

  if (error?.code === "42501") {
    return { ok: false, motivo: "No se pudo registrar tu negocio. Iniciá sesión de nuevo." };
  }
  if (
    error &&
    /negocio_nombre|negocio_vertical|rancho_id/.test(error.message) &&
    /schema cache|Could not find|does not exist|null value/i.test(error.message)
  ) {
    return { ok: false, motivo: "Falta correr la migración 0130 en Supabase." };
  }

  return {
    ok: false,
    motivo: "No pudimos registrar tu negocio para el pago: " + (error?.message ?? ""),
  };
}
