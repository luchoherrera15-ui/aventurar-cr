"use server";

import { createClient } from "@/lib/supabase/server";
import type { RespuestasPlanificador } from "./tipos";

/**
 * Guarda el lead opcional del cotizador ("¿Querés que te guardemos
 * esto?") en `planificador_leads` (migración 0069). Es totalmente
 * tolerante a fallos: si la tabla todavía no existe o el insert
 * falla, el wizard sigue y se cierra igual — el lead es un extra,
 * nunca un bloqueo.
 */
export async function guardarLeadPlanificador(datos: {
  nombre: string;
  correo: string;
  whatsapp: string;
  respuestas: RespuestasPlanificador;
  consentimiento: boolean;
}): Promise<{ ok: boolean }> {
  // Sin consentimiento no se guarda nada — la UI ya lo exige, esto
  // es el cinturón del lado del servidor.
  if (!datos.consentimiento) return { ok: false };

  const nombre = datos.nombre.trim().slice(0, 120);
  const correo = datos.correo.trim().slice(0, 160);
  const whatsapp = datos.whatsapp.trim().slice(0, 40);
  if (!correo && !whatsapp) return { ok: false };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("planificador_leads").insert({
      nombre: nombre || null,
      correo: correo || null,
      whatsapp: whatsapp || null,
      respuestas: datos.respuestas,
      consentimiento: true,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
