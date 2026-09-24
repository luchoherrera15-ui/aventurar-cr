import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { toString as qrATexto } from "qrcode";
// Los colores y las cuatro animaciones de esta landing viven en su
// propia hoja: el resto del sitio no las descarga nunca.
import "./invitaciones.css";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconChatBubble } from "@/components/icons";
import { CATALOGO_INVITACIONES } from "@/lib/catalogo-invitaciones";
import { IMAGEN_OG } from "@/lib/sitio";
import { PRODUCTOS_INDIVIDUALES, promoVigente, tipoCambioUSD } from "@/lib/paquetes-invitaciones";
import DemoConfirmaciones from "./demo-confirmaciones";
import HeroVivo from "./hero-vivo";
import PiezasValor from "./piezas-valor";
import PreciosCatalogo from "./precios-catalogo";
import VitrinaEjemplos from "./vitrina-ejemplos";

/**
 * /invitaciones — la landing de invitaciones digitales (rehecha, sep 2026).
 *
 * LA IDEA: en vez de contar el producto, ponerlo a andar en la página.
 *
 *   1. El héroe tiene un teléfono con una invitación REAL adentro
 *      (/i/{slug} en un iframe): se desliza, se abre el sobre, se toca
 *      «Confirmar». Y con pestañas para pasar de una boda a un
 *      quinceaños.
 *   2. «Probalo»: tres pasos donde quien mira escribe su nombre, toca
 *      «Sí, voy» y se ve a sí mismo aparecer en la lista del anfitrión,
 *      con los contadores moviéndose. Es la relación causa→efecto que
 *      vende el producto.
 *   3. Lo que se lleva: cuenta regresiva corriendo, Maps y Waze que
 *      abren, preguntas que se prenden y apagan, y un QR que escanea.
 *   4. La vitrina: cada ejemplo corriendo en el teléfono, filtrado por
 *      ocasión.
 *   5. Precios (el mismo catálogo de siempre) y el cierre.
 *
 * LA LÍNEA DE DISEÑO SIGUE SIENDO LA NUESTRA: el navy de la marca como
 * fondo, el naranja como acento, la Figtree del sitio, y el «papel» de
 * la invitación (crema y vino de «Carta de Amor») para todo lo que
 * muestra al invitado. Los pares de color están medidos en
 * invitaciones.css. El CTA naranja lleva letra navy y no blanca: blanco
 * sobre ese naranja da 2,9:1 y no pasa.
 *
 * Lo que había antes —el riel de slides de colores (`riel-ejemplos.tsx`)
 * y la hoja `reel.css`— dejó de montarse acá, igual que se hizo con el
 * `Reel` en agosto: los archivos siguen en la carpeta hasta que el dueño
 * decida borrarlos.
 */

// La serif del papel de la invitación: la misma del álbum y de las
// invitaciones, así el producto se ve de una sola familia.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  // Sin "| Bookea": el layout raíz ya lo agrega con su template.
  title: "Invitaciones digitales",
  description:
    "Un link que se abre en cualquier teléfono, con música, historia y ubicación. Tus invitados confirman con un toque y la lista se te arma sola. Probala acá mismo.",
  /**
   * ⚠️ SIN ESTE BLOQUE, COMPARTIR ESTA PÁGINA MOSTRABA OTRA COSA: el
   * openGraph del layout raíz se hereda entero cuando la página no
   * declara el suyo, y WhatsApp mostraba la portada del marketplace.
   */
  openGraph: {
    title: "Invitaciones digitales que tus invitados abren de una",
    description:
      "Un link que se abre en cualquier teléfono. Confirman con un toque y la lista se te arma sola. Probala en la página.",
    locale: "es_CR",
    siteName: "Bookea",
    type: "website",
    images: [IMAGEN_OG],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invitaciones digitales que tus invitados abren de una",
    description:
      "Un link que se abre en cualquier teléfono. Confirman con un toque y la lista se te arma sola.",
  },
};

/** El álbum de ejemplo: lo abre el QR de «Lo que se lleva» y el link de al lado. */
const ALBUM_EJEMPLO = "/a/fotos-ejemplo-cumpleanos-star-wars-de-luis-herrera";

