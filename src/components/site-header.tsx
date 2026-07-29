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
        <Link href="/eventos" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- el
              logo oficial es un PNG estático: next/image no aporta
              nada acá. */}
          <img
            src="/logo-bookea.png"
            alt="Bookear"
            className="h-8 w-auto shrink-0 sm:h-9"
          />
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
