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

  return <MenuCuenta sesionActiva={!!user} cerrarSesion={cerrarSesionPublica} />;
}
