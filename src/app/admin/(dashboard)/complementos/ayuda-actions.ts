"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { enviarCorreo, escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import { hilosDeAyuda, type HiloAyuda } from "@/lib/lealtad/ayuda-hilo";

/**
 * «NO ME GUSTA CÓMO ME ESTÁ QUEDANDO» — el lado de Bookea (0149).
 *
 * Contestar y cerrar el hilo de ayuda con el diseño de una tarjeta.
 *
 * La escritura va con la SESIÓN del admin y no con la llave de
 * servicio: la política de la base exige `autor_id = auth.uid()`, y así
 * el hilo guarda QUIÉN del equipo contestó. Con la llave de servicio
 * habría que elegir a mano un autor, y todas las respuestas quedarían
 * firmadas por la misma persona sin importar quién escribió.
 */

type Resultado =
  | { ok: true; hilo: HiloAyuda | null }
  | { ok: false; motivo: string };

const TOPE_TEXTO = 2000;

/**
 * El pedido, con el negocio y su dueño resueltos. Se lee con la llave de
 * servicio porque hace falta el correo del dueño (`perfiles` está bajo
 * RLS) y el nombre del negocio.
 */
async function cabezaDelHilo(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  hiloId: string,
) {
  const { data, error } = await db
    .from("ayuda_diseno")
    .select("id, rancho_id, estado, hilo_id")
    .eq("id", hiloId)
    .is("hilo_id", null)
    .maybeSingle();

  if (error) {
    if (/does not exist|schema cache|Could not find/i.test(error.message)) {
      return { falta: true as const };
    }
    return { falta: false as const, fila: null };
  }
  return { falta: false as const, fila: data as { id: string; rancho_id: string; estado: string } | null };
}

export async function responderAyudaComoBookea(
  hiloId: string,
  bruto: string,
): Promise<Resultado> {
  const { ok, supabase } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión de nuevo." };

  const texto = bruto.trim().slice(0, TOPE_TEXTO);
  if (texto.length < 1) return { ok: false, motivo: "Escribí la respuesta." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const cabeza = await cabezaDelHilo(db, hiloId);
  if (cabeza.falta) return { ok: false, motivo: "Falta correr la migración 0149 en Supabase." };
  if (!cabeza.fila) return { ok: false, motivo: "Ese pedido ya no existe." };
  if (cabeza.fila.estado === "cerrada") {
    return { ok: false, motivo: "Ese pedido está cerrado: reabrilo antes de escribir." };
  }
  const ranchoId = cabeza.fila.rancho_id;

  const { error } = await supabase.from("ayuda_diseno").insert({
    hilo_id: hiloId,
    rancho_id: ranchoId,
    autor_id: user.id,
    texto,
  });
  if (error) return { ok: false, motivo: "No se pudo responder: " + error.message };

  // Que el dueño se entere. Si el correo no sale, la respuesta igual
  // está en su panel — la fila es la fuente de verdad, el correo es el
  // aviso.
  after(() => avisarAlNegocio(db, ranchoId, texto));

  revalidatePath("/admin/complementos");
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, hilo: (await hilosDeAyuda(db, ranchoId)).find((h) => h.id === hiloId) ?? null };
}

/**
 * Cerrar el pedido: se resolvió. Libera el índice único parcial, así que
 * el negocio puede volver a pedir ayuda cuando le haga falta.
 */
export async function cerrarAyudaDeDiseno(hiloId: string): Promise<Resultado> {
  const { ok, supabase } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión de nuevo." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const cabeza = await cabezaDelHilo(db, hiloId);
  if (cabeza.falta) return { ok: false, motivo: "Falta correr la migración 0149 en Supabase." };
  if (!cabeza.fila) return { ok: false, motivo: "Ese pedido ya no existe." };

  const { error } = await supabase
    .from("ayuda_diseno")
    .update({
      estado: "cerrada",
      atendida_por: user.id,
      atendida_en: new Date().toISOString(),
    })
    .eq("id", hiloId);
  if (error) return { ok: false, motivo: "No se pudo cerrar: " + error.message };

  revalidatePath("/admin/complementos");
  revalidatePath(`/lealtad/panel/${cabeza.fila.rancho_id}`);
  return { ok: true, hilo: null };
}

/** El correo al dueño cuando Bookea le contesta. Nunca lanza. */
async function avisarAlNegocio(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  ranchoId: string,
  texto: string,
) {
  try {
    const { data: rancho } = await db
      .from("ranchos")
      .select("nombre, owner_id")
      .eq("id", ranchoId)
      .maybeSingle();
    if (!rancho) return;

    const { data: perfil } = await db
      .from("perfiles")
      .select("email")
      .eq("id", rancho.owner_id as string)
      .maybeSingle();
    const correo = String((perfil?.email as string | null) ?? "").trim();
    if (!correo.includes("@")) return;

    await enviarCorreo({
      to: correo,
      subject: "Te respondimos sobre el diseño de tu tarjeta",
      html: `
        <p style="margin:0 0 12px;font-size:15px">
          Hola${rancho.nombre ? ` ${escaparHtml(String(rancho.nombre))}` : ""}, te contestamos
          sobre el diseño de tu tarjeta:
        </p>
        <blockquote style="margin:0 0 16px;border-left:3px solid #ddd;padding-left:12px;font-size:15px">
          ${escaparHtml(texto).replaceAll("\n", "<br>")}
        </blockquote>
        <p style="margin:0;font-size:15px">
          Seguí la conversación desde
          <a href="${SITIO}/lealtad/panel/${ranchoId}">tu panel de Lealtad</a>, en el bloque de
          ayuda con el diseño (está en el creador y en el editor de la tarjeta).
        </p>
      `,
    });
  } catch (e) {
    console.error("[ayuda-diseno] no se pudo avisarle al negocio:", e);
  }
}
