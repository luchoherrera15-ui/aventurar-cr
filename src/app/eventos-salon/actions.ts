"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { enviarCorreo, plantillaConfirmacionReserva } from "@/lib/email";
import type { HorarioBloque } from "./types";

const MINUTOS_HOLD = 10;

// Límites contra bots: cuántos intentos de reserva puede hacer una
// misma conexión en 10 minutos, y cuántas fechas puede tener
// tomadas al mismo tiempo. Sin esto, alguien podría escribirle
// directo al servidor (sin pasar por la página) y tomar todas las
// fechas disponibles para bloquear las reservas reales.
// Cambiar de fecha ahora libera la anterior, así que comparar varios
// días es normal y no debería toparse con el límite: por eso la ventana
// admite más intentos que antes. El tope real contra el acaparamiento
// sigue siendo MAX_HOLDS_ACTIVOS_POR_IP (más el índice único por fecha).
const MAX_INTENTOS_POR_VENTANA = 20;
const VENTANA_INTENTOS_MINUTOS = 10;
const MAX_HOLDS_ACTIVOS_POR_IP = 2;

async function obtenerIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "desconocida";
}

export async function crearReservaTemporal(ranchoId: string, fecha: string) {
  const supabase = await createClient();
  const ip = await obtenerIp();
  const nowIso = new Date().toISOString();
  const expiraEn = new Date(Date.now() + MINUTOS_HOLD * 60 * 1000).toISOString();

  const { data: puedeIntentar } = await supabase.rpc("registrar_intento_reserva", {
    p_ip: ip,
    p_max_intentos: MAX_INTENTOS_POR_VENTANA,
    p_ventana_minutos: VENTANA_INTENTOS_MINUTOS,
  });

  if (puedeIntentar === false) {
    return {
      id: null,
      expiraEn: null,
      error:
        "Hiciste demasiados intentos de reserva en poco tiempo. Esperá unos minutos e intentá de nuevo.",
    };
  }

  // Libera holds vencidos de esta fecha (de este rancho) antes de intentar tomarla.
  await supabase
    .from("reservas")
    .delete()
    .eq("rancho_id", ranchoId)
    .eq("fecha", fecha)
    .eq("estado", "temporal")
    .lt("expira_en", nowIso);

  // Elegir otro día de este mismo negocio reemplaza el bloqueo anterior
  // en vez de sumar uno. El cliente ya libera el suyo al cambiar de
  // fecha, pero si la pestaña se cerró de golpe (o se recargó) el hold
  // viejo sigue vivo hasta 10 minutos, y sin esto la persona se topaba
  // con "ya tenés una fecha reservada" por su propio hold huérfano.
  const { data: propios } = await supabase
    .from("reservas")
    .select("id")
    .eq("estado", "temporal")
    .eq("creado_por_ip", ip)
    .eq("rancho_id", ranchoId)
    .gt("expira_en", nowIso);

  for (const propio of propios ?? []) {
    await supabase.rpc("liberar_hold_temporal", { p_id: propio.id, p_ip: ip });
  }

  // Tope de fechas tomadas al mismo tiempo por la misma conexión —
  // evita que se "acaparen" fechas de varios negocios a la vez.
  const { count: activosPorIp } = await supabase
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("estado", "temporal")
    .eq("creado_por_ip", ip)
    .gt("expira_en", nowIso);

  if ((activosPorIp ?? 0) >= MAX_HOLDS_ACTIVOS_POR_IP) {
    return {
      id: null,
      expiraEn: null,
      error:
        "Tenés fechas bloqueadas en otros lugares. Completá esas reservas o esperá a que se liberen antes de elegir otra.",
    };
  }

  const { data, error } = await supabase
    .from("reservas")
    .insert({
      fecha,
      estado: "temporal",
      expira_en: expiraEn,
      origen: "web",
      rancho_id: ranchoId,
      creado_por_ip: ip,
    })
    .select("id, expira_en")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        id: null,
        expiraEn: null,
        error:
          "Justo ahora otra persona reservó temporalmente esta fecha. Esperá unos minutos o elegí otro día.",
      };
    }
    return { id: null, expiraEn: null, error: error.message };
  }
  return {
    id: data.id as string,
    expiraEn: data.expira_en as string,
    error: null,
  };
}

export async function cancelarReservaTemporal(id: string) {
  const supabase = await createClient();
  const ip = await obtenerIp();
  // Se libera por RPC porque la política de borrado solo permite
  // eliminar holds ya vencidos — un `delete` directo sobre un hold
  // todavía activo no borraba nada y la fecha quedaba tomada los
  // 10 minutos completos aunque la persona se hubiera ido a otra.
  // La función comprueba que el hold lo haya creado esta misma
  // conexión, así nadie puede soltar el de otra persona.
  await supabase.rpc("liberar_hold_temporal", { p_id: id, p_ip: ip });
}

