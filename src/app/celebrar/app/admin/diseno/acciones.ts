"use server";

import { redirect } from "next/navigation";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { esAdminCelebrar, prefijoDeLaPeticion } from "@/lib/celebrar/sesion";
import { createClient } from "@/lib/supabase/server";

/** El equipo marca el pedido (pendiente / en proceso / atendida) y deja una nota. */
export async function atenderPedidoDiseno(formData: FormData): Promise<void> {
  const [prefijo, esAdmin] = await Promise.all([prefijoDeLaPeticion(), esAdminCelebrar()]);
  const volver = conPrefijo(RUTA.appAdminDiseno, prefijo);
  if (!esAdmin) redirect(volver);
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 300) || null;
  if (!["pendiente", "en_proceso", "atendida"].includes(estado)) redirect(`${volver}?aviso=${encodeURIComponent("Estado inválido.")}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("celebrar_ayuda_diseno")
    .update({ estado, nota_admin: nota, atendida_en: estado === "atendida" ? new Date().toISOString() : null })
    .eq("id", id);
  redirect(`${volver}?aviso=${encodeURIComponent(error ? `No se pudo guardar: ${error.message}` : "Listo.")}`);
}
