/**
 * LA FRANJA DE LATINOAMÉRICA — banderas desfilando y una línea que dice
 * para qué negocios sirve esto.
 *
 * Pedido del dueño (31 ago 2026): «primero las banderas en la parte
 * superior yendo de un lado a otro, todas desde México hasta Argentina,
 * y luego un texto» con los rubros.
 *
 * ------------------------------------------------------------------
 * ⚠️ POR QUÉ LAS BANDERAS SON SVG Y NO EMOJI
 * ------------------------------------------------------------------
 * Windows NO trae los glifos de bandera. Un `🇲🇽` en Chrome sobre
 * Windows no se pinta: salen las dos letras regionales, «MX». Lo medí
 * antes de escribir esto —el emoji rasterizado devolvió UN solo color—
 * y es exactamente lo que se ve en la referencia que motivó la
 * sección: una fila que dice «CO VE EC PE BO PY…» en vez de banderas.
 *
 * O sea que con emoji la misma franja se vería como banderas en un
 * iPhone y como una lista de siglas en la computadora del dueño. Por
 * eso van dibujadas: se ven igual en todos lados y pesan nada.
 *
 * Los escudos van insinuados (un disco, un triángulo) y no calcados: a
 * 26 px de ancho el detalle no se lee, pero SIN nada México se
 * confundiría con Italia y Ecuador con Colombia. Lo que se dibuja es lo
 * mínimo que distingue una bandera de otra.
 */

type Bandera = {
  pais: string;
  /** Cómo se rotula debajo, cuando el nombre completo no entra. */
  corto?: string;
  svg: React.ReactNode;
};

/* Los colores repetidos, una sola vez. */
const ROJO = "#CE1126";
const AZUL_OSCURO = "#002B7F";
const AMARILLO = "#FCD116";

/**
 * De México a Argentina, en orden geográfico de norte a sur — que es
 * como el dueño las pidió y como alguien las lee sin pensarlo.
 */
const BANDERAS: Bandera[] = [
  {
    pais: "México",
    svg: (
      <>
        <rect width="10" height="20" fill="#006847" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill={ROJO} />
        <ellipse cx="15" cy="10" rx="2.6" ry="2.2" fill="#8C6239" />
      </>
    ),
  },
  {
    pais: "Guatemala",
    svg: (
      <>
        <rect width="10" height="20" fill="#4997D0" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#4997D0" />
        <circle cx="15" cy="10" r="2.4" fill="#4E8B3C" />
      </>
    ),
  },
  {
    pais: "El Salvador",
    svg: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <rect width="30" height="6.7" fill="#0F47AF" />
        <rect y="13.3" width="30" height="6.7" fill="#0F47AF" />
        <circle cx="15" cy="10" r="2.4" fill="#C6A83C" />
      </>
    ),
  },
  {
    pais: "Honduras",
    svg: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <rect width="30" height="6.7" fill="#0073CF" />
        <rect y="13.3" width="30" height="6.7" fill="#0073CF" />
        <g fill="#0073CF">
          <circle cx="15" cy="10" r="0.9" />
          <circle cx="11.6" cy="8" r="0.9" />
          <circle cx="18.4" cy="8" r="0.9" />
          <circle cx="11.6" cy="12" r="0.9" />
          <circle cx="18.4" cy="12" r="0.9" />
        </g>
      </>
    ),
  },
  {
    pais: "Nicaragua",
    svg: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <rect width="30" height="6.7" fill="#0067C6" />
        <rect y="13.3" width="30" height="6.7" fill="#0067C6" />
        <path d="M15 7.6l2.6 4.6h-5.2z" fill="#C8DBEF" />
      </>
    ),
  },
  {
    pais: "Costa Rica",
    svg: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <rect width="30" height="4" fill={AZUL_OSCURO} />
        <rect y="16" width="30" height="4" fill={AZUL_OSCURO} />
        <rect y="7.5" width="30" height="5" fill={ROJO} />
      </>
    ),
  },
  {
    pais: "Panamá",
    svg: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <rect x="15" width="15" height="10" fill={ROJO} />
        <rect y="10" width="15" height="10" fill="#005293" />
        <path d="M7.5 3l.7 2.1h2.2l-1.8 1.3.7 2.1-1.8-1.3-1.8 1.3.7-2.1-1.8-1.3h2.2z" fill="#005293" />
        <path d="M22.5 13l.7 2.1h2.2l-1.8 1.3.7 2.1-1.8-1.3-1.8 1.3.7-2.1-1.8-1.3h2.2z" fill={ROJO} />
      </>
    ),
  },
  {
    pais: "República Dominicana",
    corto: "R. Dominicana",
    svg: (
      <>
        <rect width="15" height="10" fill="#002D62" />
        <rect x="15" width="15" height="10" fill={ROJO} />
        <rect y="10" width="15" height="10" fill={ROJO} />
        <rect x="15" y="10" width="15" height="10" fill="#002D62" />
        <rect x="13" width="4" height="20" fill="#fff" />
        <rect y="8" width="30" height="4" fill="#fff" />
      </>
    ),
  },
  {
    pais: "Colombia",
    svg: (
      <>
        <rect width="30" height="10" fill={AMARILLO} />
        <rect y="10" width="30" height="5" fill="#003893" />
        <rect y="15" width="30" height="5" fill={ROJO} />
      </>
    ),
  },
  {
    pais: "Venezuela",
    svg: (
      <>
        <rect width="30" height="6.7" fill={AMARILLO} />
        <rect y="6.7" width="30" height="6.6" fill="#00247D" />
        <rect y="13.3" width="30" height="6.7" fill={ROJO} />
        <g fill="#fff">
          <circle cx="10.5" cy="11.6" r="0.6" />
          <circle cx="12.6" cy="10.7" r="0.6" />
          <circle cx="15" cy="10.4" r="0.6" />
          <circle cx="17.4" cy="10.7" r="0.6" />
          <circle cx="19.5" cy="11.6" r="0.6" />
        </g>
      </>
    ),
  },
  {
    pais: "Ecuador",
    svg: (
      <>
        <rect width="30" height="10" fill={AMARILLO} />
        <rect y="10" width="30" height="5" fill="#0072CE" />
        <rect y="15" width="30" height="5" fill={ROJO} />
        <ellipse cx="15" cy="10" rx="2.2" ry="2.6" fill="#C8B560" />
      </>
    ),
  },
  {
    pais: "Perú",
    svg: (
      <>
        <rect width="10" height="20" fill="#D91023" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#D91023" />
      </>
    ),
  },
  {
    pais: "Bolivia",
    svg: (
      <>
        <rect width="30" height="6.7" fill="#D52B1E" />
        <rect y="6.7" width="30" height="6.6" fill="#F9E300" />
        <rect y="13.3" width="30" height="6.7" fill="#007934" />
      </>
    ),
  },
  {
    pais: "Brasil",
    svg: (
      <>
        <rect width="30" height="20" fill="#009C3B" />
        <path d="M15 2.6L27.4 10 15 17.4 2.6 10z" fill="#FFDF00" />
        <circle cx="15" cy="10" r="4.2" fill="#002776" />
      </>
    ),
  },
  {
    pais: "Paraguay",
    svg: (
      <>
        <rect width="30" height="6.7" fill="#D52B1E" />
        <rect y="6.7" width="30" height="6.6" fill="#fff" />
        <rect y="13.3" width="30" height="6.7" fill="#0038A8" />
        <circle cx="15" cy="10" r="2.2" fill="#009B3A" />
      </>
    ),
  },
  {
    pais: "Chile",
    svg: (
      <>
        <rect width="30" height="10" fill="#fff" />
        <rect y="10" width="30" height="10" fill="#D52B1E" />
        <rect width="10" height="10" fill="#0039A6" />
        <path d="M5 2.4l.9 2.7h2.9l-2.3 1.7.9 2.7L5 7.8 2.6 9.5l.9-2.7L1.2 5.1h2.9z" fill="#fff" />
      </>
    ),
  },
  {
    pais: "Uruguay",
    svg: (
      <>
        <rect width="30" height="20" fill="#fff" />
        <g fill="#0038A8">
          <rect y="2.2" width="30" height="2.2" />
          <rect y="6.7" width="30" height="2.2" />
          <rect x="11" y="11.1" width="19" height="2.2" />
          <rect x="11" y="15.6" width="19" height="2.2" />
        </g>
        <rect width="11" height="11.1" fill="#fff" />
        <circle cx="5.5" cy="5.5" r="2.4" fill="#FCD116" />
      </>
    ),
  },
  {
    pais: "Argentina",
    svg: (
      <>
        <rect width="30" height="6.7" fill="#74ACDF" />
        <rect y="6.7" width="30" height="6.6" fill="#fff" />
        <rect y="13.3" width="30" height="6.7" fill="#74ACDF" />
        <circle cx="15" cy="10" r="2.2" fill="#FCD116" />
      </>
    ),
  },
];

