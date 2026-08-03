import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * ¿Esta persona ya tiene un negocio publicado?
 *
 * Sirve para que el header no le siga ofreciendo "Publicá tu espacio" a
 * quien ya publicó: en ese caso lo que necesita es la puerta a su
 * panel. Cuenta CUALQUIER estado, no solo los aprobados — quien tiene
 * una publicación esperando revisión es justamente el que más necesita
 * llegar a su panel para completarla.
 *
 * Va envuelto en `cache()` de React: el header lo consulta desde dos
 * lugares (el link de escritorio y el menú del celular) y así la
 * consulta se hace una sola vez por render. La RLS de `ranchos` ya
 * limita a los propios, y `head: true` no trae filas: solo cuenta.
 */
export const tieneNegocioPropio = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from("ranchos")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  // Ante un error se responde que no: seguir mostrando "Publicá tu
  // espacio" es inofensivo, mientras que mandar a /mi-negocio a alguien
  // que no tiene nada lo deja en una pantalla vacía.
  if (error) return false;
  return (count ?? 0) > 0;
});
