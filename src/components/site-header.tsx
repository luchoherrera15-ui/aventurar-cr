import Link from "next/link";
import type { ReactNode } from "react";
import { tieneNegocioPropio } from "@/lib/negocio-propio";
import AccionesSesion from "./acciones-sesion";

/**
 * Header público compartido por el directorio, el portal de cada
 * proveedor, el rancho insignia y /publicar. El navy ocupa solo el
 * cuadrado de la marca — el resto del header es blanco, a propósito
 * (regla del rediseño: el navy no pasa del 5% de la pantalla).
 */
export default async function SiteHeader({
  breadcrumb,
  ancho = "max-w-[1600px]",
  extra,
  conPublicar = true,
}: {
  /** Texto después de la barra, ej. "Eventos", "Rancho de Eventos". */
  breadcrumb?: string;
  ancho?: string;
  /** Nav propia de la página (links de ancla, "volver al directorio"...). */
  extra?: ReactNode;
  /** false = sin el link "Publicá tu espacio" (páginas de proveedor,
   * donde el header ya carga bastante; el link sigue en el menú). */
  conPublicar?: boolean;
}) {
  // A quien ya publicó no se le ofrece publicar: lo que necesita es la
  // puerta a su panel.
  const yaPublica = conPublicar ? await tieneNegocioPropio() : false;

  return (
    <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-surface/90 backdrop-blur-sm">
      <div
        className={`mx-auto flex ${ancho} flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-6 lg:px-10`}
      >
        {/* El logo lleva al home (la portada de las tres verticales) —
            antes iba directo a /eventos porque / era solo un redirect. */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- el
              logo oficial es un PNG estático: next/image no aporta
              nada acá.

              -nav.png es el mismo logo a 440×109 y con paleta de 128
              colores: 4.2 KB contra los 29.8 KB del master de
              1251×309, que se estaba bajando entero para pintarlo a
              146×36. Como está en el header Y en el pie, son ~51 KB
              menos por página, en todas las páginas del sitio. El
              master sigue en /logo-bookea.png para lo que necesite
              resolución (correos, OG, la app móvil).

              width/height explícitos: sin ellos el navegador no sabe
              cuánto espacio reservar hasta que baja la imagen. */}
          <img
            src="/logo-bookea-nav.png"
            alt="Bookear"
            width={440}
            height={109}
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
          {conPublicar && (
            <Link
              href={yaPublica ? "/mi-negocio" : "/publicar"}
              className="hidden whitespace-nowrap text-[13.5px] font-bold text-aventurea-ink hover:text-aventurea-navy sm:block"
            >
              {yaPublica ? "Manejá tu espacio" : "Publicá tu espacio"}
            </Link>
          )}
          <AccionesSesion />
        </div>
      </div>
    </header>
  );
}
