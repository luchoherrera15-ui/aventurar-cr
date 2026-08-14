import { IconCheck, IconChair, IconUsers } from "@/components/icons";
import type { BadgeNegocio } from "./perfil-tipos";

/**
 * El ícono de cada tipo de insignia. `icons.tsx` no tiene un set de
 * parqueo/wifi/tarjeta (son conceptos de "comodidad del local", no de
 * navegación ni de categoría) — para esos tres se usa un emoji simple,
 * tal como pide el brief, en vez de sumar íconos de línea nuevos para
 * tres casos puntuales.
 */
function IconoBadge({ icono }: { icono: BadgeNegocio["icono"] }) {
  switch (icono) {
    case "check":
      return <IconCheck className="h-3.5 w-3.5 shrink-0 text-aventurea-green" />;
    case "silla":
      return <IconChair className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />;
    case "espera":
      return <IconUsers className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />;
    case "parqueo":
      return (
        <span aria-hidden className="text-[14px] leading-none">
          🚗
        </span>
      );
    case "wifi":
      return (
        <span aria-hidden className="text-[14px] leading-none">
          📶
        </span>
      );
    case "tarjeta":
      return (
        <span aria-hidden className="text-[14px] leading-none">
          💳
        </span>
      );
  }
}

/**
 * La fila de insignias rápidas del negocio ("✓ Reserva instantánea",
 * "💳 Pago online", "🚗 Parqueo") — mismo lenguaje visual que los
 * chips de ComodidadesSeccion (detalles-seccion.tsx), pero acá vive en
 * el encabezado, arriba de todo, y con badges ya resueltos por props
 * en vez de leer `amenidades` directo.
 */
export default function BusinessBadges({ badges }: { badges: BadgeNegocio[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b.id}
          className="flex items-center gap-1.5 rounded-xl border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-aventurea-ink"
        >
          <IconoBadge icono={b.icono} />
          {b.label}
        </span>
      ))}
    </div>
  );
}
