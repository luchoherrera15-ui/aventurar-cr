"use client";

import { useEffect, useState } from "react";
import type { Apertura, Paleta } from "@/lib/celebrar/invitacion/esquema";
import { alfa, mezclar } from "@/lib/celebrar/invitacion/colores";

/** El evento con el que la apertura avisa «ya se abrió»: la música arranca ahí. */
export const EVENTO_ABRIR = "celebrar:abrir";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LA APERTURA — la invitación llega cerrada y se abre con un toque
 * ══════════════════════════════════════════════════════════════════
 *
 * Decisión del dueño (22 sep 2026): TODAS las invitaciones se abren con
 * una animación y al abrirla arranca la música; y NO todas con la misma
 * —hay cuarenta y ocho (tres temáticas), repartidas entre las familias del catálogo—.
 *
 * Cada apertura se arma con tres piezas:
 *   · el TELÓN, una o varias láminas que cubren la pantalla y se van
 *     (a los lados, hacia arriba, como persianas, como mosaico…);
 *   · el ADORNO del centro (un sobre, un monograma, un pergamino…);
 *   · unos EXTRAS opcionales (chispas, partículas, un flash).
 * El CSS decide cómo se va cada cosa; acá solo se dice cuántas piezas
 * hay y qué se dibuja, para no repetir cuarenta y cinco componentes.
 *
 * La capa va FUERA del artículo (que tiene contención de layout y
 * encerraría un `fixed`), así que recibe los colores por props.
 */

type Adorno = "sobre" | "monograma" | "papel" | "semaforo" | "libro_cuento" | "ninguno";

type Receta = {
  piezas: number;
  adorno: Adorno;
  particulas?: number;
  /** Para las que son una rejilla: [columnas, filas]. CSS no tiene `floor()`. */
  rejilla?: readonly [number, number];
  /** Cuánto dura la animación de abrir, en ms (1 500 si no se dice). */
  duracion?: number;
  /** El llamado a tocar, si la apertura tiene el suyo. */
  toca?: string;
};

/** Qué dibuja cada apertura: piezas del telón, adorno del centro y partículas. */
const CONFIG: Record<Exclude<Apertura, "directa">, Receta> = {
  // Papel
  sobre: { piezas: 0, adorno: "sobre" },
  sobre_cera: { piezas: 0, adorno: "sobre" },
  carta_doblada: { piezas: 0, adorno: "papel" },
  pergamino: { piezas: 0, adorno: "papel" },
  postal: { piezas: 0, adorno: "papel" },
  libro: { piezas: 2, adorno: "papel" },
  diptico: { piezas: 2, adorno: "monograma" },
  abanico: { piezas: 6, adorno: "monograma" },
  sobre_desliza: { piezas: 0, adorno: "sobre" },
  funda: { piezas: 1, adorno: "papel" },
  // Telones
  telon: { piezas: 2, adorno: "monograma" },
  telon_alto: { piezas: 1, adorno: "monograma" },
  persiana: { piezas: 8, adorno: "monograma" },
  persiana_v: { piezas: 8, adorno: "monograma" },
  puertas: { piezas: 2, adorno: "monograma" },
  iris: { piezas: 1, adorno: "monograma" },
  cremallera: { piezas: 2, adorno: "monograma" },
  mosaico: { piezas: 12, adorno: "monograma", rejilla: [4, 3] },
  damero: { piezas: 16, adorno: "monograma", rejilla: [4, 4] },
  franjas: { piezas: 7, adorno: "monograma" },
  // Luz
  destello: { piezas: 0, adorno: "monograma", particulas: 12 },
  flash: { piezas: 0, adorno: "monograma" },
  amanecer: { piezas: 1, adorno: "monograma" },
  rayo: { piezas: 0, adorno: "monograma", particulas: 8 },
  chispas: { piezas: 0, adorno: "monograma", particulas: 18 },
  fuegos: { piezas: 0, adorno: "monograma", particulas: 22 },
  purpurina: { piezas: 0, adorno: "monograma", particulas: 26 },
  halo: { piezas: 0, adorno: "monograma" },
  // Partículas
  petalos: { piezas: 0, adorno: "monograma", particulas: 18 },
  confeti: { piezas: 0, adorno: "monograma", particulas: 24 },
  humo: { piezas: 3, adorno: "monograma" },
  burbujas: { piezas: 0, adorno: "monograma", particulas: 16 },
  hojas: { piezas: 0, adorno: "monograma", particulas: 14 },
  nieve: { piezas: 0, adorno: "monograma", particulas: 26 },
  arena: { piezas: 0, adorno: "monograma", particulas: 30 },
  estrellas: { piezas: 0, adorno: "monograma", particulas: 22 },
  // Movimiento
  zoom: { piezas: 1, adorno: "monograma" },
  giro: { piezas: 1, adorno: "papel" },
  ondas: { piezas: 3, adorno: "monograma" },
  ripple: { piezas: 1, adorno: "monograma" },
  pixeles: { piezas: 16, adorno: "monograma", rejilla: [4, 4] },
  glitch: { piezas: 3, adorno: "monograma" },
  espiral: { piezas: 1, adorno: "monograma" },
  corte: { piezas: 2, adorno: "monograma" },
  rebote: { piezas: 1, adorno: "monograma" },
  // Temáticas
  carta_magica: { piezas: 0, adorno: "sobre", particulas: 20, duracion: 2000, toca: "Tocá para romper el lacre" },
  largada: { piezas: 2, adorno: "semaforo", particulas: 14, duracion: 2300, toca: "Tocá para arrancar" },
  cuento: { piezas: 2, adorno: "libro_cuento", particulas: 24, duracion: 1900, toca: "Tocá para abrir el cuento" },
};

