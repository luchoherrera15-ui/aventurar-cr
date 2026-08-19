"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/food/negocio", label: "Hoy" },
  { href: "/food/negocio/franjas", label: "Franjas" },
  { href: "/food/negocio/menu", label: "Menú" },
  { href: "/food/negocio/check-in", label: "Check-in" },
  { href: "/food/negocio/configuracion", label: "Configuración" },
];

export default function PanelNavFood() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-aventurea-line px-4 sm:mx-0 sm:px-0">
      {TABS.map((t) => {
        const activo = t.href === "/food/negocio" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 border-b-2 px-3.5 py-3 text-[13.5px] font-bold transition-colors ${
              activo
                ? "border-aventurea-navy text-aventurea-navy"
                : "border-transparent text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
