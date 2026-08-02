"use client";

import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";

/**
 * Los controles de descarga: el álbum entero, o una selección.
 *
 * Componente controlado a propósito — no tiene estado propio. Vive en
 * la barra superior, junto a "Subir fotos", pero la selección la
 * necesita también la grilla (para pintar cada foto como elegida y
 * dejarla tocar). Con el estado en el padre común (AlbumInteractivo),
 * los dos se mantienen sincronizados sin pasarse mensajes entre sí.
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
  return (
    <div
      className="flex w-full flex-col items-start gap-2.5 rounded-2xl border p-4 sm:w-auto sm:shrink-0"
      style={{
        borderColor: conAlfa(paleta.tinta, 0.15),
        background: conAlfa(paleta.fondo, 0.7),
      }}
    >
      <p
        className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
        style={{ color: conAlfa(paleta.tinta, 0.55) }}
      >
        Descargar
      </p>

      {eligiendo ? (
        <form
          method="POST"
          action={`/a/${slug}/zip`}
          className="flex flex-col items-start gap-2"
        >
          {/* Los campos ocultos salen de la selección de la grilla, no de
              checkboxes acá: este bloque solo dispara la descarga de lo
              que ya se marcó. */}
          {[...seleccion].map((id) => (
            <input key={id} type="hidden" name="foto" value={id} />
          ))}
          <button
            type="submit"
            disabled={seleccion.size === 0}
            className="rounded-xl px-4 py-2 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: paleta.acento, color: paleta.fondo }}
          >
            {seleccion.size === 0
              ? "Tocá las fotos que querés"
              : `Descargar ${seleccion.size} foto${seleccion.size === 1 ? "" : "s"}`}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onElegirTodas}
              className="text-[12px] font-bold underline"
              style={{ color: conAlfa(paleta.tinta, 0.65) }}
            >
              Elegir todas
            </button>
            <button
              type="button"
              onClick={onCancelar}
              className="text-[12px] font-bold underline"
              style={{ color: conAlfa(paleta.tinta, 0.65) }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <a
            href={`/a/${slug}/zip`}
            className="rounded-xl px-4 py-2 text-[13px] font-bold transition-opacity hover:opacity-90"
            style={{ background: paleta.acento, color: paleta.fondo }}
          >
            Descargar las {totalFotos} foto{totalFotos === 1 ? "" : "s"}
          </a>
          <button
            type="button"
            onClick={onIniciar}
            className="rounded-xl border px-4 py-2 text-[13px] font-bold transition-colors"
            style={{
              borderColor: conAlfa(paleta.tinta, 0.3),
              color: conAlfa(paleta.tinta, 0.8),
            }}
          >
            Elegir algunas
          </button>
        </div>
      )}
    </div>
  );
}
