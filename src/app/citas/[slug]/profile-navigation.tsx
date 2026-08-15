"use client";

import { useEffect, useState } from "react";
import type { SeccionPerfil } from "./perfil-tipos";

const ETIQUETA_SECCION: Record<SeccionPerfil, string> = {
  servicios: "Servicios",
  equipo: "Equipo",
  portfolio: "Portfolio",
  resenas: "Reseñas",
  informacion: "Información",
};

/**
 * Nav interna del perfil: enlaces de ancla a las secciones que
 * REALMENTE están en el DOM. `secciones` la arma la página con las que
 * de verdad se van a renderizar (un negocio sin equipo no ofrece un
 * link a "Equipo") — este componente no adivina, recibe la lista ya
 * resuelta.
 *
 * Queda pegada bajo el header del sitio (top-16: el header mide 64px,
 * ver SiteHeader) y resalta la sección visible con
 * IntersectionObserver — nada de medir el scroll a mano.
 *
 * Offset de las secciones: el resto del perfil usa `scroll-mt-24` en
 * el contenedor de cada sección (así lo hace hoy `#servicios` en
 * agenda-negocio.tsx) — replicá ese mismo valor en `#equipo`,
 * `#portfolio`, `#resenas` e `#informacion` para que el salto de ancla
 * no tape el título de la sección detrás de esta nav.
 */
export default function ProfileNavigation({
  secciones,
}: {
  secciones: SeccionPerfil[];
}) {
  const [activa, setActiva] = useState<SeccionPerfil | null>(secciones[0] ?? null);

  useEffect(() => {
    if (secciones.length === 0) return;
    const elementos = secciones
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elementos.length === 0) return;

    // Franja "activa" justo debajo de esta nav: un margen negativo
    // grande arriba (altura del header + la nav) y otro grande abajo
    // (para no marcar como activa una sección que apenas asoma al pie
    // de la pantalla) simulan esa franja sin medir nada a mano.
    const observer = new IntersectionObserver(
      (entries) => {
        const visibles = entries.filter((e) => e.isIntersecting);
        if (visibles.length === 0) return;
        const masArriba = visibles.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        );
        setActiva(masArriba.target.id as SeccionPerfil);
      },
      { rootMargin: "-130px 0px -70% 0px", threshold: 0 },
    );

    elementos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [secciones]);

  if (secciones.length === 0) return null;

  return (
    <nav
      aria-label="Secciones del perfil"
      className="sticky top-16 z-30 mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface/95 shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)] backdrop-blur-sm"
    >
      <div className="flex gap-1 overflow-x-auto p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {secciones.map((id) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activa === id ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              setActiva(id);
            }}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors ${
              activa === id
                ? "bg-aventurea-blue-light text-aventurea-navy"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {ETIQUETA_SECCION[id]}
          </a>
        ))}
      </div>
    </nav>
  );
}
