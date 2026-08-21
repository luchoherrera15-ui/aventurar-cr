"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";
import { armarNotasManual } from "./tipos";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  RESERVAS — acciones propias de la pantalla del panel
 * ═══════════════════════════════════════════════════════════════════
 *
 * Solo lo que las actions existentes NO cubren: anotar una reserva a
 * mano y cancelar desde el lado del negocio. El check-in y el no-show
 * ya viven en ../panel-actions.ts y la pantalla los importa de ahí —
 * duplicarlos acá sería tener dos versiones del mismo update.
 *
 * Mismo patrón de confianza que reservarFood() y cancelarReservaFood()
 * (src/app/food/reserva/actions.ts): el navegador nunca decide nada
 * sensible; este servidor verifica la sesión y la pertenencia
 * (verificarAccesoNegocioFood) y recién entonces invoca los RPC de
 * cupo con service_role. Los RPC son los ÚNICOS que tocan
 * food_franjas.reservado — acá no se suma ni resta cupo a mano jamás.
 */

export type EstadoNuevaReserva = {
  error: string | null;
  ok?: boolean;
  /** El código de confirmación que generó crear_reserva_food(). */
  codigo?: string;
};

/**
 * ANOTAR UNA RESERVA A MANO — la que entra por teléfono o en la barra.
 *
 * Pasa por crear_reserva_food() (0190/0191) igual que una reserva
 * online: mismo candado transaccional sobre la franja, mismo control
 * de cupo/vigencia y mismo código de confirmación. Reimplementar el
 * insert acá abriría la puerta a sobrevender una franja que el RPC
 * protege. `p_customer_id` es el usuario del PANEL (el dueño): la
 * tabla exige un customer_id no-nulo y el comensal de teléfono no
 * tiene cuenta — su nombre y teléfono van serializados en `notas`
 * (armarNotasManual, ./tipos.ts), que es cómo la pantalla después lo
 * distingue de una reserva online.
 */
export async function crearReservaManual(
  negocioId: string,
  _previo: EstadoNuevaReserva,
  formData: FormData,
): Promise<EstadoNuevaReserva> {
  const { user, ok } = await verificarAccesoNegocioFood(negocioId);
  if (!user) return { error: "Iniciá sesión." };
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const franjaId = String(formData.get("franja_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const nota = String(formData.get("nota") ?? "").trim();
  const personas = Number(formData.get("personas") ?? 0);

  if (!franjaId) return { error: "Elegí la fecha y la hora de la reserva." };
  if (!nombre) return { error: "Escribí a nombre de quién es la reserva." };
  if (!Number.isInteger(personas) || personas < 1 || personas > 30) {
    return { error: "La cantidad de personas tiene que estar entre 1 y 30." };
  }

  // La franja tiene que ser DE ESTE negocio: sin este check, un id de
  // franja ajeno pegado en el DOM anotaría la reserva en el
  // restaurante equivocado. Se lee con la sesión del dueño (la RLS ya
  // le muestra solo lo suyo), no con service_role.
  const supabase = await createClient();
  const { data: franja, error: errFranja } = await supabase
    .from("food_franjas")
    .select("id, business_id")
    .eq("id", franjaId)
    .maybeSingle();
  if (errFranja) return { error: "No se pudo validar la franja: " + errFranja.message };
  if (!franja || franja.business_id !== negocioId) {
    return { error: "Esa franja no corresponde a tu negocio." };
  }

  const db = createAdminClient();
  if (!db) return { error: "No hay conexión de servicio." };

  const { data, error } = await db.rpc("crear_reserva_food", {
    p_franja_id: franjaId,
    p_customer_id: user.id,
    p_party_size: personas,
  });
  if (error) return { error: "No se pudo registrar: " + error.message };

  const r = data as { ok: boolean; reserva_id?: string; codigo?: string; motivo?: string };
  if (!r.ok || !r.reserva_id) return { error: r.motivo ?? "No se pudo registrar la reserva." };

  // Las notas van en un segundo paso porque el RPC no las recibe (y no
  // se modifica un RPC en producción por un campo de texto). Si este
  // update fallara, la reserva IGUAL quedó bien creada — solo se
  // avisa, no se revierte un cupo ya tomado por un texto que faltó.
  const { error: errNotas } = await db
    .from("food_reservations")
    .update({ notas: armarNotasManual(nombre, telefono, nota) })
    .eq("id", r.reserva_id);
  if (errNotas) {
    console.error("[food/reservas] reserva creada pero sin notas:", errNotas.message);
  }

  revalidatePath("/food/negocio/reservas");
  revalidatePath("/food/negocio");
  revalidatePath("/food/negocio/franjas");

  return { error: null, ok: true, codigo: r.codigo };
}

export type ResultadoCancelacion = { ok: true } | { ok: false; error: string };

/**
 * CANCELAR DESDE EL NEGOCIO.
 *
 * A diferencia del no-show (que a propósito NO devuelve cupo, ver
 * marcarNoShow en ../panel-actions.ts), cancelar SÍ libera la franja:
 * el restaurante avisó a tiempo y esos lugares pueden venderse de
 * nuevo. Por eso no es un update de `estado` a secas sino el RPC
 * cancelar_reserva_food() (0191), que descuenta `reservado` bajo el
 * mismo candado con el que se reserva.
 *
 * El RPC exige el customer_id del DUEÑO DE LA RESERVA (está pensado
 * para "cancelo lo mío"). Acá quien cancela es el negocio, así que
 * este servidor primero verifica que la reserva pertenezca al negocio
 * del usuario en sesión y entonces invoca el RPC con el customer_id
 * de la fila — exactamente el reparto de responsabilidades que
 * documenta la 0191: "el servidor confirma p_customer_id ANTES de
 * invocar; el navegador nunca decide de quién es la reserva".
 */
export async function cancelarReservaDelNegocio(
  negocioId: string,
  reservaId: string,
): Promise<ResultadoCancelacion> {
  const { user, ok } = await verificarAccesoNegocioFood(negocioId);
  if (!user) return { ok: false, error: "Iniciá sesión." };
  if (!ok) return { ok: false, error: "No tenés permiso sobre este negocio." };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "No hay conexión de servicio." };

  const { data: reserva, error: errBuscar } = await db
    .from("food_reservations")
    .select("id, business_id, customer_id, estado")
    .eq("id", reservaId)
    .maybeSingle();
  if (errBuscar) return { ok: false, error: "No se pudo buscar la reserva: " + errBuscar.message };
  if (!reserva || reserva.business_id !== negocioId) {
    return { ok: false, error: "Esa reserva no corresponde a tu negocio." };
  }
  if (reserva.estado !== "confirmada") {
    return { ok: false, error: `Esa reserva ya está ${reserva.estado}.` };
  }

  const { data, error } = await db.rpc("cancelar_reserva_food", {
    p_reserva_id: reservaId,
    p_customer_id: reserva.customer_id,
  });
  if (error) return { ok: false, error: "No se pudo cancelar: " + error.message };

  const r = data as { ok: boolean; motivo?: string };
  if (!r.ok) return { ok: false, error: r.motivo ?? "No se pudo cancelar." };

  revalidatePath("/food/negocio/reservas");
  revalidatePath("/food/negocio");
  revalidatePath("/food/negocio/franjas");

  return { ok: true };
}
