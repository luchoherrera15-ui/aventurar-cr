"use client";

import { useRef, useState } from "react";

/**
 * EL PASO A PASO, EN UNA SOLA SECCIÓN DESLIZABLE.
 *
 * Antes los tres pasos («creá», «escaneo», «fidelidad») iban apilados
 * uno debajo del otro, cada uno con su demo — largo y enredado. Ahora
 * es UN slider: se ve un paso a la vez y se pasa con las flechas, los
 * puntos o arrastrando/deslizando. Los tres mockups siguen montados
 * (para que sus animaciones internas no se reinicien al cambiar), solo
 * que el track se corre con transform (GPU).
 */
export type PasoSlide = {
  numero: number;
  eyebrow: string;
  titulo: string;
  bajada: string;
  mockup: React.ReactNode;
};

export default function PasosSlider({ pasos }: { pasos: PasoSlide[] }) {
  const [i, setI] = useState(0);
  const n = pasos.length;
  const ir = (k: number) => setI(Math.max(0, Math.min(n - 1, k)));

  // Swipe: se guarda dónde empezó el dedo/mouse y, al soltar, si se
  // movió lo suficiente en horizontal, se cambia de paso.
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const alBajar = (e: React.PointerEvent) => {
    inicio.current = { x: e.clientX, y: e.clientY };
  };
  const alSoltar = (e: React.PointerEvent) => {
    const p = inicio.current;
    inicio.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    // Solo cuenta como swipe si fue más horizontal que vertical (para no
    // robar el scroll de la página).
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      ir(i + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <div className="mt-12">
      {/* La ventana: solo se ve un paso; el track se corre. */}
      <div
        className="overflow-hidden"
        onPointerDown={alBajar}
        onPointerUp={alSoltar}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex items-start transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {pasos.map((p, idx) => (
            <div
              key={p.numero}
              className="w-full shrink-0 px-1"
              aria-hidden={idx !== i}
            >
              <div className="mx-auto max-w-[56ch] text-center">
                <span
                  aria-hidden
                  className="mx-auto grid h-9 w-9 place-items-center rounded-full text-[14px] font-extrabold"
                  style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
                >
                  {p.numero}
                </span>
                <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
                  {p.eyebrow}
                </p>
                <h3 className="titulo mx-auto mt-3 max-w-[20ch] text-[clamp(22px,3.2vw,32px)] leading-tight text-aventurea-navy">
                  {p.titulo}
                </h3>
                <p className="mx-auto mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                  {p.bajada}
                </p>
              </div>
              {/* El mockup no debe capturar el gesto de swipe cuando la
                  persona quiere cambiar de paso arrastrando; pero SÍ es
                  interactivo (sus botones). El swipe se decide arriba por
                  distancia, así que un clic normal en el mockup pasa.

                  Se achica con `scale` (los mockups tienen tamaños fijos
                  por dentro, así que un max-width no los encoge): en el
                  slider ocupan menos y calzan mejor en una sola sección.
                  El `origin-top` + margen negativo recorta el hueco que
                  deja el transform (que no cambia el alto de layout). */}
              <div className="mt-8 flex select-none justify-center">
                {/* `zoom` (no `transform: scale`) achica el mockup Y su
                    caja de layout, así no queda un hueco debajo; los
                    botones internos siguen respondiendo. Con esto los
                    tres mockups calzan cómodos en la sección. */}
                <div style={{ zoom: 0.82 }}>{p.mockup}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controles: flechas + puntos, en una sola fila. */}
      <div className="mt-10 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => ir(i - 1)}
          disabled={i === 0}
          aria-label="Paso anterior"
          className="grid h-11 w-11 place-items-center rounded-full border border-aventurea-line text-[18px] font-bold text-aventurea-navy transition disabled:cursor-not-allowed disabled:opacity-30 hover:enabled:bg-aventurea-sky-light"
        >
          ‹
        </button>

        <div className="flex items-center gap-2.5">
          {pasos.map((p, idx) => (
            <button
              key={p.numero}
              type="button"
              onClick={() => ir(idx)}
              aria-label={`Ir al paso ${p.numero}`}
              aria-current={idx === i}
              className="h-2.5 rounded-full transition-all"
              style={{
                width: idx === i ? 30 : 10,
                background: idx === i ? "var(--accion-fuerte)" : "var(--aventurea-line, #d8dee9)",
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => ir(i + 1)}
          disabled={i === n - 1}
          aria-label="Paso siguiente"
          className="grid h-11 w-11 place-items-center rounded-full border border-aventurea-line text-[18px] font-bold text-aventurea-navy transition disabled:cursor-not-allowed disabled:opacity-30 hover:enabled:bg-aventurea-sky-light"
        >
          ›
        </button>
      </div>

      <p className="mt-4 text-center text-[12.5px] font-semibold text-aventurea-ink-soft">
        Paso {i + 1} de {n} · deslizá o usá las flechas
      </p>
    </div>
  );
}
