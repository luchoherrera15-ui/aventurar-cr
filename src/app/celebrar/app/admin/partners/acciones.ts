"use server";

import { redirect } from "next/navigation";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { esAdminCelebrar, prefijoDeLaPeticion } from "@/lib/celebrar/sesion";
import { createClient } from "@/lib/supabase/server";

/**
 * Aprobar, suspender, rechazar o volver a pendiente a un partner, y
 * fijarle el descuento y una nota interna. Va por la RPC
 * `celebrar_admin_partner_estado`, que vuelve a preguntar `is_admin()`.
 */
export async function cambiarEstadoPartner(formData: FormData): Promise<void> {
  const [prefijo, esAdmin] = await Promise.all([prefijoDeLaPeticion(), esAdminCelebrar()]);
  const volver = conPrefijo(RUTA.appAdminPartners, prefijo);
  if (!esAdmin) redirect(volver);

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  const descuento = Number(formData.get("descuento"));
  const notas = String(formData.get("notas") ?? "").trim();
  const aviso = (m: string) => redirect(`${volver}?aviso=${encodeURIComponent(m)}`);

  if (!/^[0-9a-f-]{36}$/i.test(id)) aviso("Partner inválido.");
  if (!["pendiente", "aprobado", "suspendido", "rechazado"].includes(estado)) aviso("Estado inválido.");
  if (formData.has("descuento") && (!Number.isInteger(descuento) || descuento < 0 || descuento > 60)) aviso("El descuento va de 0 a 60 %.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_admin_partner_estado", {
    p_id: id,
    p_estado: estado,
    p_descuento: formData.has("descuento") ? descuento : null,
    p_notas: notas || null,
  });
  if (error) aviso(`No se pudo guardar: ${error.message}`);
  if (data === false) aviso("Ese partner ya no existe.");
  aviso(`Listo: partner ${estado}${formData.has("descuento") ? ` con ${descuento} % de descuento` : ""}.`);
}