export type CompletarReservaInput = {
  nombre: string;
  correo: string;
  whatsapp: string;
  cedula: string;
  tipo_evento: string;
  invitados: number;
  /** Solo para armar el correo de confirmación — no se guardan en la reserva. */
  fecha: string;
  nombre_rancho: string;
  horario_bloque: HorarioBloque | null;
  monto_total: number;
  deposito_monto: number;
  metodo_pago: "sinpe" | "transferencia";
  deposito_comprobante_url: string;
  terminos_aceptados: boolean;
  /** Aceptación aparte de los términos: que el evento no es de los que
   *  el negocio no alquila (serenatas, menores, fiestas clandestinas). */
  aviso_prohibiciones_aceptado: boolean;
  notas: string | null;
  codigo_descuento: string | null;
  descuento_monto: number;
};

const CEDULA_REGEX = /^[0-9-]{7,14}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_REGEX = /^[0-9+\s-]{8,16}$/;

export async function completarReservaTemporal(
  id: string,
  input: CompletarReservaInput,
) {
  if (!CEDULA_REGEX.test(input.cedula.trim())) {
    return { error: "El número de cédula no es válido." };
  }
  if (!CORREO_REGEX.test(input.correo.trim())) {
    return { error: "El correo electrónico no es válido." };
  }
  if (!WHATSAPP_REGEX.test(input.whatsapp.trim())) {
    return { error: "El número de WhatsApp no es válido." };
  }
  if (!input.aviso_prohibiciones_aceptado) {
    return { error: "Tenés que confirmar el aviso sobre el tipo de evento." };
  }

  const supabase = await createClient();

  // El límite de invitados en el formulario ya lo topa en capacidad_max,
  // pero eso es solo del lado del navegador — se vuelve a comprobar acá
  // por si alguien le escribe directo al servidor.
  const { data: hold } = await supabase
    .from("reservas")
    .select("rancho_id")
    .eq("id", id)
    .maybeSingle();
  if (hold?.rancho_id) {
    const { data: ranchoDatos } = await supabase
      .from("ranchos")
      .select("capacidad_max")
      .eq("id", hold.rancho_id)
      .maybeSingle();
    const capacidadMax = ranchoDatos?.capacidad_max;
    if (capacidadMax && input.invitados > capacidadMax) {
      return {
        error: `Este lugar recibe hasta ${capacidadMax} personas — no se puede reservar para más.`,
      };
    }
  }

  // Este paso pasa por una función security definer en vez de un
  // update directo: un visitante anónimo completando su propia
  // reserva es justo el caso donde la política de RLS es más
  // delicada de mantener bien en todos los proyectos, y es el mismo
  // patrón que ya usan liberar_hold_temporal y redimir_codigo_descuento
  // para esta misma fricción. La función solo escribe si la fila
  // sigue en 'temporal', así que no sirve para tocar una reserva ya
  // confirmada o rechazada.
  const { data: ranchoId, error } = await supabase.rpc(
    "completar_reserva_temporal",
    {
      p_id: id,
      p_nombre: input.nombre,
      p_correo: input.correo,
      p_whatsapp: input.whatsapp,
      p_cedula: input.cedula,
      p_tipo_evento: input.tipo_evento,
      p_invitados: input.invitados,
      p_horario_bloque: input.horario_bloque,
      p_monto_total: input.monto_total,
      p_deposito_monto: input.deposito_monto,
      p_metodo_pago: input.metodo_pago,
      p_deposito_comprobante_url: input.deposito_comprobante_url,
      p_terminos_aceptados: input.terminos_aceptados,
      p_aviso_prohibiciones_aceptado: input.aviso_prohibiciones_aceptado,
      p_notas: input.notas,
      p_codigo_descuento: input.codigo_descuento,
      p_descuento_monto: input.descuento_monto,
    },
  );

  if (error) return { error: error.message };
  if (!ranchoId) {
    return {
      error:
        "Esta reserva ya no está disponible (se venció el tiempo o ya se completó). Elegí la fecha de nuevo.",
    };
  }

  // El monto ya viene descontado desde el cliente (la vista previa del
  // código usa esta misma función de validación); acá solo se registra
  // el uso para que no se pueda reutilizar más veces de las permitidas.
  if (input.codigo_descuento) {
    await supabase.rpc("redimir_codigo_descuento", {
      p_rancho_id: ranchoId,
      p_codigo: input.codigo_descuento,
    });
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/mi-rancho", "layout");

  // El correo es un plus, no un requisito: si Resend falla o todavía
  // no está configurado, la reserva ya quedó guardada igual.
  await enviarCorreo({
    to: input.correo,
    subject: `Reserva recibida — ${input.nombre_rancho}`,
    html: plantillaConfirmacionReserva({
      nombreCliente: input.nombre,
      nombreRancho: input.nombre_rancho,
      fecha: input.fecha,
      montoDeposito: input.deposito_monto,
    }),
  });

  return { error: null };
}
