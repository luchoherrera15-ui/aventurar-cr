"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendarLine, IconCompass, IconHeart, IconHome, IconUserCircle } from "@/components/icons";

/**
 * LA NAVEGACIÓN INFERIOR DE FOOD.BOOKEA — el shell que le faltaba a la
 * experiencia móvil (pedido explícito del dueño: "la navegación
 * principal debe ser mediante una bottom navigation moderna, fija y
 * limpia").
 *
 * CINCO pestañas, un componente aparte y no un prop de FoodHeader: es
 * SOLO para las pantallas del CONSUMIDOR (home, descubrir, mis
 * reservas, favoritos, perfil) — nunca para /food/negocio (el panel
 * del dueño ya tiene su propio rail lateral) ni para /food/demo (que
 * vive en su propia burbuja de marketing, con su propio nav). Por eso
 * cada página de consumidor la importa a mano en vez de vivir en un
 * layout compartido de /food — un layout ahí envolvería también al
 * panel del negocio y a la demo, que no la quieren.
 *
 * `lg:hidden`: en escritorio la navegación ya la resuelve FoodHeader/
 * SiteHeader; esta barra es el reemplazo de esa navegación SOLO en el
 * ancho donde un header con seis links no entra ni se usa con el
 * pulgar. Fija abajo, con el `safe-area-inset-bottom` que ya usa el
 * resto del sitio en sus barras fijas (mobile-booking-bar.tsx,
 * rancho-portal.tsx) para no quedar tapada por la barra de gestos del
 * teléfono.
 */
const TABS: { href: string; label: string; Icono: typeof IconHome; coincide: (ruta: string) => boolean }[] = [
  {
    href: "/food",
    label: "Inicio",
    Icono: IconHome,
    coincide: (r) => r === "/food",
  },
  {
    href: "/food/descubrir",
    label: "Descubrir",
    Icono: IconCompass,
    coincide: (r) => r.startsWith("/food/descubrir") || r.startsWith("/food/restaurante"),
  },
  {
    href: "/food/mis-reservas",
    label: "Reservas",
    Icono: IconCalendarLine,
    coincide: (r) => r.startsWith("/food/mis-reservas") || r.startsWith("/food/reserva"),
  },
  {
    href: "/food/favoritos",
    label: "Favoritos",
    Icono: IconHeart,
    coincide: (r) => r.startsWith("/food/favoritos"),
  },
  {
    href: "/food/perfil",
    label: "Perfil",
    Icono: IconUserCircle,
    coincide: (r) => r.startsWith("/food/perfil"),
  },
];

export default function BottomNavFood() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación de FOOD.BOOKEA"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-aventurea-line bg-white/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-[560px] items-stretch justify-between px-1">
        {TABS.map((t) => {
          const activa = t.coincide(pathname ?? "");
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={activa ? "page" : undefined}
              className="presionable flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1"
            >
              <t.Icono
                className={`h-[22px] w-[22px] transition-colors ${
                  activa ? "text-aventurea-orange" : "text-aventurea-ink-soft"
                }`}
              />
              <span
                className={`text-[10.5px] font-bold transition-colors ${
                  activa ? "text-aventurea-orange" : "text-aventurea-ink-soft"
                }`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
