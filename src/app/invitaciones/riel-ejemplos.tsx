"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPause, IconPlay } from "@/components/icons";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import {
  CATEGORIAS_INVITACIONES,
  type CategoriaInvitacion,
  type DemoInvitacion,
} from "@/lib/catalogo-invitaciones";

/** Cuánto dura cada slide antes de pasar solo al siguiente. */
const DURACION_MS = 5000;

const PALETA_DEFECTO = { fondo: "#efe7d8", tinta: "#2a2318", acento: "#c9a227" };

/**
 * Los ejemplos como UN slide grande a la vez, con la barra de progreso
 * segmentada abajo — el patrón de la página de producto de Apple
 * (iPhone 17 Pro): no una fila de tarjetas expuestas, sino una sola
 * invitación ocupando toda la pantalla, que avanza sola y se puede
 * empujar a mano deslizando o tocando un punto.
 *
 * Es el mismo estilo en el teléfono que en escritorio a propósito: cada
 * slide ocupa el 100% del ancho del riel, así que en el celular se
 * desliza igual que en la pantalla grande — no hay una versión "mobile"
 * aparte con tarjetas chiquitas asomando.
 *
 * CÓMO SE MANTIENEN SINCRONIZADOS EL RELOJ Y LA BARRA: el avance
 * automático es un `setTimeout` de `DURACION_MS`, y la barra visual es
 * un `<span>` con una animación CSS de la MISMA duración, reiniciada
 * (por `key`) cada vez que cambia el slide activo o se reanuda de una
 * pausa. Pausar congela las dos cosas (se cancela el timeout Y la
 * animación queda en `paused`); reanudar arranca las dos de cero — no
 * intenta seguir a mitad, porque ahí es donde el timer y la barra se
 * desincronizan si uno retoma y el otro no.
 *
 * Con `prefers-reduced-motion` no hay avance automático ni animación:
 * el punto activo se ve lleno y quieto, y la navegación queda en manos
 * de quien mira, tocando los puntos.
 */
