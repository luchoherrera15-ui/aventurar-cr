"use client";

import { useRef, useState, useTransition } from "react";
import { subirMusicaCelebrar } from "@/app/celebrar/editor/acciones";
import type { Documento, Musica } from "@/lib/celebrar/invitacion/esquema";
import { Campo, Interruptor } from "./campos";

/**
 * La tarjeta «Canción» del editor: subir un mp3 (o m4a, aac, ogg, wav)
 * de hasta 12 MB, ponerle título y decidir si arranca sola al primer
 * toque. Queda como un botón flotante «Reproducir nuestra canción» en la
 * invitación, igual que en las demos de Bookea.
 */
export default function PanelMusica({
  doc,
  celebracionId,
  cambiar,
}: {
  doc: Documento;
  celebracionId: string;
  cambiar: (fn: (d: Documento) => Documento) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, iniciar] = useTransition();
  const m = doc.musica;
  const set = (parche: Partial<Musica>) => cambiar((d) => ({ ...d, musica: { ...d.musica, ...parche } }));

  function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    const fd = new FormData();
    fd.set("archivo", archivo);
    iniciar(async () => {
      const r = await subirMusicaCelebrar(celebracionId, fd);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      set({ url: r.url, titulo: m.titulo || archivo.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) });
    });
  }

  return (
    <section className="c-tarjeta grid gap-4 p-4">
      <div>
        <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Canción</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-(--c-tinta-suave)">
          Un botón «Reproducir nuestra canción» flota en la invitación. Los navegadores no dejan sonar nada sin un toque,
          así que «arranca sola» significa: al primer toque o scroll de la persona.
        </p>
      </div>

      {m.url ? (
        <div className="grid gap-3 rounded-xl border border-(--c-linea) p-3">
          <audio controls preload="none" src={m.url} className="w-full" />
          <Campo id="musica-titulo" etiqueta="Título (se muestra en el botón)" valor={m.titulo} maxLength={120} placeholder="Nuestra canción" alCambiar={(v) => set({ titulo: v })} />
          <Interruptor id="musica-auto" etiqueta="Arranca sola al primer toque" activo={m.autoplay} alCambiar={(v) => set({ autoplay: v })} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo} className="c-boton c-boton-secundario min-h-10 text-[13px]">
              {subiendo ? "Subiendo…" : "Cambiar la canción"}
            </button>
            <button type="button" onClick={() => set({ url: "", titulo: "", autoplay: false })} className="text-[13px] font-medium text-(--c-coral-tinta) underline underline-offset-4">
              Quitar la canción
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-(--c-linea) px-4 py-6 text-center transition-colors hover:border-(--c-marino) disabled:opacity-60"
        >
          <span className="c-montserrat text-[14px] font-semibold text-(--c-tinta)">{subiendo ? "Subiendo la canción…" : "Subir una canción"}</span>
          <span className="text-[12px] text-(--c-tinta-suave)">mp3, m4a, aac, ogg o wav · hasta 12 MB</span>
        </button>
      )}
      <input ref={entrada} type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/x-m4a,.mp3,.m4a,.aac,.ogg,.wav" className="sr-only" onChange={(e) => alElegir(e.target.files?.[0])} />
      {error && (
        <p role="alert" className="rounded-xl bg-(--c-coral-suave) px-3 py-2 text-[13px] text-(--c-coral-tinta)">
          {error}
        </p>
      )}
      <p className="text-[12px] leading-relaxed text-(--c-tinta-suave)">
        Usá música de la que tengás derecho (propia, con licencia o libre). Las plataformas de streaming no permiten
        descargar sus canciones para esto.
      </p>
    </section>
  );
}
