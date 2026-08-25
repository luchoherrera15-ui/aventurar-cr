"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconMail, IconSparkles } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  «MÁS SERVICIOS» — la puerta a lo que no es marketplace
 * ════════════════════════════════════════════════════════════════════
 *
 * Lealtad e Invitaciones son productos que Bookea le vende AL NEGOCIO,
 * no cosas que un visitante reserva. Por eso no van con las cinco
 * puertas del centro —que son categorías de reserva— sino apartadas en
 * la esquina, junto a las acciones de cuenta.
 *
 * Es la misma separación que ya hacía la barra vieja con su línea
 * divisoria antes del botón «⋯»: a la izquierda el catálogo, a la
 * derecha las herramientas. Mezclarlos haría que alguien buscando
 * dónde cortarse el pelo se encuentre con un producto de software.
 *
 * Mismo contrato de accesibilidad que el mega menú: `aria-expanded` +
 * `aria-haspopup` + `aria-controls`, cierre con click afuera y con
 * Escape devolviendo el foco al botón. Sin `role="menu"` — son enlaces
 * de navegación, y ese rol le rompe al lector de pantalla la
 * navegación por links.
 */

const SERVICIOS = [
  {
    href: "/lealtad",
    titulo: "Lealtad",
    detalle: "Tarjetas de sellos para tus clientes",
    Icono: IconSparkles,
  },
  {
    href: "/invitaciones",
    titulo: "Invitaciones",
    detalle: "Invitaciones digitales para tu evento",
    Icono: IconMail,
  },
];

export default function MasServicios() {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  useEffect(() => {
    if (!abierto) return;

    function alTocarFuera(e: PointerEvent) {
      const objetivo = e.target as Node;
      if (botonRef.current?.contains(objetivo)) return;
      if (panelRef.current?.contains(objetivo)) return;
      setAbierto(false);
    }

    function alTeclado(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAbierto(false);
      botonRef.current?.focus();
    }

    document.addEventListener("pointerdown", alTocarFuera);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("pointerdown", alTocarFuera);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  return (
    <div className="relative">
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-controls={idPanel}
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13.5px] font-bold transition-colors ${
          abierto
            ? "bg-aventurea-cream-2 text-[color:var(--navy)]"
            : "text-aventurea-ink hover:bg-aventurea-cream-2 hover:text-[color:var(--navy)]"
        }`}
      >
        Más servicios
        <IconChevronDown
          aria-hidden
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        <div
          id={idPanel}
          ref={panelRef}
          /* Anclado a la DERECHA: el botón vive en la esquina, y un panel
             que crezca hacia la derecha se saldría de la pantalla. */
          className="anim-mega-panel absolute right-0 top-[calc(100%+8px)] z-50 w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-aventurea-line bg-white p-1.5 shadow-[0_24px_60px_-28px_rgba(16,47,82,0.32)]"
        >
          {SERVICIOS.map(({ href, titulo, detalle, Icono }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-aventurea-cream-2"
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-orange-light text-bookea-naranja-fuerte [&_svg]:h-4 [&_svg]:w-4"
              >
                <Icono />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-extrabold text-aventurea-ink">
                  {titulo}
                </span>
                <span className="block text-[12px] leading-snug text-aventurea-ink-soft">
                  {detalle}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
