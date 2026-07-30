import { createClient } from "@/lib/supabase/server";
import AgendaEventos, { type EventoAgenda } from "@/components/agenda-eventos";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { perteneceASeccion } from "../vertical";
import { seccionActiva } from "../vertical-server";

type ReservaAgenda = {
  id: string;
  fecha: string;
  nombre: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  estado: string;
  monto_total: number | null;
  horario_bloque: string | null;
  rancho_id: string;
};

/**
 * La agenda global: todos los eventos que vienen, de todos los
 * negocios, ordenados por fecha — el control operativo de la
 * plataforma. HOY y MAÑANA salen resaltados.
 */
export default async function AdminAgendaPage() {
  const supabase = await createClient();
  const seccion = await seccionActiva();
  const hoy = hoyISOCR();

  const [{ data, error }, ranchosRes] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, fecha, nombre, tipo_evento, invitados, estado, monto_total, horario_bloque, rancho_id")
      .gte("fecha", hoy)
      .in("estado", ["pendiente", "confirmada"])
      .order("fecha", { ascending: true }),
    supabase.from("ranchos").select("id, nombre, vertical"),
  ]);

  const nombrePorRancho = new Map(
    (ranchosRes.data ?? []).map((r) => [r.id as string, r.nombre as string]),
  );
  const verticalPorRancho = new Map(
    (ranchosRes.data ?? []).map((r) => [r.id as string, r.vertical as string | null]),
  );

  const eventos: EventoAgenda[] = ((data ?? []) as ReservaAgenda[])
    .filter((r) => perteneceASeccion(verticalPorRancho.get(r.rancho_id), seccion))
    .map((r) => ({
    id: r.id,
    fecha: r.fecha,
    nombre: r.nombre,
    tipo_evento: r.tipo_evento,
    invitados: r.invitados,
    estado: r.estado,
    monto_total: r.monto_total,
    horario_bloque: r.horario_bloque,
    ranchoNombre: nombrePorRancho.get(r.rancho_id) ?? null,
  }));

  const manana = sumarDiasISO(hoy, 1);
  const deHoy = eventos.filter((e) => e.fecha === hoy).length;
  const deManana = eventos.filter((e) => e.fecha === manana).length;

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Agenda</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
        {eventos.length} evento{eventos.length === 1 ? "" : "s"} próximo
        {eventos.length === 1 ? "" : "s"}
        {deHoy > 0 && ` · ${deHoy} hoy`}
        {deManana > 0 && ` · ${deManana} mañana`}. Un día antes de cada
        evento, el sistema avisa por correo al cliente y al proveedor.
      </p>

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar la agenda: {error.message}
        </p>
      )}

      <AgendaEventos eventos={eventos} />
    </div>
  );
}
