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

  if (!error && (count ?? 0) > 0) return true;

  // ── Y los negocios donde ALGUIEN LA SUMÓ (0116) ──
  //
  // Sin esto, quien colabora en un negocio ajeno nunca ve la puerta a su
  // panel: el header le sigue ofreciendo "Publicá tu espacio" como si
  // fuera un cliente cualquiera. Es lo que pasaba después de darle
  // acceso a alguien — el permiso estaba bien, pero no había por dónde
  // entrar.
  //
  // Va en una consulta aparte y no en un `or`: `.eq("owner_id", …)`
  // filtra sobre `ranchos`, y la relación vive en otra tabla.
  //
  // Si la 0116 todavía no corrió, esta consulta falla y se responde que
  // no — exactamente el comportamiento que había antes.
  const { count: colaborados, error: errorColab } = await supabase
    .from("rancho_colaboradores")
    .select("rancho_id", { count: "exact", head: true })
    .eq("usuario_id", user.id);

  // Ante un error se responde que no: seguir mostrando "Publicá tu
  // espacio" es inofensivo, mientras que mandar a /mi-negocio a alguien
  // que no tiene nada lo deja en una pantalla vacía.
  if (errorColab) return false;
  return (colaborados ?? 0) > 0;
});
