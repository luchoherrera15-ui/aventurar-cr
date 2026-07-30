import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";

/**
 * El aviso push de un mensaje nuevo del chat: le suena al OTRO
 * participante de la conversación (el autor ya sabe qué escribió).
 *
 * Vive acá y no en la acción de la web porque hay dos caminos que
 * terminan en lo mismo — la acción enviarMensaje de la web y la app
 * móvil, que inserta directo en Supabase y luego pega en
 * /api/mensajes/[id]/aviso porque no tiene servidor propio.
 *
 * Una sola vez por mensaje: la bandera `push_enviado` se reclama
 * dentro del mismo UPDATE que lee los datos (migración 0057), el
 * mismo patrón de confirmacion_enviada en reservas. Nunca lanza: el
 * mensaje ya quedó guardado y eso no puede fallar por un aviso.
 */
export async function notificarMensajeNuevo(
  mensajeId: string,
  opciones?: { maxAntiguedadMinutos?: number },
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    let consulta = admin
      .from("mensajes")
      .update({ push_enviado: true })
      .eq("id", mensajeId)
      .eq("push_enviado", false);

    if (opciones?.maxAntiguedadMinutos) {
      const desde = new Date(
        Date.now() - opciones.maxAntiguedadMinutos * 60 * 1000,
      ).toISOString();
      consulta = consulta.gte("created_at", desde);
    }

    const { data } = await consulta
      .select(
        "id, texto, autor_id, conversaciones(cliente_id, proveedor_id, ranchos(nombre))",
      )
      .maybeSingle();
    if (!data) return;

    const m = data as unknown as {
      texto: string;
      autor_id: string;
      conversaciones: {
        cliente_id: string;
        proveedor_id: string;
        ranchos: { nombre: string } | null;
      } | null;
    };
    const conv = m.conversaciones;
    if (!conv) return;

    const receptor =
      m.autor_id === conv.cliente_id ? conv.proveedor_id : conv.cliente_id;
    const texto =
      m.texto.length > 120 ? m.texto.slice(0, 117) + "…" : m.texto;

    await enviarPush({
      usuarios: [receptor],
      titulo: `Mensaje nuevo — ${conv.ranchos?.nombre ?? "Bookea"}`,
      cuerpo: texto,
      data: { url: "/?tab=mensajes" },
    });
  } catch (e) {
    console.warn("[mensajes] No se pudo avisar el mensaje:", e);
  }
}
