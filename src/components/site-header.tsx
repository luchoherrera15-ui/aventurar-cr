import Link from "next/link";
import type { ReactNode } from "react";
import AccionesSesion from "./acciones-sesion";

/**
 * Header público compartido por el directorio, el portal de cada
 * proveedor, el rancho insignia y /publicar. El navy ocupa solo el
 * cuadrado de la marca — el resto del header es blanco, a propósito
 * (regla del rediseño: el navy no pasa del 5% de la pantalla).
 */
export default function SiteHeader({
  breadcrumb,
  ancho = "max-w-[1600px]",
  extra,
}: {
  /** Texto después de la barra, ej. "Eventos", "Rancho de Eventos". */
  breadcrumb?: string;
  ancho?: string;
  /** Nav propia de la página (links de ancla, "volver al directorio"...). */
  extra?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-surface/90 backdrop-blur-sm">
      <div
        className={`mx-auto flex ${ancho} flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6 lg:px-10`}
      >
        <Link href="/ranchos-eventos" className="flex shrink-0 items-center gap-2">
          {/* Tile de marca: B en navy con el punto naranja del pin del
              logo — hasta que el archivo del logo viva en el repo. */}
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-navy text-[14.5px] font-bold text-white">
            B
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-aventurea-orange"
            />
          </span>
          <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight text-aventurea-ink sm:text-base">
            Bookear <span className="font-extrabold text-aventurea-orange">CR</span>
          </span>
          {breadcrumb && (
            <>
              <span className="hidden text-zinc-300 sm:inline">/</span>
              <span className="hidden text-[13px] font-light text-aventurea-ink-soft sm:inline">
                {breadcrumb}
              </span>
            </>
          )}
        </Link>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          {extra}
          <Link
            href="/publicar"
            className="hidden whitespace-nowrap text-[13.5px] font-bold text-aventurea-ink hover:text-aventurea-navy sm:block"
          >
            Publicá tu espacio
          </Link>
          <AccionesSesion />
        </div>
      </div>
    </header>
  );
}
