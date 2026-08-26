import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import FoodHeader from "@/components/food/food-header";
import FoodFooter from "@/components/food/food-footer";
import BottomNavFood from "@/components/food/bottom-nav-food";
import {
  IconCalendarLine,
  IconChevronRight,
  IconHeart,
  IconSalir,
  IconStore,
  IconUserCircle,
} from "@/components/icons";

export const metadata: Metadata = { title: "Mi perfil · FOOD.BOOKEA", robots: { index: false } };

/**
 * EL PERFIL DE FOOD.BOOKEA — la quinta pestaña del bottom nav.
 *
 * No es una cuenta paralela: la sesión, el nombre y el correo son los
 * MISMOS de siempre (`perfiles`, la tabla única de Bookea). Esta
 * pantalla es solo la puerta de FOOD hacia Mis reservas, Favoritos, la
 * cuenta general y — si la persona además es dueña de un negocio de
 * FOOD (`miNegocioFood()`, ya existía para el panel) — un acceso
 * directo a su panel. Nada de eso se inventa acá; se reutiliza tal
 * cual.
 */
export default async function PerfilFoodPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta?volver=food:perfil");

  const [{ data: perfil }, negocio] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    miNegocioFood(),
  ]);

  const nombre = (perfil?.nombre as string | null)?.trim() || user.email || "Tu cuenta";

  async function cerrarSesionFood() {
    "use server";
    const db = await createClient();
    // `scope: "local"` — cierra ESTA sesión y nada más.
    //
    // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
    // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
    // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
    // quedaba también deslogueado del teléfono, sin ninguna pista de por
    // qué. Un botón que dice «cerrar sesión» cierra la de acá.
    await db.auth.signOut({ scope: "local" });
    redirect("/food");
  }

  return (
    <>
      <FoodHeader />
      <main className="mx-auto min-h-[70svh] max-w-[640px] px-4 pb-28 pt-8 sm:px-6 sm:pb-10">
        <div className="flex items-center gap-3.5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-aventurea-navy text-white">
            <IconUserCircle className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-extrabold text-aventurea-ink">{nombre}</p>
            {user.email && <p className="truncate text-[13px] text-aventurea-ink-soft">{user.email}</p>}
          </div>
        </div>

        {negocio && (
          <Link
            href="/food/negocio"
            className="mt-6 flex items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 transition-colors hover:border-aventurea-navy"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-aventurea-navy text-white">
              <IconStore className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-aventurea-ink">{negocio.nombre}</p>
              <p className="text-[12px] text-aventurea-ink-soft">Administrar tu panel de negocio →</p>
            </div>
          </Link>
        )}

        <nav className="mt-6 flex flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white">
          <ItemPerfil href="/food/mis-reservas" Icono={IconCalendarLine} label="Mis reservas" />
          <ItemPerfil href="/food/favoritos" Icono={IconHeart} label="Favoritos" />
          <ItemPerfil href="/cuenta" Icono={IconUserCircle} label="Editar mi cuenta de Bookea" />
          {!negocio && <ItemPerfil href="/food/negocio/nuevo" Icono={IconStore} label="Publicá tu restaurante" />}
        </nav>

        <nav className="mt-4 flex flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white">
          <ItemPerfil href="/terminos" Icono={IconChevronRight} label="Términos y condiciones" oculta />
          <ItemPerfil href="/privacidad" Icono={IconChevronRight} label="Privacidad" oculta />
        </nav>

        <form action={cerrarSesionFood} className="mt-4">
          <button
            type="submit"
            className="presionable flex w-full items-center gap-3 rounded-2xl border border-aventurea-line bg-white p-4 text-left transition-colors hover:border-red-300"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
              <IconSalir className="h-5 w-5" />
            </span>
            <span className="text-[13.5px] font-extrabold text-red-700">Cerrar sesión</span>
          </button>
        </form>
      </main>
      <div className="lg:hidden" style={{ height: "64px" }} aria-hidden />
      <FoodFooter />
      <BottomNavFood />
    </>
  );
}

function ItemPerfil({
  href,
  Icono,
  label,
  oculta = false,
}: {
  href: string;
  Icono: typeof IconUserCircle;
  label: string;
  /** true = el ícono de la izquierda es puramente decorativo/genérico
   *  (Ayuda, Términos, Privacidad reusan la flecha como marcador, no
   *  como un ícono propio de la sección — evita inventar tres íconos
   *  temáticos para tres links de bajo tráfico). */
  oculta?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-aventurea-line p-4 transition-colors last:border-b-0 hover:bg-aventurea-cream-2"
    >
      {!oculta && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-aventurea-cream-2 text-aventurea-navy">
          <Icono className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1 text-[13.5px] font-bold text-aventurea-ink">{label}</span>
      <IconChevronRight className="h-4 w-4 shrink-0 text-aventurea-ink-soft" />
    </Link>
  );
}
