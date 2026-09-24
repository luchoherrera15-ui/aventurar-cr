"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MOTOR DE LAS DEMOSTRACIONES — se reproduce solo y vuelve a empezar
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «que sea AUTOMÁTICO el proceso, no
 * interactivo de cliquear, sino que todo se dé fluyendo».
 *
 * Así que arranca sola, avanza sola y al terminar espera un momento y
 * vuelve al principio. No hay botón de play: quien pasa por el home no
 * tiene que hacer nada para ver el producto funcionando.
 *
 * ── POR QUÉ UN HOOK Y NO DOS COPIAS ─────────────────────────────────
 *
 * Lo usan la demo de automatizaciones y la de reservas. Son escenas
 * distintas con el mismo mecanismo: avanzar, terminar, rebobinar.
 * Duplicarlo era garantizar que una de las dos se quedara con un bug
 * que la otra ya tenía arreglado.
 *
 * ── DOS CUIDADOS QUE NO SON OPCIONALES ──────────────────────────────
 *
 * 1. `prefers-reduced-motion`: quien lo pidió NO ve la escena
 *    reproducirse sola. Se le muestra completa y quieta — que es la
 *    información, sin el movimiento.
 * 2. `IntersectionObserver`: la secuencia solo corre mientras se ve en
 *    pantalla. Sin esto, cuatro demostraciones estarían girando
 *    temporizadores en una pestaña que nadie está mirando.
 */

export function useSecuencia({
  pasos,
  esperas,
  pausaFinal = 2600,
}: {
  /** Cuántos pasos tiene la escena. */
  pasos: number;
  /** Cuánto dura cada paso, en milisegundos. */
  esperas: number[];
  /** Cuánto se queda la escena completa antes de rebobinar. */
  pausaFinal?: number;
}) {
  const [visibles, setVisibles] = useState(0);
  const [aLaVista, setALaVista] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ¿Pidió que nada se mueva?
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  // ¿Se está viendo?
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setALaVista(e.isIntersecting),
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const corriendo = aLaVista && !quieto;

  // El motor. Cuando llega al final espera y vuelve a cero.
  useEffect(() => {
    if (!corriendo) return;
    const ultimo = visibles >= pasos;
    const demora = ultimo ? pausaFinal : (esperas[visibles] ?? 1500);
    reloj.current = setTimeout(() => {
      setVisibles((n) => (n >= pasos ? 0 : n + 1));
    }, demora);
    return () => {
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = null;
    };
  }, [corriendo, visibles, pasos, esperas, pausaFinal]);

  return {
    /** Se cuelga del contenedor: es lo que se observa en pantalla. */
    caja,
    /** Cuántos pasos mostrar. Con movimiento reducido, todos. */
    visibles: quieto ? pasos : visibles,
    /** Para el punto que late en la cabecera. */
    corriendo,
    /** El paso que está por entrar, para el «escribiendo…». */
    siguiente: quieto ? -1 : visibles,
  };
}