export default function RielEjemplos({
  demos,
  claseSerif,
}: {
  demos: DemoInvitacion[];
  claseSerif: string;
}) {
  const rielRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<(HTMLDivElement | null)[]>([]);
  const activoRef = useRef(0);

  const [activo, setActivo] = useState(0);
  // Cambia cada vez que hay que REINICIAR la barra sin cambiar de slide
  // (al reanudar de una pausa) — es la llave de `key` del relleno.
  const [ciclo, setCiclo] = useState(0);
  const [pausado, setPausado] = useState(false);

  // La pestaña activa. Arranca en la primera que TENGA ejemplos: si
  // "Fiestas Infantiles" quedara sin ninguno, abrir ahí sería recibir
  // al visitante con una vitrina vacía.
  const [categoria, setCategoria] = useState<CategoriaInvitacion>(
    () =>
      CATEGORIAS_INVITACIONES.find((c) => demos.some((d) => d.categoria === c.id))?.id ??
      CATEGORIAS_INVITACIONES[0].id,
  );
  const visibles = useMemo(
    () => demos.filter((d) => d.categoria === categoria),
    [demos, categoria],
  );
  // useSyncExternalStore, no useState+useEffect, para no disparar un
  // segundo render solo por leer una media query. (La plantilla de
  // /i/[slug] ya NO usa este hook: ahí las animaciones corren siempre
  // por decisión del dueño. Este riel es sitio, no invitación, y sí
  // respeta la señal.)
  const animar = !useMovimientoReducido();

  const irA = useCallback(
    (indice: number) => {
      const el = rielRef.current;
      if (!el || visibles.length === 0) return;
      const destino = ((indice % visibles.length) + visibles.length) % visibles.length;
      activoRef.current = destino;
      setActivo(destino);
      setCiclo((c) => c + 1);
      el.scrollTo({
        left: destino * el.clientWidth,
        behavior: animar ? "smooth" : "auto",
      });
    },
    [visibles.length, animar],
  );

  /**
   * Cambiar de pestaña reinicia el riel: el slide activo, la barra de
   * progreso y el scroll vuelven al principio. Sin esto, saltar de una
   * pestaña de tres ejemplos a una de uno dejaría el riel scrolleado a
   * una posición que ya no existe (en blanco).
   */
  function cambiarCategoria(id: CategoriaInvitacion) {
    if (id === categoria) return;
    setCategoria(id);
    activoRef.current = 0;
    setActivo(0);
    setCiclo((c) => c + 1);
    slidesRef.current = [];
    rielRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }

  function alternarPausa() {
    // Al reanudar, la barra arranca de cero en vez de seguir a mitad:
    // es lo que mantiene sincronizado el timeout (que sí reinicia
    // entero) con el relleno visual.
    if (pausado) setCiclo((c) => c + 1);
    setPausado((p) => !p);
  }

  // Cubre el deslizar a mano: cuando el que mira arrastra el riel sin
  // tocar un punto, esto detecta cuál slide quedó realmente a la vista
  // y sincroniza el estado (y reinicia la barra de ese slide).
  useEffect(() => {
    const el = rielRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting || entrada.intersectionRatio < 0.6) continue;
          const i = Number((entrada.target as HTMLElement).dataset.index);
          if (Number.isNaN(i) || i === activoRef.current) continue;
          activoRef.current = i;
          setActivo(i);
          setCiclo((c) => c + 1);
        }
      },
      { root: el, threshold: [0.6] },
    );
    slidesRef.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
    // `categoria` en las deps: al cambiar de pestaña los slides son
    // otros nodos y hay que volver a observarlos.
  }, [visibles.length, categoria]);

  // El avance automático. Un timeout por slide (no un intervalo): así
  // se cancela limpio cada vez que cambia el slide, se reinicia el
  // ciclo o se pausa — sin arrastrar un resto de tiempo de la vez
  // anterior.
  useEffect(() => {
    if (pausado || !animar || visibles.length <= 1) return;
    const t = setTimeout(() => irA(activoRef.current + 1), DURACION_MS);
    return () => clearTimeout(t);
  }, [activo, ciclo, pausado, animar, visibles.length, irA]);

  if (demos.length === 0) return null;

  return (
    <div>
      {/* Las pestañas: en pantalla angosta se deslizan de lado en vez
          de apilarse en tres filas. */}
      <div
        role="tablist"
        aria-label="Categorías de invitaciones"
        className="mb-6 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible"
        style={{ scrollbarWidth: "none" }}
      >
        {CATEGORIAS_INVITACIONES.map((c) => {
          const activa = c.id === categoria;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => cambiarCategoria(c.id)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-[12.5px] font-bold transition-colors sm:text-[13px] ${
                activa
                  ? "bg-[#ee7420] text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/20 px-6 py-16 text-center text-[14px] text-white/60">
          Estamos preparando los ejemplos de esta categoría. Escribinos y te
          diseñamos la tuya desde cero.
        </p>
      ) : (
        <>
      <div
        ref={rielRef}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl"
        style={{ scrollbarWidth: "none" }}
      >
        {visibles.map((demo, i) => {
          const m = demo.muestra ?? PALETA_DEFECTO;
          return (
            <div
              key={demo.slug}
              ref={(el) => {
                slidesRef.current[i] = el;
              }}
              data-index={i}
              className="flex min-h-[420px] w-full shrink-0 snap-start flex-col items-center justify-center gap-5 px-6 py-14 text-center sm:min-h-[460px] sm:gap-6 sm:px-16 sm:py-20"
              style={{ background: m.fondo, color: m.tinta }}
            >
              <p
                className="text-[10.5px] font-bold uppercase tracking-[0.32em]"
                style={{ color: m.acento }}
              >
                {demo.ocasion}
              </p>
              <p
                className={`${claseSerif} max-w-[16ch] text-[clamp(34px,6vw,58px)] leading-[1.05]`}
              >
                {demo.nombre}
              </p>
              <span aria-hidden className="h-px w-14" style={{ background: m.acento }} />
              <p className="max-w-[46ch] text-[14.5px] leading-relaxed opacity-70">
                {demo.descripcion}
              </p>
              <a
                href={`/i/${demo.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold transition-transform hover:scale-[1.03]"
                style={{ background: m.acento, color: m.fondo }}
              >
                Abrir la invitación
                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                  <path
                    d="M4 10h12m0 0-5-5m5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          );
        })}
      </div>

      {/* El indicador: puntos chicos, y el activo se estira en una
          píldora que se rellena mientras dura el slide — igual que un
          carrusel de historias. Tocar un punto salta directo ahí. */}
      {visibles.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {visibles.map((demo, i) => {
            const esActivo = i === activo;
            return (
              <button
                key={demo.slug}
                type="button"
                onClick={() => irA(i)}
                aria-label={`Ir al ejemplo ${i + 1} de ${visibles.length}: ${demo.nombre}`}
                aria-current={esActivo}
                className="flex items-center justify-center p-1.5"
              >
                <span
                  className={
                    esActivo
                      ? "relative h-1.5 w-9 overflow-hidden rounded-full bg-white/20 transition-[width]"
                      : "h-1.5 w-1.5 rounded-full bg-white/30 transition-colors hover:bg-white/50"
                  }
                >
                  {esActivo && (
                    <span
                      key={`${activo}-${ciclo}`}
                      className="absolute inset-0 origin-left rounded-full bg-white"
                      style={{
                        animationName: animar ? "riel-progreso" : undefined,
                        animationDuration: `${DURACION_MS}ms`,
                        animationTimingFunction: "linear",
                        animationFillMode: "forwards",
                        animationPlayState: pausado ? "paused" : "running",
                        transform: animar ? undefined : "scaleX(1)",
                      }}
                    />
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={alternarPausa}
            aria-label={pausado ? "Reanudar el avance automático" : "Pausar el avance automático"}
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-white/75 transition-colors hover:border-white/40 hover:text-white [&_svg]:h-3 [&_svg]:w-3"
          >
            {pausado ? <IconPlay /> : <IconPause />}
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
