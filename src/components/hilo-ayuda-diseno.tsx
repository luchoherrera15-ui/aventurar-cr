"use client";

import { useState } from "react";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";

/**
 * EL HILO DE AYUDA CON EL DISEÑO, dibujado — los dos lados.
 *
 * Lo usan la pantalla del negocio (creador y editor de la tarjeta) y la
 * bandeja del admin en /admin/complementos. Es UN componente y no dos
 * porque es literalmente la misma conversación mirada desde cada punta:
 * dos copias se separarían el día que alguien toque una.
 *
 * Se pinta con los alias `aventurea-*`, que es lo que hace que funcione
 * en los dos lados sin un prop de variante: dentro de `.lealtad` esas
 * variables están re-declaradas con la paleta de Lealtad (globals.css),
 * así que el mismo JSX sale azul Bookea en /admin y azul Lealtad en el
 * panel del negocio.
 */

export default function HiloAyudaDiseno({
  hilo,
  comoBookea = false,
  alResponder,
  ocupado = false,
  error = null,
}: {
  hilo: HiloAyuda;
  /** true = lo está mirando el equipo desde /admin. */
  comoBookea?: boolean;
  alResponder: (texto: string) => void;
  ocupado?: boolean;
  error?: string | null;
}) {
  const [texto, setTexto] = useState("");
  const cerrado = hilo.estado === "cerrada";

  function enviar() {
    const limpio = texto.trim();
    if (!limpio) return;
    alResponder(limpio);
    setTexto("");
  }

  return (
    <div>
      <ol className="space-y-2.5">
        {hilo.mensajes.map((m) => {
          // «Mío» es de quien mira: para el negocio, lo suyo; para
          // Bookea, lo de Bookea. Así los dos leen la conversación con
          // sus propias palabras de un lado y las del otro enfrente.
          const mio = comoBookea ? m.deBookea : !m.deBookea;
          return (
            <li
              key={m.id}
              className={`rounded-2xl border px-3.5 py-3 ${
                mio
                  ? "border-aventurea-line bg-aventurea-cream-2/50"
                  : "border-aventurea-navy/25 bg-aventurea-navy/[0.05]"
              }`}
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                <span className={m.deBookea ? "text-aventurea-navy" : ""}>{m.autor}</span>
                <span className="font-normal normal-case tracking-normal">{m.fecha}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-aventurea-ink">
                {m.texto}
              </p>

              {/* El resumen automático: qué negocio, qué tarjeta, qué
                  colores tenía puestos. Solo viaja en el primer mensaje
                  y es lo que evita que la primera respuesta se gaste en
                  preguntar qué estaba mirando. */}
              {m.contexto && (
                <details className="mt-2.5" open={comoBookea}>
                  <summary className="cursor-pointer text-[11.5px] font-bold text-aventurea-ink-soft">
                    Cómo estaba la tarjeta cuando escribió
                  </summary>
                  <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white px-3 py-2.5 font-sans text-[12px] leading-relaxed text-aventurea-ink-soft">
                    {m.contexto}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
      </ol>

      {cerrado ? (
        <p className="mt-3 rounded-xl bg-aventurea-cream-2 px-3.5 py-2.5 text-[12.5px] font-bold text-aventurea-ink-soft">
          Este pedido está cerrado.
        </p>
      ) : (
        <div className="mt-3">
          {/* El id lleva el id del hilo: la bandeja del admin puede
              tener dos abiertos a la vez, y dos `<label for>` apuntando
              al mismo id enfocan siempre el primero. */}
          <label className="sr-only" htmlFor={`ayuda-respuesta-${hilo.id}`}>
            Escribir en el hilo
          </label>
          <textarea
            id={`ayuda-respuesta-${hilo.id}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={
              comoBookea
                ? "Contestale al negocio…"
                : "Seguí la conversación — contanos más de lo que buscás…"
            }
            className="w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={enviar}
              disabled={ocupado || texto.trim().length === 0}
              className="presionable rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
            >
              {ocupado ? "Enviando…" : "Enviar"}
            </button>
            {error && (
              <p role="alert" className="text-[12.5px] font-bold text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
