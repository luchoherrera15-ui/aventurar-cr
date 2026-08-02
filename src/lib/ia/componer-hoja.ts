import type { SupabaseClient } from "@supabase/supabase-js";
import { modeloDe, motivoParaNoGastar } from "@/lib/ia/config-ia";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";
import {
  ErrorImpresionIA,
  generarInvitacionImpresa,
} from "@/lib/ia/generador-impresion";

/**
 * Componer la hoja para papel de una invitación, en un solo lugar.
 *
 * Existe porque el trabajo entra por DOS puertas y la plata es la
 * misma: el botón "Componer la hoja" que aprieta el cliente, y el cron
 * nocturno que las va armando solo para que cuando el cliente entre ya
 * esté lista. Con la lógica repartida, una de las dos se olvida de
 * mirar el tope de gasto o de registrar los tokens, y el gasto de IA
 * deja de cuadrar.
 *
 * Lo que NO vive acá: quién tiene permiso. Eso es distinto en cada
 * puerta — el dueño de la invitación en el botón, el secreto del cron
 * en el otro— y cada una lo resuelve antes de llamar.
 */

export type ResultadoHoja =
  | { ok: true; slug: string }
  | { ok: false; error: string; sinPresupuesto?: boolean };

/** Lo que hace falta saber de la invitación para componerle la hoja. */
export type InvitacionParaHoja = {
  id: string;
  slug: string;
  titulo: string | null;
  html_personalizado: string | null;
  fecha_evento: string | null;
  hora: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
};

export async function componerHoja({
  admin,
  invitacion,
  usuarioId,
}: {
  /** Cliente con llave de servicio: escribe `invitaciones`. */
  admin: SupabaseClient;
  invitacion: InvitacionParaHoja;
  /** A nombre de quién se registra el gasto; null cuando lo hace el cron. */
  usuarioId: string | null;
}): Promise<ResultadoHoja> {
  const htmlDigital = invitacion.html_personalizado;
  if (!htmlDigital) {
    return { ok: false, error: "Esta invitación todavía no tiene diseño propio." };
  }

  let motivo: string | null = null;
  try {
    motivo = await motivoParaNoGastar();
  } catch {
    // Fail-closed: si no se puede verificar el interruptor ni el tope,
    // no se gasta. Mismo criterio que el chat y el generador.
    motivo = "No pudimos verificar el estado del asistente; probá de nuevo en un momento.";
  }
  if (motivo) return { ok: false, error: motivo, sinPresupuesto: true };

  const modelo = await modeloDe("invitacion_imprimir").catch(
    () => "claude-opus-5" as const,
  );

  const datos = [
    invitacion.titulo,
    invitacion.fecha_evento,
    invitacion.hora,
    invitacion.lugar_nombre,
    invitacion.direccion,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const { html, usage, tiempoMs } = await generarInvitacionImpresa({
      // Una invitación animada puede pesar decenas de miles de
      // caracteres, y el modelo solo la necesita como referencia de
      // identidad visual: con el arranque le alcanza para tomar fondo,
      // paleta y tipografías. Mandarla entera alarga la llamada hasta
      // rozar el tope de tiempo y encarece cada composición.
      htmlDigital: htmlDigital.slice(0, 45000),
      datosEvento: datos || "(los datos están dentro del HTML digital)",
      modelo,
    });

    await registrarDesdeUsage(usage, {
      agente: "invitacion_imprimir",
      modelo,
      tiempoMs,
      usuarioId,
      referenciaId: invitacion.id,
    });

    const { error } = await admin
      .from("invitaciones")
      .update({
        html_impresion: html,
        impresion_generada_en: new Date().toISOString(),
      })
      .eq("id", invitacion.id);
    if (error) {
      return { ok: false, error: "No se pudo guardar la versión impresa: " + error.message };
    }

    return { ok: true, slug: invitacion.slug };
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
        usuarioId,
        referenciaId: invitacion.id,
      });
      return { ok: false, error: e.message };
    }
    // Acá caen los fallos que NO son del modelo: se quedó sin tiempo,
    // se cortó la conexión, falta la llave.
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    console.error("[imprimir] No se pudo componer la versión impresa:", mensaje);
    return { ok: false, error: `No se pudo componer la versión impresa: ${mensaje.slice(0, 200)}` };
  }
}

/** Las columnas que `componerHoja` necesita, para no repetir la lista. */
export const COLUMNAS_HOJA =
  "id, slug, titulo, html_personalizado, fecha_evento, hora, lugar_nombre, direccion";
