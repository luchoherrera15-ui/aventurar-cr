"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { modeloDe, motivoParaNoGastar } from "@/lib/ia/config-ia";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";
import {
  ErrorImpresionIA,
  generarInvitacionImpresa,
} from "@/lib/ia/generador-impresion";

/**
 * Compone (o rehace) la versión de una hoja de una invitación.
 *
 * Solo el dueño de la invitación o un admin. El gate del paquete lo
 * resuelve la pantalla; acá se vuelve a comprobar la propiedad, porque
 * una server action se puede invocar desde cualquier lado.
 */
export async function generarVersionImpresa(invitacionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Iniciá sesión para generar la versión impresa." };

  const admin = createAdminClient();
  if (!admin) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const { data: inv, error: errorLectura } = await admin
    .from("invitaciones")
    .select(
      "id, slug, titulo, cliente_id, html_personalizado, fecha_evento, hora, lugar_nombre, direccion",
    )
    .eq("id", invitacionId)
    .maybeSingle();
  if (errorLectura) return { error: errorLectura.message };
  if (!inv) return { error: "Esa invitación ya no existe." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  const esAdmin = perfil?.rol === "admin";
  if (inv.cliente_id !== user.id && !esAdmin) {
    return { error: "Esta invitación no es tuya." };
  }

  const htmlDigital = inv.html_personalizado as string | null;
  if (!htmlDigital) {
    return { error: "Esta invitación todavía no tiene diseño propio." };
  }

  let motivo: string | null = null;
  try {
    motivo = await motivoParaNoGastar();
  } catch {
    // Fail-closed: si no se puede verificar el interruptor ni el tope,
    // no se gasta. Es el mismo criterio del chat y del generador.
    motivo = "No pudimos verificar el estado del asistente; probá de nuevo en un momento.";
  }
  if (motivo) return { error: motivo };

  const modelo = await modeloDe("invitacion_imprimir").catch(
    () => "claude-opus-5" as const,
  );

  const datos = [
    inv.titulo,
    inv.fecha_evento,
    inv.hora,
    inv.lugar_nombre,
    inv.direccion,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const { html, usage, tiempoMs } = await generarInvitacionImpresa({
      htmlDigital,
      datosEvento: datos || "(los datos están dentro del HTML digital)",
      modelo,
    });

    await registrarDesdeUsage(usage, {
      agente: "invitacion_imprimir",
      modelo,
      tiempoMs,
      usuarioId: user.id,
      referenciaId: inv.id as string,
    });

    const { error } = await admin
      .from("invitaciones")
      .update({ html_impresion: html, impresion_generada_en: new Date().toISOString() })
      .eq("id", inv.id);
    if (error) return { error: "No se pudo guardar la versión impresa: " + error.message };

    revalidatePath(`/i/${inv.slug}/imprimir`);
    return { error: null };
  } catch (e) {
    // Los tokens ya se cobraron aunque la composición fallara.
    if (e instanceof ErrorImpresionIA) {
      await registrarFalloIA({
        agente: "invitacion_imprimir",
        modelo,
        tokensInput: e.usage?.input_tokens ?? 0,
        tokensOutput: e.usage?.output_tokens ?? 0,
        tiempoMs: e.tiempoMs,
        error: e.message,
        usuarioId: user.id,
        referenciaId: inv.id as string,
      });
      return { error: e.message };
    }
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    console.error("[imprimir] No se pudo componer la versión impresa:", mensaje);
    return { error: "No se pudo componer la versión impresa; intentá de nuevo." };
  }
}
