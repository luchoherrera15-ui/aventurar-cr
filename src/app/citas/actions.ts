"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarCitaConfirmada } from "@/lib/notificaciones-cita";
import { leerCuentasDeCobro } from "@/lib/ranchos-publicos";

export type CrearCitaInput = {
  ranchoId: string;
  itemId: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  miembroId: string | null;
  nombre: string;
  telefono: string;
  notas: string;
};

/** La cuenta SINPE del negocio, para las instrucciones del depósito. */
export type SinpeDelNegocio = { numero: string | null; titular: string | null };

/**
 * Crea la cita llamando al RPC (que valida horario, resuelve el
 * profesional y confirma al instante) y dispara los avisos. La cita
 * nace confirmada — decisión de producto: sin aprobación manual.
 *
 * Los avisos (correo + push) viven en src/lib/notificaciones-cita.ts,
 * compartidos con /api/citas/[id]/confirmacion — el camino de la app
 * móvil, que llama al RPC directo porque no tiene servidor propio.
 *
 * Devuelve además el SINPE del negocio, que la pantalla muestra en la
 * confirmación ("aseguralo con tu depósito"). Viaja acá y no en las
 * props de la ficha porque esa ficha es pública: cualquier dato que le
 * pase a un componente `"use client"` queda escrito en el HTML, servido
 * a Googlebot y a cualquier anónimo (ver @/lib/ranchos-publicos). Acá
 * lo recibe únicamente quien acaba de agendar en ese negocio, con
 * sesión iniciada y con la cita a su nombre.
 */
export async function crearCita(
  input: CrearCitaInput,
): Promise<
  { error: string } | { error: null; reservaId: string; sinpe: SinpeDelNegocio }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión para reservar tu cita." };

  const { data, error } = await supabase.rpc("crear_cita", {
    p_rancho_id: input.ranchoId,
    p_item_id: input.itemId,
    p_fecha: input.fecha,
    p_hora: input.hora,
    p_miembro_id: input.miembroId,
    p_nombre: input.nombre,
    p_telefono: input.telefono,
    p_notas: input.notas,
  });

  if (error || !data) {
    // Los mensajes del RPC ya vienen en español y listos para mostrar.
    return { error: error?.message || "No se pudo crear la cita. Intentá de nuevo." };
  }

  const reservaId = data as string;
  // Los avisos nunca tumban una cita ya creada.
  try {
    await notificarCitaConfirmada(reservaId);
  } catch {
    // El aviso queda pendiente; la cita existe igual.
  }
  // Cliente de servicio: agendar una cita no pide cuenta, así que
  // `supabase` acá es el rol anónimo y desde la 0140 ese rol no lee las
  // columnas de cobro. Lo que habilita verlas no es el rol: es que la
  // cita ya quedó creada unas líneas más arriba.
  const cuentas = await leerCuentasDeCobro(
    createAdminClient() ?? supabase,
    input.ranchoId,
  );
  return {
    error: null,
    reservaId,
    sinpe: { numero: cuentas.sinpeNumero, titular: cuentas.sinpeTitular },
  };
}
