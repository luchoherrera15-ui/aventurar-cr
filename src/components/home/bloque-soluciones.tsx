import Link from "next/link";
import { IconCheck, IconChevronRight, IconStar } from "@/components/icons";

/**
 * "Más formas de conectar": los dos productos que Bookea tiene además
 * de la reserva — invitaciones digitales y el programa de lealtad.
 *
 * Las dos listas de viñetas son TODAS ciertas y verificables contra el
 * producto que ya está en producción: Apple Wallet y Google Wallet
 * existen (`src/lib/wallet/`), la confirmación de asistencia existe, la
 * cuenta regresiva existe. Nada de esto es una promesa a futuro.
 *
 * ⚠️ NO se importa NADA de `src/components/lealtad/**` ni de
 * `src/app/lealtad/**`, y ningún nodo de acá se envuelve en la clase
 * `.lealtad`: esa clase re-declara las 7 variables raíz del sistema y
 * el home tiene que ver la paleta del marketplace. Los pases del mock
 * se dibujan con divs y tokens `aventurea-*`, acá adentro.
 *
 * Los dos mocks van `aria-hidden`: son ilustraciones del producto. Todo
 * lo que dicen de verdad está en el copy y en las viñetas.
 */

const VINETAS_INVITACIONES = [
  "Confirmación de asistencia",
  "Ubicación, agenda y cuenta regresiva",
  "Diseño adaptable a cualquier evento",
];

const VINETAS_LEALTAD = [
  "Apple Wallet y Google Wallet",
  "Sellos, puntos y beneficios",
  "Actualizaciones y comunicación directa",
];

/** La viñeta con su check en un círculo. Misma pieza en las dos tarjetas. */
function Vineta({ texto, oscura }: { texto: string; oscura?: boolean }) {
  return (
    <li
      className={`flex items-center gap-2.5 text-[13px] font-semibold ${
        oscura ? "text-white/80" : "text-aventurea-ink-soft"
      }`}
    >
      {/* El círculo va en `sky` y no en naranja también sobre navy: el
          blanco sobre naranja da 2,9:1 y no llega ni al mínimo de un
          objeto gráfico; sobre `sky` da 4,4:1. */}
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-aventurea-sky text-white">
        <IconCheck className="h-2.5 w-2.5" />
      </span>
      {texto}
    </li>
  );
}

