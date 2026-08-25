"use client";

/**
 * BANDA 5 — ESCENARIOS (oscuro, carril horizontal).
 *
 * En escritorio: scrollytelling horizontal — el alto de la sección se
 * calcula en JS (`innerHeight + (anchoTotalDelTrack - innerWidth) * 1.05`)
 * y el track se mueve con `translate3d(-p*max,0,0)` según el progreso
 * vertical, vía el mismo motor de scroll único.
 *
 * En viewports ≤720px, y también con `prefers-reduced-motion`, se
 * degrada a scroll horizontal nativo con `scroll-snap` — sin JS de
 * scrollytelling: es más simple, más usable en un dedo, y es la forma
 * más honesta de "estado final sin animación" para un carril que por
 * naturaleza es horizontal.
 *
 * Cada tarjeta es un <button> real (no un <div onClick>): se escribe
 * sola la primera vez que entra en pantalla, y un click la vuelve a
 * escribir desde cero.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionReducido, useScrubber } from "./motor";
import { NEGOCIO_DEMO } from "./constantes";
import estilos from "./assist.module.css";

type Turno = { autor: "cliente" | "bot"; texto: string; etiqueta?: string };

type Escenario = { titulo: string; turnos: Turno[] };

const ESCENARIOS: Escenario[] = [
  {
    titulo: "Fuera de horario",
    turnos: [
      { autor: "cliente", texto: "Hola, disculpen la hora… ¿tienen campo mañana?" },
      { autor: "bot", texto: "¡Hola! Aunque sean las 11pm, acá ando. Tengo 10am y 1pm libres mañana." },
      { autor: "cliente", texto: "La 1pm porfa" },
      { autor: "bot", texto: "Confirmada mañana 1pm 🙌", etiqueta: "reserva creada" },
    ],
  },
  {
    titulo: "Pregunta de precio",
    turnos: [
      { autor: "cliente", texto: "¿Cuánto cuesta el diseño en gel?" },
      { autor: "bot", texto: "El diseño en gel está en ₡12.000 y toma 1h15. ¿Te reservo un espacio?" },
      { autor: "cliente", texto: "Sí, para el jueves" },
      { autor: "bot", texto: "Tengo jueves 2:00pm libre. ¿Te la dejo agendada?" },
    ],
  },
  {
    titulo: "Cambio de cita",
    turnos: [
      { autor: "cliente", texto: "Hola, ¿puedo mover mi cita de mañana?" },
      { autor: "bot", texto: `Claro. Tu cita de mañana 3pm en ${NEGOCIO_DEMO} queda libre. ¿Para cuándo la paso?` },
      { autor: "cliente", texto: "Para el viernes, misma hora" },
      { autor: "bot", texto: "Listo, movida a viernes 3:00pm ✅", etiqueta: "reserva creada" },
    ],
  },
  {
    titulo: "La pregunta de siempre",
    turnos: [
      { autor: "cliente", texto: "¿A qué hora abren los sábados?" },
      { autor: "bot", texto: "Los sábados abrimos de 9am a 4pm. ¿Querés que te aparte un espacio?" },
    ],
  },
  {
    titulo: "Cliente indeciso",
    turnos: [
      { autor: "cliente", texto: "No sé si hacerme acrílicas o gel…" },
      { autor: "bot", texto: "Las acrílicas duran más (₡18.000) y el gel es más natural (₡12.000). ¿Cuál te late?" },
      { autor: "cliente", texto: "Vamos con acrílicas" },
      { autor: "bot", texto: "Perfecto, ¿qué día te acomoda?" },
    ],
  },
];

function TarjetaEscenario({ escenario }: { escenario: Escenario }) {
  const reducedMotion = useMotionReducido();
  const [visibles, setVisibles] = useState(reducedMotion ? escenario.turnos.length : 0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const yaJugadoRef = useRef(reducedMotion);

  const limpiar = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const reproducir = useCallback(() => {
    if (reducedMotion) {
      setVisibles(escenario.turnos.length);
      return;
    }
    limpiar();
    setVisibles(0);
    escenario.turnos.forEach((_, i) => {
      const t = setTimeout(() => setVisibles((v) => Math.max(v, i + 1)), 500 + i * 750);
      timersRef.current.push(t);
    });
  }, [escenario.turnos, limpiar, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || yaJugadoRef.current) return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting && !yaJugadoRef.current) {
            yaJugadoRef.current = true;
            reproducir();
            obs.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion, reproducir]);

  useEffect(() => limpiar, [limpiar]);

  return (
    <button
      ref={cardRef}
      type="button"
      className={estilos.escenarioTarjeta}
      onClick={reproducir}
      aria-label={`Escenario: ${escenario.titulo}. Click para volver a reproducir la conversación.`}
    >
      <span className={estilos.escenarioTitulo}>{escenario.titulo}</span>
      <span className={estilos.escenarioHilo}>
        {escenario.turnos.slice(0, visibles).map((turno, i) => (
          <span
            key={i}
            className={`${estilos.escenarioBurbuja} ${
              turno.autor === "bot" ? estilos.escenarioBurbujaBot : estilos.escenarioBurbujaCliente
            }`}
          >
            {turno.texto}
            {turno.etiqueta ? <span className={estilos.escenarioEtiqueta}>{turno.etiqueta}</span> : null}
          </span>
        ))}
      </span>
    </button>
  );
}

export default function Escenarios() {
  const reducedMotion = useMotionReducido();
  const [esSimple, setEsSimple] = useState(false);
  const exteriorRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const maxRef = useRef(0);
  const [alturaSeccion, setAlturaSeccion] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const actualizar = () => setEsSimple(mq.matches || reducedMotion);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, [reducedMotion]);

  const medir = useCallback(() => {
    const track = trackRef.current;
    if (!track || esSimple) return;
    const max = Math.max(0, track.scrollWidth - window.innerWidth);
    maxRef.current = max;
    setAlturaSeccion(window.innerHeight + max * 1.05);
  }, [esSimple]);

  useEffect(() => {
    if (esSimple) return;
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [esSimple, medir]);

  const onProgress = useCallback((p: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${(-p * maxRef.current).toFixed(2)}px, 0, 0)`;
  }, []);

  useScrubber(exteriorRef, onProgress);

  if (esSimple) {
    return (
      <section className={estilos.escenariosSimple} aria-label="Escenarios de uso de Bookea Assist">
        <div className={estilos.escenariosCabecera}>
          <p className={estilos.kickerOscuro}>Escenarios</p>
          <h2 className={`${estilos.d2} ${estilos.tituloOscuro}`}>Así responde, en la vida real.</h2>
        </div>
        <div className={`${estilos.escenariosPistaSimple} ${estilos.snapX}`}>
          {ESCENARIOS.map((e) => (
            <TarjetaEscenario key={e.titulo} escenario={e} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={exteriorRef}
      className={estilos.escenariosExterior}
      style={alturaSeccion ? { height: `${alturaSeccion}px` } : undefined}
      aria-label="Escenarios de uso de Bookea Assist"
    >
      <div className={estilos.escenariosSticky}>
        <div className={estilos.escenariosCabecera}>
          <p className={estilos.kickerOscuro}>Escenarios</p>
          <h2 className={`${estilos.d2} ${estilos.tituloOscuro}`}>Así responde, en la vida real.</h2>
        </div>
        <div ref={trackRef} className={estilos.escenariosPista}>
          {ESCENARIOS.map((e) => (
            <TarjetaEscenario key={e.titulo} escenario={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
