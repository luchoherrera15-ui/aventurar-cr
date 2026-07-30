import { createAdminClient } from "@/lib/supabase/admin";

/**
 * El archivo .ics de una reserva: Apple Calendar y Outlook lo abren
 * directo desde el enlace del correo ("guardar en mi calendario").
 * El id de la reserva es un UUID inadivinable — misma postura que los
 * endpoints de avisos — y el contenido es lo mismo que ya dice el
 * correo donde viaja el enlace. Costa Rica no tiene horario de
 * verano: la conversión a UTC es un +6 fijo.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escapa los caracteres especiales del formato iCalendar. */
function escaparIcs(texto: string) {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function compactaUtc(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return new Response("Reserva no encontrada", { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) return new Response("No disponible", { status: 500 });

  const { data } = await admin
    .from("reservas")
    .select(
      "id, fecha, hora_inicio, duracion_minutos, tipo_evento, estado, ranchos(nombre, direccion_exacta, canton, provincia)",
    )
    .eq("id", id)
    .in("estado", ["pendiente", "confirmada"])
    .maybeSingle();
  if (!data) return new Response("Reserva no encontrada", { status: 404 });

  const r = data as unknown as {
    id: string;
    fecha: string;
    hora_inicio: string | null;
    duracion_minutos: number | null;
    tipo_evento: string | null;
    ranchos: {
      nombre: string;
      direccion_exacta: string | null;
      canton: string | null;
      provincia: string | null;
    } | null;
  };

  const negocio = r.ranchos?.nombre ?? "Bookea";
  const esCita = r.hora_inicio !== null;
  const titulo = esCita
    ? `${r.tipo_evento ?? "Cita"} — ${negocio}`
    : `${r.tipo_evento ?? "Evento"} en ${negocio}`;
  const ubicacion = [
    r.ranchos?.direccion_exacta,
    r.ranchos?.canton,
    r.ranchos?.provincia,
  ]
    .filter(Boolean)
    .join(", ");

  let dtInicio: string;
  let dtFin: string;
  if (esCita) {
    const inicio = new Date(`${r.fecha}T${r.hora_inicio!.slice(0, 5)}:00-06:00`);
    const fin = new Date(inicio.getTime() + (r.duracion_minutos ?? 30) * 60_000);
    dtInicio = `DTSTART:${compactaUtc(inicio)}`;
    dtFin = `DTEND:${compactaUtc(fin)}`;
  } else {
    const siguiente = new Date(`${r.fecha}T00:00:00Z`);
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    dtInicio = `DTSTART;VALUE=DATE:${r.fecha.replace(/-/g, "")}`;
    dtFin = `DTEND;VALUE=DATE:${siguiente.toISOString().slice(0, 10).replace(/-/g, "")}`;
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookea//Reservas//ES",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${r.id}@bookea.lat`,
    `DTSTAMP:${compactaUtc(new Date())}`,
    dtInicio,
    dtFin,
    `SUMMARY:${escaparIcs(titulo)}`,
    ubicacion ? `LOCATION:${escaparIcs(ubicacion)}` : null,
    "DESCRIPTION:Reservado en Bookea — el comprobante está en tu correo.",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bookea-reserva.ics"',
    },
  });
}
