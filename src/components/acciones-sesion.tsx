import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuCuenta from "./menu-cuenta";

// Se queda en el directorio en vez de mandar a /mi-rancho/login: acá
// arriba cualquiera puede estar de visita, no solo un dueño.
async function cerrarSesionPublica() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/eventos");
}

export default async function AccionesSesion() {
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

  return (
    <MenuCuenta
      sesionActiva={!!user}
      nombre={nombre}
      fotoUrl={fotoUrl}
      cerrarSesion={cerrarSesionPublica}
    />
  );
}
