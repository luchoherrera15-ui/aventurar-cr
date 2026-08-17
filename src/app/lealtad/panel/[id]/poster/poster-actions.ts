"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verificarAccesoRancho } from "@/lib/auth";
import { validarConfigPoster, type ConfigPoster } from "@/lib/lealtad/plantillas-poster";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";

/**
 * Guardar el póster personalizado en `programa_lealtad.poster_config`
 * (jsonb, migración 0132).
 *
 * ------------------------------------------------------------------
 * ACÁ SE DECIDE, NO EN EL FORMULARIO
 * ------------------------------------------------------------------
 * El editor valida mientras se escribe para avisar temprano, pero no
 * autoriza nada: una petición armada a mano no pasa por ese código. De
 * este lado se vuelve a comprobar quién es, que el programa sea de SU
 * negocio y que los textos entren en una A4.
 *
 * ------------------------------------------------------------------
 * SI LA 0132 NO ESTÁ PEGADA, SE DICE
 * ------------------------------------------------------------------
 * Las migraciones las pega el dueño a mano, así que la columna puede
 * no existir todavía. En ese caso esto NO finge que guardó: devuelve el
 * motivo en palabras para que la pantalla lo muestre. Un «listo» que no
 * guardó nada se descubre una semana después, cuando el póster vuelve
 * al texto viejo y nadie entiende por qué.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

/** El tipo del parámetro no es una garantía: esto llega por la red. */
function formaValida(valor: unknown): valor is ConfigPoster {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const o = valor as Record<string, unknown>;
  return (
    typeof o.base === "string" &&
    // Solo que SEA texto: cuál de las cuatro es lo decide la lista
    // blanca de `validarConfigPoster`, dos líneas más abajo.
    typeof o.tipografia === "string" &&
    typeof o.titulo === "string" &&
    typeof o.invitacion === "string" &&
    Array.isArray(o.pasos) &&
    o.pasos.length === 3 &&
    o.pasos.every((p) => typeof p === "string") &&
    typeof o.mostrarPasos === "boolean" &&
    typeof o.mostrarPremio === "boolean" &&
    typeof o.mostrarPie === "boolean" &&
    typeof o.colorFondo === "string" &&
    typeof o.colorAcento === "string"
  );
}

export async function guardarPosterConfig(
  ranchoId: string,
  programaId: string,
  config: ConfigPoster,
): Promise<Resultado> {
  const { user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/lealtad/login");
  // El póster es material del negocio: un empleado con permiso de
  // acreditar puede imprimirlo, no reescribir lo que promete.
  if (!ok) return { ok: false, motivo: "Solo el dueño del negocio edita el póster." };

  if (!formaValida(config)) {
    return { ok: false, motivo: "Los datos del póster llegaron incompletos. Recargá y probá de nuevo." };
  }
  const motivo = validarConfigPoster(config);
  if (motivo) return { ok: false, motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const limpio: ConfigPoster = {
    ...config,
    titulo: config.titulo.trim(),
    invitacion: config.invitacion.trim(),
    pasos: [config.pasos[0].trim(), config.pasos[1].trim(), config.pasos[2].trim()],
  };

  // El filtro lleva las DOS llaves. Con `id` solo, un programaId ajeno
  // —uno real, así que ninguna FK lo frena— dejaría reescribir el
  // póster de otro negocio con la llave de servicio y la RLS fuera de
  // juego.
  const { error } = await db
    .from("programa_lealtad")
    .update({ poster_config: limpio })
    .eq("id", programaId)
    .eq("rancho_id", ranchoId);

  if (error) {
    // 42703 = undefined_column en Postgres; PGRST204 = PostgREST sin la
    // columna en su caché de esquema. Los dos significan lo mismo acá:
    // la 0132 todavía no corrió.
    const faltaColumna =
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /poster_config/.test(error.message);
    return {
      ok: false,
      motivo: faltaColumna
        ? "Tu base todavía no tiene la columna del póster (migración 0132). Podés seguir probando el diseño acá, pero no se puede guardar hasta que se aplique."
        : "No se pudo guardar el póster: " + error.message,
    };
  }

  revalidatePath(`/lealtad/panel/${ranchoId}/poster`);
  return { ok: true };
}
