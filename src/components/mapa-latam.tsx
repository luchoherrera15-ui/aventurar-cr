/**
 * El mapa de la portada: América Latina dibujada como una nube de
 * puntos, con pines que se van encendiendo y sueltan una onda que se
 * abre alrededor (radar). Costa Rica es el protagonista — se enciende
 * primero y es el único en naranja de marca. El ciclo dura 5s.
 *
 * La silueta es una grilla "pixel art" (SILUETA) en vez de un <path>:
 * un contorno vectorial hecho a mano queda amorfo, y uno de verdad
 * pesaría más que toda la página. Así la forma es legible, editable a
 * ojo y son ~200 círculos idénticos que el navegador dibuja sin
 * despeinarse.
 *
 * SVG estático + CSS (home.css): cero JavaScript, cero pedidos de red.
 */

/** Cada '#' es tierra. 20 columnas × 25 filas — de México al cono sur. */
const SILUETA = [
  "..####..............",
  ".#######............",
  ".########...........",
  "..#######...........",
  "...######...........",
  "....####............",
  ".....###............",
  "......##...##.......",
  ".......#..####......",
  "........########....",
  "........##########..",
  ".......###########..",
  ".......############",
  "......#############.",
  "......#############.",
  ".......###########..",
  "........##########..",
  "........#########...",
  ".........#######....",
  ".........######.....",
  "..........#####.....",
  "..........####......",
  "..........###.......",
  "..........##........",
  "..........#.........",
];

/** Separación entre puntos y radio, en unidades del viewBox. */
const PASO = 20;
const RADIO = 5.2;

type Pin = {
  /** Columna y fila dentro de SILUETA (admite decimales). */
  col: number;
  fila: number;
  /** Segundos dentro del ciclo de 5s en que se enciende. */
  delay: number;
  /** El de casa (Costa Rica): más grande y en naranja de marca. */
  casa?: boolean;
};

/** Los pines, en el orden en que se encienden. */
const PINES: Pin[] = [
  { col: 6.5, fila: 7.5, delay: 0, casa: true }, // Costa Rica
  { col: 9, fila: 9.5, delay: 0.7 }, // Colombia
  { col: 3.5, fila: 2, delay: 1.3 }, // México
  { col: 15, fila: 13, delay: 1.9 }, // Brasil
  { col: 12, fila: 7, delay: 2.5 }, // Caribe
  { col: 8.5, fila: 15, delay: 3.1 }, // Perú
  { col: 12, fila: 20, delay: 3.7 }, // Argentina
];

const x = (col: number) => col * PASO + PASO / 2;
const y = (fila: number) => fila * PASO + PASO / 2;

export default function MapaLatam({ className = "" }: { className?: string }) {
  const puntos: { cx: number; cy: number }[] = [];
  SILUETA.forEach((linea, fila) => {
    [...linea].forEach((c, col) => {
      if (c === "#") puntos.push({ cx: x(col), cy: y(fila) });
    });
  });

  return (
    <svg
      viewBox={`0 0 ${20 * PASO} ${SILUETA.length * PASO}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <g className="mapa-tierra">
        {puntos.map((p) => (
          <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r={RADIO} fill="currentColor" />
        ))}
      </g>

      {PINES.map(({ col, fila, delay, casa }) => (
        <g
          key={`${col}-${fila}`}
          style={{ "--pin-delay": `${delay}s` } as React.CSSProperties}
        >
          <circle
            className={casa ? "mapa-onda mapa-onda-casa" : "mapa-onda"}
            cx={x(col)}
            cy={y(fila)}
            r="13"
          />
          <circle
            className={casa ? "mapa-pin mapa-pin-casa" : "mapa-pin"}
            cx={x(col)}
            cy={y(fila)}
            r={casa ? 8 : 6}
          />
        </g>
      ))}
    </svg>
  );
}
