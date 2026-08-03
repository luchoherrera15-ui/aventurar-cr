"use server";

import { verificarAccesoRancho } from "@/lib/auth";
import {
  enviarCampanaNegocioCore,
  type CampanaNegocioInput,
  type ResultadoCampanaNegocio,
} from "@/lib/campanas/citas";

export type { CampanaNegocioInput, ResultadoCampanaNegocio };

/**
 * Campañas de correo POR NEGOCIO desde el panel web — la pieza que
 * cierra el ciclo del CRM: el sistema detecta al cliente que faltó dos
 * veces o que dejó de venir, y el dueño le manda una promoción desde
 * su panel. La lógica (derivación de destinatarios en el servidor,
 * consentimiento con ámbito, frenos anti-abuso y bitácora 0094) vive
 * en el núcleo compartido con /api/citas/campanas (la app móvil).
 */
export async function enviarCampanaNegocio(
  ranchoId: string,
  input: CampanaNegocioInput,
): Promise<ResultadoCampanaNegocio> {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!ok || !user) {
    return {
      error: "No encontramos tu publicación.",
      enviados: 0,
      fallidos: 0,
      excluidos: 0,
      omitidosRecientes: 0,
    };
  }
  return enviarCampanaNegocioCore(supabase, user.id, ranchoId, input);
}
