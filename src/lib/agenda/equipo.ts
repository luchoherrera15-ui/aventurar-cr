import type { SupabaseClient } from "@supabase/supabase-js";
import { RANGO_LIBRE } from "@/app/citas/tipos";

/**
 * El núcleo de la configuración por miembro del equipo (horario propio
 * y servicios que da), compartido entre la server action del panel web
 * y el endpoint /api/citas/equipo que usa la app móvil. Recibe un
 * cliente de Supabase YA autenticado como el dueño (cookies o bearer):
 * la autorización la hace quien llama; la RLS es la red de fondo.
 */

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_REGEX = /^[0-9a-f-]{36}$/i;

export type RangoHorarioMiembroCore = { dow: number; abre: string; cierra: string };

/**
 * Guarda el horario propio de una persona del equipo. La semántica es
 * la del motor (0081): los días CON filas sustituyen al horario del
 * negocio; `null` borra todo y la persona vuelve a heredar completo.
 * `diasLibres` marca los días en que la persona no trabaja — se
 * guardan con el rango centinela (RANGO_LIBRE) para que NO hereden.
 */
export async function guardarHorarioMiembroCore(
  supabase: SupabaseClient,
  ranchoId: string,
  miembroId: string,
  rangos: RangoHorarioMiembroCore[] | null,
  diasLibres: number[] = [],
): Promise<{ error?: string }> {
  if (!UUID_REGEX.test(miembroId)) return { error: "Miembro inválido." };
  if (rangos !== null) {
    if (!Array.isArray(rangos) || rangos.length > 28) {
      return { error: "Demasiados rangos de horario." };
    }
    for (const r of rangos) {
      if (!Number.isInteger(r.dow) || r.dow < 0 || r.dow > 6) {
        return { error: "Día de la semana inválido." };
      }
      if (!HORA_REGEX.test(r.abre) || !HORA_REGEX.test(r.cierra)) {
        return { error: "Revisá las horas: alguna quedó incompleta." };
      }
      if (r.abre >= r.cierra) {
        return { error: "La hora de cierre tiene que ser después de la de apertura." };
      }
    }
    if (!Array.isArray(diasLibres)) return { error: "Días libres inválidos." };
    // Deduplicado y con tope duro: hay 7 días — cualquier lista más
    // grande es un body malicioso, no un horario.
    diasLibres = [...new Set(diasLibres)];
    if (diasLibres.length > 7) return { error: "Días libres inválidos." };
    for (const dow of diasLibres) {
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return { error: "Día de la semana inválido." };
      }
      if (rangos.some((r) => r.dow === dow)) {
        return { error: "Un día no puede ser libre y tener horario a la vez." };
      }
    }
  }

  // El miembro tiene que ser de este negocio (la RLS igual lo exige,
  // pero así el error es claro y no se borra nada por accidente).
  const { data: miembro } = await supabase
    .from("equipo_rancho")
    .select("id")
    .eq("id", miembroId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!miembro) return { error: "Esa persona no está en tu equipo." };

  // Delete + insert no son una transacción en PostgREST: se guarda una
  // copia de lo que había para restaurarla si el insert nuevo falla —
  // sin eso, un fallo a mitad dejaría a la persona "heredando" el
  // horario del negocio (disponible cuando no debería).
  const { data: filasViejas } = await supabase
    .from("horarios_recurso")
    .select("miembro_id, dow, abre, cierra")
    .eq("miembro_id", miembroId);

  const { error: errorBorrado } = await supabase
    .from("horarios_recurso")
    .delete()
    .eq("miembro_id", miembroId);
  if (errorBorrado) {
    return { error: "No se pudo guardar el horario: " + errorBorrado.message };
  }

  if (rangos !== null) {
    const filas = [
      ...rangos.map((r) => ({
        miembro_id: miembroId,
        dow: r.dow,
        abre: r.abre,
        cierra: r.cierra,
      })),
      ...diasLibres.map((dow) => ({
        miembro_id: miembroId,
        dow,
        abre: RANGO_LIBRE.abre,
        cierra: RANGO_LIBRE.cierra,
      })),
    ];
    if (filas.length > 0) {
      const { error } = await supabase.from("horarios_recurso").insert(filas);
      if (error) {
        // Mejor esfuerzo: devolver el horario anterior antes de avisar.
        if (filasViejas && filasViejas.length > 0) {
          await supabase.from("horarios_recurso").insert(filasViejas);
        }
        return { error: "No se pudo guardar el horario: " + error.message };
      }
    }
  }

  return {};
}

/**
 * Define qué servicios da una persona. La tabla funciona por servicio
 * ("este servicio lo dan estas personas"; sin filas = lo dan todas),
 * así que al desmarcar un servicio que hoy es "de todos" (o del que
 * esta persona es la única asignada) hay que materializar la lista con
 * el resto del equipo.
 */
