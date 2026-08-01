import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agruparHorarioRecurso,
  type RecursoDisponibilidad,
} from "@/lib/agenda/disponibilidad";
import type {
  BloqueoPublico,
  HorariosPorMiembro,
  ServicioRecurso,
} from "./[slug]/reservar/reservar-cita";

/**
 * Los datos "pro" de la agenda (0061) que el motor de disponibilidad
 * necesita además del horario del negocio: el horario propio de cada
 * persona, los bloqueos vigentes (sin motivo — vista pública) y qué
 * recursos dan qué servicio. Lo cargan las dos puertas de la agenda
 * (la página del negocio y /reservar) para pasárselo a ReservarCita.
 */
export type AgendaPro = {
  horariosRecurso: HorariosPorMiembro;
  bloqueos: BloqueoPublico[];
  serviciosRecurso: ServicioRecurso[];
};

export async function cargarAgendaPro(
  supabase: SupabaseClient,
  ranchoId: string,
): Promise<AgendaPro> {
  const [{ data: horariosData }, { data: bloqueosData }, { data: asignacionesData }] =
    await Promise.all([
      supabase
        .from("horarios_recurso")
        .select("miembro_id, dow, abre, cierra, equipo_rancho!inner(rancho_id)")
        .eq("equipo_rancho.rancho_id", ranchoId),
      // Solo los bloqueos que todavía tocan el futuro: el motor recorta
      // por día, acá solo se acota la descarga.
      supabase
        .from("bloqueos_agenda_publicos")
        .select("miembro_id, inicio, fin")
        .eq("rancho_id", ranchoId)
        .gte("fin", new Date().toISOString()),
      supabase
        .from("servicios_recurso")
        .select("item_id, miembro_id, rancho_items!inner(rancho_id)")
        .eq("rancho_items.rancho_id", ranchoId),
    ]);

  // Filas → objeto por miembro, con la convención de herencia del
  // motor: claves solo para los días con filas (0081).
  const porMiembro = new Map<string, { dow: number; abre: string; cierra: string }[]>();
  for (const fila of (horariosData ?? []) as unknown as {
    miembro_id: string;
    dow: number;
    abre: string;
    cierra: string;
  }[]) {
    const lista = porMiembro.get(fila.miembro_id) ?? [];
    lista.push(fila);
    porMiembro.set(fila.miembro_id, lista);
  }
  const horariosRecurso: Record<string, RecursoDisponibilidad["horario"]> = {};
  for (const [miembroId, filas] of porMiembro) {
    horariosRecurso[miembroId] = agruparHorarioRecurso(filas);
  }

  return {
    horariosRecurso,
    bloqueos: (bloqueosData ?? []) as BloqueoPublico[],
    serviciosRecurso: ((asignacionesData ?? []) as unknown as ServicioRecurso[]).map(
      (a) => ({ item_id: a.item_id, miembro_id: a.miembro_id }),
    ),
  };
}
