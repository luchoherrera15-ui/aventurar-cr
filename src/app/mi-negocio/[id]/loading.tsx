import { Bloque } from "../../esqueleto";
import { EsqueletoCardPanel, EsqueletoMetrica } from "@/components/panel/piezas";
import { GAP_METRICAS, GAP_TABLERO, TILE_PANEL } from "@/components/panel/sistema";

/**
 * Pantalla de carga del panel del dueño.
 *
 * Es la pantalla que más se abre del sitio y la que más esperaba: hacía
 * NUEVE tandas de consultas en cascada (~500 ms de puro esperar a la
 * base a ~55 ms el viaje, medido). El page.tsx ya las junta en una sola
 * tanda; esto resuelve la otra mitad del problema — que hasta que la
 * base no contestaba, Next no podía mandar ni el `<head>`, así que el
 * navegador ni siquiera sabía qué CSS pedir.
 *
 * CALCA EL SHELL, que es la única regla de un esqueleto: si la forma no
 * es la misma, la página salta al llegar el contenido y la espera se
 * siente peor que con un spinner. Este calcaba un panel centrado de
 * 1280px con las pestañas ARRIBA en horizontal — dos rediseños atrás.
 * Ahora es lo que de verdad hay: columna navy pegada al borde izquierdo
 * (`panel-sidebar.tsx`), contenido con su padding y su tope de 1560px, y
 * la fila de tarjetas de números con el mismo relleno sólido.
 *
 * Los huecos DENTRO de la columna navy no usan `Bloque`: ese gris es
 * `bg-aventurea-navy/[0.07]`, calibrado para el lienzo claro, y sobre
 * navy desaparece. Adentro del rail el relleno es blanco translúcido —
 * mismo criterio que `EsqueletoVitrinaHome`.
 */
export default function CargandoPanelNegocio() {
  return (
    <main className="w-full">
      <div className="lg:grid lg:grid-cols-[252px_1fr] lg:items-start xl:grid-cols-[276px_1fr]">
        {/* La columna del menú */}
        <div className="px-4 pt-6 sm:px-6 lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:bg-aventurea-rail-fondo lg:px-4 lg:pb-6 lg:pt-5">
          {/* La identidad del negocio: tarjeta navy en el teléfono, parte
              del rail en escritorio — igual que la real. */}
          <div className="mb-3 rounded-3xl bg-aventurea-rail-fondo p-4 lg:mb-4 lg:rounded-none lg:border-b lg:border-aventurea-navy-3 lg:bg-none lg:p-0 lg:pb-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-white/15" />
              <div className="min-w-0 flex-1">
                <div className="h-3.5 w-3/4 animate-pulse rounded-lg bg-white/15" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded-lg bg-white/10" />
              </div>
            </div>
            <div className="mt-3 h-9 w-full animate-pulse rounded-xl bg-white/10" />
          </div>

          {/* En el teléfono el menú entero es UN botón que despliega. */}
          <Bloque className="mb-4 h-11 w-full rounded-2xl lg:hidden" />

          {/* En escritorio, la lista de secciones. */}
          <div className="hidden flex-col gap-1 lg:flex">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>
        </div>

        {/* El contenido, con el mismo padding y el mismo tope que el real */}
        <div className="min-w-0 px-4 pb-12 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8 2xl:px-10">
          <div className="mx-auto w-full max-w-[1560px]">
            <Bloque className="h-3.5 w-[190px]" />

            {/* El encabezado: fecha, titular y la línea de abajo */}
            <Bloque className="mt-5 h-3 w-[170px]" />
            <Bloque className="mt-3 h-8 w-[min(520px,90%)]" />
            <Bloque className="mt-3 h-3.5 w-[min(430px,80%)]" />

            {/* De acá para abajo el hueco calca las PIEZAS del panel
                (`components/panel/piezas.tsx`), no una copia a mano de
                sus medidas: cuando cambie el padding de una tarjeta o
                el alto de una métrica, el esqueleto lo sigue solo. */}
            <div className={`mt-7 flex flex-col ${GAP_TABLERO}`}>
              {/* "Tu negocio en números": el rótulo y la fila de cuatro */}
              <div>
                <Bloque className="h-2.5 w-[90px]" />
                <Bloque className="mt-2 h-4 w-[200px]" />
                <div className={`mt-3 grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <EsqueletoMetrica key={i} />
                  ))}
                </div>
              </div>

              {/* "Lo que viene": ahora es UNA tarjeta con filas, no una
                  grilla de cinco cuadritos. */}
              <EsqueletoCardPanel filas={4} />

              {/* "Tus herramientas": la tarjeta con su grilla de tiles */}
              <div className="rounded-3xl border border-aventurea-line bg-aventurea-surface p-4 shadow-elevado sm:p-5">
                <Bloque className="h-2.5 w-[110px]" />
                <Bloque className="mt-2 h-4 w-[170px]" />
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className={TILE_PANEL}>
                      <Bloque className="h-9 w-9 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <Bloque className="h-3.5 w-1/2" />
                        <Bloque className="mt-2 h-3 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
