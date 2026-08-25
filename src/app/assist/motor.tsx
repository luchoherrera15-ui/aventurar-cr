"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL MOTOR DE SCROLL DE /assist
 * ═══════════════════════════════════════════════════════════════════
 *
 * Un ÚNICO `requestAnimationFrame` para toda la página: cada sección
 * que necesita "scrubbing" (mapear el scroll a un progreso 0..1, o a un
 * paso discreto) se suscribe con `useScrubber` y en cada frame recibe
 * su progreso, calculado con `getBoundingClientRect()`. No hay un
 * listener de `scroll` por sección — eso es justo lo que este archivo
 * evita: N secciones × N listeners de scroll disparando reflow en
 * cascada.
 *
 * `prefers-reduced-motion: reduce` se resuelve ACÁ, una sola vez: si
 * está activo, el loop de rAF ni se arranca, y cada hook de este
 * archivo se comporta como un no-op — las secciones que lo consumen
 * ya saben (por `useMotionReducido`) que tienen que pintar su estado
 * final directo, sin animar nada.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type EscuchaFrame = (tiempoMs: number) => void;

type MotorApi = {
  /** true si el visitante pidió menos movimiento: ninguna sección debe
   *  animar, y el loop de rAF no corre. */
  reducedMotion: boolean;
  /** Se suscribe al frame único de la página. Devuelve la función para
   *  des-suscribirse (limpieza de efecto). No hace nada si hay
   *  `prefers-reduced-motion: reduce`. */
  agregarEscucha: (cb: EscuchaFrame) => () => void;
};

const ContextoMotor = createContext<MotorApi | null>(null);

/** true mientras el navegador todavía no confirmó la preferencia (SSR /
 *  primer paint) — arrancamos asumiendo movimiento normal para no
 *  parpadear en el caso común, y la corregimos apenas monta el efecto. */
function leerReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Hook standalone: por si algún componente necesita la preferencia sin
 *  pasar por el proveedor (no es el caso hoy, pero es más barato que
 *  duplicar el matchMedia). El estado inicial de `useState` YA lee el
 *  valor real en el cliente (`leerReducedMotion` solo cae al `false` de
 *  SSR cuando `window` no existe) — el efecto de acá abajo únicamente
 *  se suscribe a CAMBIOS de la preferencia en vivo, nunca fija el valor
 *  inicial: eso evita un `setState` síncrono en el cuerpo del efecto. */
