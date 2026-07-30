import { createAdminClient } from "@/lib/supabase/admin";

/**
 * El feed .ics de la agenda completa de un negocio: el dueño lo
 * suscribe una vez en Google Calendar ("Otros calendarios → Desde
 * URL") o Apple Calendar ("Añadir suscripción") y su agenda de Bookea
 * aparece — y se refresca sola — junto a su calendario de siempre.
 *
 * El token es un UUID inadivinable que vive en `calendario_tokens`
 * (0071), NUNCA en `ranchos` (tabla pública). Sale todo lo agendado:
 * citas con su hora, eventos de día completo, alquileres multi-día y
 * los bloqueos del propio dueño. Costa Rica no tiene horario de
 * verano: la conversión a UTC es un +6 fijo.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADO_FEED = ["pendiente", "confirmada", "cumplida", "bloqueada"];

/** Cuántos días hacia atrás viaja el feed (el futuro va completo). */
const DIAS_PASADOS = 60;

function escaparIcs(texto: string) {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function compactaUtc(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

function fechaCompacta(iso: string) {
  return iso.replace(/-/g, "");
}

/** El día siguiente en ISO (los DTEND de día completo son exclusivos). */
function diaSiguiente(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type FilaFeed = {
  id: string;
  fecha: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  duracion_minutos: number | null;
  duracion_horas: number | null;
  horario_bloque: string | null;
  nombre: string;
  tipo_evento: string | null;
  estado: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!UUID_REGEX.test(token)) {
    return new Response("Calendario no encontrado", { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) return new Response("No disponible", { status: 500 });

  const { data: fila } = await admin
    .from("calendario_tokens")
    .select("rancho_id, ranchos(nombre)")
    .eq("token", token)
    .maybeSingle();
  if (!fila) return new Response("Calendario no encontrado", { status: 404 });

  const { rancho_id: ranchoId, ranchos } = fila as unknown as {
    rancho_id: string;
    ranchos: { nombre: string } | null;
  };
  const negocio = ranchos?.nombre ?? "Bookea";

  const desde = new Date(Date.now() - DIAS_PASADOS * 86400_000)
    .toISOString()
    .slice(0, 10);
  const { data: reservasData } = await admin
    .from("reservas")
    .select(
      "id, fecha, fecha_fin, hora_inicio, duracion_minutos, duracion_horas, horario_bloque, nombre, tipo_evento, estado",
    )
    .eq("rancho_id", ranchoId)
    .in("estado", ESTADO_FEED)
    // Lo importado de SU calendario (origen sync) no se re-exporta:
    // ya vive allá — devolvérselo lo duplicaría en su pantalla.
    .neq("origen", "sync")
    .gte("fecha", desde)
    .order("fecha", { ascending: true });

  const eventos = ((reservasData ?? []) as FilaFeed[]).map((r) => {
    const esBloqueo = r.estado === "bloqueada";
    const titulo = esBloqueo
      ? `Bloqueado — ${r.nombre || "sin detalle"}`
      : [r.tipo_evento || "Reserva", r.nombre].filter(Boolean).join(" — ");

    let dtInicio: string;
    let dtFin: string;
    if (r.hora_inicio) {
      // Cita o servicio con hora: evento con horas reales.
      const inicio = new Date(`${r.fecha}T${r.hora_inicio.slice(0, 5)}:00-06:00`);
      const minutos =
        r.duracion_minutos ??
        (r.duracion_horas ? Math.round(Number(r.duracion_horas) * 60) : 60);
      const fin = new Date(inicio.getTime() + minutos * 60_000);
      dtInicio = `DTSTART:${compactaUtc(inicio)}`;
      dtFin = `DTEND:${compactaUtc(fin)}`;
    } else {
      // Evento de día completo (o varios días si hay fecha_fin).
      dtInicio = `DTSTART;VALUE=DATE:${fechaCompacta(r.fecha)}`;
      dtFin = `DTEND;VALUE=DATE:${fechaCompacta(diaSiguiente(r.fecha_fin ?? r.fecha))}`;
    }

    return [
      "BEGIN:VEVENT",
      `UID:${r.id}@bookea.lat`,
      `DTSTAMP:${compactaUtc(new Date())}`,
      dtInicio,
      dtFin,
      `SUMMARY:${escaparIcs(titulo)}`,
      r.horario_bloque ? `DESCRIPTION:${escaparIcs(`Bloque: ${r.horario_bloque}`)}` : null,
      r.estado === "pendiente" ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookea//Agenda//ES",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparIcs(`${negocio} — Bookea`)}`,
    "X-WR-TIMEZONE:America/Costa_Rica",
    // Sugerencia de refresco para los clientes de calendario que la
    // respetan (Google refresca a su propio ritmo igual).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...eventos,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
