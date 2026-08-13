"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarReservaCompletada } from "@/lib/notificaciones-reserva";
import { leerCuentasDeCobro, SIN_CUENTAS } from "@/lib/ranchos-publicos";
import type { HorarioBloque } from "./tipos-lugar";

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

/**
 * Toma una fecha por 10 minutos y, si sale, devuelve JUNTO con el hold
 * los datos de cobro del negocio.
 *
 * Que vengan de acá y no de la página es lo que cierra la fuga: la
 * ficha de un lugar es pública y cualquier dato que le pase al
 * calendario (que es `"use client"`) queda escrito en el HTML, a la
 * vista de Googlebot y de cualquier anónimo con un `curl`. En cambio
 * esta respuesta solo la recibe quien acaba de tomar una fecha de ESTE
 * negocio: tiene el hold a su nombre, verificado por IP, y los topes de
 * acá arriba (2 fechas tomadas a la vez, 20 intentos cada 10 minutos)
 * hacen que raspar las cuentas de todos los proveedores deje de ser
 * gratis. No alcanza con tener cuenta — hay que estar reservando.
 *
 * Las cuentas se piden en paralelo con los controles anti-bot: si el
 * hold sale, ya están listas y el paso "Cómo pagar" no espera otro
 * viaje a la base.
 */
export async function crearReservaTemporal(ranchoId: string, fecha: string) {
  const supabase = await createClient();
  // Con el cliente de servicio a propósito: acá se reserva SIN cuenta
  // (se crea en silencio al completar), así que el `supabase` de esta
  // acción es el rol anónimo — y desde la 0140 ese rol ya no puede leer
  // las cuentas de cobro. Sin esto, el paso "Cómo pagar" se quedaba sin
  // ningún método y nadie podía depositar. El permiso acá no lo da el
  // rol sino el hold: la persona acaba de tomar esta fecha, con tope de
  // intentos por IP.
  const cuentasPromesa = leerCuentasDeCobro(createAdminClient() ?? supabase, ranchoId);
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
      cuentas: SIN_CUENTAS,
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
      cuentas: SIN_CUENTAS,
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
        cuentas: SIN_CUENTAS,
        error:
          "Justo ahora otra persona reservó temporalmente esta fecha. Esperá unos minutos o elegí otro día.",
      };
    }
    return { id: null, expiraEn: null, cuentas: SIN_CUENTAS, error: error.message };
  }
  return {
    id: data.id as string,
    expiraEn: data.expira_en as string,
    cuentas: await cuentasPromesa,
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

  // Quien reserva sin sesión iniciada queda con cuenta creada en
  // silencio (sin contraseña, como el resto del sitio): si después
  // quiere entrar, le mandamos el código de acceso a este mismo correo
  // y ya ve esta reserva en "Mis reservas".
  const correoLimpio = input.correo.trim().toLowerCase();
  const { data: yaTieneCuenta } = await supabase.rpc("existe_cuenta", {
    p_email: correoLimpio,
  });
  if (!yaTieneCuenta) {
    const admin = createAdminClient();
    if (admin) {
      const { data: cuentaCreada, error: errorCuenta } = await admin.auth.admin.createUser({
        email: correoLimpio,
        email_confirm: true,
        user_metadata: { nombre: input.nombre, rol: "cliente" },
      });
      if (!errorCuenta && cuentaCreada.user) {
        // Con el cliente admin a propósito: el visitante es anónimo y
        // la RLS de reservas (solo dueño/admin editan) haría que este
        // update afecte 0 filas sin error — la cuenta quedaría creada
        // pero jamás vinculada a su reserva.
        await admin
          .from("reservas")
          .update({ cliente_id: cuentaCreada.user.id })
          .eq("id", id);
      }
    }
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/mi-negocio", "layout");

  // Los dos correos (confirmación al cliente + aviso al dueño) salen
  // del mismo helper que usa la app móvil, para no tener la lógica de
  // "a quién se le avisa" duplicada en dos lados. Los montos y los
  // invitados que van en el correo los lee de la reserva ya guardada.
  // Nunca lanza: el correo es un plus, no un requisito — si Resend
  // falla o todavía no está configurado, la reserva ya quedó guardada.
  await notificarReservaCompletada(id);

  return { error: null };
}
