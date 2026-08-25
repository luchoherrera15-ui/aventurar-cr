"use client";

/**
 * BANDA 6 — TU TONO (claro).
 *
 * La misma respuesta del bot, en tres tonos de voz. Cicla sola cada
 * pocos segundos y también es clickeable — clickear un tono lo fija y
 * reinicia el ciclo desde ahí. Con `prefers-reduced-motion` no hay
 * ciclo automático: se queda en el tono elegido (o en el primero) y
 * solo cambia por click.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionReducido } from "./motor";
import estilos from "./assist.module.css";

const TONOS = [
  {
    nombre: "Cercano",
    respuesta: "¡Hola! Sí tengo campo el viernes a las 5pm 🙌 ¿Te la aparto?",
  },
  {
    nombre: "Neutral",
    respuesta: "Hola, sí hay disponibilidad el viernes a las 5:00pm. ¿Deseás que te la reserve?",
  },
  {
    nombre: "Formal",
    respuesta:
      "Buenas tardes. Confirmo disponibilidad para el viernes a las 5:00 p.m. ¿Desea que procedamos con la reserva?",
  },
];

const INTERVALO_MS = 3600;

export default function Tono() {
  const reducedMotion = useMotionReducido();
  const [activo, setActivo] = useState(0);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const arrancarCiclo = useCallback(() => {
    if (reducedMotion) return;
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    intervaloRef.current = setInterval(() => {
      setActivo((v) => (v + 1) % TONOS.length);
    }, INTERVALO_MS);
  }, [reducedMotion]);

  useEffect(() => {
    arrancarCiclo();
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [arrancarCiclo]);

  const alElegir = useCallback(
    (i: number) => {
      setActivo(i);
      arrancarCiclo();
    },
    [arrancarCiclo],
  );

  return (
    <section className={estilos.tono}>
      <div className={estilos.contenedor}>
        <div className={estilos.tonoCabecera}>
          <p className={estilos.kickerClaro}>Tu tono, no el nuestro</p>
          <h2 className={`${estilos.d2} ${estilos.tituloClaro}`}>
            Contesta como tu negocio habla, no como habla un robot.
          </h2>
        </div>

        <div className={estilos.tonoSelector} role="tablist" aria-label="Tono de voz">
          {TONOS.map((tono, i) => (
            <button
              key={tono.nombre}
              type="button"
              role="tab"
              aria-selected={activo === i}
              className={`${estilos.tonoBoton} ${activo === i ? estilos.tonoBotonActivo : ""}`}
              onClick={() => alElegir(i)}
            >
              {tono.nombre}
            </button>
          ))}
        </div>

        <div className={estilos.tonoTarjeta}>
          <p className={estilos.tonoPregunta}>“¿Tienen espacio el viernes a las 5pm?”</p>
          <div className={estilos.tonoRespuestaWrap}>
            <p key={activo} className={estilos.tonoRespuesta}>
              {TONOS[activo].respuesta}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