/**
 * Las pestañas del teléfono del héroe: una demo por ocasión, en el
 * orden en que se muestran. Los slugs existen en la base (el catálogo
 * los verifica); «Carta de Amor» va primera por pedido del dueño.
 */
const DEMOS_DEL_HERO = ["demo-boda-premium", "demo-quince-anos", "demo-princesas", "demo-corporativa"]
  .map((slug) => CATALOGO_INVITACIONES.find((d) => d.slug === slug))
  .filter((d): d is NonNullable<typeof d> => !!d);

/**
 * El QR del álbum, generado en el servidor (esta página es estática,
 * así que corre una vez por build) y pasado al cliente como un path:
 * meter la librería `qrcode` en el bundle del navegador serían ~50 KB
 * por un solo dibujo.
 */
async function qrDelAlbum(): Promise<{ viewBox: string; d: string }> {
  const svg = await qrATexto(`https://bookea.lat${ALBUM_EJEMPLO}`, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
  });
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 33 33";
  // El path de los módulos es el ÚLTIMO <path>: el primero es el fondo.
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  return { viewBox, d: paths[paths.length - 1] ?? "" };
}

export default async function InvitacionesLanding() {
  // El «desde $X» sale del producto más barato del catálogo, calculado
  // y no escrito a mano, para que no quede viejo al cambiar precios.
  const desdeUSD = Math.min(...PRODUCTOS_INDIVIDUALES.map((p) => p.precioUSD));
  const desdeColones =
    "₡" + (Math.round((desdeUSD * tipoCambioUSD()) / 100) * 100).toLocaleString("es-CR");
  const qr = await qrDelAlbum();

  return (
    <main className="inv-landing min-h-svh">
      <RevealOnScroll />

      {/* ================= HÉROE ================= */}
      <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 lg:pb-24 lg:pt-20">
        {/* Un halo naranja detrás del teléfono, muy bajo: profundidad
            sin convertirse en un degradado de los que el sitio evita. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-[8%] top-[30%] h-[560px] w-[560px] -translate-y-1/2 rounded-full opacity-[0.14] blur-[130px]"
          style={{ background: "var(--inv-naranja)" }}
        />

        <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-12 lg:grid-cols-[1.1fr_auto] lg:gap-16">
          <div className="text-center lg:text-left">
            <h1
              className="titulo inv-entra mx-auto max-w-[17ch] text-[clamp(40px,6.4vw,72px)] leading-[1.02] lg:mx-0"
              style={{ ["--inv-orden" as string]: 0 }}
            >
              Una invitación que se abre como un regalo.
            </h1>
            <p
              className="inv-entra mx-auto mt-6 max-w-[50ch] text-[clamp(16px,2vw,20px)] leading-relaxed text-[var(--inv-tinta-suave)] lg:mx-0"
              style={{ ["--inv-orden" as string]: 1 }}
            >
              Un link que se abre en cualquier teléfono, con música, historia y ubicación.
              Tus invitados confirman con un toque; vos ves la lista armarse sola.
            </p>

            <div
              className="inv-entra mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              style={{ ["--inv-orden" as string]: 2 }}
            >
              <Link
                href="#precios"
                className="presionable inline-flex min-h-[48px] items-center rounded-full bg-[var(--inv-naranja)] px-7 text-[14.5px] font-bold text-[var(--inv-naranja-tinta)]"
              >
                Ver precios
              </Link>
              <Link
                href="#probar"
                className="presionable inline-flex min-h-[48px] items-center rounded-full border border-[var(--inv-linea)] px-7 text-[14.5px] font-bold transition-colors duration-[var(--duracion-micro)] hover:border-[var(--inv-tinta-suave)]"
              >
                Probar una invitación
              </Link>
            </div>
            <p
              className="inv-entra mt-4 text-[13px] text-[var(--inv-tinta-suave)]"
              style={{ ["--inv-orden" as string]: 3 }}
            >
              Desde ${desdeUSD} · {desdeColones} aproximadamente · diseñada a mano para tu evento
            </p>
          </div>

          <HeroVivo demos={DEMOS_DEL_HERO} claseSerif={cormorant.className} />
        </div>
      </section>

      {/* ================= PROBALO ================= */}
      <section id="como-funciona" className="scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[62ch] text-center">
            <p className="text-[13px] font-bold text-[var(--inv-naranja)]">Probalo acá mismo</p>
            <h2 className="titulo mt-3 text-[clamp(30px,5vw,54px)] leading-[1.06]">
              Escribí tu nombre y mirá cómo aparecés en la lista.
            </h2>
            <p className="mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-[var(--inv-tinta-suave)]">
              Es lo que pasa con cada invitado: vos mandás el link, ellos confirman en
              un toque, y a vos te llega la lista armada. Nada de esto se guarda: es
              para que lo veas.
            </p>
          </div>
          <div data-reveal className="mt-12">
            <DemoConfirmaciones claseSerif={cormorant.className} />
          </div>
        </div>
      </section>

      {/* ================= LO QUE SE LLEVA ================= */}
      <section id="que-incluye" className="scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28" style={{ background: "var(--inv-fondo-2)" }}>
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[60ch] text-center">
            <p className="text-[13px] font-bold text-[var(--inv-naranja)]">Lo que se lleva tu evento</p>
            <h2 className="titulo mt-3 text-[clamp(30px,5vw,54px)] leading-[1.06]">
              Todo funciona. Acá también.
            </h2>
            <p className="mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-[var(--inv-tinta-suave)]">
              Cada pieza de abajo está andando de verdad: la cuenta corre, los mapas
              abren y el QR se escanea.
            </p>
          </div>
          <div data-reveal className="mt-12">
            <PiezasValor qr={qr} albumHref={ALBUM_EJEMPLO} claseSerif={cormorant.className} />
          </div>
        </div>
      </section>

      {/* ================= EJEMPLOS ================= */}
      <section id="ejemplos" className="scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[60ch] text-center">
            <p className="text-[13px] font-bold text-[var(--inv-naranja)]">Ejemplos</p>
            <h2 className="titulo mt-3 text-[clamp(30px,5vw,54px)] leading-[1.06]">
              Invitaciones que ya están andando.
            </h2>
            <p className="mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-[var(--inv-tinta-suave)]">
              No son maquetas: cada una se abre como se le abre a un invitado. Elegí
              la ocasión y deslizá adentro del teléfono.
            </p>
          </div>
          <div data-reveal className="mt-10">
            <VitrinaEjemplos demos={CATALOGO_INVITACIONES} claseSerif={cormorant.className} />
          </div>
        </div>
      </section>

      {/* ================= PRECIOS ================= */}
      <section id="precios" className="scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28" style={{ background: "var(--inv-fondo-2)" }}>
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[13px] font-bold text-[var(--inv-naranja)]">Precios</p>
            <h2 className="titulo mt-3 text-[clamp(30px,5vw,54px)] leading-[1.06]">
              Elegí lo que necesitás.
            </h2>
            <p className="mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-[var(--inv-tinta-suave)]">
              Todo se diseña desde cero para tu evento. Llevá una pieza suelta, o el
              pack si querés la invitación y el álbum juntos.
            </p>
          </div>
          <div data-reveal>
            <PreciosCatalogo colonesPorUSD={tipoCambioUSD()} promoViva={promoVigente()} />
          </div>
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-5 py-24 text-center sm:px-8 lg:py-32">
        <div data-reveal className="mx-auto w-full max-w-[760px]">
          <h2 className="titulo text-[clamp(32px,5.6vw,64px)] leading-[1.04]">
            Dejá de perseguir invitados por WhatsApp.
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-[var(--inv-tinta-suave)]">
            Contanos de tu evento y te mandamos una propuesta diseñada para vos. Si no
            te gusta, no pagás nada.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/invitaciones/pedido/intermedio"
              className="presionable inline-flex min-h-[52px] items-center rounded-full bg-[var(--inv-naranja)] px-9 text-[15px] font-bold text-[var(--inv-naranja-tinta)]"
            >
              Quiero la mía
            </Link>
            <Link
              href="#probar"
              className="presionable inline-flex min-h-[52px] items-center gap-2 rounded-full border border-[var(--inv-linea)] px-7 text-[14.5px] font-bold transition-colors duration-[var(--duracion-micro)] hover:border-[var(--inv-tinta-suave)]"
            >
              <IconChatBubble className="h-4 w-4" />
              Volver a probarla
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
