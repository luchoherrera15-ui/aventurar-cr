"use client";

import { useState } from "react";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";

/**
 * Las descargas del álbum, en dos piezas fijas:
 *
 * - El botón de tres puntitos arriba a la derecha (pedido del dueño):
 *   se despliega con "Descargar todas" y "Elegir cuáles". Fijo, para
 *   que en un álbum de 200 fotos no haya que volver hasta arriba.
 * - Cuando se está eligiendo, una barra abajo al centro con el botón
 *   de descargar lo marcado — flota sobre la grilla que se está
 *   tocando, como la barra de selección de una galería del teléfono.
 *
 * Componente controlado a propósito — la selección vive en
 * AlbumInteractivo porque la grilla también la necesita (pintar cada
 * foto elegida y dejarla tocar).
 *
 * El envío es un <form> normal, no `fetch`: así el navegador lo trata
 * como una descarga de verdad, con su propia barra de progreso — igual
 * que el link de "todas". Nada de JavaScript bajando archivos.
 */
export default function Descargas({
  slug,
  totalFotos,
  paleta,
  eligiendo,
  seleccion,
  onIniciar,
  onCancelar,
  onElegirTodas,
}: {
  slug: string;
  totalFotos: number;
  paleta: Paleta;
  eligiendo: boolean;
  seleccion: Set<string>;
  onIniciar: () => void;
  onCancelar: () => void;
  onElegirTodas: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  const itemMenu =
    "block w-full rounded-xl px-4 py-2.5 text-left text-[13px] font-bold transition-colors";

  return (
    <>
      {/* Los tres puntitos, fijos arriba a la derecha. */}
      <div className="fixed right-4 top-4 z-40 sm:right-6 sm:top-5">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label="Opciones del álbum"
          aria-expanded={abierto}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[22px] font-bold leading-none shadow-lg backdrop-blur transition-transform hover:scale-105"
          style={{
            background: conAlfa(paleta.fondo, 0.85),
            color: paleta.tinta,
            border: `1px solid ${conAlfa(paleta.tinta, 0.15)}`,
          }}
        >
          <span className="relative -top-[3px]">…</span>
        </button>

        {abierto && (
          <>
            {/* El velo invisible: tocar fuera cierra el menú. */}
            <button
              type="button"
              aria-label="Cerrar el menú"
              onClick={() => setAbierto(false)}
              className="fixed inset-0 -z-10 cursor-default"
            />
            <div
              className="anim-panel-entrar absolute right-0 mt-2 w-60 rounded-2xl p-2 shadow-xl"
              style={{
                background: paleta.fondo,
                border: `1px solid ${conAlfa(paleta.tinta, 0.15)}`,
              }}
            >
              <p
                className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: conAlfa(paleta.tinta, 0.5) }}
              >
                Descargar
              </p>
              <a
                href={`/a/${slug}/zip`}
                onClick={() => setAbierto(false)}
                className={itemMenu}
                style={{ color: paleta.tinta }}
              >
                Descargar las {totalFotos} foto{totalFotos === 1 ? "" : "s"}
              </a>
              <button
                type="button"
                onClick={() => {
                  onIniciar();
                  setAbierto(false);
                }}
                className={itemMenu}
                style={{ color: paleta.tinta }}
              >
                Elegir cuáles descargar
              </button>
            </div>
          </>
        )}
      </div>

      {/* La barra de selección, flotando abajo mientras se elige. */}
      {eligiendo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <form
            method="POST"
            action={`/a/${slug}/zip`}
            className="anim-panel-entrar pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl px-5 py-3.5 shadow-xl"
            style={{
              background: paleta.fondo,
              border: `1px solid ${conAlfa(paleta.tinta, 0.15)}`,
            }}
          >
            {/* Los campos ocultos salen de la selección de la grilla:
                este bloque solo dispara la descarga de lo ya marcado. */}
            {[...seleccion].map((id) => (
              <input key={id} type="hidden" name="foto" value={id} />
            ))}
            <button
              type="submit"
              disabled={seleccion.size === 0}
              className="rounded-xl px-4 py-2.5 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: paleta.acento, color: paleta.fondo }}
            >
              {seleccion.size === 0
                ? "Tocá las fotos que querés"
                : `Descargar ${seleccion.size} foto${seleccion.size === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={onElegirTodas}
              className="text-[12.5px] font-bold underline"
              style={{ color: conAlfa(paleta.tinta, 0.7) }}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={onCancelar}
              className="text-[12.5px] font-bold underline"
              style={{ color: conAlfa(paleta.tinta, 0.7) }}
            >
              Cancelar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
