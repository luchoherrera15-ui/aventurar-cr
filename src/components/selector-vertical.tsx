import Link from "next/link";
import { IconClock, IconSparkles } from "./icons";

/**
 * El conmutador de las verticales, arriba de cada directorio: cards
 * chiquitas (ícono + nombre) para saltar entre Citas y Eventos sin
 * robarle espacio a las cards de abajo.
 *
 * Hospedajes y Restaurantes ya no aparecen acá — se resumió a las dos
 * verticales principales. Sus páginas siguen vivas y enlazadas desde
 * el pie de página; solo se sacaron de este switcher rápido.
 */
const VERTICALES = [
  { id: "citas", href: "/citas", label: "Citas", Icono: IconClock },
  { id: "eventos", href: "/eventos", label: "Eventos", Icono: IconSparkles },
] as const;

export type VerticalActiva = (typeof VERTICALES)[number]["id"];

export default function SelectorVertical({ activo }: { activo?: VerticalActiva }) {
  return (
    <nav
      aria-label="Tipo de reserva"
      className="mx-auto grid w-full max-w-[380px] grid-cols-2 gap-2"
    >
      {VERTICALES.map(({ id, href, label, Icono }) => {
        const esActivo = id === activo;
        return (
          <Link
            key={id}
            href={href}
            aria-current={esActivo ? "page" : undefined}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-2 py-2.5 text-center text-[12px] font-bold transition-all sm:text-[13px] ${
              esActivo
                ? "border-aventurea-navy bg-aventurea-navy text-white shadow-[0_10px_24px_-12px_rgba(22,41,94,0.5)]"
                : "border-aventurea-line bg-white text-aventurea-ink-soft hover:-translate-y-0.5 hover:border-aventurea-navy/40 hover:text-aventurea-ink"
            }`}
          >
            <Icono
              className={`h-4 w-4 shrink-0 ${esActivo ? "text-aventurea-orange" : "text-aventurea-navy/60"}`}
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
