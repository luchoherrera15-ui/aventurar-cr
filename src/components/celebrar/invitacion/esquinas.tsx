import type { Esquinas as TipoEsquinas } from "@/lib/celebrar/invitacion/esquema";

/**
 * Los adornos de esquina de la portada (y del cierre): una ilustración
 * de línea dibujada para la esquina superior izquierda en un lienzo de
 * 120×120, reflejada para las otras tres. Van en el acento de la escena,
 * SVG inline en `currentColor`, sin recursos externos.
 */

const n = (x: number) => Math.round(x * 100) / 100;
const hoja = (L: number, W: number) => `M0 0Q${n(L * 0.5)} ${n(-W)} ${L} 0Q${n(L * 0.5)} ${n(W)} 0 0Z`;

function Floral() {
  // Dos tallos que salen de la esquina, hojas alternadas y una flor abierta cerca del vértice.
  const hojas = [
    [26, 20, -30, 15, 4.5],
    [38, 30, -20, 14, 4],
    [54, 44, -15, 13, 3.8],
    [66, 56, 0, 12, 3.5],
    [20, 28, 60, 14, 4],
    [30, 42, 70, 13, 3.8],
    [42, 56, 80, 12, 3.5],
    [52, 70, 88, 11, 3.2],
  ] as const;
  return (
    <>
      <path d="M10 10C30 12 52 28 76 66" />
      <path d="M10 10C12 30 26 54 62 80" />
      {hojas.map(([x, y, a, L, W], i) => (
        <path key={i} d={hoja(L, W)} transform={`translate(${x} ${y}) rotate(${a})`} />
      ))}
      <g transform="translate(22 22)">
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-7.5" rx="3.4" ry="7" transform={`rotate(${i * 60})`} />
        ))}
        <circle r="2.4" />
      </g>
      <g transform="translate(46 12)">
        {Array.from({ length: 5 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-4.2" rx="2" ry="4" transform={`rotate(${i * 72})`} />
        ))}
        <circle r="1.4" />
      </g>
      <circle cx="14" cy="48" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="58" cy="26" r="1.2" fill="currentColor" stroke="none" />
    </>
  );
}

function Hojas() {
  // Rama de eucalipto que baja por el costado y otra que corre por arriba.
  const redondas = (pts: readonly (readonly [number, number, number])[]) => pts.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={n(r * 0.86)} />);
  return (
    <>
      <path d="M12 8C10 34 14 62 30 92" />
      {redondas([
        [20, 20, 5.2],
        [4, 30, 4.8],
        [22, 40, 5],
        [6, 52, 4.6],
        [24, 62, 4.8],
        [10, 74, 4.2],
        [28, 82, 4],
      ])}
      <path d="M8 12C34 10 62 14 92 30" />
      {redondas([
        [30, 6, 4.6],
        [42, 20, 4.8],
        [54, 8, 4.4],
        [66, 22, 4.6],
        [78, 14, 4],
        [84, 28, 3.8],
      ])}
    </>
  );
}

function Deco() {
  return (
    <>
      <path d="M6 6H60M6 6V60" />
      <path d="M6 14H50M14 6V50" />
      <path d="M14 14H40M14 14V40" />
      <path d="M6 6L46 46" />
      {[10, 20, 30, 40].map((r) => (
        <path key={r} d={`M6 ${6 + r}A${r} ${r} 0 0 0 ${6 + r} 6`} />
      ))}
      <path d="M60 6L66 6M6 60L6 66" />
      <circle cx="68" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="68" r="1.5" fill="currentColor" stroke="none" />
    </>
  );
}

