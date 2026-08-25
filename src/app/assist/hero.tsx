"use client";

/**
 * BANDA 1 — HERO (negro tecnológico).
 *
 * Rediseño pedido por el dueño (ago 2026): «una página en blanco, un
 * H1 súper bold y un botón INGRESAR, que se vea más tecnológica».
 *
 * Lo que había antes era un hero de dos columnas con el mockup de
 * iPhone corriendo un guion de chat en loop, tres chips que lo
 * interrumpían y una bajada de tres líneas. Eso NO se perdió: el mismo
 * mockup con el mismo guion vive en `como-funciona.tsx`, más abajo en
 * esta misma página, que es donde explicar la conversación tiene
 * sentido. Acá arriba estorbaba.
 *
 * ── POR QUÉ ESTE NEGRO Y NO EL NAVY DEL RESTO ──────────────────────
 * El fondo es `--void-tech` (#08090c), más negro que el `--void` de la
 * paleta. Es lo que hace la diferencia entre «oscuro» y
 * «tecnológico»: sobre el navy, una malla de puntos y un resplandor se
 * leen como decoración; sobre casi negro, se leen como pantalla. Las
 * bandas de abajo siguen con la paleta de siempre y el corte se nota
 * como intencional, no como error.
 *
 * ── LAS TRES CAPAS DEL FONDO, Y POR QUÉ NINGUNA ANIMA ──────────────
 * Malla de puntos + resplandor naranja + viñeta. Las tres son CSS
 * puro, quietas y `aria-hidden`. El hero viejo tenía tres blobs
 * animados 22-32s; acá no hay ninguno a propósito: lo único que se
 * mueve al cargar es la entrada del título y del botón, y así el ojo
 * va al texto. Menos movimiento se lee más caro, no más pobre.
 *
 * La malla se dibuja con `radial-gradient` repetido y NO con un SVG ni
 * una imagen: es un fondo, no un elemento, así que no suma nodos al
 * DOM ni un pedido de red.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import estilos from "./assist.module.css";

/**
 * En VOSEO —«Automatizá», no «Automatiza»— aunque el pedido vino
 * escrito de la otra forma: es el trato que usa el sitio entero
 * («Reservá», «Publicá», «Convertí cada interacción…»), y una sola
 * pieza tuteando canta muchísimo.
 *
 * Se parte en palabras para que entren escalonadas. `CON BOOKEA` va
 * aparte porque cierra en naranja: es la marca, y es lo único que se
 * lleva color en toda la pantalla.
 */
const TITULO = "Automatizá tu trabajo".split(" ");

export default function Hero() {
  /**
   * El escalonado arranca en el primer frame DESPUÉS de montar, no en
   * el render: si las clases visibles ya estuvieran puestas en el
   * primer pintado, no habría transición que ver — el navegador no
   * anima entre dos estados que nunca existieron por separado.
   *
   * No consulta `prefers-reduced-motion`: no hace falta. La animación
   * es solo opacidad y un desplazamiento de 18px que la media query de
   * `.heroTechPalabra` apaga desde el CSS, y el contenido queda visible
   * igual — nunca se esconde nada detrás de una animación.
   */
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const visible = montado ? estilos.heroTechVisible : "";

  return (
    <section className={estilos.heroTech} aria-label="Bookea Assist">
      <div className={estilos.heroTechFondo} aria-hidden="true">
        <span className={estilos.heroTechMalla} />
        <span className={estilos.heroTechResplandor} />
        <span className={estilos.heroTechVineta} />
      </div>

      <div className={estilos.heroTechInner}>
        <p className={`${estilos.heroTechKicker} ${estilos.heroTechPalabra} ${visible}`}>
          Bookea Assist
        </p>

        <h1 className={estilos.heroTechTitulo}>
          {TITULO.map((palabra, i) => (
            <span
              key={`${palabra}-${i}`}
              className={`${estilos.heroTechPalabra} ${visible}`}
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              {palabra}&nbsp;
            </span>
          ))}
          <span
            className={`${estilos.heroTechPalabra} ${estilos.heroTechMarca} ${visible}`}
            style={{ "--i": TITULO.length + 1 } as React.CSSProperties}
          >
            con Bookea
          </span>
        </h1>

        <div
          className={`${estilos.heroTechAccion} ${estilos.heroTechPalabra} ${visible}`}
          style={{ "--i": TITULO.length + 2 } as React.CSSProperties}
        >
          {/* `/cuenta` y no un login propio: es la única puerta de
              sesión del sitio — la misma a la que manda «Iniciar
              sesión» del header. Inventarle otra a /assist sería una
              segunda puerta a la misma casa. */}
          <Link href="/cuenta" className={estilos.botonTech}>
            Ingresar
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
