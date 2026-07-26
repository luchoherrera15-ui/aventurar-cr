"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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

  // Tope de fechas tomadas al mismo tiempo por la misma conexión —
  // evita que se "acaparen" todas las fechas del calendario.
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
        "Ya tenés una fecha reservada temporalmente. Completá esa reserva o esperá a que se libere antes de elegir otra.",
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
  contacto: string;
  cedula: string;
  tipo_evento: string;
  invitados: number;
  horario_bloque: HorarioBloque;
  monto_total: number;
  deposito_monto: number;
  metodo_pago: "sinpe" | "transferencia";
  deposito_comprobante_url: string;
  terminos_aceptados: boolean;
  notas: string | null;
  codigo_descuento: string | null;
  descuento_monto: number;
};

const CEDULA_REGEX = /^[0-9-]{7,14}$/;

export async function completarReservaTemporal(
  id: string,
  input: CompletarReservaInput,
) {
  if (!CEDULA_REGEX.test(input.cedula.trim())) {
    return { error: "El número de cédula no es válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservas")
    .update({ ...input, estado: "pendiente" })
    .eq("id", id)
    .eq("estado", "temporal");

  if (error) return { error: error.message };

  // El monto ya viene descontado desde el cliente (la vista previa del
  // código usa esta misma función de validación); acá solo se registra
  // el uso para que no se pueda reutilizar más veces de las permitidas.
  if (input.codigo_descuento) {
    const { data: reserva } = await supabase
      .from("reservas")
      .select("rancho_id")
      .eq("id", id)
      .maybeSingle();
    if (reserva) {
      await supabase.rpc("redimir_codigo_descuento", {
        p_rancho_id: reserva.rancho_id,
        p_codigo: input.codigo_descuento,
      });
    }
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/mi-rancho/reservas");
  return { error: null };
}
