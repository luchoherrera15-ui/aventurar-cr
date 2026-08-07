import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/auth";

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
 *
 * La sesión se pide con `usuarioActual()` (src/lib/auth.ts) y no con un
 * `auth.getUser()` propio: ese `cache()` compartido evita que el mismo
 * render pregunte "¿quién sos?" cuatro veces por cuatro clientes
 * distintos. Para quien tiene sesión abierta, cada una de esas era una
 * ida y vuelta a /auth/v1/user (144–150 ms medidos).
 */
export const tieneNegocioPropio = cache(async (): Promise<boolean> => {
  const user = await usuarioActual();
  if (!user) return false;

  const supabase = await createClient();

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
