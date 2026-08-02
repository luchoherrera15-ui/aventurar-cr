"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COLUMNAS_HOJA,
  componerHoja,
  type InvitacionParaHoja,
} from "@/lib/ia/componer-hoja";

/**
 * Compone (o rehace) la versión de una hoja de una invitación, a pedido.
 *
 * Acá vive el permiso: solo el dueño de la invitación o un admin. Se
 * comprueba aunque la pantalla ya haya resuelto el gate del paquete,
 * porque una server action se puede invocar desde cualquier lado.
 *
 * El trabajo en sí (llamar al modelo, mirar el tope de gasto, registrar
 * los tokens y guardar el HTML) está en src/lib/ia/componer-hoja: lo
 * comparte con el cron que las va armando de noche.
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
    .select(`${COLUMNAS_HOJA}, cliente_id`)
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
  if ((inv as { cliente_id: string | null }).cliente_id !== user.id && !esAdmin) {
    return { error: "Esta invitación no es tuya." };
  }

  const resultado = await componerHoja({
    admin,
    invitacion: inv as unknown as InvitacionParaHoja,
    usuarioId: user.id,
  });

  if (!resultado.ok) return { error: resultado.error };

  revalidatePath(`/i/${resultado.slug}/imprimir`);
  return { error: null };
}
