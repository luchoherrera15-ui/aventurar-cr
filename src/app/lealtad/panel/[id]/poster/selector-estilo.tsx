"use client";

import Link from "next/link";
import { useRef } from "react";
import { ESTILOS, ESTILOS_POSTER, type EstiloPoster } from "@/lib/lealtad/plantillas-poster";

/**
 * ELEGIR CUÁL DE LOS CINCO PÓSTERES SE IMPRIME.
 *
 * ------------------------------------------------------------------
 * EL ESTILO VA EN LA URL, NO EN UN useState
 * ------------------------------------------------------------------
 * Son enlaces a `?estilo=…` y no botones que cambian un estado local.
 * La diferencia se siente el día que el dueño usa esto de verdad:
 *
 *   · imprime, ve que le gustó otra y vuelve — sale la misma que dejó;
 *   · le pasa el link al encargado y los dos ven la misma hoja;
 *   · recarga y no pierde la elección.
 *
 * Un póster que cambia al recargar es un póster en el que nadie
 * confía, y la elección se vuelve a hacer cada vez.
 *
 * `scroll={false}`: la hoja está justo debajo y ya se está mirando.
 * Saltar al tope en cada clic obligaría a bajar otra vez para comparar
 * dos estilos, que es exactamente lo que uno hace acá.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ES UN COMPONENTE DE CLIENTE
 * ------------------------------------------------------------------
 * Por las flechas del teclado. Cinco enlaces sueltos obligan a cinco
 * tabulaciones para llegar al siguiente control; con flechas se
 * recorren los cinco sin salir del grupo, igual que en `selector-tipo`.
 * Los cinco siguen siendo enlaces tabulables: la flecha SUMA, no
 * reemplaza al Tab.
 */

/** Wrap-around: de la última a la primera, como espera el patrón. */
function siguiente(indice: number, delta: number, total: number): number {
  return (indice + delta + total) % total;
}

export default function SelectorEstilo({
  ruta,
  actual,
  marca,
  acento,
}: {
  /** La misma página, sin query: el estilo se le pega como `?estilo=`. */
  ruta: string;
  actual: EstiloPoster;
  /** Los dos colores del programa, para que las miniaturas no mientan. */
  marca: string;
  acento: string;
}) {
  const enlaces = useRef<(HTMLAnchorElement | null)[]>([]);

  function alTeclado(e: React.KeyboardEvent) {
    const saltos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const delta = saltos[e.key];
    if (delta === undefined) return;
    const desde = enlaces.current.findIndex((a) => a === document.activeElement);
    if (desde === -1) return;
    e.preventDefault();
    enlaces.current[siguiente(desde, delta, ESTILOS_POSTER.length)]?.focus();
  }

  const variables = {
    "--poster-marca": marca,
    "--poster-acento": acento,
  } as React.CSSProperties;

  return (
    <nav
      aria-label="Diseño del póster"
      className="poster-estilos no-imprimir"
      onKeyDown={alTeclado}
      style={variables}
    >
      <p className="poster-estilos-titulo">Elegí el diseño</p>
      <ul className="poster-estilos-lista">
        {ESTILOS_POSTER.map((id, i) => {
          const definicion = ESTILOS[id];
          const elegido = id === actual;
          return (
            <li key={id}>
              <Link
                ref={(el) => {
                  enlaces.current[i] = el;
                }}
                href={`${ruta}?estilo=${id}`}
                scroll={false}
                // `page` y no `true`: lo que este enlace marca es que la
                // página que se está viendo es esa, no un ítem de una
                // lista cualquiera.
                aria-current={elegido ? "page" : undefined}
                className={`poster-estilo${elegido ? " es-elegido" : ""}`}
              >
                {/* La miniatura dibuja el LAYOUT, no el color: es lo
                    único que distingue de un vistazo cinco nombres que
                    para quien nunca los vio suenan igual. */}
                <span className="poster-mini" data-estilo={id} aria-hidden />
                <span className="poster-estilo-nombre">{definicion.nombre}</span>
                <span className="poster-estilo-nota">{definicion.seNota}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
