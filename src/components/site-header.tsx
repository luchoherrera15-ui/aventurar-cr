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
 *
 * ------------------------------------------------------------------
 * `segundaFila`: el buscador y las categorías, DENTRO de la misma
 * burbuja (pedido del dueño, ago 2026)
 * ------------------------------------------------------------------
 * Vivían en su propia franja blanca debajo del header
 * (`NavCategorias`, montada aparte en `page.tsx`). El pedido fue
 * literal: "que todo esté ahí compacto en ese header de burbuja
 * flotante". Así que esa franja se borró entera y su contenido pasa
 * como este prop — un segundo renglón DENTRO de la misma píldora de
 * vidrio, separado del primero por un filete fino.
 *
 * Solo tiene efecto junto con `flotante`: cuando no hay `segundaFila`
 * el contenedor exterior se queda en `h-16` fijo (el contrato de
 * siempre); en cuanto aparece, el alto pasa a ser el que pida el
 * contenido (`py-3` en vez de `h-16`) — la burbuja crece para las dos
 * filas. Como HOY solo la portada enciende `flotante`, esto no le
 * cambia el alto a ninguna otra pantalla.
 */
export default async function SiteHeader({
  breadcrumb,
  ancho = "max-w-[1600px]",
  extra,
  extraCentrado = false,
  conPublicar = true,
  flotante = false,
  segundaFila,
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
  /** El buscador + categorías de la portada, como segundo renglón
   *  DENTRO de la burbuja flotante (ver el comentario grande de
   *  arriba). Solo tiene efecto si `flotante` también está prendido. */
  segundaFila?: ReactNode;
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
        // Altura FIJA de 64px en el caso de siempre: media docena de
        // barras `sticky` de abajo adivinaban esta altura con `top-14`
        // (56px) y quedaban metidas 7px debajo del header. Con h-16 el
        // offset es exacto: top-16. Ese contrato sigue en pie para las
        // 28 pantallas que NO pasan `segundaFila`. Cuando sí la pasan
        // (hoy, solo la portada), no hay ningún `top-16` que respetar
        // en esa pantalla, así que el alto se libera (`py-3`) para que
        // la burbuja crezca a lo que pidan las dos filas.
        className={`mx-auto ${ancho} ${
          segundaFila ? "py-3" : "flex h-16 items-center"
        } ${flotante ? "px-3 sm:px-5 lg:px-8" : "px-4 sm:px-6 lg:px-10"}`}
      >
        <div
          className={
            flotante
              ? `flex w-full flex-col rounded-2xl border border-white/60 bg-white/70 shadow-[0_12px_36px_-16px_rgba(16,47,82,0.35)] backdrop-blur-xl transition-shadow ${
                  segundaFila ? "gap-2.5 px-4 py-2.5 sm:px-5" : "h-12 justify-center px-4 sm:px-5"
                }`
              : "flex w-full items-center justify-between gap-x-4"
          }
        >
          <div className="flex w-full items-center justify-between gap-x-4">
            {/* El logo lleva al home (la portada de las tres verticales)
                — antes iba directo a /eventos porque / era solo un
                redirect. */}
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

            {/* La columna del medio. Existe solo cuando alguien la pide,
                y va con `min-w-0` para que si la nav no entra se encoja
                ella en vez de empujar el logo o las acciones fuera del
                header. */}
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

          {/* El segundo renglón: buscador + categorías, dentro de la
              MISMA burbuja (ver el comentario grande de arriba). El
              filete de arriba es lo único que separa las dos filas —
              nada de un fondo o un borde propio, para que se lea como
              una sola pieza de vidrio. */}
          {segundaFila && (
            <div className="border-t border-aventurea-line/60 pt-2.5">{segundaFila}</div>
          )}
        </div>
      </div>
    </header>
  );
}
