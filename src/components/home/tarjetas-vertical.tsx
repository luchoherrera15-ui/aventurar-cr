import Image from "next/image";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { estiloRevelado } from "@/components/revelar";

/**
 * "¿Qué querés reservar hoy?" — la bifurcación del home: dos tarjetas
 * grandes, una por vertical, que mandan a `/citas` y a `/eventos`.
 *
 * Es la sección que decide el recorrido, así que no lleva datos: un
 * conteo de negocios ("2 negocios") no vende, y las dos verticales
 * tienen que verse igual de sólidas aunque una todavía esté arrancando.
 *
 * ⚠️ LAS FOTOS SON PROPIAS, no de Unsplash como en la maqueta.
 * `public/fondos/portada-citas.jpg` y `portada-eventos.jpg` ya estaban
 * pagadas y en el repo — las usaba solo `fondo-portada.tsx`, que quedó
 * huérfano. Traer fotos de un banco de imágenes teniendo estas sería
 * pagar dos veces por lo mismo y, encima, meter un host externo en la
 * ruta más visitada del sitio.
 */

const TARJETAS: {
  numero: string;
  kicker: string;
  titulo: string;
  cta: string;
  href: string;
  foto: string;
  /* La piel del bloque, que solo se ve mientras la foto baja. */
  piel: string;
}[] = [
  {
    numero: "01",
    kicker: "Citas y servicios",
    titulo: "Tiempo para vos, en el momento ideal.",
    cta: "Explorar servicios",
    href: "/citas",
    foto: "/fondos/portada-citas.jpg",
    piel: "bento-navy",
  },
  {
    numero: "02",
    kicker: "Eventos",
    titulo: "Todo para crear un momento inolvidable.",
    cta: "Planear mi evento",
    href: "/eventos",
    foto: "/fondos/portada-eventos.jpg",
    // `bento-naranja` PINTA AZUL (#2f7cbe con texto blanco): el nombre
    // quedó de una etapa anterior de la marca. Se usa esa piel y no
    // `bento-azul` porque `bento-azul` es el azul CLARO con texto
    // oscuro, y debajo de una foto con velo navy dejaría un destello
    // claro mientras la imagen baja — justo el flash que la piel viene
    // a evitar. Estas dos pieles son las únicas que ya nacen con el
    // texto blanco que va encima de la foto.
    piel: "bento-naranja",
  },
];

export default function TarjetasVertical() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <header className="mx-auto max-w-[46ch] text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-bookea-naranja-fuerte">
            Dos formas de encontrar lo que buscás
          </p>
          <h2 className="titulo mt-3.5 text-balance text-[clamp(28px,4vw,48px)] text-aventurea-ink">
            ¿Qué querés reservar hoy?
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Entrá directamente al mundo que necesitás. Cada uno tiene su
            propio buscador, sus categorías y su forma de reservar.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {TARJETAS.map((t, i) => (
            <Link
              key={t.href}
              href={t.href}
              data-reveal
              style={estiloRevelado(i, 90)}
              className={`bento elevar group relative flex min-h-[300px] flex-col p-7 sm:min-h-[360px] sm:p-9 lg:min-h-[390px] ${t.piel}`}
            >
              {/* Decorativa: el enlace ya se llama solo con su texto, y
                  una descripción de la foto acá solo agregaría ruido al
                  lector de pantalla. */}
              <Image
                src={t.foto}
                alt=""
                fill
                // Calidad 60 es la del sitio para "fotos detrás de un
                // velo" (ver next.config.ts): con el degradado navy
                // encima nadie nota la diferencia y pesa ~30% menos.
                quality={60}
                // El ancho real, no "50vw": el contenedor topa en 1200 px
                // y son dos tarjetas con 20 px de aire, o sea 590 px cada
                // una. Con `50vw` en una pantalla ancha el navegador se
                // bajaba el candidato de 1920 para pintar 590.
                sizes="(min-width: 1200px) 590px, (min-width: 1024px) 46vw, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              {/* El velo de la maqueta: opaco del lado del texto,
                  transparente del otro, para que la foto se vea y el
                  texto blanco no dependa de qué haya en la imagen. En
                  móvil el degradado va de abajo hacia arriba, que es
                  donde queda el texto cuando la tarjeta es alta y
                  angosta. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-aventurea-navy via-aventurea-navy/75 to-aventurea-navy/10 sm:bg-gradient-to-r sm:from-aventurea-navy sm:via-aventurea-navy/75 sm:to-aventurea-navy/5"
              />

              {/* `flex-1` y no `h-full`: la altura de la tarjeta la fija
                  un `min-h`, o sea que es `auto` — un `height:100%`
                  contra un padre auto no resuelve y el `mt-auto` de
                  abajo dejaría de empujar el texto al pie. */}
              <div className="relative flex flex-1 flex-col">
                {/* Solo de sm para arriba. El velo cambia de dirección en
                    `sm:` y el número no se mueve: en teléfono cae arriba,
                    donde el degradado vale navy al 25 % y se transparenta
                    la foto — 2,83:1. Es decoración (`aria-hidden`), así
                    que en móvil simplemente no va, igual que la flechita
                    de grilla-categorias. */}
                <span
                  aria-hidden
                  className="hidden text-[11px] font-extrabold tracking-[0.1em] text-white/55 sm:block"
                >
                  {t.numero}
                </span>

                <div className="mt-auto pt-12 sm:max-w-[68%]">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange-light">
                    {t.kicker}
                  </p>
                  <h3 className="titulo mt-2.5 text-balance text-[clamp(23px,2.6vw,34px)] text-white">
                    {t.titulo}
                  </h3>
                  <span className="mt-6 inline-flex items-center gap-2 text-[12.5px] font-extrabold text-white">
                    {t.cta}
                    <IconChevronRight className="h-3.5 w-3.5 text-aventurea-orange transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
