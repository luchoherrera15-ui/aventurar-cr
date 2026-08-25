import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tieneNegocioPropio } from "@/lib/negocio-propio";
import MenuCuenta from "./menu-cuenta";

// Se queda en el directorio en vez de mandar a /mi-negocio/login: acá
// arriba cualquiera puede estar de visita, no solo un dueño.
async function cerrarSesionPublica() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function AccionesSesion({
  /** true = los botones toman el círculo navy de la lupa de búsqueda,
   *  para la variante flotante del header (ver site-header.tsx). */
  flotante = false,
}: {
  flotante?: boolean;
} = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El nombre vive en `perfiles` (lo escribe el trigger o el callback de
  // Google); la foto solo existe si entraron con Google, que la manda en
  // la metadata. Con cualquiera de los dos el avatar deja de ser genérico.
  let nombre: string | null = null;
  let fotoUrl: string | null = null;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre")
      .eq("id", user.id)
      .maybeSingle();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    nombre =
      [perfil?.nombre, meta.nombre, meta.full_name, meta.name].find(
        (v): v is string => typeof v === "string" && v.trim().length > 0,
      ) ?? null;
    fotoUrl =
      [meta.avatar_url, meta.picture].find(
        (v): v is string => typeof v === "string" && v.startsWith("https://"),
      ) ?? null;
  }

  // Cacheado con el mismo helper que usa el header de escritorio: en un
  // render se consulta una sola vez.
  const yaPublica = user ? await tieneNegocioPropio() : false;

  return (
    <MenuCuenta
      sesionActiva={!!user}
      nombre={nombre}
      fotoUrl={fotoUrl}
      yaPublica={yaPublica}
      cerrarSesion={cerrarSesionPublica}
      flotante={flotante}
    />
  );
}
