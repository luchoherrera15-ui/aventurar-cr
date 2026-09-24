"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { sugerirTextos } from "@/app/celebrar/editor/ia-textos";
import { NOMBRE_TONO, TONOS, type TonoIA } from "@/lib/celebrar/ia-tonos";
import type { TipoSeccion } from "@/lib/celebrar/invitacion/esquema";

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL «DIAMANTITO»: escribir un campo con IA
 * ══════════════════════════════════════════════════════════════════
 *
 * Un botón chico con destellos al lado del rótulo de un campo. Al
 * tocarlo se abre una tarjeta debajo: el tono (cálido, elegante,
 * divertido, formal, breve), una indicación opcional y «Generar 3
 * opciones». Las tres las escribe Chispa (nuestro bot rápido) en uno o dos segundos; tocar una
 * la pone en el campo (y se puede seguir editando a mano).
 *
 * El id de la celebración viaja por contexto (`ProveedorIA`) para no
 * enhebrarlo por cada `Campo` del panel.
 */

export type ContextoIA = { celebracionId: string };
const Ctx = createContext<ContextoIA | null>(null);

export function ProveedorIA({ celebracionId, children }: ContextoIA & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ celebracionId }}>{children}</Ctx.Provider>;
}

/** Lo que un campo declara para poder pedirle su texto a la IA. */
export type CampoIA = { seccion: TipoSeccion; campo: string };

export function IconoDestellos({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z" />
      <path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" opacity=".85" />
      <path d="M5 15l.7 1.9 1.9.7-1.9.7L5 20l-.7-1.7-1.9-.7 1.9-.7z" opacity=".7" />
    </svg>
  );
}

