"use server";

/**
 * Invitar y quitar a quien administra un negocio.
 *
 * ── DÓNDE SE DECIDE EL PERMISO ───────────────────────────────────────
 *
 * Acá NO. Las dos acciones corren con la sesión del usuario (el cliente
 * de cookies, no `service_role`), así que quien manda es la base:
 * `agregar_colaborador` comprueba que quien llama sea el dueño, y el
 * DELETE pasa por la política "Quitar un colaborador" de la 0116.
 *
 * Si esto usara `service_role` para "simplificar", la comprobación de
 * dueño quedaría en este archivo — y entonces un error acá sería un
 * agujero, en vez de un error que la base rechaza igual.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResultadoColaborador = { ok: boolean; mensaje: string };

/** Los códigos que devuelve `agregar_colaborador` (0116), en español. */
const MENSAJES: Record<string, { ok: boolean; mensaje: string }> = {
  agregado: { ok: true, mensaje: "Listo, ya puede administrar este negocio." },
  ya_estaba: { ok: true, mensaje: "Esa persona ya administraba este negocio." },
  ya_es_dueno: { ok: false, mensaje: "Ese correo es el del dueño: ya tiene acceso total." },
  sin_cuenta: {
    ok: false,
    mensaje: "No hay ninguna cuenta con ese correo. Pedile que se registre y volvé a intentar.",
  },
};

export async function agregarColaborador(
  ranchoId: string,
  correo: string,
): Promise<ResultadoColaborador> {
  const limpio = correo.trim().toLowerCase();
  if (!limpio || !limpio.includes("@")) {
    return { ok: false, mensaje: "Escribí un correo válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agregar_colaborador", {
    p_rancho: ranchoId,
    p_email: limpio,
  });

  if (error) {
    // 42501 es la excepción de la función: quien llama no es el dueño.
    if (error.code === "42501") {
      return { ok: false, mensaje: "Solo el dueño del negocio puede invitar." };
    }
    return { ok: false, mensaje: "No se pudo agregar. Probá de nuevo." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  const codigo = (fila as { codigo?: string } | null)?.codigo ?? "";
  const respuesta = MENSAJES[codigo] ?? {
    ok: false,
    mensaje: "No se pudo agregar. Probá de nuevo.",
  };

  if (respuesta.ok) revalidatePath(`/mi-negocio/${ranchoId}`);
  return respuesta;
}

export async function quitarColaborador(
  ranchoId: string,
  usuarioId: string,
): Promise<ResultadoColaborador> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rancho_colaboradores")
    .delete()
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", usuarioId);

  if (error) return { ok: false, mensaje: "No se pudo quitar. Probá de nuevo." };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { ok: true, mensaje: "Se le quitó el acceso." };
}
