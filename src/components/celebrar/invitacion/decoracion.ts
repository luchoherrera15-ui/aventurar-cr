import type { Decoracion, EscalaDecoracion } from "@/lib/celebrar/invitacion/esquema";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LOS MOTIVOS DECORATIVOS — patrones de línea fina para las escenas
 * ══════════════════════════════════════════════════════════════════
 *
 * Cada motivo es una LOSETA SVG (data: URI) que se repite como fondo de
 * la escena, dibujada en el color que se le pasa (el «suave» de la
 * escena, o el acento) con trazo fino y `fill: none` salvo donde el
 * dibujo lo pide. El estilo es el de la papelería fina: eucalipto,
 * olivo, helechos, peonías en línea, abanicos art déco, damasco, celosía,
 * olas japonesas… nada de clip art.
 *
 * Los dibujos se ARMAN con helpers (una hoja, una rama, una flor) en vez
 * de pegar paths gigantes: así cada loseta tiene variaciones (ángulos,
 * tamaños) y no se lee como cuadrícula. La opacidad no va acá: la pone
 * la capa (`decoracionIntensidad`), y la escala multiplica el tamaño de
 * la loseta.
 */

const ESCALA: Record<EscalaDecoracion, number> = { fina: 0.72, media: 1, grande: 1.4 };

type Loseta = { cuerpo: string; ancho: number; alto: number };

function datos(l: Loseta): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${l.ancho}" height="${l.alto}" viewBox="0 0 ${l.ancho} ${l.alto}">${l.cuerpo}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(doc)}")`;
}

const n = (x: number) => Math.round(x * 100) / 100;

/* ── Piezas ─────────────────────────────────────────────────────── */

/** Una hoja apuntada (largo L, ancho W) con nervio, con la base en (0,0) y la punta en (L,0). */
const hoja = (L: number, W: number, nervio = true) =>
  `<path d="M0 0Q${n(L * 0.5)} ${n(-W)} ${L} 0Q${n(L * 0.5)} ${n(W)} 0 0Z"/>${nervio ? `<path d="M0 0L${n(L * 0.9)} 0"/>` : ""}`;

/** Una hoja redonda (eucalipto): elipse ligeramente irregular. */
const hojaRedonda = (r: number) => `<ellipse cx="${r}" cy="0" rx="${r}" ry="${n(r * 0.88)}"/>`;

/**
 * Una rama: tallo desde (0,0) a lo largo de +x con `cuenta` hojas
 * alternadas. `dibujaHoja(i)` devuelve la hoja i con la base en el tallo.
 */
function rama(largo: number, cuenta: number, dibujaHoja: (i: number) => string, curva = 12): string {
  const partes: string[] = [`<path d="M0 0Q${n(largo / 2)} ${n(-curva)} ${largo} ${n(-curva * 1.2)}"/>`];
  for (let i = 0; i < cuenta; i++) {
    const t = (i + 1) / (cuenta + 1);
    // Punto sobre la curva cuadrática del tallo.
    const x = n(largo * t);
    const y = n(2 * (1 - t) * t * -curva + t * t * -curva * 1.2);
    const lado = i % 2 === 0 ? -1 : 1;
    const ang = lado * (38 + (i % 3) * 8) - (curva > 0 ? 10 : 0);
    partes.push(`<g transform="translate(${x} ${y}) rotate(${ang})">${dibujaHoja(i)}</g>`);
  }
  return partes.join("");
}

/** Una flor de `petalos` pétalos elípticos alrededor de un centro. */
function flor(petalos: number, rx: number, ry: number, centro = 2.2): string {
  const partes: string[] = [];
  for (let i = 0; i < petalos; i++) {
    partes.push(`<ellipse cx="0" cy="${n(-ry - 1)}" rx="${rx}" ry="${ry}" transform="rotate(${n((360 / petalos) * i)})"/>`);
  }
  partes.push(`<circle cx="0" cy="0" r="${centro}"/>`);
  return partes.join("");
}

/** Una peonía en línea: pétalos externos en arcos, remolino adentro. */
const peonia = (r: number) => {
  const partes: string[] = [];
  for (let i = 0; i < 7; i++) {
    partes.push(`<path d="M${n(-r * 0.55)} ${n(-r * 0.15)}Q0 ${n(-r * 1.15)} ${n(r * 0.55)} ${n(-r * 0.15)}" transform="rotate(${n((360 / 7) * i)})"/>`);
  }
  for (let i = 0; i < 5; i++) {
    partes.push(`<path d="M${n(-r * 0.3)} 0Q0 ${n(-r * 0.62)} ${n(r * 0.3)} 0" transform="rotate(${n(36 + 72 * i)})"/>`);
  }
  partes.push(`<circle cx="0" cy="0" r="${n(r * 0.1)}"/>`);
  return partes.join("");
};

/** Colocar una pieza en (x,y) girada `a` grados y escalada `s`. */
const en = (x: number, y: number, a: number, cuerpo: string, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${a})${s !== 1 ? ` scale(${s})` : ""}">${cuerpo}</g>`;

