import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Se queda en el directorio en vez de mandar a /mi-rancho/login: acá
// arriba cualquiera puede estar de visita, no solo un dueño.
async function cerrarSesionPublica() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/ranchos-eventos");
}

/**
 * Los botones de la derecha del header público.
 *
 * Antes siempre decían "Iniciar sesión" aunque la persona ya estuviera
 * adentro, y eso se lee como que la sesión se cerró sola al volver al
 * directorio. Ahora reflejan el estado real.
 */
export default async function AccionesSesion({
  compacto = false,
}: {
  compacto?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const secundario = compacto
    ? "whitespace-nowrap rounded-lg px-2.5 py-2 text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange sm:px-4 sm:text-[12.5px]"
    : "hidden rounded-lg px-3 py-2 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange sm:block";

  const primario = compacto
    ? "whitespace-nowrap rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[12px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange sm:px-4 sm:text-[12.5px]"
    : "rounded-xl bg-aventurea-orange px-4 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark";

  if (user) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link href="/ranchos-eventos" className={secundario}>
          Ver el directorio
        </Link>
        <form action={cerrarSesionPublica}>
          <button type="submit" className={secundario}>
            Cerrar sesión
          </button>
        </form>
        <Link href="/mi-rancho" className={primario}>
          Mi panel
        </Link>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Link href="/mi-rancho/login" className={secundario}>
        Iniciar sesión
      </Link>
      <Link href="/publicar" className={primario}>
        {compacto ? "Publicá tu salón" : "Publicar gratis"}
      </Link>
    </div>
  );
}