export default function AsistenteTexto({ ia, valor, alAplicar }: { ia: CampoIA; valor: string; alAplicar: (v: string) => void }) {
  const ctx = useContext(Ctx);
  const [abierto, setAbierto] = useState(false);
  const [tono, setTono] = useState<TonoIA>("calido");
  const [indicacion, setIndicacion] = useState("");
  const [opciones, setOpciones] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);
  const cuadro = useRef<HTMLDivElement>(null);
  // El cuadro va en un PORTAL con posición fija: dentro de la tarjeta de
  // la sección (overflow hidden) quedaba recortado y no se podía bajar a
  // ver las opciones. Se ancla al botón y se recoloca al scrollear.
  const [pos, setPos] = useState<{ top: number; right: number; maxAlto: number } | null>(null);
  useLayoutEffect(() => {
    if (!abierto) return;
    const colocar = () => {
      const r = caja.current?.getBoundingClientRect();
      if (!r) return;
      const abajo = window.innerHeight - r.bottom - 12;
      // Si abajo no cabe ni la mitad, el cuadro se abre hacia arriba.
      const haciaArriba = abajo < 260 && r.top > abajo;
      setPos({
        top: haciaArriba ? Math.max(12, r.top - 8 - Math.min(r.top - 20, 520)) : r.bottom + 8,
        right: Math.max(12, window.innerWidth - r.right),
        maxAlto: haciaArriba ? Math.min(r.top - 20, 520) : Math.min(abajo, 520),
      });
    };
    colocar();
    window.addEventListener("scroll", colocar, true);
    window.addEventListener("resize", colocar);
    return () => {
      window.removeEventListener("scroll", colocar, true);
      window.removeEventListener("resize", colocar);
    };
  }, [abierto]);
  // Enfriamiento: hasta cuándo no se puede volver a generar este campo.
  const [disponibleEn, setDisponibleEn] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!disponibleEn) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [disponibleEn]);
  const faltanMs = disponibleEn ? Math.max(0, disponibleEn - ahora) : 0;
  const enfriando = faltanMs > 0;
  const cuenta = `${Math.floor(faltanMs / 60000)}:${String(Math.floor((faltanMs % 60000) / 1000)).padStart(2, "0")}`;

  // Clic afuera o Escape: se cierra.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (caja.current?.contains(t) || cuadro.current?.contains(t)) return;
      setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (!ctx) return null;
  const { celebracionId } = ctx;

  function generar() {
    setError(null);
    iniciar(async () => {
      const r = await sugerirTextos({ celebracionId, seccion: ia.seccion, campo: ia.campo, actual: valor, tono, indicacion });
      if (!r.ok) {
        setError(r.mensaje);
        if (r.esperarMs) setDisponibleEn(Date.now() + r.esperarMs);
        return;
      }
      setOpciones(r.opciones);
      setDisponibleEn(r.disponibleEn);
    });
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        title="Escribir este texto con IA"
        className={`c-montserrat inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-[11px] font-bold tracking-[0.02em] transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
          abierto ? "bg-(--c-marino) text-(--c-blanco)" : "c-ia-pastilla text-(--c-blanco) hover:brightness-110"
        }`}
      >
        <IconoDestellos />
        IA
      </button>

      {abierto &&
        pos &&
        createPortal(
        <div
          ref={cuadro}
          role="dialog"
          aria-label="Escribir con IA"
          className="celebrar fixed z-[60] w-[min(360px,88vw)] overflow-y-auto rounded-2xl border border-(--c-linea) bg-(--c-blanco) p-4 shadow-elevado"
          style={{ top: pos.top, right: pos.right, maxHeight: pos.maxAlto }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="c-montserrat flex items-center gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
                <span className="c-ia-pastilla inline-flex h-5 w-5 items-center justify-center rounded-full text-(--c-blanco)">
                  <IconoDestellos className="h-3 w-3" />
                </span>
                Escribir con IA
              </p>
              <p className="mt-0.5 text-[11.5px] text-(--c-tinta-suave)">Tres opciones para este campo, con tu tono. Después las editás como querás.</p>
            </div>
            <span className="c-montserrat shrink-0 rounded-md bg-(--c-hielo) px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-(--c-tinta-suave)" title="Los textos con IA vienen incluidos con tu invitación">
              Chispa · incluido
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Tono">
            {TONOS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTono(t)}
                aria-pressed={tono === t}
                className={`c-montserrat min-h-7 rounded-lg px-2.5 text-[12px] font-semibold ${tono === t ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
              >
                {NOMBRE_TONO[t]}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={indicacion}
            onChange={(e) => setIndicacion(e.target.value)}
            maxLength={300}
            placeholder="Algo que quieras que diga (opcional)"
            className="c-campo mt-3 min-h-10 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                generar();
              }
            }}
          />

          <button type="button" onClick={generar} disabled={pendiente || enfriando} className="c-boton c-boton-primario mt-3 min-h-10 w-full gap-1.5 text-[13px] disabled:opacity-60">
            <IconoDestellos />
            {pendiente ? "Escribiendo…" : enfriando ? `Otras 3 en ${cuenta}` : opciones.length ? "Generar otras 3" : "Generar 3 opciones"}
          </button>
          {enfriando && !pendiente && (
            <p className="mt-2 text-[11.5px] text-(--c-tinta-suave)">Para cuidar el uso de la IA, cada campo se puede volver a generar cada 5 minutos. Mientras, elegí una de las opciones o editala a mano.</p>
          )}

          {pendiente && (
            <ul className="mt-3 grid gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="c-ia-brilla h-10 rounded-xl bg-(--c-hielo)" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-(--c-coral-suave) px-3 py-2 text-[12.5px] text-(--c-coral-tinta)">
              {error}
            </p>
          )}

          {!pendiente && opciones.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {opciones.map((o, i) => (
                <li key={`${i}-${o.slice(0, 12)}`}>
                  <button
                    type="button"
                    onClick={() => {
                      alAplicar(o);
                      setAbierto(false);
                    }}
                    className="group flex w-full items-start gap-2 rounded-xl border border-(--c-linea) px-3 py-2.5 text-left text-[13px] leading-snug text-(--c-tinta) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:border-(--c-marino) hover:bg-(--c-hielo)"
                  >
                    <span className="c-montserrat mt-0.5 shrink-0 text-[10px] font-bold text-(--c-tinta-suave)">{i + 1}</span>
                    <span className="flex-1">{o}</span>
                    <span className="c-montserrat shrink-0 text-[11px] font-semibold text-(--c-azul) opacity-0 transition-opacity group-hover:opacity-100">Usar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-snug text-(--c-tinta-suave)">Incluido en tu invitación: 3 opciones por campo, y otras 3 cada 5 minutos.</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