function Filigrana() {
  return (
    <>
      <path d="M8 8C40 6 56 22 52 40C50 50 40 52 36 46C32 40 40 34 46 40" />
      <path d="M8 8C6 40 22 56 40 52C50 50 52 40 46 36C40 32 34 40 40 46" />
      <path d="M8 8C26 10 32 20 30 30" />
      <path d="M8 8C10 26 20 32 30 30" />
      <path d="M30 30C36 34 40 38 44 44" />
      <path d="M62 10C70 8 78 12 82 18M10 62C8 70 12 78 18 82" />
      <circle cx="30" cy="30" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="86" cy="22" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="22" cy="86" r="1.2" fill="currentColor" stroke="none" />
    </>
  );
}

function Estrellas() {
  const destello = (x: number, y: number, r: number) => (
    <path key={`${x}-${y}`} d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} />
  );
  return (
    <>
      {destello(18, 18, 11)}
      {destello(44, 12, 5)}
      {destello(12, 46, 6)}
      {destello(38, 36, 3.5)}
      <circle cx="30" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8" cy="32" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="56" cy="26" r="1" fill="currentColor" stroke="none" />
      <circle cx="26" cy="58" r="1" fill="currentColor" stroke="none" />
      <path d="M62 6C58 8 56 14 60 18C56 16 52 12 54 6Z" />
    </>
  );
}

/**
 * Tres frondas de helecho que salen de la esquina: un raquis curvo con
 * foliolos alternos en forma de hoja (cerrados, no líneas: si no se ven
 * como telarañas), más chicos hacia la punta.
 */
function Selva() {
  const fronda = (angulo: number, L: number, k: number, key: string) => {
    const partes: React.JSX.Element[] = [];
    // El raquis: una curva suave hacia arriba.
    partes.push(<path key={`${key}-r`} d={`M0 0Q${(L * 0.55).toFixed(1)} ${(-L * 0.06).toFixed(1)} ${L} ${(-L * 0.18).toFixed(1)}`} />);
    for (let i = 0; i < k; i++) {
      const t = (i + 0.6) / (k + 0.6);
      const x = L * t;
      const y = 2 * (1 - t) * t * -L * 0.06 + t * t * -L * 0.18;
      const l = (1 - t) * L * 0.26 + 3; // largo del foliolo
      const w = l * 0.32; // ancho del foliolo
      const lado = i % 2 === 0 ? -1 : 1;
      const ang = lado * 58 - t * 10;
      const rad = (ang * Math.PI) / 180;
      // Un foliolo: hoja cerrada apuntada, con su nervio.
      const px = x + Math.cos(rad) * l;
      const py = y + Math.sin(rad) * l;
      const nx = -Math.sin(rad) * w;
      const ny = Math.cos(rad) * w;
      const cx = x + Math.cos(rad) * l * 0.5;
      const cy = y + Math.sin(rad) * l * 0.5;
      partes.push(
        <path
          key={`${key}-${i}`}
          d={`M${x.toFixed(1)} ${y.toFixed(1)}Q${(cx + nx).toFixed(1)} ${(cy + ny).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}Q${(cx - nx).toFixed(1)} ${(cy - ny).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z`}
        />,
      );
    }
    return (
      <g key={key} transform={`translate(8 8) rotate(${angulo})`}>
        {partes}
      </g>
    );
  };
  return (
    <>
      {fronda(14, 96, 9, "a")}
      {fronda(46, 74, 8, "b")}
      {fronda(76, 92, 9, "c")}
      <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
    </>
  );
}

