"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";

/**
 * EL LINK DIRECTO DE LA CAJA (0206) — prender o apagar la búsqueda a
 * mano en `bookea.lat/<negocio>/scan`.
 *
 * Es una decisión de CONFIGURACIÓN, no de operación: como el póster
 * (`poster-actions.ts`), la maneja el dueño (o un admin de plataforma) y
 * no un colaborador con permiso de acreditar — un empleado con solo ese
 * permiso puede USAR el link, no decidir qué deja hacer.
 *
 * La escritura va con la SESIÓN del usuario, no con la llave de
 * servicio: la RLS de `programa_lealtad` ya sabe que edita el dueño, y
 * el guard de acá solo da un mensaje decente antes de intentarlo.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function guardarPermiteManualEnLink(
  ranchoId: string,
  programaId: string,
  permitir: boolean,
): Promise<Resultado> {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { ok: false, motivo: "El link de la caja lo configura el dueño del negocio." };
  }

  // El filtro lleva las DOS llaves: un programaId real pero ajeno no
  // pasa la FK, así que sin el `rancho_id` acá se podría reescribir el
  // link de otro negocio con la sesión de este dueño.
  const { data: programa } = await acceso.supabase
    .from("programa_lealtad")
    .select("id, rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const { error } = await acceso.supabase
    .from("programa_lealtad")
    .update({ permite_manual_en_link: permitir })
    .eq("id", programaId);
  if (error) return { ok: false, motivo: "No se pudo guardar. Probá de nuevo." };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}
