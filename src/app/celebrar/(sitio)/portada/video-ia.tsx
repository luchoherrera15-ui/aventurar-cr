/**
 * La sección destacada de video: banda marina con el argumento a la
 * izquierda y el formato (un cuadro vertical, como el video que se
 * abre en WhatsApp) dibujado en CSS a la derecha. No hay video falso
 * reproduciéndose: se muestra el formato, no una promesa.
 */
export default function VideoIA() {
  return (
    <section
      id="video"
      aria-labelledby="video-titulo"
      className="sobre-oscuro scroll-mt-20 bg-(--c-marino) py-16 text-(--c-blanco) lg:py-24"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="c-montserrat inline-flex items-center gap-2 rounded-lg bg-(--c-marino-medio) px-3 py-1.5 text-[13px] font-semibold text-(--c-sobre-marino-suave)">
            <span className="h-1.5 w-1.5 rounded-full bg-(--c-coral)" aria-hidden="true" />
            Videos con IA
          </p>
          <h2 id="video-titulo" className="mt-5 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-blanco)">
            Sus fotos, en movimiento
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-(--c-sobre-marino-suave)">
            Un video corto para anunciar la fecha o abrir la invitación: las fotos que ya tienen,
            los nombres, el lugar y una canción. Se arma desde el mismo panel y sale listo para
            mandar por WhatsApp.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="c-tarjeta-marina p-5">
              <p className="c-montserrat text-[15px] font-semibold text-(--c-blanco)">Con plantilla</p>
              <p className="mt-2 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">
                Elegís un estilo, subís las fotos y el video se arma solo. Rápido y económico: es el
                primer formato que ofrece CELEBRAR.
              </p>
            </div>
            <div className="c-tarjeta-marina p-5">
              <p className="c-montserrat text-[15px] font-semibold text-(--c-blanco)">Con inteligencia artificial</p>
              <p className="mt-2 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">
                Las fotos ganan movimiento y se convierten en escenas. Se genera en segundo plano y
                te avisamos cuando está listo.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[280px]">
          <div
            className="c-tarjeta-marina relative flex aspect-[9/16] flex-col justify-between overflow-hidden p-6"
            role="img"
            aria-label="Formato del video: vertical, con los nombres, la fecha y el lugar sobre las fotos"
          >
            <div className="c-montserrat flex items-center justify-between text-[11px] font-semibold text-(--c-sobre-marino-suave)">
              <span>Save the date</span>
              <span>0:18</span>
            </div>
            <div className="text-center">
              <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.14em] text-(--c-coral)">
                Nos casamos
              </p>
              <p className="c-montserrat mt-3 text-[28px] font-extrabold leading-none tracking-tight text-(--c-blanco)">
                Sofía & Andrés
              </p>
              <p className="mt-3 text-[13px] text-(--c-sobre-marino-suave)">12.12.2026 · Escazú</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-(--c-blanco) text-(--c-marino)"
              >
                <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M7 5v14l11-7z" />
                </svg>
              </span>
              <span className="h-1 flex-1 rounded-full bg-(--c-marino)">
                <span className="block h-1 w-1/3 rounded-full bg-(--c-coral)" />
              </span>
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-(--c-sobre-marino-suave)">
            Vertical, pensado para el teléfono.
          </p>
        </div>
      </div>
    </section>
  );
}