export function useMotionReducido(): boolean {
  const [reducido, setReducido] = useState(leerReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducido(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reducido;
}

export function ProveedorMotor({ children }: { children: React.ReactNode }) {
  const escuchasRef = useRef<Set<EscuchaFrame>>(new Set());
  const reducedMotion = useMotionReducido();
  const rafRef = useRef<number | null>(null);

  const agregarEscucha = useCallback((cb: EscuchaFrame) => {
    escuchasRef.current.add(cb);
    return () => {
      escuchasRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const inicio = performance.now();
    const tick = (ahora: number) => {
      const tiempoMs = ahora - inicio;
      // Copia a arreglo: una escucha puede des-suscribirse a media
      // pasada (un componente que se desmonta) y mutar un Set mientras
      // se itera es justo el tipo de bug que no se ve en desarrollo.
      for (const cb of Array.from(escuchasRef.current)) cb(tiempoMs);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [reducedMotion]);

  return (
    <ContextoMotor.Provider value={{ reducedMotion, agregarEscucha }}>
      {children}
    </ContextoMotor.Provider>
  );
}

function useMotor(): MotorApi {
  const ctx = useContext(ContextoMotor);
  if (!ctx) {
    throw new Error("useMotor() se usa dentro de <ProveedorMotor>");
  }
  return ctx;
}

/**
 * El progreso 0..1 de un contenedor alto respecto al viewport, con la
 * fórmula exacta que pidió la especificación. `document.scrollingElement`
 * se usa para cualquier lectura directa de scroll (no aplica acá porque
 * getBoundingClientRect ya es relativo al viewport, pero se respeta el
 * mismo criterio en los componentes que sí leen/escriben scrollLeft).
 */
function progresoDe(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  let p = total > 8 ? -r.top / total : r.top < window.innerHeight * 0.5 ? 1 : 0;
  p = Math.min(1, Math.max(0, p));
  return p;
}

/**
 * Suscribe `ref` al motor único: en cada frame calcula el progreso 0..1
 * del elemento y llama a `onProgress`. `onProgress` tiene que venir
 * memoizado (`useCallback`) — si cambia en cada render, este hook
 * des-suscribe y vuelve a suscribir en cada render, que es exactamente
 * el costo que el motor único quiere evitar.
 */
export function useScrubber(
  ref: RefObject<HTMLElement | null>,
  onProgress: (p: number) => void,
) {
  const { reducedMotion, agregarEscucha } = useMotor();
  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    return agregarEscucha(() => onProgress(progresoDe(el)));
  }, [reducedMotion, agregarEscucha, ref, onProgress]);
}

/** Variante de `useScrubber` para lo que además quiere la marca de
 *  tiempo del loop (animaciones ambiente sincronizadas al progreso Y al
 *  reloj, como el barrido de la línea de escaneo). */
export function useFrame(onFrame: (tiempoMs: number) => void) {
  const { reducedMotion, agregarEscucha } = useMotor();
  useEffect(() => {
    if (reducedMotion) return;
    return agregarEscucha(onFrame);
  }, [reducedMotion, agregarEscucha, onFrame]);
}

/**
 * Revelado al entrar en viewport (fade + slide), con soporte para
 * escalonar un grupo vía `--i` (custom property que el CSS Module lee
 * para el `transition-delay`). Si hay `prefers-reduced-motion`, entra
 * visible desde el primer render — nada que observar ni animar.
 *
 * Recibe el `ref` en vez de crearlo y devolverlo: un objeto de retorno
 * que mezcla un ref con valores planos (`visible`, `style`) hace que el
 * linter del compilador de React no pueda probar que leer `.visible` o
 * `.style` en cada componente es seguro, y lo marca como "acceso a ref
 * en render" aunque no se lea `.current` en ningún lado. Con el ref
 * creado en el propio componente (`useRef` directo, `ref={miRef}`) ese
 * falso positivo desaparece y de paso es el patrón más común para un
 * hook de IntersectionObserver.
 */
export function useRevelar<T extends HTMLElement>(ref: RefObject<T | null>, indice = 0) {
  const reducedMotion = useMotionReducido();
  // El estado inicial ya resuelve el caso "reduced motion": no hace
  // falta un `setState` síncrono en el efecto para ese caso, que es
  // justo lo que evita la cascada de renders.
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entrada of entries) {
          if (entrada.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion, ref]);

  return {
    visible,
    // Se castea porque las custom properties no son parte del tipo
    // CSSProperties de React.
    style: { "--i": indice } as React.CSSProperties,
  };
}

/**
 * Progreso 0..1 con easing `1 - (1-k)³` (ease-out cúbico), disparado una
 * sola vez cuando `activo` pasa a `true` — pensado para contadores del
 * panel/inbox y para el `stroke-dashoffset` del sparkline. Usa el mismo
 * loop único vía `agregarEscucha`. Con `prefers-reduced-motion` salta
 * directo a 1 (el valor final), sin animar.
 */
export function useProgresoAnimado(activo: boolean, duracionMs = 1200): number {
  const { reducedMotion, agregarEscucha } = useMotor();
  const [progreso, setProgreso] = useState(0);
  const empezadoRef = useRef(false);

  useEffect(() => {
    // Con reduced motion no hay nada que animar ni que arrancar: el
    // valor final se devuelve directo más abajo (`reducedMotion ? 1 :
    // progreso`), sin pasar por `setState` en el efecto.
    if (reducedMotion || !activo || empezadoRef.current) return;
    empezadoRef.current = true;

    const inicio = performance.now();
    const quitar = agregarEscucha(() => {
      const t = Math.min(1, (performance.now() - inicio) / duracionMs);
      setProgreso(1 - Math.pow(1 - t, 3));
      if (t >= 1) quitar();
    });
  }, [activo, duracionMs, reducedMotion, agregarEscucha]);

  return reducedMotion ? 1 : progreso;
}
