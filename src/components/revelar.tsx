import type { CSSProperties, ReactNode } from "react";

/**
 * REVELADO AL HACER SCROLL, con escalonado.
 *
 * El observer NO vive acá: ya existe uno solo para toda la página en
 * `RevealOnScroll` (montado en el layout), que busca `[data-reveal]`,
 * esconde lo que está debajo del pliegue y lo anima al subir. Esto es
 * solo la forma cómoda de marcar un elemento y darle su retraso.
 *
 * POR QUÉ NO LLEVA "use client": no hay estado, ni efecto, ni evento —
 * es un `div` con un atributo y una variable CSS. Manteniéndolo del
 * lado del servidor, revelar una grilla de 30 cards no manda ni un
 * byte de JavaScript extra al navegador.
 *
 * IMPORTANTE: el contenido nace VISIBLE. Si el JavaScript no corre,
 * falla o llega tarde, se ve todo igual y solo se pierde la animación
 * — que es exactamente lo que tiene que pasar. Nunca envolver en esto
 * algo que deba estar oculto por otra razón.
 *
 * ```tsx
 * {negocios.map((n, i) => (
 *   <Revelar key={n.id} indice={i}>
 *     <CardNegocio negocio={n} />
 *   </Revelar>
 * ))}
 * ```
 */

/** Milisegundos entre un elemento y el siguiente. */
const PASO_MS = 60;

/**
 * Tope del escalonado. Sin esto, el elemento 30 de una grilla esperaría
 * 1,8 s después del primero: para entonces la persona ya hizo scroll y
 * lo que ve es contenido que aparece tarde, que se lee como lentitud y
 * no como estilo.
 */
const RETRASO_MAXIMO_MS = 320;

/** El retraso escalonado de un índice, ya topado. */
export function retrasoDe(indice: number, paso: number = PASO_MS): number {
  return Math.min(Math.max(indice, 0) * paso, RETRASO_MAXIMO_MS);
}

/**
 * El `style` para marcar a mano un elemento propio, cuando no conviene
 * el `div` extra que agrega <Revelar> (por ejemplo dentro de un grid
 * donde el envoltorio rompería la grilla).
 *
 * ```tsx
 * <li data-reveal style={estiloRevelado(i)}>…</li>
 * ```
 */
export function estiloRevelado(indice: number, paso: number = PASO_MS): CSSProperties {
  return { "--reveal-delay": `${retrasoDe(indice, paso)}ms` } as CSSProperties;
}

export default function Revelar({
  children,
  indice = 0,
  paso = PASO_MS,
  className = "",
}: {
  children: ReactNode;
  /** Posición en la lista: de acá sale el escalonado. */
  indice?: number;
  /** Milisegundos entre elementos. El sistema usa 50–80. */
  paso?: number;
  className?: string;
}) {
  return (
    <div data-reveal style={estiloRevelado(indice, paso)} className={className}>
      {children}
    </div>
  );
}
