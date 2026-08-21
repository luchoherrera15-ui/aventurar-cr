import Link from "next/link";

/**
 * El pie de FOOD.BOOKEA — rediseño ago 2026 sobre el mockup del dueño:
 * franja navy con columnas (Reservá / Para negocios / Legal / Contacto),
 * marca "Bookea / FOOD" y barra de copyright.
 *
 * Aparte de `SiteFooter` por la misma razón que `FoodHeader` es aparte
 * de `SiteHeader`: ese componente lo comparten más de treinta rutas.
 * Sin redes sociales ni teléfono: FOOD no tiene cuentas propias ni
 * línea telefónica hoy, y un link muerto es peor que ninguno.
 */
const COLUMNAS: { titulo: string; links: { href: string; label: string }[] }[] = [
  {
    titulo: "Reservá",
    links: [
      { href: "/food", label: "Restaurantes" },
      { href: "/food#ofertas", label: "Ofertas" },
      { href: "/food/mis-reservas", label: "Mis reservas" },
    ],
  },
  {
    titulo: "Para negocios",
    links: [
      { href: "/food/negocio", label: "Publicá tu restaurante" },
      { href: "/lealtad", label: "Programa de lealtad" },
    ],
  },
  {
    titulo: "Legal",
    links: [
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Políticas de privacidad" },
    ],
  },
];

export default function FoodFooter() {
  return (
    <footer className="bg-aventurea-navy text-white">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="text-[20px] font-extrabold">Bookea</span>
            <span className="text-[15px] font-bold text-white/40" aria-hidden>
              /
            </span>
            <span className="text-[15px] font-extrabold tracking-wide text-aventurea-orange">
              FOOD
            </span>
          </p>
          <p className="mt-2 text-[13px] text-white/60">Comé mejor. Pagá menos.</p>
        </div>

        {COLUMNAS.map((c) => (
          <nav key={c.titulo} aria-label={c.titulo}>
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white/50">
              {c.titulo}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] font-medium text-white/85 transition-colors hover:text-aventurea-orange"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white/50">
            Contacto
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] font-medium text-white/85">
            <li>
              <a href="mailto:hola@bookea.lat" className="transition-colors hover:text-aventurea-orange">
                hola@bookea.lat
              </a>
            </li>
            <li className="text-white/60">Costa Rica</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1280px] px-4 py-4 text-[12px] text-white/50 sm:px-6">
          © {new Date().getFullYear()} Bookea · Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