/**
 * Un azar REPETIBLE: la misma partícula cae siempre igual. Tiene que ser
 * determinista porque esto también se pinta en el servidor —un
 * `Math.random()` daría un HTML distinto y rompería la hidratación—.
 */
function azar(i: number, semilla: number) {
  const x = Math.sin((i + 1) * 127.1 + semilla * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Las variables de una partícula: dónde nace, cuánto tarda, cómo gira. */
function varsParticula(i: number, n: number): React.CSSProperties {
  return {
    "--i": i,
    "--n": n,
    // dónde nace a lo ancho, y su deriva lateral mientras cae
    "--x": (4 + azar(i, 1) * 92).toFixed(2),
    "--y": (6 + azar(i, 9) * 84).toFixed(2),
    "--dx": (azar(i, 2) * 30 - 15).toFixed(2),
    // el retraso NO va pegado a la posición: si no, caen en fila india
    "--d": (azar(i, 3) * 0.35).toFixed(3) + "s",
    "--s": (0.65 + azar(i, 4) * 0.8).toFixed(2),
    "--r": (azar(i, 5) * 720 - 360).toFixed(0),
    "--t": (0.9 + azar(i, 6) * 0.7).toFixed(2) + "s",
    // para las que salen del centro: el ángulo repartido con una pizca de azar
    "--ang": (i * (360 / n) + azar(i, 7) * 18 - 9).toFixed(1),
    "--rad": (26 + azar(i, 8) * 30).toFixed(1),
  } as React.CSSProperties;
}

export default function AperturaInvitacion({
  tipo,
  nombre,
  saludo,
  paleta,
  fuenteTitulo,
  fuenteTexto,
}: {
  tipo: Exclude<Apertura, "directa">;
  nombre: string;
  saludo: string;
  paleta: Paleta;
  fuenteTitulo: string;
  fuenteTexto: string;
}) {
  const [estado, setEstado] = useState<"cerrada" | "abriendo" | "abierta">("cerrada");

  // Mientras está cerrada no se scrollea la invitación de atrás.
  useEffect(() => {
    if (estado === "abierta") return;
    const html = document.documentElement;
    const previo = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previo;
    };
  }, [estado]);

  function abrir() {
    if (estado !== "cerrada") return;
    setEstado("abriendo");
    window.dispatchEvent(new Event(EVENTO_ABRIR));
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setEstado("abierta"), reducido ? 250 : (CONFIG[tipo]?.duracion ?? 1500));
  }

  if (estado === "abierta") return null;

  const cfg = CONFIG[tipo] ?? CONFIG.sobre;
  const [columnas] = cfg.rejilla ?? [0, 0];
  // La inicial del sello: la del primer nombre propio («Los 7 de Mateo» → M).
  const palabras = nombre.trim().split(/\s+/).filter((w) => !/^(los|las|el|la|mi|mis|un|una|de|del|y|&|\d+)$/i.test(w));
  const inicial = (palabras[0] ?? nombre).charAt(0).toUpperCase() || "✦";
  // Las temáticas se abren sobre el fondo de la invitación (la noche del
  // castillo, el asfalto), no sobre el color de escena (el pergamino).
  const tematica = tipo === "carta_magica" || tipo === "largada" || tipo === "cuento";
  const fondoAp = tematica ? paleta.fondo : paleta.escena;
  const vars = {
    "--ap-fondo": fondoAp,
    "--ap-fondo-2": mezclar(fondoAp, "#000000", 0.35),
    "--ap-tinta": tematica ? paleta.tinta : paleta.tintaEscena,
    "--ap-acento": paleta.acento,
    "--ap-acento-35": alfa(paleta.acento, 0.35),
    "--ap-papel": paleta.superficie,
    "--ap-papel-tinta": paleta.tinta,
    "--ap-sobre": mezclar(paleta.fondo, paleta.escena, 0.25),
    "--ap-sobre-oscuro": mezclar(paleta.fondo, "#000000", 0.18),
    "--ap-titulo": fuenteTitulo,
    "--ap-texto": fuenteTexto,
  } as React.CSSProperties;

  return (
    <div
      className={`inv-apertura inv-ap-${tipo} ${estado === "abriendo" ? "inv-apertura-abriendo" : ""}`}
      style={vars}
      role="button"
      tabIndex={0}
      aria-label={`Abrir la invitación de ${nombre}`}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }}
    >
      {cfg.piezas > 0 && (
        <div className="inv-ap-capa" aria-hidden="true">
          {Array.from({ length: cfg.piezas }, (_, i) => (
            <span
              key={i}
              className="inv-ap-pieza"
              style={
                {
                  "--i": i,
                  "--n": cfg.piezas,
                  // la rejilla se calcula acá: CSS no tiene `floor()`
                  ...(columnas ? { "--c": i % columnas, "--f": Math.floor(i / columnas) } : null),
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {cfg.particulas ? (
        <div className="inv-ap-particulas" aria-hidden="true">
          {Array.from({ length: cfg.particulas }, (_, i) => (
            <span key={i} className="inv-ap-particula" style={varsParticula(i, cfg.particulas!)} />
          ))}
        </div>
      ) : null}

      <div className="inv-apertura-cuerpo">
        {tipo === "carta_magica" && (
          // La lechuza que trae la carta: llega volando y se va al abrir.
          <svg className="inv-ap-lechuza" viewBox="0 0 120 90" aria-hidden="true">
            <path className="inv-ap-lechuza-ala" d="M52 40Q40 8 12 4Q30 22 30 34Q40 42 52 44Z" />
            <ellipse cx="60" cy="48" rx="24" ry="17" />
            <path d="M40 52Q28 58 20 56Q30 50 38 46Z" />
            <circle cx="82" cy="38" r="15" />
            <path d="M72 26L70 16L78 24ZM90 25L96 16L94 28Z" />
            <circle cx="78" cy="37" r="5.5" fill="#fff6d6" />
            <circle cx="90" cy="37" r="5.5" fill="#fff6d6" />
            <circle cx="79" cy="37" r="2.4" fill="#1a1a1a" />
            <circle cx="91" cy="37" r="2.4" fill="#1a1a1a" />
            <path d="M84 42L88 48L81 45Z" fill="#e0a43a" />
            <path className="inv-ap-lechuza-ala" d="M54 42Q44 76 16 84Q34 66 34 52Q44 46 54 44Z" />
          </svg>
        )}
        {cfg.adorno === "semaforo" && (
          <div className="inv-ap-semaforo" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="inv-ap-foco" style={{ "--i": i } as React.CSSProperties}>
                <span />
                <span />
              </span>
            ))}
          </div>
        )}
        {cfg.adorno === "libro_cuento" && (
          <div className="inv-ap-libro-cuento" aria-hidden="true">
            <svg viewBox="0 0 200 120" className="inv-ap-cuento-castillo">
              <path d="M40 110V60h16v50M144 110V60h16v50M56 110V74h88v36M86 74V44h28v30" />
              <path d="M36 60l12-26 12 26M140 60l12-26 12 26M82 44l18-34 18 34" />
              <path d="M100 10V0l12 4-12 4M48 34v-8l9 3-9 3M152 34v-8l9 3-9 3" />
              <path d="M92 110V94q8-10 16 0v16" />
              <path d="M20 110h160" />
            </svg>
            <span className="inv-ap-cuento-erase">Érase una vez…</span>
          </div>
        )}
        {cfg.adorno === "sobre" && (
          <div className="inv-sobre" aria-hidden="true">
            <span className="inv-sobre-carta">
              <span className="inv-sobre-carta-saludo">{saludo}</span>
              <span className="inv-sobre-carta-nombre">{nombre}</span>
            </span>
            <span className="inv-sobre-cuerpo" />
            <span className="inv-sobre-solapa" />
            <span className="inv-sobre-sello">{inicial}</span>
          </div>
        )}
        {cfg.adorno === "papel" && (
          <div className="inv-ap-papel" aria-hidden="true">
            <span className="inv-ap-papel-hoja">
              <span className="inv-sobre-carta-saludo">{saludo}</span>
              <span className="inv-sobre-carta-nombre">{nombre}</span>
            </span>
          </div>
        )}
        {cfg.adorno === "monograma" && (
          <span className="inv-apertura-monograma" aria-hidden="true">
            {inicial}
          </span>
        )}
        <p className="inv-apertura-saludo">{saludo}</p>
        <p className="inv-apertura-nombre">{nombre}</p>
        <p className="inv-apertura-toca">
          <span className="inv-apertura-anillo" aria-hidden="true" />
          {cfg.toca ?? "Tocá para abrir"}
        </p>
      </div>
    </div>
  );
}
