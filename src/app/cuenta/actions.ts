"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El inicio de sesión y el registro viven en el cliente
// (FormularioCodigoAcceso): sin contraseñas, con código al correo.
// Acá solo queda lo que sí necesita correr en el servidor.

export async function cerrarSesionCuenta() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/cuenta");
}

/**
 * Crea o corrige la reseña del cliente para una reserva confirmada.
 * Las políticas RLS de `resenas` (migración 0033) son las que mandan:
 * solo el cliente de una reserva confirmada puede insertar, y solo el
 * autor puede editar la suya — acá no se re-valida nada de eso.
 */
export async function guardarResena(
  reservaId: string,
  ranchoId: string,
  calificacion: number,
  comentario: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión para dejar tu reseña." };

  const estrellas = Math.round(Number(calificacion));
  if (!Number.isFinite(estrellas) || estrellas < 1 || estrellas > 5) {
    return { error: "Elegí de 1 a 5 estrellas." };
  }
  const texto = comentario.trim().slice(0, 800) || null;

  const { data: existente } = await supabase
    .from("resenas")
    .select("id")
    .eq("reserva_id", reservaId)
    .eq("cliente_id", user.id)
    .maybeSingle();

  const { error } = existente
    ? await supabase
        .from("resenas")
        .update({ calificacion: estrellas, comentario: texto })
        .eq("id", existente.id)
    : await supabase.from("resenas").insert({
        rancho_id: ranchoId,
        cliente_id: user.id,
        reserva_id: reservaId,
        calificacion: estrellas,
        comentario: texto,
      });

  if (error) return { error: "No se pudo guardar la reseña: " + error.message };
  return { error: null };
}
