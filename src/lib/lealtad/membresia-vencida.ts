import type { SupabaseClient } from "@supabase/supabase-js";
import { planGuardadoDe } from "./aplicar-plan";
import {
  complementoVencio,
  finDelPagoManual,
  membresiaVencidaDe,
  suscripcionSueltaElBloqueo,
  type MembresiaVencida,
} from "./regalias";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA MEMBRESÍA VENCIDA — se acabó lo regalado o lo pagado
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 nov 2026): cuando una regalía vence, el negocio
 * ve «¡MEMBRESÍA VENCIDA!» y no puede avanzar hasta pagar. Y lo mismo
 * cuando se acaba lo que cubría un pago por SINPE: sin fecha, quien
 * pagaba una vez no volvía a ver el aviso nunca.
 *
 * ── POR DÓNDE PASA ──────────────────────────────────────────────────
 * Un popup que solo tape el panel se salta con el link de la caja, así
 * que esta función la usan las tres entradas por donde se opera:
 *
 *   · `lealtad/panel/[id]/layout.tsx` — el panel y TODAS sus subrutas
 *     (crear, editar, póster), con el popup;
 *   · `[slug]/scan/page.tsx` — el link directo de la caja;
 *   · `lib/lealtad/app-movil/puerta.ts` — la app. Ahí sin hablar de
 *     plata: la regla 3.1.1 de Apple y la decisión del dueño de que en
 *     la app no se muestre nada de pagos (ver `sin-cobros.test.ts`).
 *
 * Lo que NO se toca: los pases de los clientes y la afiliación por QR.
 * La tarjeta sigue en su teléfono como estaba; el castigo es del negocio
 * que no ha pagado, no de su clientela.
 *
 * ── SI NO SE PUEDE SABER, NO SE BLOQUEA ─────────────────────────────
 * Cualquier error de lectura devuelve null. Cerrarle el panel a un
 * negocio que paga porque una consulta se cayó cuesta mucho más que
 * dejar pasar unos minutos a uno que debe.
 *
 * ── EL COSTO ────────────────────────────────────────────────────────
 * Esto corre en cada carga del panel: son dos lecturas por índice. Las
 * otras dos (suscripción y comprobante) solo se pagan cuando ya hay una
 * regalía vencida, que es el caso raro.
 */

export type BloqueoMembresia = MembresiaVencida & {
  /**
   * Dejó un comprobante de SINPE y Bookea todavía no lo aprueba. Sigue
   * bloqueado —un comprobante sin revisar no es un pago confirmado— pero
   * el aviso le dice que ya se recibió, en vez de pedirle pagar otra vez.
   */
  comprobanteEnRevision: boolean;
};

export async function bloqueoPorMembresia(
  db: SupabaseClient,
  ranchoId: string,
  ahora: Date = new Date(),
): Promise<BloqueoMembresia | null> {
  try {
    // Con la llave de servicio: la RLS de `historial_plan_lealtad` solo
    // se la muestra a los admins de Bookea (0173).
    const [movimientos, complemento] = await Promise.all([
      db
        .from("historial_plan_lealtad")
        .select("concepto, plan_despues, cortesia_hasta")
        .eq("rancho_id", ranchoId)
        .order("creado_en", { ascending: false })
        .limit(1),
      db
        .from("addons_negocio")
        .select("activo, vence_en, es_cortesia")
        .eq("rancho_id", ranchoId)
        .eq("addon", "lealtad")
        .maybeSingle(),
    ]);
    if (movimientos.error || complemento.error) return null;

    const mov = movimientos.data?.[0] as
      | { concepto: string; plan_despues: string | null; cortesia_hasta: string | null }
      | undefined;
    const addon = complemento.data as {
      activo: boolean;
      vence_en: string | null;
      es_cortesia: boolean | null;
    } | null;

    const complementoFila = addon
      ? { activo: addon.activo, venceEn: addon.vence_en, esCortesia: addon.es_cortesia === true }
      : null;

    // Solo si el complemento venció hace falta saber el paquete, para
    // separar una membresía de la Prueba de 14 días. El negocio normal
    // no paga esta lectura.
    const plan = complementoVencio(complementoFila, ahora)
      ? (await planGuardadoDe(db, ranchoId)).plan
      : null;

    const vencida = membresiaVencidaDe(
      {
        ultimoMovimiento: mov
          ? {
              concepto: mov.concepto,
              planDespues: mov.plan_despues,
              cortesiaHasta: mov.cortesia_hasta,
            }
          : null,
        complemento: complementoFila,
        plan,
      },
      ahora,
    );
    if (!vencida) return null;

    // ── ¿YA PAGÓ CON TARJETA? ──────────────────────────────────────
    // El webhook de Stripe escribe el plan pero NO deja fila en la
    // bitácora, así que para la bitácora la regalía sigue siendo lo
    // último que pasó. Sin esta consulta, el negocio que acaba de pagar
    // seguiría viendo el aviso.
    //
    const [yaPaga, solicitud] = await Promise.all([
      hayCobroConTarjeta(db, ranchoId),
      db
        .from("solicitudes_lealtad")
        .select("id")
        .eq("rancho_id", ranchoId)
        .eq("estado", "pendiente")
        .limit(1),
    ]);
    // `null` = no se pudo saber, y sin saberlo no se bloquea.
    if (yaPaga !== false) return null;

    return { ...vencida, comprobanteEnRevision: (solicitud.data?.length ?? 0) > 0 };
  } catch (error) {
    console.error("[membresia] No se pudo revisar la regalía:", error);
    return null;
  }
}

/**
 * ¿Este negocio tiene una suscripción de Stripe viva?
 *
 * Por negocio Y por cuenta: la suscripción puede colgar solo de la cuenta
 * (0143). `null` = no se pudo leer.
 */
export async function hayCobroConTarjeta(
  db: SupabaseClient,
  ranchoId: string,
): Promise<boolean | null> {
  const { data: cuenta, error: errorCuenta } = await db
    .from("cuentas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (errorCuenta) return null;

  const dueno = cuenta?.id
    ? `rancho_id.eq.${ranchoId},cuenta_id.eq.${cuenta.id as string}`
    : `rancho_id.eq.${ranchoId}`;
  const { data, error } = await db.from("suscripciones").select("estado").or(dueno);
  if (error) return null;

  return ((data ?? []) as { estado: string }[]).some((s) => suscripcionSueltaElBloqueo(s.estado));
}

/**
 * La fecha que le toca al complemento con un pago por SINPE.
 *
 * Devuelve `null` si el negocio paga con tarjeta, y ese null importa:
 * Stripe cobra solo y deja el complemento sin fecha. Escribirle una acá
 * apagaría el módulo de alguien que está pagando el día que llegue.
 */
export async function fechaDelPagoManual(
  db: SupabaseClient,
  ranchoId: string,
  meses: number,
  ahora: Date = new Date(),
): Promise<string | null> {
  if ((await hayCobroConTarjeta(db, ranchoId)) === true) return null;

  const { data } = await db
    .from("addons_negocio")
    .select("vence_en")
    .eq("rancho_id", ranchoId)
    .eq("addon", "lealtad")
    .maybeSingle();
  return finDelPagoManual(meses, (data?.vence_en as string | null | undefined) ?? null, ahora);
}
