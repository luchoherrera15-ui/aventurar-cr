/**
 * "Cómo funciona": los tres pasos, en una banda navy a sangre completa.
 *
 * Es la única sección oscura del cuerpo del home. Va a media página a
 * propósito: parte el recorrido en dos (arriba se descubre, abajo se
 * publica) y le da al scroll un punto de respiro que no es otra grilla
 * de tarjetas.
 *
 * Sin datos: copy fijo, cero consultas, cero JavaScript.
 */

/**
 * El ancla de esta sección. La exporta ella —que es quien pinta el
 * `id`— para que `NavHome` no tenga que repetir el string y que un
 * renombre no deje el link del header apuntando al vacío.
 */
export const ID_COMO_FUNCIONA = "como-funciona";

const PASOS: { numero: string; titulo: string; texto: string }[] = [
  {
    numero: "01",
    titulo: "Buscá lo que necesitás",
    // La maqueta decía "filtrá por zona y fecha". La fecha no filtra en
    // Citas —no existe una consulta de disponibilidad transversal al
    // directorio— así que prometerla acá sería la misma mentira que se
    // sacó del buscador. Categoría y zona sí filtran hoy, en las dos
    // verticales.
    texto:
      "Elegí entre citas, servicios o proveedores para eventos, y afiná por categoría y zona.",
  },
  {
    numero: "02",
    titulo: "Compará con confianza",
    // ⚠️ La maqueta prometía "opiniones verificadas". En la base hay
    // CERO reseñas: la sección existe y funciona, pero ninguna de las
    // reservas terminó en una. Se cae la palabra, no el paso.
    texto: "Revisá fotos, precios y disponibilidad real.",
  },
  {
    numero: "03",
    titulo: "Reservá o solicitá cotización",
    texto:
      "Confirmá una cita al instante o coordiná los detalles de tu evento desde Bookea.",
  },
];

export default function ComoFunciona() {
  return (
    <section
      id={ID_COMO_FUNCIONA}
      // `bento-navy` sin `bento`: la piel (fondo navy + texto blanco) es
      // lo que se reusa; el radio de 18 px de `bento` sobra en una banda
      // a sangre completa, que no tiene esquinas que redondear.
      //
      // `scroll-mt-24` es el offset del sitio para secciones con ancla:
      // sin él, el header sticky de 64 px se come el título cuando se
      // llega desde "Cómo funciona" en la nav.
      className="bento-navy relative scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-10"
    >
      {/* La marca de agua gigante de la maqueta. Decorativa pura: si el
          navegador la corta, no se pierde nada. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-4 select-none text-[220px] font-extrabold leading-none tracking-tighter text-white/5 sm:-bottom-24 sm:text-[320px] lg:text-[400px]"
      >
        03
      </span>

      <div className="relative mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-aventurea-orange">
            Simple de principio a fin
          </p>
          <h2 className="titulo mt-4 max-w-[14ch] text-balance text-[clamp(30px,4vw,48px)] text-white">
            Tu próxima reserva, en tres pasos.
          </h2>
          <p className="mt-5 max-w-[42ch] text-[14.5px] leading-relaxed text-white/60">
            Menos mensajes. Menos incertidumbre. Más tiempo para
            disfrutar.
          </p>
        </div>

        {/* Lista ordenada de verdad: son pasos, y el número no es
            decoración sino la posición. El `01` visible queda fuera del
            flujo accesible (`aria-hidden`) porque el lector de pantalla
            ya numera solo la lista. */}
        <ol className="border-t border-white/15">
          {PASOS.map((paso) => (
            <li
              key={paso.numero}
              className="grid grid-cols-[38px_1fr] gap-4 border-b border-white/15 py-6 sm:grid-cols-[56px_1fr] sm:gap-5 sm:py-7"
            >
              <span
                aria-hidden
                className="text-[12px] font-extrabold leading-6 text-aventurea-orange"
              >
                {paso.numero}
              </span>
              <div>
                <h3 className="text-[16.5px] font-extrabold tracking-tight text-white sm:text-[17.5px]">
                  {paso.titulo}
                </h3>
                <p className="mt-1.5 max-w-[48ch] text-[13.5px] leading-relaxed text-white/60">
                  {paso.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
