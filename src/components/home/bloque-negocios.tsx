import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

/**
 * "Tu talento merece ser encontrado" — el bloque del home para el otro
 * lado del marketplace: el que publica.
 *
 * ⚠️ EL MOCK DEL PANEL NO LLEVA CIFRAS.
 *
 * La maqueta mostraba "28 reservas" y "₡184k". No son reales ni
 * pretendían serlo, pero quien mira la portada no tiene forma de
 * saberlo: en una sección que promete "así te va a ir", un número
 * inventado se lee como un dato. Se quedan las etiquetas y las barras
 * —que comunican exactamente lo mismo: hay panel, hay agenda, hay
 * ingresos medidos— y no queda nada que defender.
 *
 * El mock entero va `aria-hidden`: es una ilustración del producto, y
 * todo lo que dice de verdad ya está en el copy de la izquierda.
 *
 * El bloque cierra en CLARO, no en navy. Es a propósito: `SiteFooter`
 * es claro por decisión propia ("dos navys pegados se leen como uno
 * solo") y no se toca desde acá.
 */

/* Las alturas de la barras del gráfico, en el orden de la maqueta. La
   cuarta es la destacada — un pico, no una línea plana, que es lo que
   hace que un gráfico de adorno se lea como un gráfico. */
const BARRAS: { alto: string; destacada?: boolean }[] = [
  { alto: "h-[45%]" },
  { alto: "h-[72%]" },
  { alto: "h-[58%]" },
  { alto: "h-[90%]", destacada: true },
  { alto: "h-[65%]" },
  { alto: "h-[72%]" },
  { alto: "h-[80%]" },
];

export default function BloqueNegocios() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="bento grid items-center gap-10 border border-aventurea-orange/25 bg-aventurea-orange-light p-7 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-16">
          <div data-reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
              Para profesionales y negocios
            </p>
            <h2 className="titulo mt-3.5 max-w-[14ch] text-balance text-[clamp(28px,4vw,48px)] text-aventurea-ink">
              Tu talento merece ser encontrado.
            </h2>
            <p className="mt-5 max-w-[46ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              Mostrá tus servicios, recibí reservas y administrá tu
              agenda o tus cotizaciones desde un solo lugar. Publicar es
              gratis.
            </p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link href="/publicar" className="btn-naranja presionable">
                Publicá tu negocio gratis
                <IconChevronRight className="h-3.5 w-3.5" />
              </Link>
              {/* El segundo enlace de la maqueta ("Conocer las
                  herramientas") apuntaba a #como-funciona, que explica
                  cómo se RESERVA — la sección equivocada para quien
                  vende. `/publicar/ejemplos` es la que de verdad
                  responde la duda que tiene en la cabeza en este punto:
                  cómo va a quedar su página. */}
              <Link
                href="/publicar/ejemplos"
                className="group inline-flex items-center gap-2 text-[13px] font-extrabold text-aventurea-navy hover:underline"
              >
                Ver cómo se ve mi página
                <IconChevronRight className="h-3 w-3 text-aventurea-orange transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* ── Mock del panel (decoración) ───────────────────────── */}
          <div
            aria-hidden
            data-reveal
            className="overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface shadow-flotante lg:rotate-[2.5deg]"
          >
            <div className="flex h-[52px] items-center gap-3 border-b border-aventurea-line px-4 sm:px-5">
              {/* El logo, sugerido con una barra: meter el PNG real en un
                  mock lo convertiría en una captura de pantalla falsa. */}
              <span className="h-2.5 w-14 rounded-full bg-aventurea-navy/75" />
              <span className="text-[9.5px] font-bold text-aventurea-ink-soft">
                Panel de negocio
              </span>
              <span className="ml-auto h-6 w-6 rounded-full bg-aventurea-cream-2" />
            </div>

            <div className="grid min-h-[250px] grid-cols-[48px_1fr] sm:grid-cols-[68px_1fr]">
              <div className="space-y-5 bg-aventurea-navy px-3 py-6 sm:px-5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="block h-1.5 w-6 rounded-full bg-white/35"
                  />
                ))}
              </div>

              <div className="p-4 sm:p-7">
                <p className="text-[10.5px] font-extrabold text-aventurea-navy">
                  Esta semana
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {["Reservas", "Ingresos"].map((etiqueta) => (
                    <div
                      key={etiqueta}
                      className="rounded-xl bg-aventurea-cream-2 p-3 sm:p-4"
                    >
                      <p className="text-[8.5px] font-bold text-aventurea-ink-soft">
                        {etiqueta}
                      </p>
                      {/* Donde iba el número. Barra corta y sólida, no
                          `esqueleto`: el barrido animado se leería como
                          "esto está cargando" y esto no carga nunca. */}
                      <span className="mt-2.5 block h-3.5 w-12 rounded-md bg-aventurea-navy/15" />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex h-[92px] items-end justify-around rounded-xl bg-aventurea-cream-2/60 px-3 pt-4">
                  {BARRAS.map((barra, i) => (
                    <span
                      key={i}
                      className={`w-[7%] rounded-t-md ${barra.alto} ${
                        barra.destacada
                          ? "bg-aventurea-sky"
                          : "bg-aventurea-sky-light"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
