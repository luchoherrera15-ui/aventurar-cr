import Link from "next/link";
import type { ReactNode } from "react";
import { tieneNegocioPropio } from "@/lib/negocio-propio";
import AccionesSesion from "./acciones-sesion";

/**
 * Header público compartido por el directorio, el portal de cada
 * proveedor, el rancho insignia y /publicar. El navy ocupa solo el
 * cuadrado de la marca — el resto del header es blanco, a propósito
 * (regla del rediseño: el navy no pasa del 5% de la pantalla).
 *
 * ------------------------------------------------------------------
 * `flotante`: la variante vidrio de la portada (pedido del dueño, ago
 * 2026)
 * ------------------------------------------------------------------
 * "Flotante" es SOLO un cambio de piel, nunca de contrato: el `<header>`
 * de afuera se queda en `h-16`, `sticky top-0`, exactamente como
 * siempre — de eso dependen media docena de barras `sticky top-16` de
 * otras pantallas (ver el comentario viejo, más abajo). Lo que cambia
 * vive ADENTRO, en una segunda capa: una píldora más baja (`h-12`),
 * separada de los bordes de la pantalla, con vidrio esmerilado
 * (`backdrop-blur-xl` + fondo blanco al 70%) y sombra flotante en vez
 * del borde inferior sólido de siempre. Por fuera de esa píldora el
 * `<header>` es TRANSPARENTE — es lo que hace que se lea "flotando
 * sobre la página" y no "una barra blanca más".
 *
 * Prop y no comportamiento nuevo por defecto: 29 pantallas usan este
 * componente (directorio, paneles de proveedor, /cuenta, legales…) y
 * la mayoría son utilitarias, no la vidriera de marketing que es la
 * portada. Encenderlo en todas de un tirón sería un cambio de marca
 * que nadie pidió para esas pantallas.
 */
export default async function SiteHeader({
  breadcrumb,
  ancho = "max-w-[1600px]",
  extra,
  extraCentrado = false,
  conPublicar = true,
  flotante = false,
}: {
  /** Texto después de la barra, ej. "Eventos", "Rancho de Eventos". */
  breadcrumb?: string;
  ancho?: string;
  /** Nav propia de la página (links de ancla, "volver al directorio"...). */
  extra?: ReactNode;
  /**
   * `extra` al MEDIO del header en vez de pegado a la derecha.
   *
   * Es un prop y no el comportamiento por defecto porque las otras dos
   * pantallas que usan `extra` le pasan una barra de pestañas que
   * pertenece a la derecha, junto a las acciones. Centrar por defecto
   * las movería a las dos sin que nadie lo pidiera.
   *
   * Solo la portada lo enciende: ahí `extra` son las puertas del
   * marketplace, o sea la navegación principal del sitio, y esa va al
   * medio — es la posición que el ojo busca en un header de tres
   * columnas.
   */
  extraCentrado?: boolean;
  /** false = sin el link "Publicá tu espacio" (páginas de proveedor,
   * donde el header ya carga bastante; el link sigue en el menú). */
  conPublicar?: boolean;
  /** true = la píldora flotante de vidrio (ver el comentario grande de
   *  arriba). Hoy solo la portada la enciende. */
  flotante?: boolean;
}) {
  // A quien ya publicó no se le ofrece publicar: lo que necesita es la
  // puerta a su panel.
  const yaPublica = conPublicar ? await tieneNegocioPropio() : false;

  return (
    <header
      className={`sticky top-0 z-50 ${
        flotante
          ? ""
          : "border-b border-aventurea-line bg-aventurea-surface/90 backdrop-blur-sm"
      }`}
    >
      <div
        // Altura FIJA de 64px: media docena de barras `sticky` de abajo
        // adivinaban esta altura con `top-14` (56px) y quedaban metidas
        // 7px debajo del header. Con h-16 el offset es exacto: top-16.
        // La variante flotante NO toca este alto — solo lo que hay
        // adentro cambia de piel — así que ese contrato sigue en pie.
        className={`mx-auto flex h-16 ${ancho} items-center ${flotante ? "px-3 sm:px-5 lg:px-8" : "px-4 sm:px-6 lg:px-10"}`}
      >
        <div
          className={
            flotante
              ? "flex h-12 w-full items-center justify-between gap-x-4 rounded-2xl border border-white/60 bg-white/70 px-4 shadow-[0_12px_36px_-16px_rgba(16,47,82,0.35)] backdrop-blur-xl transition-shadow sm:px-5"
              : "flex w-full items-center justify-between gap-x-4"
          }
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
              master sigue en /logo-bookea-v4.png para lo que necesite
              resolución (correos, OG, la app móvil).

              width/height explícitos: sin ellos el navegador no sabe
              cuánto espacio reservar hasta que baja la imagen. */}
          <img
            src="/logo-bookea-nav-v4.png"
            alt="Bookear"
            width={440}
            height={138}
            className={`w-auto shrink-0 ${flotante ? "h-7 sm:h-8" : "h-8 sm:h-9"}`}
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

        {/* La columna del medio. Existe solo cuando alguien la pide, y
            va con `min-w-0` para que si la nav no entra se encoja ella
            en vez de empujar el logo o las acciones fuera del header. */}
        {extraCentrado && (
          <div className="flex min-w-0 flex-1 items-center justify-center">{extra}</div>
        )}

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          {!extraCentrado && extra}
          {conPublicar && (
            <Link
              href={yaPublica ? "/mi-negocio" : "/publicar"}
              className="hidden whitespace-nowrap text-[13.5px] font-bold text-aventurea-ink hover:text-aventurea-navy sm:block"
            >
              {yaPublica ? "Manejá tu espacio" : "Publicá tu espacio"}
            </Link>
          )}
          <AccionesSesion flotante={flotante} />
        </div>
        </div>
      </div>
    </header>
  );
}
