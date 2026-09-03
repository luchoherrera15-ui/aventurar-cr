"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";

/**
 * «¿QUERÉS PERSONALIZAR AÚN MÁS TU TARJETA?» — el botón del final del
 * alta (pedido del dueño, 2 sep 2026).
 *
 * Quien acaba de crear su tarjeta con el asistente se queda con lo que
 * el asistente permite: cuatro pasos y las opciones de la lista. El que
 * quiere algo que no está ahí —su tipografía, su fondo, los sellos
 * acomodados de otra forma— hoy no tenía a quién decírselo sin salirse
 * de Bookea. Este botón es esa puerta, y llega al equipo con la persona
 * ya identificada: correo, teléfono y el negocio recién creado.
 *
 * ── NO ES UNA TABLA NUEVA ───────────────────────────────────────────
 * Es el MISMO hilo `ayuda_diseno` (0149) que ya usa «No me gusta cómo
 * me está quedando» desde el panel. Eso importa por dos razones: el
 * equipo contesta desde la bandeja que ya existe (`/admin/lealtad`), y
 * la persona lee la respuesta en el bloque de ayuda de su propio panel.
 * Un pedido, una conversación — no dos bandejas que se ignoran.
 *
 * ── POR QUÉ NO PIDE ESCRIBIR NADA ───────────────────────────────────
 * El pedido del dueño fue explícito: «presioná este botón y eso envíe
 * una solicitud». Obligar a redactar en la pantalla de festejo es la
 * forma más rápida de que nadie la toque. El texto que se guarda dice
 * exactamente lo que pasó —pidió ayuda para personalizar— y el detalle
 * se conversa en el hilo, que es donde una conversación va.
 *
 * Escribe con la SESIÓN y no con la llave de servicio: la política de
 * `ayuda_diseno` exige firmar con el propio id y gestionar ese negocio,
 * y el índice único parcial es el que evita que el doble clic abra dos
 * hilos. Nada de eso se cumpliría insertando por arriba de la RLS.
 */

const TEXTO_DEL_PEDIDO =
  "Acabo de crear mi tarjeta con el asistente y quiero personalizarla más " +
  "de lo que permite el creador. ¿Me pueden dar una mano con el diseño?";

export type ResultadoPersonalizar =
  | { ok: true; yaExistia: boolean }
  | { ok: false; motivo: string };

export async function pedirPersonalizacion(
  ranchoId: string,
): Promise<ResultadoPersonalizar> {
  const { user, ok, supabase } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "Esto lo pide el dueño del negocio." };

  const { error } = await supabase.from("ayuda_diseno").insert({
    hilo_id: null,
    rancho_id: ranchoId,
    programa_id: null,
    autor_id: user.id,
    texto: TEXTO_DEL_PEDIDO,
    contexto: "Pedido desde el final del alta pública (/lealtad/crear).",
    estado: "abierta",
  });

  // 23505 = ya hay un hilo abierto para este negocio. No es un error
  // que la persona tenga que resolver: su pedido YA está en la bandeja
  // del equipo, que es exactamente lo que quería lograr con el botón.
  const yaExistia = error?.code === "23505";
  if (error && !yaExistia) {
    if (
      /ayuda_diseno/.test(error.message) &&
      /does not exist|schema cache|Could not find/i.test(error.message)
    ) {
      return { ok: false, motivo: "Falta correr la migración 0149 en Supabase." };
    }
    return { ok: false, motivo: `No se pudo enviar el pedido: ${error.message}` };
  }

  // El aviso al equipo va DESPUÉS de responder (`after`): la pantalla de
  // «listo» no tiene por qué esperar a que salga un correo.
  if (!yaExistia) {
    after(async () => {
      // Los datos de contacto salen del SERVIDOR, no del navegador: son
      // con lo que el equipo va a levantar el teléfono, y un dato así no
      // se le pregunta a la pantalla.
      const db = createAdminClient();
      const { data: rancho } = db
        ? await db
            .from("ranchos")
            .select("nombre, telefono, whatsapp")
            .eq("id", ranchoId)
            .maybeSingle()
        : { data: null };

      const negocioNombre = ((rancho?.nombre as string | null) ?? "").trim() || "(sin nombre)";
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const telefono =
        ((rancho?.telefono as string | null) ??
          (rancho?.whatsapp as string | null) ??
          (typeof metadata.whatsapp === "string" ? metadata.whatsapp : null) ??
          "")?.trim() || "(sin teléfono)";

      await avisarAAdministradores({
        subject: `QUIERE PERSONALIZAR SU TARJETA — ${negocioNombre}`,
        html: `
          <h2 style="margin:0 0 12px">Piden personalizar la tarjeta</h2>
          <p style="margin:0 0 12px;font-size:14px">
            <b>${escaparHtml(negocioNombre)}</b> acaba de crear su tarjeta en el asistente
            público y pidió ayuda para personalizarla más allá de lo que el creador permite.
          </p>
          <table style="font-size:14px;border-collapse:collapse">
            <tr><td style="padding:2px 12px 2px 0"><b>Correo</b></td><td>${escaparHtml(user.email ?? "(sin correo)")}</td></tr>
            <tr><td style="padding:2px 12px 2px 0"><b>Teléfono</b></td><td>${escaparHtml(telefono)}</td></tr>
            <tr><td style="padding:2px 12px 2px 0"><b>Negocio</b></td><td>${escaparHtml(negocioNombre)}</td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:14px">
            <a href="${SITIO}/admin/lealtad">Contestale desde la bandeja de Lealtad →</a>
          </p>
        `,
      });
    });
  }

  return { ok: true, yaExistia };
}
