import Link from "next/link";
import AccionesSesion from "@/components/acciones-sesion";

/**
 * El header propio de FOOD.BOOKEA — rediseño ago 2026 sobre el mockup
 * del dueño: logo "Bookea / FOOD", navegación central, botón navy
 * "Publicá tu restaurante" y el menú de sesión compartido.
 *
 * Con `demo` (la vitrina comercial /food/demo) la navegación se queda
 * DENTRO de la demo (incluye Favoritos y las reservas demo) y aparece
 * un chip DEMO junto al logo — mismo componente y no una copia, para
 * que cualquier ajuste visual del header llegue a los dos modos.
 *
 * Es un componente aparte y no un prop nuevo en `SiteHeader` a
 * propósito: `SiteHeader` lo usan más de treinta rutas (grep
 * "SiteHeader" en src/app) y FOOD tiene su propia navegación y altura.
 * `AccionesSesion` (el menú de sesión) sí se reutiliza tal cual.
 */
const NAV_REAL: { href: string; label: string }[] = [
  { href: "/food", label: "Explorar" },
  { href: "/food#ofertas", label: "Ofertas" },
  { href: "/food#restaurantes", label: "Restaurantes" },
  { href: "/food/mis-reservas", label: "Mis reservas" },
];

const NAV_DEMO: { href: string; label: string }[] = [
  { href: "/food/demo", label: "Explorar" },
  { href: "/food/demo#ofertas", label: "Ofertas" },
  { href: "/food/demo/favoritos", label: "Favoritos" },
  { href: "/food/demo/reservas", label: "Mis reservas" },
];

export default function FoodHeader({ demo = false }: { demo?: boolean }) {
  const nav = demo ? NAV_DEMO : NAV_REAL;
  return (
    <header className="sticky top-0 z-50 border-b border-aventurea-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-x-4 px-4 sm:px-6">
        <Link href={demo ? "/food/demo" : "/food"} className="flex shrink-0 items-baseline gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- mismo
              criterio que site-header.tsx: el logo oficial es un PNG
              estático servido tal cual. */}
          <img
            src="/logo-bookea-nav-v4.png"
            alt="Bookea"
            width={440}
            height={138}
            className="h-7 w-auto shrink-0 self-center"
          />
          <span className="text-[15px] font-bold text-aventurea-line-fuerte" aria-hidden>
            /
          </span>
          <span className="text-[15px] font-extrabold tracking-wide text-aventurea-orange">
            FOOD
          </span>
          {demo && (
            <span className="ml-1 self-center rounded-md bg-aventurea-navy px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-white">
              Demo
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {nav.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="whitespace-nowrap text-[13.5px] font-bold text-aventurea-ink transition-colors hover:text-aventurea-orange"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/food/negocio"
            className="hidden whitespace-nowrap rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 sm:block"
          >
            Publicá tu restaurante
          </Link>
          <AccionesSesion />
        </div>
      </div>
    </header>
  );
}
