import EspecimenVivo from "@/components/celebrar/especimen-vivo";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { MARCA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";

/**
 * El héroe: marino a sangre, el claim en Montserrat 800 a la izquierda
 * y el teléfono con la invitación viva a la derecha. Entra en cascada
 * una sola vez (`c-aparece`); después solo se mueve el teléfono. El
 * confeti es CSS estático: puntos y anillos que sugieren fiesta sin
 * competir con el texto.
 */
export default function Hero() {
  return (
    <section className="sobre-oscuro relative overflow-hidden bg-(--c-marino) text-(--c-blanco)">
      <Confeti />
      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="max-w-2xl">
          <p
            className="c-aparece c-montserrat inline-flex items-center gap-2 rounded-lg bg-(--c-marino-medio) px-3 py-1.5 text-[13px] font-semibold text-(--c-sobre-marino-suave)"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-(--c-coral)" aria-hidden="true" />
            {MARCA.lema}
          </p>
          <h1
            className="c-aparece mt-6 text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] text-(--c-blanco)"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Más que una invitación, una experiencia.
          </h1>
          <p
            className="c-aparece mt-6 max-w-xl text-lg leading-relaxed text-(--c-sobre-marino-suave)"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            Creá la invitación digital de tu celebración, recibí las confirmaciones, juntá las
            fotos de todos en un álbum y guardá los recuerdos en la misma página. Se comparte con
            un link y se abre en cualquier teléfono.
          </p>
          <div
            className="c-aparece mt-9 flex flex-wrap items-center gap-3"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-claro">
              Crear mi invitación
            </EnlaceCelebrar>
            <EnlaceCelebrar a={RUTA.comoFunciona} className="c-boton c-boton-fantasma">
              Ver cómo funciona
            </EnlaceCelebrar>
          </div>
          <ul
            className="c-aparece mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-(--c-sobre-marino-suave)"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            {["Invitación con tu link", "Confirmaciones en tiempo real", "Álbum con QR", "Recuerdos"].map(
              (t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-(--c-coral)" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m3.5 8.5 2.8 2.8L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="c-aparece flex justify-center lg:justify-end" style={{ "--i": 2 } as React.CSSProperties}>
          <EspecimenVivo ancho={290} />
        </div>
      </div>
    </section>
  );
}

/** Confeti estático: unos pocos puntos y anillos, sin animación. */
function Confeti() {
  // Solo en los márgenes (x < 4 % o > 95 %) para no pisar texto ni teléfono.
  const piezas = [
    { top: "14%", left: "2.5%", size: 10, tipo: "punto", color: "var(--c-coral)" },
    { top: "58%", left: "1.5%", size: 18, tipo: "anillo", color: "var(--c-sobre-marino-suave)" },
    { top: "86%", left: "3%", size: 8, tipo: "punto", color: "var(--c-sobre-marino-suave)" },
    { top: "10%", left: "96%", size: 20, tipo: "anillo", color: "var(--c-sobre-marino-suave)" },
    { top: "48%", left: "97.5%", size: 9, tipo: "punto", color: "var(--c-coral)" },
    { top: "84%", left: "95.5%", size: 14, tipo: "anillo", color: "var(--c-coral)" },
  ] as const;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden opacity-70 lg:block">
      {piezas.map((p, i) => (
        <span
          key={i}
          className="c-confeti"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.tipo === "punto" ? p.color : "transparent",
            border: p.tipo === "anillo" ? `2px solid ${p.color}` : undefined,
          }}
        />
      ))}
    </div>
  );
}
