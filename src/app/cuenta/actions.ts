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

const TELEFONO_REGEX = /^[0-9+\s-]{8,16}$/;

/**
 * Edita nombre y teléfono desde /cuenta. Reusa los DOS mecanismos que
 * ya existían para el onboarding (formulario-codigo-acceso.tsx,
 * auth/callback/route.ts) en vez de inventar uno nuevo:
 * - el nombre se escribe con el RPC `actualizar_mi_nombre` (0041)
 *   porque la RLS de `perfiles` bloquea un update directo del cliente;
 * - el teléfono nunca vivió en una columna de `perfiles` — siempre fue
 *   metadata de auth (`whatsapp`), así que se guarda igual acá.
 *
 * El correo queda afuera a propósito: cambiarlo dispara el flujo de
 * confirmación por email de Supabase, y esa pantalla no existe hoy en
 * ningún lado del sitio (ni web ni móvil) — agregarla de rebote en un
 * editor de perfil sería meter una superficie de seguridad nueva sin
 * que se haya pedido.
 */
export async function actualizarPerfil(
  nombre: string,
  telefono: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión de nuevo para editar tu perfil." };

  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return { error: "Escribí tu nombre." };
  if (nombreLimpio.length > 60) return { error: "El nombre es demasiado largo." };

  const telefonoLimpio = telefono.trim();
  if (telefonoLimpio && !TELEFONO_REGEX.test(telefonoLimpio)) {
    return { error: "Ese teléfono no se ve válido." };
  }

  // En serie y no en paralelo: `perfiles` y la metadata de auth son dos
  // almacenes distintos sin transacción en común, así que un
  // Promise.all podía dejarlos desincronizados si uno fallaba y el otro
  // no (ej. el nombre queda guardado pero el teléfono no) sin que el
  // mensaje de error dijera cuál de los dos. Yendo en serie, si el
  // nombre falla no se intenta el teléfono, y si el teléfono es el que
  // falla el mensaje lo dice en vez de sonar a que no se guardó nada.
  const { error: errorNombre } = await supabase.rpc("actualizar_mi_nombre", { p_nombre: nombreLimpio });
  if (errorNombre) return { error: "No se pudo guardar el nombre. Probá de nuevo." };

  const { error: errorMeta } = await supabase.auth.updateUser({
    data: { nombre: nombreLimpio, whatsapp: telefonoLimpio },
  });
  if (errorMeta) return { error: "El nombre se guardó, pero el teléfono no. Probá de nuevo." };

  return { error: null };
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