const estrella5 = (r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${n(Math.cos(a) * rr)} ${n(Math.sin(a) * rr)}`);
  }
  return `<path d="M${pts.join("L")}Z"/>`;
};
const destello4 = (r: number) => `<path d="M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z"/>`;
const luna = (r: number) => `<path d="M${n(r * 0.3)} ${-r}A${r} ${r} 0 1 0 ${n(r * 0.3)} ${r}A${n(r * 0.78)} ${n(r * 0.78)} 0 1 1 ${n(r * 0.3)} ${-r}Z"/>`;
const corazon = (r: number) =>
  `<path d="M0 ${n(r * 0.9)}C${n(-r * 1.3)} ${n(-r * 0.1)} ${n(-r * 0.9)} ${n(-r * 1.1)} 0 ${n(-r * 0.45)}C${n(r * 0.9)} ${n(-r * 1.1)} ${n(r * 1.3)} ${n(-r * 0.1)} 0 ${n(r * 0.9)}Z"/>`;
const mariposa = (r: number) =>
  `<path d="M0 ${n(-r * 0.6)}L0 ${n(r * 0.6)}"/>` +
  `<path d="M0 ${n(-r * 0.4)}Q${n(-r * 1.1)} ${n(-r * 1.3)} ${n(-r * 1.2)} ${n(-r * 0.3)}Q${n(-r * 1.1)} ${n(r * 0.2)} 0 ${n(r * 0.05)}"/>` +
  `<path d="M0 ${n(-r * 0.4)}Q${n(r * 1.1)} ${n(-r * 1.3)} ${n(r * 1.2)} ${n(-r * 0.3)}Q${n(r * 1.1)} ${n(r * 0.2)} 0 ${n(r * 0.05)}"/>` +
  `<path d="M0 ${n(r * 0.05)}Q${n(-r * 0.9)} ${n(r * 0.1)} ${n(-r * 0.75)} ${n(r * 0.75)}Q${n(-r * 0.3)} ${n(r * 0.9)} 0 ${n(r * 0.5)}"/>` +
  `<path d="M0 ${n(r * 0.05)}Q${n(r * 0.9)} ${n(r * 0.1)} ${n(r * 0.75)} ${n(r * 0.75)}Q${n(r * 0.3)} ${n(r * 0.9)} 0 ${n(r * 0.5)}"/>` +
  `<path d="M0 ${n(-r * 0.6)}Q${n(-r * 0.25)} ${n(-r * 0.9)} ${n(-r * 0.35)} ${n(-r * 1.05)}M0 ${n(-r * 0.6)}Q${n(r * 0.25)} ${n(-r * 0.9)} ${n(r * 0.35)} ${n(-r * 1.05)}"/>`;
const globo = (r: number) =>
  `<ellipse cx="0" cy="0" rx="${r}" ry="${n(r * 1.18)}"/><path d="M${n(-r * 0.22)} ${n(r * 1.25)}L0 ${n(r * 1.12)}L${n(r * 0.22)} ${n(r * 1.25)}Z"/><path d="M0 ${n(r * 1.25)}Q${n(r * 0.5)} ${n(r * 1.8)} 0 ${n(r * 2.3)}Q${n(-r * 0.4)} ${n(r * 2.7)} ${n(r * 0.2)} ${n(r * 3.1)}"/>`;

/** El abanico art déco: semicírculo relleno (para tapar al de atrás), arcos concéntricos y rayos. */
const abanico = (R: number, fondo = "none") => {
  const partes: string[] = [`<path d="M${-R} 0A${R} ${R} 0 0 1 ${R} 0Z" fill="${fondo}"/>`];
  for (let k = 1; k <= 2; k++) {
    const r = n((R * k) / 3);
    partes.push(`<path d="M${-r} 0A${r} ${r} 0 0 1 ${r} 0"/>`);
  }
  for (let i = 1; i < 4; i++) {
    const a = Math.PI - (Math.PI / 4) * i;
    partes.push(`<path d="M0 0L${n(Math.cos(a) * R)} ${n(-Math.sin(a) * R)}"/>`);
  }
  return partes.join("");
};

/** El rizo del damasco, simétrico. */
const damasco = (r: number) => {
  const mitad = `<path d="M0 ${n(r * 0.9)}C${n(-r * 0.1)} ${n(r * 0.2)} ${n(-r * 0.9)} ${n(r * 0.4)} ${n(-r * 0.85)} ${n(-r * 0.2)}C${n(-r * 0.8)} ${n(-r * 0.7)} ${n(-r * 0.3)} ${n(-r * 0.75)} ${n(-r * 0.25)} ${n(-r * 0.35)}C${n(-r * 0.22)} ${n(-r * 0.1)} ${n(-r * 0.45)} ${n(-r * 0.05)} ${n(-r * 0.5)} ${n(-r * 0.25)}"/><path d="M0 ${n(-r * 0.95)}C${n(-r * 0.35)} ${n(-r * 0.95)} ${n(-r * 0.45)} ${n(-r * 0.55)} 0 ${n(-r * 0.4)}"/>`;
  return `${mitad}<g transform="scale(-1 1)">${mitad}</g><path d="M0 ${n(-r * 0.4)}L0 ${n(r * 0.9)}"/><path d="M${n(-r * 0.1)} ${n(-r * 1.15)}L0 ${n(-r * 1.3)}L${n(r * 0.1)} ${n(-r * 1.15)}L0 ${n(-r * 1)}Z"/>`;
};

/* ── Las losetas ────────────────────────────────────────────────── */

function loseta(d: Exclude<Decoracion, "ninguna">, c: string, fondo: string): Loseta {
  // Un atributo repetido rompe el XML entero (la loseta sale en blanco): el grosor y la opacidad van por parámetro.
  const g = (cuerpo: string, grosor = 1.1, opacidad = 1) =>
    `<g fill="none" stroke="${c}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"${opacidad < 1 ? ` opacity="${opacidad}"` : ""}>${cuerpo}</g>`;
  const relleno = (cuerpo: string) => `<g fill="${c}" stroke="none">${cuerpo}</g>`;

  switch (d) {
    case "hojas":
      return {
        ancho: 260,
        alto: 260,
        cuerpo: g(
          en(20, 60, -28, rama(96, 7, (i) => hoja(16 + (i % 2) * 3, 4.6))) +
            en(150, 200, 148, rama(88, 6, (i) => hoja(15 + (i % 3) * 2, 4.2))) +
            en(170, 40, 62, rama(70, 5, () => hoja(13, 3.8))) +
            en(60, 190, -75, rama(58, 4, () => hoja(12, 3.6), 6)),
        ),
      };
    case "eucalipto":
      return {
        ancho: 280,
        alto: 280,
        cuerpo: g(
          en(24, 70, -22, rama(120, 8, (i) => hojaRedonda(5.2 + (i % 3) * 0.8), 18)) +
            en(170, 240, 152, rama(110, 7, (i) => hojaRedonda(5 + (i % 2)), 14)) +
            en(200, 30, 78, rama(78, 5, () => hojaRedonda(4.6), 8)),
        ),
      };
    case "olivo":
      return {
        ancho: 280,
        alto: 260,
        cuerpo: g(
          en(20, 80, -18, rama(130, 9, (i) => hoja(17 + (i % 2) * 2, 2.6, false), 10)) +
            en(255, 210, 166, rama(120, 8, (i) => hoja(16 + (i % 3), 2.5, false), 8)) +
            relleno(`<circle cx="70" cy="62" r="3.2"/><circle cx="82" cy="74" r="2.8"/><circle cx="196" cy="214" r="3"/><circle cx="184" cy="226" r="2.6"/>`),
        ),
      };
    case "helecho": {
      const fronda = (L: number, k: number) => {
        const partes: string[] = [`<path d="M0 0Q${n(L * 0.5)} ${n(-L * 0.12)} ${L} ${n(-L * 0.22)}"/>`];
        for (let i = 0; i < k; i++) {
          const t = (i + 1) / (k + 1);
          const x = n(L * t);
          const y = n(2 * (1 - t) * t * -L * 0.12 + t * t * -L * 0.22);
          const l = n((1 - t) * L * 0.28 + 3);
          partes.push(`<path d="M${x} ${y}Q${n(x + l * 0.3)} ${n(y - l * 0.8)} ${n(x + l * 0.15)} ${n(y - l)}"/><path d="M${x} ${y}Q${n(x + l * 0.5)} ${n(y + l * 0.7)} ${n(x + l * 0.4)} ${n(y + l * 0.95)}"/>`);
        }
        return partes.join("");
      };
      return { ancho: 280, alto: 280, cuerpo: g(en(20, 100, -35, fronda(110, 11)) + en(180, 260, 140, fronda(100, 10)) + en(210, 40, 70, fronda(70, 7))) };
    }
    case "monstera": {
      const hojaM = (r: number) =>
        `<path d="M0 ${n(-r)}C${n(r * 0.7)} ${n(-r)} ${n(r * 1.05)} ${n(-r * 0.45)} ${n(r * 0.95)} ${n(r * 0.05)}C${n(r * 0.85)} ${n(r * 0.6)} ${n(r * 0.45)} ${n(r * 1.05)} 0 ${n(r * 1.1)}C${n(-r * 0.45)} ${n(r * 1.05)} ${n(-r * 0.85)} ${n(r * 0.6)} ${n(-r * 0.95)} ${n(r * 0.05)}C${n(-r * 1.05)} ${n(-r * 0.45)} ${n(-r * 0.7)} ${n(-r)} 0 ${n(-r)}Z"/>` +
        `<path d="M0 ${n(-r * 0.6)}L0 ${n(r * 1.1)}"/>` +
        `<path d="M${n(-r * 0.9)} ${n(-r * 0.2)}L${n(-r * 0.25)} ${n(-r * 0.1)}M${n(-r * 0.95)} ${n(r * 0.3)}L${n(-r * 0.3)} ${n(r * 0.3)}M${n(-r * 0.7)} ${n(r * 0.75)}L${n(-r * 0.25)} ${n(r * 0.65)}"/>` +
        `<path d="M${n(r * 0.9)} ${n(-r * 0.2)}L${n(r * 0.25)} ${n(-r * 0.1)}M${n(r * 0.95)} ${n(r * 0.3)}L${n(r * 0.3)} ${n(r * 0.3)}M${n(r * 0.7)} ${n(r * 0.75)}L${n(r * 0.25)} ${n(r * 0.65)}"/>` +
        `<path d="M0 ${n(r * 1.1)}Q${n(r * 0.1)} ${n(r * 1.6)} ${n(-r * 0.1)} ${n(r * 2)}"/>`;
      return { ancho: 300, alto: 300, cuerpo: g(en(70, 70, -20, hojaM(34)) + en(225, 215, 165, hojaM(30)) + en(230, 60, 40, hojaM(20)) + en(60, 230, -150, hojaM(18))) };
    }
    case "laurel": {
      const ramaLaurel = (L: number) => {
        const partes: string[] = [`<path d="M0 0Q${n(L * 0.5)} ${n(-L * 0.35)} ${L} ${n(-L * 0.9)}"/>`];
        for (let i = 0; i < 6; i++) {
          const t = (i + 1) / 7;
          const x = n(L * t);
          const y = n(2 * (1 - t) * t * -L * 0.35 + t * t * -L * 0.9);
          const ang = -40 - t * 30;
          partes.push(en(x, y, ang - 45, hoja(12, 3.4, false)) + en(x, y, ang + 45, hoja(12, 3.4, false)));
        }
        return partes.join("");
      };
      return {
        ancho: 260,
        alto: 260,
        cuerpo: g(`<g transform="translate(126 214) scale(-1 1)">${ramaLaurel(84)}</g>` + en(134, 214, 0, ramaLaurel(84)) + `<g transform="translate(56 92) scale(-.55 .55)">${ramaLaurel(84)}</g>` + en(204, 92, 0, ramaLaurel(84), 0.55)),
      };
    }
    case "flores":
      return {
        ancho: 220,
        alto: 220,
        cuerpo: g(
          en(46, 50, 12, flor(5, 3.6, 7.5)) +
            en(160, 130, -20, flor(6, 3.2, 6.5)) +
            en(90, 180, 30, flor(5, 3, 6)) +
            en(190, 36, 0, flor(5, 2.4, 5, 1.6)) +
            en(70, 92, -50, hoja(16, 4.5)) +
            en(140, 160, 130, hoja(14, 4)) +
            en(20, 160, 40, hoja(12, 3.5)) +
            relleno(`<circle cx="120" cy="80" r="1.4"/><circle cx="30" cy="110" r="1.2"/><circle cx="200" cy="190" r="1.4"/>`),
        ),
      };
    case "peonias":
      return {
        ancho: 300,
        alto: 300,
        cuerpo: g(
          en(78, 82, 0, peonia(36)) +
            en(226, 222, 22, peonia(30)) +
            en(232, 66, -14, peonia(18)) +
            en(62, 236, 8, peonia(20)) +
            en(118, 118, 50, hoja(26, 8)) +
            en(40, 42, 200, hoja(22, 7)) +
            en(190, 250, -140, hoja(24, 7)) +
            en(260, 190, 100, hoja(20, 6)),
        ),
      };
    case "mariposas":
      return { ancho: 260, alto: 260, cuerpo: g(en(60, 60, -12, mariposa(16)) + en(190, 170, 18, mariposa(13)) + en(200, 50, 30, mariposa(9)) + en(70, 200, -25, mariposa(10)) + relleno(`<circle cx="130" cy="120" r="1.2"/><circle cx="30" cy="140" r="1"/>`)) };
    case "deco": {
      // Abanicos en filas alternadas, como escamas.
      const R = 44;
      const fila = (y: number, dx: number) => [-1, 0, 1, 2].map((i) => en(dx + i * R * 2, y, 0, abanico(R, fondo))).join("");
      // Filas cada 30 px, alternando el desfase: la de abajo tapa a la de arriba.
      return { ancho: 176, alto: 60, cuerpo: g(fila(0, R) + fila(30, 0) + fila(60, R) + fila(90, 0), 0.9) };
    }
    case "damasco":
      return { ancho: 200, alto: 240, cuerpo: g(en(50, 60, 0, damasco(30)) + en(150, 180, 0, damasco(30)) + en(150, 60, 0, `<circle r="2.2"/>`) + en(50, 180, 0, `<circle r="2.2"/>`)) };
    case "celosia": {
      // Celosía morisca: lentes horizontales y verticales que forman cuadrifolios.
      const lente = `<path d="M0 30Q30 0 60 30Q30 60 0 30Z"/>`;
      return { ancho: 60, alto: 60, cuerpo: g(lente + `<g transform="translate(60 0) rotate(90)">${lente}</g>`, 0.8) };
    }
    case "geometria":
      return {
        ancho: 96,
        alto: 96,
        cuerpo: g(`<path d="M0 96L96 0M-8 8L8 -8M88 104L104 88"/><path d="M48 24L72 48L48 72L24 48Z"/>`) + relleno(`<circle cx="48" cy="48" r="1.6"/><circle cx="0" cy="0" r="1.6"/><circle cx="96" cy="96" r="1.6"/>`),
      };
    case "lineas":
      return { ancho: 16, alto: 16, cuerpo: g(`<path d="M-4 20L20 -4M-4 4L4 -4M12 20L20 12"/>`, 0.9) };
    case "cuadricula":
      return { ancho: 44, alto: 44, cuerpo: g(`<path d="M0 .5H44M.5 0V44"/>`, 0.6) };
    case "ondas": {
      // Seigaiha: escamas concéntricas rellenas del fondo para taparse entre filas.
      const escama = (cx: number, cy: number) =>
        `<circle cx="${cx}" cy="${cy}" r="40" fill="${fondo}"/><circle cx="${cx}" cy="${cy}" r="31" fill="${fondo}"/><circle cx="${cx}" cy="${cy}" r="22" fill="${fondo}"/><circle cx="${cx}" cy="${cy}" r="13" fill="${fondo}"/>`;
      // Filas cada 40 px (medio radio de separación visual), alternando el
      // desfase; la fila de abajo se dibuja después y tapa la de arriba.
      const fila = (cy: number, desfase: number) => [0, 1, 2].map((i) => escama(desfase + i * 80, cy)).join("");
      return { ancho: 160, alto: 80, cuerpo: g(fila(-40, 40) + fila(0, 0) + fila(40, 40) + fila(80, 0) + fila(120, 40), 1) };
    }
    case "estrellas":
      return {
        ancho: 260,
        alto: 260,
        cuerpo:
          g(en(50, 50, 0, estrella5(7)) + en(200, 160, 15, estrella5(5)) + en(90, 210, 0, destello4(9)) + en(220, 40, 0, destello4(6)) + en(150, 100, -20, luna(11))) +
          relleno(`<circle cx="120" cy="40" r="1.3"/><circle cx="30" cy="150" r="1.1"/><circle cx="240" cy="230" r="1.4"/><circle cx="170" cy="230" r="1"/><circle cx="70" cy="120" r="1"/>`),
      };
    case "corazones":
      return { ancho: 200, alto: 200, cuerpo: g(en(40, 46, -12, corazon(9)) + en(150, 120, 10, corazon(7)) + en(90, 170, -6, corazon(5)) + en(170, 30, 16, corazon(4))) + relleno(en(110, 70, 0, corazon(2.6)) + en(30, 130, 0, corazon(2.2))) };
    case "anillos":
      return {
        ancho: 240,
        alto: 220,
        cuerpo: g(`<circle cx="60" cy="70" r="22"/><circle cx="82" cy="70" r="22"/><circle cx="170" cy="170" r="14"/><circle cx="184" cy="170" r="14"/>` + en(60, 44, 0, destello4(5)) + en(184, 152, 0, destello4(4)), 1.3),
      };
    case "confeti":
      return {
        ancho: 220,
        alto: 220,
        cuerpo:
          relleno(`<circle cx="30" cy="40" r="3"/><circle cx="160" cy="70" r="2.4"/><circle cx="110" cy="190" r="3.2"/><circle cx="200" cy="200" r="2"/>` + en(70, 100, 25, `<rect x="-6" y="-2" width="12" height="4" rx="2"/>`) + en(190, 130, -35, `<rect x="-6" y="-2" width="12" height="4" rx="2"/>`) + en(40, 180, 60, `<rect x="-5" y="-1.8" width="10" height="3.6" rx="1.8"/>`)) +
          g(en(130, 30, 10, `<path d="M-6 5L0 -6L6 5Z"/>`) + en(80, 150, -20, `<path d="M-5 4L0 -5L5 4Z"/>`) + en(180, 20, 0, `<path d="M-6 0Q-3 -6 0 0Q3 6 6 0"/>`) + en(20, 120, 40, `<path d="M-6 0Q-3 -6 0 0Q3 6 6 0"/>`)),
      };
    case "puntos":
      return { ancho: 36, alto: 36, cuerpo: relleno(`<circle cx="9" cy="9" r="1.8"/><circle cx="27" cy="27" r="1.8"/>`) };
    case "terrazzo":
      return {
        ancho: 240,
        alto: 240,
        cuerpo: relleno(
          `<path d="M30 40Q42 28 56 38Q62 52 48 60Q32 62 28 50Z"/><path d="M150 60Q160 52 168 62Q170 74 158 76Q146 74 150 60Z"/><path d="M90 150Q104 140 118 152Q122 170 104 176Q86 172 90 150Z"/><path d="M200 190Q210 182 218 192Q220 204 208 206Q196 202 200 190Z"/><path d="M40 200Q46 194 52 200Q54 208 46 210Q38 208 40 200Z"/><path d="M190 120Q196 116 200 122Q200 128 194 129Q188 126 190 120Z"/>`,
        ) + g(`<path d="M120 30Q132 24 140 34Q138 46 126 46Q116 42 120 30Z"/><path d="M60 110Q68 104 74 112Q72 122 62 120Q56 116 60 110Z"/>`),
      };
    case "globos":
      return { ancho: 240, alto: 260, cuerpo: g(en(50, 60, -8, globo(14)) + en(170, 40, 6, globo(11)) + en(130, 150, -4, globo(16)) + en(40, 190, 10, globo(9)) + en(210, 190, -10, globo(12))) };
    case "dinosaurios": {
      // Siluetas rellenas (un tiranosaurio, un cuello largo), huellas de
      // tres dedos y frondas de helecho: el parque de dinosaurios de las
      // fiestas infantiles, en línea fina como el resto.
      const trex =
        `<path d="M0 24Q10 19 22 18Q29 12 33 9Q37 3 44 3L58 7L55 11L59 12L50 16L45 17Q41 20 39 23L35 21L37 19L32 20Q30 26 28 29L25 37L32 41L20 41L21 33Q19 27 16 25Q9 27 0 28Z"/>`;
      const cuelloLargo =
        `<path d="M2 4Q7 2 10 6L15 25Q22 22 34 24Q46 26 60 35Q47 31 37 33L37 41L32 41L32 34L25 34L25 41L20 41L20 30Q14 26 12 16Q8 10 3 8Z"/>`;
      const huella =
        `<ellipse cx="0" cy="3" rx="4.2" ry="5.2"/><ellipse cx="-5.6" cy="-4" rx="2" ry="4.3" transform="rotate(-28 -5.6 -4)"/><ellipse cx="0" cy="-6.2" rx="2" ry="4.8"/><ellipse cx="5.6" cy="-4" rx="2" ry="4.3" transform="rotate(28 5.6 -4)"/>`;
      const fronda = (L: number, k: number) => {
        const partes: string[] = [`<path d="M0 0Q${n(L * 0.5)} ${n(-L * 0.12)} ${L} ${n(-L * 0.22)}"/>`];
        for (let i = 0; i < k; i++) {
          const t = (i + 1) / (k + 1);
          const x = n(L * t);
          const y = n(2 * (1 - t) * t * -L * 0.12 + t * t * -L * 0.22);
          const l = n((1 - t) * L * 0.28 + 3);
          partes.push(`<path d="M${x} ${y}Q${n(x + l * 0.3)} ${n(y - l * 0.8)} ${n(x + l * 0.15)} ${n(y - l)}"/><path d="M${x} ${y}Q${n(x + l * 0.5)} ${n(y + l * 0.7)} ${n(x + l * 0.4)} ${n(y + l * 0.95)}"/>`);
        }
        return partes.join("");
      };
      return {
        ancho: 320,
        alto: 320,
        cuerpo:
          relleno(
            en(40, 60, -4, trex, 1.15) +
              en(255, 230, 4, `<g transform="scale(-1 1)">${trex}</g>`, 0.95) +
              en(110, 200, 12, huella) +
              en(135, 232, 16, huella) +
              en(160, 264, 20, huella) +
              en(262, 70, -14, huella, 0.8) +
              en(244, 104, -10, huella, 0.8),
          ) + g(en(170, 30, 0, cuelloLargo, 1.05) + en(30, 250, -28, fronda(60, 8)) + en(290, 160, 152, fronda(56, 7)) + en(70, 140, 20, fronda(40, 6)), 1.1, 0.9),
      };
    }
    case "magia": {
      // El colegio de magia en línea fina: varitas con su estrella, lunas,
      // sombreros puntiagudos, frascos de poción y escobas. Sin escudos ni
      // nombres de ninguna saga: el tema, no la marca.
      const varita = `<path d="M0 0L34 -16"/><path d="M0 0L6 -2.8" stroke-width="2.4"/>` + en(38, -18, 0, estrella5(5));
      const sombrero = `<path d="M-16 0Q0 4 16 0"/><path d="M-10 -1L2 -30Q4 -34 8 -30L6 -26M-10 -1Q0 1 9 -1L4 -24"/><path d="M-8 -6Q0 -4 8 -6"/>`;
      const pocion = `<path d="M-3 -16h6M-2 -16v6Q-10 -6 -10 2Q-10 10 0 10Q10 10 10 2Q10 -6 2 -10v-6"/><path d="M-9 1Q0 4 9 1"/><circle cx="-3" cy="5" r="1.4"/><circle cx="3" cy="-2" r="1"/>`;
      const escoba = `<path d="M-30 0L14 0"/><path d="M14 -2L30 -8M14 0L32 0M14 2L30 8M14 -1L31 -4M14 1L31 4"/><path d="M12 -3L12 3"/>`;
      return {
        ancho: 300,
        alto: 300,
        cuerpo:
          g(en(40, 70, 0, varita) + en(200, 240, -12, sombrero, 1.1) + en(240, 70, 0, pocion) + en(110, 180, -18, escoba) + en(80, 260, 0, luna(10)) + en(170, 40, 0, luna(7))) +
          relleno(en(150, 120, 0, destello4(6)) + en(270, 160, 0, destello4(4)) + en(30, 170, 0, destello4(5)) + `<circle cx="120" cy="30" r="1.3"/><circle cx="260" cy="280" r="1.2"/><circle cx="20" cy="240" r="1"/>`),
      };
    }
    case "carreras": {
      // La pista: autos de fórmula de perfil (rellenos), banderas a cuadros,
      // conos y un trofeo. Siluetas genéricas, sin ningún personaje.
      const auto = `<path d="M-30 4L-28 -4L-18 -6L-8 -12L6 -12L12 -6L26 -4L30 0L30 4Z"/><rect x="-32" y="-12" width="6" height="8" rx="1"/>`;
      const ruedas = `<circle cx="-18" cy="5" r="5"/><circle cx="18" cy="5" r="5"/>`;
      const bandera = (() => {
        const cuadros: string[] = [];
        for (let c = 0; c < 4; c++) for (let f = 0; f < 3; f++) if ((c + f) % 2 === 0) cuadros.push(`<rect x="${c * 5}" y="${-18 + f * 5}" width="5" height="5"/>`);
        return cuadros.join("");
      })();
      const cono = `<path d="M-8 8L-2 -12L2 -12L8 8Z"/><path d="M-11 8H11"/><path d="M-5.5 -1H5.5M-4 -6H4"/>`;
      const trofeo = `<path d="M-8 -14H8V-6Q8 2 0 3Q-8 2 -8 -6Z"/><path d="M-8 -11Q-14 -11 -13 -6Q-12 -2 -7 -3M8 -11Q14 -11 13 -6Q12 -2 7 -3"/><path d="M0 3V9M-6 12H6V9H-6Z"/>`;
      return {
        ancho: 320,
        alto: 280,
        cuerpo:
          relleno(en(70, 60, 0, auto) + en(240, 200, 0, `<g transform="scale(-1 1)">${auto}</g>`, 0.85) + en(200, 70, -8, bandera) + en(40, 210, 10, bandera, 0.8)) +
          g(en(70, 60, 0, ruedas) + en(240, 200, 0, ruedas, 0.85) + en(200, 70, -8, `<path d="M0 -18V16"/><rect x="0" y="-18" width="20" height="15"/>`) + en(40, 210, 10, `<path d="M0 -18V16"/><rect x="0" y="-18" width="20" height="15"/>`, 0.8) + en(140, 150, 0, cono) + en(290, 110, 0, trofeo) + en(130, 250, 0, `<path d="M-24 0H24" stroke-dasharray="8 6"/>`) + en(20, 120, 0, `<path d="M0 -4H14M4 0H20M0 4H12"/>`), 1.2),
      };
    }
    case "castillos": {
      // El cuento de hadas: castillos de torres con banderín, coronas,
      // corazones y destellos.
      const castillo = `<path d="M-22 14V-4H-14V14M14 14V-4H22V14M-14 14V-12H14V14"/><path d="M-24 -4L-18 -16L-12 -4M12 -4L18 -16L24 -4M-8 -12L0 -28L8 -12"/><path d="M0 -28V-36L7 -33L0 -30M-18 -16V-22L-13 -20L-18 -18"/><path d="M-4 14V6Q0 1 4 6V14"/><path d="M-26 14H26"/>`;
      const corona = `<path d="M-10 6L-12 -6L-5 -1L0 -9L5 -1L12 -6L10 6Z"/><path d="M-10 9H10"/>`;
      return {
        ancho: 300,
        alto: 300,
        cuerpo:
          g(en(70, 80, 0, castillo, 1.2) + en(220, 220, 0, castillo, 0.9) + en(220, 60, -10, corona) + en(60, 230, 8, corona, 0.8) + en(150, 150, -8, corazon(7)) + en(270, 140, 12, corazon(5))) +
          relleno(en(150, 40, 0, destello4(6)) + en(20, 150, 0, destello4(5)) + en(140, 270, 0, destello4(4)) + `<circle cx="110" cy="200" r="1.3"/><circle cx="280" cy="280" r="1.2"/>`),
      };
    }
  }
}

/**
 * El patrón listo para `background-image`/`background-size`, o null si
 * no hay motivo. `color` es el trazo (hex), `fondo` el color de la
 * escena (para las olas japonesas, que se tapan entre filas).
 */
export function patronDecoracion(
  d: Decoracion,
  color: string,
  fondo = "#ffffff",
  escala: EscalaDecoracion = "media",
): { backgroundImage: string; backgroundSize: string } | null {
  if (d === "ninguna") return null;
  const l = loseta(d, color, fondo);
  const k = ESCALA[escala];
  return { backgroundImage: datos(l), backgroundSize: `${n(l.ancho * k)}px ${n(l.alto * k)}px` };
}
