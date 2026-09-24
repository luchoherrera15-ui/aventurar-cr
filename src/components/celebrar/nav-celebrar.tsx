import { RUTA } from "@/lib/celebrar/rutas";
import type { SesionCelebrar } from "@/lib/celebrar/sesion";
import { primerNombre } from "@/lib/celebrar/sesion";
import MarcaCelebrar from "./marca-celebrar";
import { EnlaceCelebrar } from "./rutas-cliente";

const SECCIONES = [
  { a: "/#funciones", texto: "Funciones" },
  { a: RUTA.plantillas, texto: "Plantillas" },
  { a: RUTA.demos, texto: "Demos" },
  { a: RUTA.comoFunciona, texto: "Cómo funciona" },
  { a: RUTA.precios, texto: "Precios" },
  { a: RUTA.partners, texto: "Partners" },
] as const;

/**
 * La barra del sitio público: blanca, fija arriba, con la marca, las
 * secciones y la puerta. En el teléfono las secciones se pliegan en un
 * `<details>` nativo (cero JS, área táctil de 48 px) que se abre debajo
 * de la barra — nunca un overlay de pantalla completa (criterio de los
 * paneles del sitio). No comparte nada con `site-header.tsx` (Bookea).
 */
export default function NavCelebrar({ sesion }: { sesion: SesionCelebrar | null }) {
  const nombre = primerNombre(sesion?.nombre ?? null);
  return (
    <header className="sticky top-0 z-40 border-b border-(--c-linea) bg-(--c-blanco)">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[76px] lg:px-8"
      >
        <MarcaCelebrar />

        <ul className="hidden items-center gap-1 lg:flex">
          {SECCIONES.map((s) => (
            <li key={s.a}>
              <EnlaceCelebrar
                a={s.a}
                className="c-montserrat flex min-h-10 items-center rounded-lg px-3.5 text-[14px] font-semibold text-(--c-tinta-suave) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:bg-(--c-hielo) hover:text-(--c-marino)"
              >
                {s.texto}
              </EnlaceCelebrar>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          {sesion ? (
            <EnlaceCelebrar a={RUTA.app} className="c-boton c-boton-primario">
              Mi panel
              {nombre && <span className="hidden sm:inline">, {nombre}</span>}
            </EnlaceCelebrar>
          ) : (
            <>
              {/* El envoltorio existe porque `.c-boton` fija display y le gana a `hidden`. */}
              <span className="hidden sm:inline-flex">
                <EnlaceCelebrar a={RUTA.entrar} className="c-boton c-boton-secundario">
                  Entrar
                </EnlaceCelebrar>
              </span>
              <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario">
                <span className="sm:hidden">Empezar</span>
                <span className="hidden sm:inline">Crear mi invitación</span>
              </EnlaceCelebrar>
            </>
          )}

          <details className="group relative lg:hidden">
            <summary
              className="flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-xl text-(--c-marino) [&::-webkit-details-marker]:hidden"
              aria-label="Abrir menú"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" className="group-open:hidden" />
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" className="hidden group-open:block" />
              </svg>
            </summary>
            <ul className="c-tarjeta absolute right-0 top-full mt-2 w-64 p-2 shadow-elevado">
              {SECCIONES.map((s) => (
                <li key={s.a}>
                  <EnlaceCelebrar
                    a={s.a}
                    className="c-montserrat flex min-h-12 items-center rounded-xl px-4 text-[14px] font-semibold text-(--c-tinta) hover:bg-(--c-hielo)"
                  >
                    {s.texto}
                  </EnlaceCelebrar>
                </li>
              ))}
              {!sesion && (
                <li className="sm:hidden">
                  <EnlaceCelebrar
                    a={RUTA.entrar}
                    className="c-montserrat flex min-h-12 items-center rounded-xl px-4 text-[14px] font-semibold text-(--c-tinta) hover:bg-(--c-hielo)"
                  >
                    Entrar
                  </EnlaceCelebrar>
                </li>
              )}
            </ul>
          </details>
        </div>
      </nav>
    </header>
  );
}
