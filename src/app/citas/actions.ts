"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enviarCorreo,
  plantillaCitaConfirmada,
  plantillaCitaNuevaProveedor,
} from "@/lib/email";
import { horaBonita } from "./tipos";

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

/**
 * Crea la cita llamando al RPC (que valida horario, resuelve el
 * profesional y confirma al instante) y dispara los correos. La cita
 * nace confirmada — decisión de producto: sin aprobación manual.
 */
export async function crearCita(
  input: CrearCitaInput,
): Promise<{ error: string } | { error: null; reservaId: string }> {
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
  // Los correos nunca tumban una cita ya creada.
  try {
    await notificarCita(reservaId);
  } catch {
    // El aviso queda pendiente; la cita existe igual.
  }
  return { error: null, reservaId };
}

/**
 * Correos de la cita: al cliente ("tu cita quedó confirmada") y al
 * negocio ("tenés una cita nueva"). Reclama la bandera
 * confirmacion_enviada DENTRO del update — una sola vez por cita,
 * mismo patrón que las reservas de eventos.
 */
async function notificarCita(reservaId: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { data } = await admin
    .from("reservas")
    .update({ confirmacion_enviada: true })
    .eq("id", reservaId)
    .eq("confirmacion_enviada", false)
    .not("hora_inicio", "is", null)
    .select(
      "id, nombre, correo, fecha, hora_inicio, duracion_minutos, tipo_evento, monto_total, miembro_id, ranchos(nombre, owner_id)",
    )
    .maybeSingle();
  if (!data) return;

  const r = data as unknown as {
    id: string;
    nombre: string | null;
    correo: string | null;
    fecha: string;
    hora_inicio: string;
    duracion_minutos: number | null;
    tipo_evento: string | null;
    monto_total: number | null;
    miembro_id: string | null;
    ranchos: { nombre: string; owner_id: string } | null;
  };

  const nombreNegocio = r.ranchos?.nombre ?? "el negocio";
  const hora = horaBonita(r.hora_inicio.slice(0, 5));
  const [y, m, d] = r.fecha.split("-").map(Number);
  const fechaLarga = new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let nombreMiembro: string | null = null;
  if (r.miembro_id) {
    const { data: miembro } = await admin
      .from("equipo_rancho")
      .select("nombre")
      .eq("id", r.miembro_id)
      .maybeSingle();
    nombreMiembro = miembro?.nombre ?? null;
  }

  if (r.correo) {
    await enviarCorreo({
      to: r.correo,
      subject: `Tu cita en ${nombreNegocio} quedó confirmada`,
      html: plantillaCitaConfirmada({
        nombreCliente: r.nombre || r.correo,
        nombreNegocio,
        servicio: r.tipo_evento ?? "tu servicio",
        fechaLarga,
        hora,
        duracionMinutos: r.duracion_minutos ?? 30,
        monto: r.monto_total,
        nombreMiembro,
        reservaId: r.id,
      }),
    });
  }

  if (r.ranchos?.owner_id) {
    const { data: perfil } = await admin
      .from("perfiles")
      .select("nombre, email")
      .eq("id", r.ranchos.owner_id)
      .maybeSingle();
    if (perfil?.email) {
      await enviarCorreo({
        to: perfil.email,
        subject: `Cita nueva en ${nombreNegocio}: ${fechaLarga}, ${hora}`,
        html: plantillaCitaNuevaProveedor({
          nombreProveedor: perfil.nombre || perfil.email,
          nombreNegocio,
          nombreCliente: r.nombre || "Un cliente",
          servicio: r.tipo_evento ?? "un servicio",
          fechaLarga,
          hora,
          nombreMiembro,
        }),
      });
    }
  }
}