export default function BloqueSoluciones() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <header className="mx-auto max-w-[52ch] text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-bookea-naranja-fuerte">
            Más formas de conectar
          </p>
          <h2 className="titulo mt-3.5 text-balance text-[clamp(28px,4vw,48px)] text-aventurea-ink">
            Bookea va más allá de la reserva.
          </h2>
          <p className="mx-auto mt-4 max-w-[56ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Herramientas para acompañar cada momento: desde la primera
            invitación hasta la próxima visita de tu cliente.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* ══════════ INVITACIONES DIGITALES ══════════
              El plan anotó las dos tarjetas como "naranja/navy". Ojo:
              `bento-naranja` pinta AZUL MEDIO (#2f7cbe) — el nombre
              quedó de una etapa anterior — y al lado de `bento-navy`
              daban dos azules seguidos. La tarjeta cálida de la maqueta
              se reproduce mejor con la piel blanca del sistema más el
              halo naranja, que además deja al naranja donde el rediseño
              lo quiere: como acento, no como relleno. */}
          <article
            data-reveal
            className="bento bento-blanco relative flex flex-col overflow-hidden"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-aventurea-orange/10 blur-2xl"
            />

            <div className="relative p-7 sm:p-10 lg:p-12">
              <p className="flex items-center gap-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-bookea-naranja-fuerte">
                <span aria-hidden className="h-0.5 w-5 bg-current" />
                Para tus celebraciones
              </p>
              <h3 className="titulo mt-4 max-w-[16ch] text-balance text-[clamp(24px,2.8vw,38px)] text-aventurea-ink">
                Invitaciones digitales que sí se sienten especiales.
              </h3>
              <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Diseñá una experiencia personalizada, compartila en
                segundos y administrá cada confirmación desde un solo
                enlace.
              </p>
              <ul className="mt-6 grid gap-2.5">
                {VINETAS_INVITACIONES.map((v) => (
                  <Vineta key={v} texto={v} />
                ))}
              </ul>
              <Link
                href="/invitaciones"
                className="group mt-8 inline-flex items-center gap-2 border-b border-aventurea-navy/30 pb-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-aventurea-navy"
              >
                Descubrir invitaciones
                <IconChevronRight className="h-3 w-3 text-aventurea-orange transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>

            {/* ── Mock: la invitación (decoración) ─────────────────── */}
            <div
              aria-hidden
              className="relative mt-auto h-[250px] overflow-hidden sm:h-[280px]"
            >
              <span className="absolute left-1/2 top-4 h-64 w-64 -translate-x-1/2 rounded-full bg-aventurea-orange/5" />
              {/* La carta de atrás: da profundidad y sugiere que hay más
                  de un diseño, que es literalmente el catálogo. */}
              <span className="absolute left-1/2 top-9 h-[220px] w-[176px] -translate-x-[64%] rotate-[10deg] rounded-3xl bg-aventurea-orange/20 shadow-elevado" />

              <div className="absolute left-1/2 top-4 flex h-[248px] w-[196px] -translate-x-1/2 -rotate-[3deg] flex-col items-center rounded-3xl border border-aventurea-orange/25 bg-aventurea-orange-light px-4 pb-4 pt-6 text-center shadow-flotante">
                <p className="text-[7px] font-extrabold uppercase tracking-[0.22em] text-aventurea-orange-dark">
                  Nos casamos
                </p>
                <p className="mt-3.5 font-serif text-[26px] leading-[0.95] text-aventurea-ink">
                  Sofía <span className="text-aventurea-orange">&amp;</span>
                  <br />
                  Daniel
                </p>
                <p className="mt-3 text-[7.5px] font-bold tracking-[0.12em] text-aventurea-ink-soft">
                  18 OCTUBRE · 4:00 P. M.
                </p>
                <div className="mt-3.5 w-full border-y border-aventurea-orange/25 py-2.5 font-serif text-[11px] leading-tight text-aventurea-ink">
                  Hacienda Los Robles
                  <span className="mt-0.5 block font-sans text-[6.5px] tracking-wide text-aventurea-ink-soft">
                    Alajuela, Costa Rica
                  </span>
                </div>
                <span className="mt-auto w-full rounded-lg bg-aventurea-sky py-2.5 text-[7.5px] font-extrabold uppercase tracking-[0.08em] text-white">
                  Confirmar asistencia
                </span>
              </div>

              {/* El aviso flotante se ancla al BORDE del bloque, no al
                  centro: en 390 px un `calc(50% + 70px)` se salía de la
                  tarjeta y quedaba cortado por la mitad. */}
              <div className="absolute right-0 top-[104px] flex items-center gap-2.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-2 shadow-flotante sm:right-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aventurea-green text-white">
                  <IconCheck className="h-3 w-3" />
                </span>
                <span>
                  <span className="block text-[7px] text-aventurea-ink-soft">
                    Nueva confirmación
                  </span>
                  <span className="block text-[9.5px] font-extrabold text-aventurea-navy">
                    María asistirá
                  </span>
                </span>
              </div>
            </div>
          </article>

          {/* ══════════ PROGRAMA DE LEALTAD ══════════ */}
          <article
            data-reveal
            className="bento bento-navy relative flex flex-col overflow-hidden"
          >
            <span aria-hidden className="bento-orbe -right-24 -top-24" />

            <div className="relative p-7 sm:p-10 lg:p-12">
              <p className="flex items-center gap-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange">
                <span aria-hidden className="h-0.5 w-5 bg-current" />
                Para hacerlos volver
              </p>
              <h3 className="titulo mt-4 max-w-[16ch] text-balance text-[clamp(24px,2.8vw,38px)] text-white">
                Una tarjeta de lealtad siempre en el teléfono.
              </h3>
              <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed text-white/60">
                Convertí cada visita en una razón para regresar: sellos,
                puntos, membresías y recompensas guardadas en Wallet.
              </p>
              <ul className="mt-6 grid gap-2.5">
                {VINETAS_LEALTAD.map((v) => (
                  <Vineta key={v} texto={v} oscura />
                ))}
              </ul>
              <Link
                href="/lealtad"
                className="group mt-8 inline-flex items-center gap-2 border-b border-white/35 pb-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-white"
              >
                Conocer Bookea Lealtad
                <IconChevronRight className="h-3 w-3 text-aventurea-orange transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>

            {/* ── Mock: los pases en Wallet (decoración) ───────────── */}
            <div
              aria-hidden
              className="relative mt-auto h-[250px] overflow-hidden sm:h-[280px]"
            >
              <span className="absolute left-1/2 top-3 h-64 w-64 -translate-x-1/2 rounded-full bg-white/5" />

              <div className="absolute left-1/2 top-0 w-[212px] -translate-x-1/2 rotate-[3deg] rounded-4xl border border-white/15 bg-aventurea-cream p-2 shadow-flotante">
                <div className="flex items-end justify-between px-2 pb-2.5 pt-3">
                  <span className="text-[12px] font-extrabold text-aventurea-navy">
                    Mis tarjetas
                  </span>
                  <span className="text-[7px] font-bold text-aventurea-ink-soft">
                    Wallet
                  </span>
                </div>

                {/* El pase de arriba se pinta primero y se queda ARRIBA
                    en la pila (`z-10`): el de abajo sube con margen
                    negativo y se asoma por debajo, como en Wallet. */}
                <div className="relative z-10 rounded-2xl bg-aventurea-orange-dark p-3.5 text-white shadow-elevado">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-extrabold">Bookea</span>
                    <span className="text-[6px] font-extrabold tracking-[0.14em] text-white/80">
                      REWARDS
                    </span>
                  </div>
                  <p className="mt-4 text-[8px] text-white/85">
                    Tu próxima recompensa
                  </p>
                  <div className="mt-2 flex gap-[3px]">
                    {Array.from({ length: 10 }, (_, i) =>
                      i < 8 ? (
                        <span
                          key={i}
                          className="flex h-3 w-3 items-center justify-center rounded-full bg-white text-aventurea-orange-dark"
                        >
                          <IconCheck className="h-2 w-2" />
                        </span>
                      ) : (
                        <span
                          key={i}
                          className="h-3 w-3 rounded-full border border-dashed border-white/70 bg-white/20"
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-2.5 text-[6.5px] font-extrabold tracking-[0.1em] text-white/85">
                    8 DE 10 VISITAS
                  </p>
                </div>

                <div className="relative -mt-12 rounded-2xl bg-aventurea-navy-2 px-3.5 pb-3.5 pt-[62px] text-white shadow-elevado">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-extrabold">Nalu</span>
                    <span className="text-[6px] font-extrabold tracking-[0.14em] text-white/70">
                      WELLNESS
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] font-extrabold">
                    Miembro Gold
                  </p>
                </div>
              </div>

              <div className="absolute right-0 top-[118px] flex items-center gap-2.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-2 shadow-flotante sm:right-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-aventurea-sky text-white">
                  <IconStar className="h-3 w-3" />
                </span>
                <span>
                  <span className="block text-[7px] text-aventurea-ink-soft">
                    Recompensa disponible
                  </span>
                  <span className="block text-[9.5px] font-extrabold text-aventurea-navy">
                    ¡Ya podés canjearla!
                  </span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
