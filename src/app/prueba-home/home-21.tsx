import Link from "next/link";
import { PRODUCTOS } from "@/lib/productos";
import TelefonoRotativo from "./telefono-rotativo";
import { Ancho, CUATRO, Shell, TarjetaProducto } from "./piezas-vivo";

/**
 * ════════════════════════════════════════════════════════════════════
 *  21 — HÉROE MARINO, TIPOGRAFÍA GRANDE, EL PRODUCTO AL LADO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026), con `/celebrar` en pantalla: «quiero
 * que el diseño de Bookea se vea algo así como el de Celebrar, más
 * profesional, textos más grandes que llenan más».
 *
 * ── QUÉ SE COPIÓ, Y QUÉ NO ──────────────────────────────────────────
 *
 * Se copió la ANATOMÍA, que es lo que hace que esa portada funcione:
 *
 *   · Fondo oscuro a sangre. No una sección oscura: la pantalla entera.
 *   · El titular a la IZQUIERDA y enorme — `clamp(2.5rem, 6vw, 4.5rem)`,
 *     o sea hasta **72 px**. El home de Bookea venía con 48 px de techo;
 *     esos 24 px de diferencia son literalmente «textos más grandes que
 *     llenan más».
 *   · Interlínea 1.04. A 72 px, 1.1 ya deja el titular flotando.
 *   · Una fila de cuatro ✓ debajo de los botones: dice cuatro cosas más
 *     sin agregar un párrafo.
 *   · El producto de verdad al lado, rotando, con su rótulo abajo.
 *   · Las dos columnas NO son mitad y mitad: 1.15 / 0.85. El texto
 *     manda y el teléfono acompaña.
 *
 * **No se copiaron los colores.** Celebrar es marino y coral; esto es
 * el navy de Bookea (#16295e) con su azul. Copiar la paleta sería
 * hacer de Bookea un Celebrar con otro logo, y la regla de la casa es
 * tener estilo propio.
 *
 * Tampoco se copió el confeti: es de Celebrar porque Celebrar es
 * fiestas. Acá abajo del titular va lo que Bookea sí tiene para
 * enseñar — el producto.
 *
 * ── LO QUE VIENE DESPUÉS DEL HÉROE ──────────────────────────────────
 *
 * El fondo vuelve a blanco y aparecen los cuatro productos. El salto
 * de oscuro a claro es el corte más barato que hay para decir «esto es
 * otra cosa», y deja las tarjetas sobre el papel donde ya se ven bien.
 */

const VENTAJAS = [
  "Tu página en 5 minutos",
  "0 % de comisión",
  "Gratis para empezar",
  "Soporte en español",
];

export default function Home21() {
  return (
    <Shell cabecera="marina">
      {/* ══ EL HÉROE ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#16295e] text-white">
        {/* Dos halos muy suaves. No son decoración gratuita: sin ellos
            un navy plano de 700 px de alto se ve como un bloque de
            color, y con ellos se ve como una superficie. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#2f4a94] opacity-40 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 right-[-10%] h-[560px] w-[560px] rounded-full bg-[#0082e6] opacity-25 blur-[140px]"
        />

        <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/80">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4da3ff]" />
              La plataforma de tu negocio
            </p>

            {/* 72 px de techo. El `titulo` de la casa ya trae Figtree 800
                con −0.025em, así que no hace falta nada más.

                El titular es el que pidió el dueño (24 sep 2026):
                «digitalizá tu negocio y aumentá tus ventas». Dice una
                acción y un resultado, que es más de lo que decía
                «Aumentá tus ventas con Bookea» — ahí «con Bookea»
                gastaba una línea repitiendo el logo que está diez
                centímetros más arriba. */}
            <h1 className="titulo mt-6 text-balance text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] text-white">
              Digitalizá tu negocio y aumentá tus ventas.
            </h1>

            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-[19px]">
              Tu página con tu menú y tus links, las reservas que entran solas,
              los sellos que hacen volver a tus clientes y las respuestas de
              Instagram en automático. Se arma en cinco minutos y se comparte
              con un link.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/empezar"
                className="inline-flex items-center justify-center rounded-[12px] bg-white px-7 py-3.5 text-[15px] font-extrabold text-[#16295e] transition-colors hover:bg-[#e9eef6]"
              >
                Empezá gratis
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center justify-center rounded-[12px] border border-white/30 px-7 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-white/10"
              >
                Ver cómo funciona
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-white/75">
              {VENTAJAS.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4 text-[#4da3ff]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path
                      d="m3.5 8.5 2.8 2.8L12.5 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <TelefonoRotativo ancho={300} />
          </div>
        </div>
      </section>

      {/* ══ LOS CUATRO PRODUCTOS, SOBRE PAPEL ══════════════════════ */}
      <Ancho className="py-16 sm:py-24">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
            Cuatro herramientas
          </p>
          <h2 className="titulo mt-4 text-balance text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.06] text-[color:var(--tinta)]">
            Prendé la que te sirve. Las otras, cuando quieras.
          </h2>
          <p className="mx-auto mt-5 max-w-[576px] text-[17px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[19px]">
            Se activan por separado y todas son gratis mientras estamos
            arrancando.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          {CUATRO.map((p) => (
            <TarjetaProducto key={p.id} p={p} alto={300} />
          ))}
        </div>
      </Ancho>

      {/* ══ EL CIERRE ══════════════════════════════════════════════
          Decía «Tu negocio ya vende. El problema es por dónde» —
          prestado de la landing de la página, donde funciona porque
          ahí se está hablando de UN canal. Acá cerraba la portada
          entera con un problema, y el dueño lo frenó (24 sep 2026).
          Cierra con lo que hay que hacer, no con lo que está mal. */}
      <section className="bg-[color:var(--superficie)]">
        <Ancho className="py-16 text-center sm:py-20">
          <h2 className="titulo mx-auto max-w-[20ch] text-balance text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.08] text-[color:var(--tinta)]">
            Armalo hoy. Se comparte con un link.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/empezar" className="btn-tinta">
              Empezá gratis
            </Link>
            <Link href="/solutions" className="btn-tinta-contorno">
              Ver cómo funciona
            </Link>
          </div>
          <p className="mt-5 text-[13.5px] text-[color:var(--tinta-suave)]">
            {PRODUCTOS.length} herramientas · sin tarjeta · sin contrato
          </p>
        </Ancho>
      </section>
    </Shell>
  );
}
