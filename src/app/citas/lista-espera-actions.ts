"use server";

import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";

/**
 * Apuntarse a la lista de espera (0095) — el lado del cliente. Cuando
 * un día no tiene espacios, deja su nombre; si el negocio cancela o
 * mueve una cita de ese día, se le avisa por correo y push ("reserva
 * quien confirme primero"). Exige sesión, como crear_cita: sin cuenta
 * no hay a quién avisarle.
 */

const UUID_REGEX = /^[0-9a-f-]{36}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ListaEsperaInput = {
  ranchoId: string;
  fecha: string;
  itemId: string | null;
  miembroId: string | null;
  nombre: string;
  telefono: string;
  notas: string;
};

export async function apuntarseListaEspera(
  input: ListaEsperaInput,
): Promise<{ error?: string; listo?: boolean }> {
  if (!UUID_REGEX.test(input.ranchoId)) return { error: "Negocio inválido." };
  if (!FECHA_REGEX.test(input.fecha)) return { error: "Revisá la fecha." };
  if (input.fecha < hoyISOCR()) {
    return { error: "Esa fecha ya pasó — elegí una futura." };
  }
  if (input.itemId !== null && !UUID_REGEX.test(input.itemId)) {
    return { error: "Servicio inválido." };
  }
  if (input.miembroId !== null && !UUID_REGEX.test(input.miembroId)) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Iniciá sesión para apuntarte a la lista de espera." };
  }

  // El negocio tiene que ser un negocio de citas publicado, y el
  // servicio/miembro (si vienen) tienen que ser SUYOS — sin esto, una
  // fila armada a mano mezclaría ids de otros negocios y la lista del
  // dueño mostraría datos que no le pertenecen.
  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, vertical, estado")
    .eq("id", input.ranchoId)
    .maybeSingle();
  if (!rancho || rancho.vertical !== "citas" || rancho.estado !== "aprobado") {
    return { error: "Este negocio no está disponible para citas." };
  }
  if (input.itemId) {
    const { data: item } = await supabase
      .from("rancho_items")
      .select("id")
      .eq("id", input.itemId)
      .eq("rancho_id", input.ranchoId)
      .maybeSingle();
    if (!item) return { error: "Ese servicio no es de este negocio." };
  }
  if (input.miembroId) {
    const { data: miembro } = await supabase
      .from("equipo_rancho")
      .select("id")
      .eq("id", input.miembroId)
      .eq("rancho_id", input.ranchoId)
      .maybeSingle();
    if (!miembro) return { error: "Esa persona no atiende en este negocio." };
  }

  const fila = {
    rancho_id: input.ranchoId,
    cliente_id: user.id,
    item_id: input.itemId,
    miembro_id: input.miembroId,
    fecha: input.fecha,
    nombre: input.nombre.trim().slice(0, 120) || null,
    correo: user.email?.trim().toLowerCase() ?? null,
    telefono: input.telefono.trim().slice(0, 40) || null,
    notas: input.notas.trim().slice(0, 300) || null,
  };
  const { error } = await supabase.from("lista_espera").insert(fila);

  if (error) {
    if (error.code === "23505") {
      // Ya estaba en la lista de ese día. Si su turno anterior ya fue
      // avisado (y no alcanzó espacio), volver a apuntarse tiene que
      // funcionar: se rehace la fila para que el próximo aviso lo
      // incluya. Si no había sido avisado, no hay nada que corregir.
      const { data: previa } = await supabase
        .from("lista_espera")
        .select("id, avisado_en")
        .eq("rancho_id", input.ranchoId)
        .eq("fecha", input.fecha)
        .eq("cliente_id", user.id)
        .maybeSingle();
      if (previa?.avisado_en) {
        await supabase.from("lista_espera").delete().eq("id", previa.id);
        const { error: errorReinsert } = await supabase.from("lista_espera").insert(fila);
        if (errorReinsert) {
          return { error: "No se pudo guardar: " + errorReinsert.message };
        }
      }
      return { listo: true };
    }
    if (/lista_espera|schema cache|does not exist/i.test(error.message)) {
      return { error: "La lista de espera todavía no está habilitada — probá más tarde." };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  return { listo: true };
}
