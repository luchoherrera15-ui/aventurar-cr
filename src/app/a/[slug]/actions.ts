"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Quitar una foto del álbum.
 *
 * Quién puede, en este orden:
 *  1. el dueño del álbum (o un admin) — cualquier foto;
 *  2. quien la subió, presentando el token que quedó en SU navegador;
 *  3. nadie más.
 *
 * Todo se decide acá porque la base no le abre DELETE a nadie: no hay
 * grant sobre `album_fotos` ni política que lo permita (0089). Eso hace
 * que el default sea "nadie borra" y que ésta sea la única puerta —
 * llamar la acción a mano desde la consola no alcanza, hay que traer el
 * token correcto.
 */
export async function borrarFotoAlbum({
  fotoId,
  token,
}: {
  fotoId: string;
  /** El token del navegador de quien subió la foto; "" si no tiene. */
  token: string;
}) {
  const admin = createAdminClient();
  if (!admin) {
    return { error: "No se puede borrar ahora mismo. Escribinos por el chat." };
  }

  const { data: foto, error: errorFoto } = await admin
    .from("album_fotos")
    .select("id, path, album_id")
    .eq("id", fotoId)
    .maybeSingle();
  if (errorFoto) return { error: "No se pudo leer la foto: " + errorFoto.message };
  if (!foto) return { error: "Esa foto ya no está en el álbum." };

  const { data: album } = await admin
    .from("albumes")
    .select("id, slug, cliente_id")
    .eq("id", foto.album_id as string)
    .maybeSingle();
  if (!album) return { error: "Ese álbum ya no existe." };

  const autorizado = await puedeBorrar({ admin, album, fotoId, token });
  if (!autorizado) {
    return {
      error:
        "Esta foto la subió otra persona. Si es tuya y la subiste desde otro teléfono, pedile al dueño del álbum que la quite.",
    };
  }

  // Primero el archivo, después la fila. Al revés, un fallo dejaría la
  // foto huérfana en el bucket sin nada que la nombre.
  const { error: errorStorage } = await admin.storage
    .from("albumes")
    .remove([foto.path as string]);
  if (errorStorage) {
    console.error("[album] No se pudo borrar el archivo:", errorStorage.message);
  }

  const { error } = await admin.from("album_fotos").delete().eq("id", fotoId);
  if (error) return { error: "No se pudo borrar la foto: " + error.message };

  revalidatePath(`/a/${album.slug as string}`);
  return { error: null };
}

/** Las tres vías de autorización, en orden de menor a mayor costo. */
async function puedeBorrar({
  admin,
  album,
  fotoId,
  token,
}: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  album: { cliente_id: string | null };
  fotoId: string;
  token: string;
}): Promise<boolean> {
  // 1 y 2: el dueño del álbum, o un admin del equipo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (album.cliente_id && album.cliente_id === user.id) return true;
    const { data: perfil } = await admin
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    if (perfil?.rol === "admin") return true;
  }

  // 3: quien la subió. Se compara el hash, nunca el token: en la base
  // solo vive el SHA-256 (0089).
  if (!token) return false;

  const { data: llave, error } = await admin
    .from("album_foto_llaves")
    .select("token_hash")
    .eq("foto_id", fotoId)
    .maybeSingle();
  // Si la 0089 no corrió, la tabla no existe: solo el dueño puede borrar.
  if (error || !llave?.token_hash) return false;

  return hashesIguales(
    String(llave.token_hash),
    createHash("sha256").update(token).digest("hex"),
  );
}

/**
 * Comparación en tiempo constante. Con `===` el tiempo de respuesta
 * revela cuántos caracteres del hash acertó quien prueba, y un hash se
 * puede reconstruir carácter por carácter con suficientes intentos.
 */
function hashesIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
