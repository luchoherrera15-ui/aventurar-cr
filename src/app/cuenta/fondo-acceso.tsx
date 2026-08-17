import "./fondo-acceso.css";

/** Ocho puntos; su posición y su desfase viven en el CSS por nth-child
 *  (en teléfono sobreviven dos, ver la media query de fondo-acceso.css). */
const PUNTOS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * El marco animado de la pantalla de acceso (/cuenta sin sesión): un
 * mapa apenas insinuado, rutas que fluyen, un resplandor que limpia el
 * centro y unos puntos que laten encima. Nada más — la tarjeta de
 * acceso la pinta la página y va POR ENCIMA de esto.
 *
 * SIN "use client" y sin una línea de JavaScript: la maqueta original
 * ciclaba las burbujas con un `setInterval`, pero el mismo efecto sale
 * de desfasar las animaciones con `--retraso` en CSS. Así esta pantalla
 * —que es lo primero que ve alguien que todavía no entró— no arrastra
 * ningún bundle extra, y `prefers-reduced-motion` se resuelve con una
 * media query en vez de con hidratación (misma decisión que reel.css en
 * /invitaciones).
 *
 * TODO acá es decorativo y va `aria-hidden`: quien navega con lector de
 * pantalla escucha el formulario y nada más. Los puntos NO llevan
 * nombres de negocio ni ofertas — la maqueta los traía, pero esos datos
 * no existen en la base y un adorno no puede prometer lo que el
 * producto no cumple.
 */
export default function FondoAcceso() {
  return (
    <div className="acceso-marco" aria-hidden="true">
      <div className="acceso-mapa" />
      <div className="acceso-resplandor" />

      {/* `preserveAspectRatio="none"` estira el trazado a lo ancho de la
          pantalla: son rutas de ambiente, no un mapa a escala. */}
      <svg
        className="acceso-rutas"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="acceso-degradado" x1="0" x2="1">
            <stop className="acceso-tope-ini" offset="0" />
            <stop className="acceso-tope-med" offset=".55" />
            <stop className="acceso-tope-fin" offset="1" />
          </linearGradient>
          {/* Acá vivía un `<filter>` de desenfoque para el halo del
              destello. Se fue: obligaba a re-rasterizar en cada frame
              una animación que ya cambia la geometría del trazo (ver
              fondo-acceso.css). El halo ahora es un trazo gemelo más
              ancho, que no cuesta nada. */}
        </defs>

        <path
          className="acceso-ruta acceso-ruta-suave"
          d="M-60 660 C180 490 370 780 610 610 S1030 370 1240 565 S1470 700 1690 510"
        />
        {/* La ruta principal y su destello comparten EL MISMO trazado: si
            se cambia una hay que cambiar la otra o la luz se despega. */}
        <path
          className="acceso-ruta"
          d="M-80 525 C150 270 350 560 565 405 S950 230 1140 420 S1450 650 1660 330"
        />
        {/* El halo del destello: un trazo gemelo, más ancho y muy
            translúcido, DEBAJO del fino. Reemplaza al `filter` de
            desenfoque que había —ver el porqué en fondo-acceso.css—:
            mismo efecto de resplandor sin obligar al navegador a
            re-rasterizar un filtro en cada frame. Los tres trazos que
            comparten esta `d` tienen que cambiar juntos o el destello se
            despega de su ruta. */}
        <path
          className="acceso-luz acceso-luz-halo"
          d="M-80 525 C150 270 350 560 565 405 S950 230 1140 420 S1450 650 1660 330"
        />
        <path
          className="acceso-luz"
          d="M-80 525 C150 270 350 560 565 405 S950 230 1140 420 S1450 650 1660 330"
        />
        <path
          className="acceso-ruta"
          d="M85 845 C215 690 385 760 525 855 M1020 840 C1140 670 1350 745 1570 620"
        />
      </svg>

      <p className="acceso-ambiente">
        Todo lo que buscás,{" "}
        <strong>
          más cerca<i>.</i>
        </strong>
      </p>

      <div className="acceso-puntos">
        {PUNTOS.map((n) => (
          <span key={n} className="acceso-punto">
            <span className="acceso-flota">
              <span className="acceso-anillo" />
              <span className="acceso-anillo acceso-anillo-2" />
              <span className="acceso-anillo acceso-anillo-3" />
              <span className="acceso-nucleo" />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