function BanderaSvg({ pais, corto, svg }: Bandera) {
  return (
    <span className="flex shrink-0 flex-col items-center gap-1.5" title={pais}>
      <svg
        viewBox="0 0 30 20"
        role="img"
        aria-label={pais}
        className="h-[19px] w-[28px] rounded-[3px] shadow-[0_1px_3px_rgba(6,38,83,.18)] ring-1 ring-black/5"
      >
        {svg}
      </svg>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft/70">
        {corto ?? pais}
      </span>
    </span>
  );
}

export default function FranjaLatam() {
  return (
    <section className="overflow-hidden px-0 pb-6 pt-14 sm:pb-8 sm:pt-16">
      {/* ── LAS BANDERAS, DESFILANDO ────────────────────────────────
          La lista va DUPLICADA y el riel se corre -50%: al terminar la
          primera copia, la segunda está exactamente donde arrancó la
          primera y el salto no se ve. Sin duplicar, el riel llega al
          final y pega un tirón de vuelta.

          `aria-hidden` en la copia: para un lector de pantalla la lista
          de países se lee UNA vez, no dos. */}
      <div className="relative">
        {/* Los bordes se desvanecen para que las banderas no aparezcan
            ni desaparezcan de golpe contra el canto de la pantalla. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-28"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-28"
        />

        <div className="flex overflow-hidden">
          <div className="anim-banderas flex items-start gap-7 pr-7 sm:gap-9 sm:pr-9">
            {BANDERAS.map((b) => (
              <BanderaSvg key={b.pais} {...b} />
            ))}
            {BANDERAS.map((b) => (
              <span key={`copia-${b.pais}`} aria-hidden>
                <BanderaSvg {...b} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── LO QUE HACEMOS, Y PARA QUIÉN ────────────────────────────
          Los rubros van en negrita dentro de la frase y no en una lista
          con viñetas: quien la lee está buscando el suyo, y en un
          párrafo corrido los encuentra de un vistazo sin que la sección
          se convierta en un listado. */}
      {/* La lista de rubros se mudó al hero (31 ago 2026): contesta
          «¿esto sirve para mi negocio?» y esa pregunta llega antes
          que ninguna. Acá queda solo el rótulo del alcance. */}
      <p className="mt-8 text-center text-[13px] font-extrabold uppercase tracking-[0.16em] text-aventurea-navy">
        En toda Latinoamérica
      </p>
    </section>
  );
}