export async function guardarServiciosMiembroCore(
  supabase: SupabaseClient,
  ranchoId: string,
  miembroId: string,
  itemIdsQueDa: string[],
): Promise<{ error?: string; advertencia?: string }> {
  if (!UUID_REGEX.test(miembroId)) return { error: "Miembro inválido." };
  if (!Array.isArray(itemIdsQueDa) || itemIdsQueDa.length > 500) {
    return { error: "Servicios inválidos." };
  }
  if (itemIdsQueDa.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) {
    return { error: "Servicio inválido." };
  }

  const [{ data: miembro }, { data: items }, { data: equipo }] = await Promise.all([
    supabase
      .from("equipo_rancho")
      .select("id")
      .eq("id", miembroId)
      .eq("rancho_id", ranchoId)
      .maybeSingle(),
    // Solo los servicios de cita ACTIVOS (con duración en minutos)
    // participan — es lo mismo que muestra el panel; tocar filas de un
    // servicio pausado que la UI no enseña dejaría restricciones
    // invisibles.
    supabase
      .from("rancho_items")
      .select("id")
      .eq("rancho_id", ranchoId)
      .eq("activo", true)
      .not("duracion_minutos", "is", null),
    supabase.from("equipo_rancho").select("id, activo").eq("rancho_id", ranchoId),
  ]);
  if (!miembro) return { error: "Esa persona no está en tu equipo." };

  const idsServicios = (items ?? []).map((i) => i.id as string);
  const da = new Set(itemIdsQueDa.filter((id) => idsServicios.includes(id)));

  const { data: filas, error: errorFilas } = await supabase
    .from("servicios_recurso")
    .select("item_id, miembro_id")
    .in(
      "item_id",
      idsServicios.length > 0 ? idsServicios : ["00000000-0000-0000-0000-000000000000"],
    );
  if (errorFilas) {
    return { error: "No se pudo leer la asignación: " + errorFilas.message };
  }

  const porItem = new Map<string, Set<string>>();
  for (const f of filas ?? []) {
    const set = porItem.get(f.item_id) ?? new Set<string>();
    set.add(f.miembro_id);
    porItem.set(f.item_id, set);
  }

  // TODOS los demás miembros, pausados incluidos: la restricción
  // materializada debe sobrevivir a que alguien se pause y se
  // reactive (mientras está pausado el motor igual no lo ofrece).
  const otros = (equipo ?? [])
    .filter((m) => m.id !== miembroId)
    .map((m) => m.id as string);

  const insertar: { item_id: string; miembro_id: string }[] = [];
  const borrar: { item_id: string; miembro_id: string }[] = [];
  let sinNadie = false;

  for (const itemId of idsServicios) {
    const asignados = porItem.get(itemId);
    const restringido = !!asignados && asignados.size > 0;
    const laDa = da.has(itemId);

    if (laDa) {
      // Con restricción vigente hay que sumarlo; sin restricción ya
      // está incluido en "todos".
      if (restringido && !asignados!.has(miembroId)) {
        insertar.push({ item_id: itemId, miembro_id: miembroId });
      }
    } else if (restringido) {
      if (asignados!.has(miembroId)) {
        // Si era el ÚNICO asignado, borrar su fila dejaría el
        // servicio sin filas = "lo dan todos" — justo lo contrario de
        // lo que pidió. Se materializa el resto antes de quitarlo.
        if (asignados!.size === 1) {
          if (otros.length === 0) {
            sinNadie = true;
            continue;
          }
          for (const otro of otros) {
            insertar.push({ item_id: itemId, miembro_id: otro });
          }
        }
        borrar.push({ item_id: itemId, miembro_id: miembroId });
      }
    } else {
      // El servicio era "de todos": para excluir a esta persona se
      // materializa la lista con el resto del equipo.
      if (otros.length === 0) {
        sinNadie = true;
        continue;
      }
      for (const otro of otros) {
        insertar.push({ item_id: itemId, miembro_id: otro });
      }
    }
  }

  if (insertar.length > 0) {
    const { error } = await supabase
      .from("servicios_recurso")
      .upsert(insertar, { onConflict: "item_id,miembro_id", ignoreDuplicates: true });
    if (error) return { error: "No se pudo guardar: " + error.message };
  }
  for (const b of borrar) {
    const { error } = await supabase
      .from("servicios_recurso")
      .delete()
      .eq("item_id", b.item_id)
      .eq("miembro_id", b.miembro_id);
    if (error) return { error: "No se pudo guardar: " + error.message };
  }

  return sinNadie
    ? {
        advertencia:
          "No hay nadie más en el equipo: un servicio sin nadie que lo dé no se puede representar. Si querés dejar de ofrecerlo, pausalo en el catálogo.",
      }
    : {};
}