/** Estrellas y una luna colgando de hilos desde el borde, como un móvil. */
function Magia() {
  const estrella = (r: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${n(Math.cos(a) * rr)} ${n(Math.sin(a) * rr)}`);
    }
    return `M${pts.join("L")}Z`;
  };
  const colgantes = [
    [22, 40, 7],
    [48, 62, 5.5],
    [74, 30, 6],
    [100, 48, 4.5],
  ] as const;
  return (
    <>
      <path d="M4 6C40 14 80 12 116 4" />
      {colgantes.map(([x, largo, r], i) => (
        <g key={i}>
          <path d={`M${x} ${n(8 + i * 0.6)}V${largo}`} strokeDasharray="1.5 2.5" />
          <path d={estrella(r)} transform={`translate(${x} ${largo + r})`} fill="currentColor" stroke="none" />
        </g>
      ))}
      <path d="M8 10V74" strokeDasharray="1.5 2.5" />
      <path d="M14 76A12 12 0 1 0 14 100A9.4 9.4 0 1 1 14 76Z" fill="currentColor" stroke="none" />
      <path d="M58 88l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1zM88 74l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="currentColor" stroke="none" />
    </>
  );
}

/** Dos banderas a cuadros que salen de la esquina, como en la meta. */
function Carreras() {
  const bandera = (x0: number, y0: number, ang: number, key: string) => {
    const cuadros: React.JSX.Element[] = [];
    for (let c = 0; c < 6; c++)
      for (let f = 0; f < 4; f++)
        if ((c + f) % 2 === 0) cuadros.push(<rect key={`${key}-${c}-${f}`} x={c * 7} y={f * 7} width="7" height="7" fill="currentColor" stroke="none" />);
    return (
      <g key={key} transform={`translate(${x0} ${y0}) rotate(${ang})`}>
        <path d="M0 0V-2" />
        {/* La tela ondea: un leve sesgo en vez de un rectángulo tieso. */}
        <g transform="skewY(-6)">
          {cuadros}
          <rect x="0" y="0" width="42" height="28" />
        </g>
      </g>
    );
  };
  return (
    <>
      <path d="M6 6L92 92" strokeWidth="2" />
      <path d="M6 6L40 106" strokeWidth="2" />
      {bandera(58, 50, -45, "a")}
      {bandera(28, 70, -18, "b")}
      <circle cx="6" cy="6" r="3" fill="currentColor" stroke="none" />
    </>
  );
}

/** La enredadera del cuento: rizos, hojitas, una corona y destellos. */
function Cuento() {
  return (
    <>
      <path d="M8 8C20 30 16 50 34 60S70 58 76 76" />
      <path d="M8 8C30 18 52 14 64 26S70 46 90 44" />
      <path d="M34 60c-8 2-12-4-8-8s10 0 8 6M64 26c4-8 12-6 12 0s-8 6-10 2M76 76c8 0 10 8 4 10s-8-4-4-8" />
      <path d="M20 34q-8-2-8 4q6 2 8-4zM46 18q2-8 8-6q-2 6-8 6zM52 62q4 6 0 10q-4-4 0-10z" />
      <g transform="translate(96 22)">
        <path d="M-10 6L-12 -6L-5 -1L0 -9L5 -1L12 -6L10 6Z" />
        <path d="M-10 9H10" />
        <circle cx="0" cy="-11" r="1.6" fill="currentColor" stroke="none" />
      </g>
      <path d="M28 92l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2zM104 60l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
    </>
  );
}

const DIBUJO: Record<Exclude<TipoEsquinas, "ninguna">, () => React.JSX.Element> = {
  floral: Floral,
  hojas: Hojas,
  deco: Deco,
  filigrana: Filigrana,
  estrellas: Estrellas,
  selva: Selva,
  magia: Magia,
  carreras: Carreras,
  cuento: Cuento,
};

/** Las cuatro esquinas; `soloArriba` deja solo las dos de arriba (para escenas cortas). */
export default function EsquinasDecorativas({ tipo, soloArriba = false }: { tipo: TipoEsquinas; soloArriba?: boolean }) {
  if (tipo === "ninguna") return null;
  const Dibujo = DIBUJO[tipo];
  const posiciones = soloArriba ? (["ai", "ad"] as const) : (["ai", "ad", "bi", "bd"] as const);
  return (
    <div className="inv-esquinas-orn" aria-hidden="true">
      {posiciones.map((pos) => (
        <svg key={pos} className={`inv-esquina inv-esquina-${pos}`} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
          <Dibujo />
        </svg>
      ))}
    </div>
  );
}
