"use client";

import { useEffect, useRef, useState } from "react";
import { EVENTO_ABRIR } from "./apertura-invitacion";

/**
 * La canción de la invitación: un botón flotante abajo («Reproducir
 * nuestra canción» → «Pausar») con un `<audio>` propio. Los navegadores
 * no dejan sonar nada sin un toque: si `autoplay` está activo, arranca
 * con la PRIMERA interacción de la persona en la página (toque, clic o
 * scroll) en vez de al cargar. Se detiene solo al terminar; en bucle
 * si la persona lo vuelve a tocar. Solo texto y un ícono: nada de marcas.
 */
export default function Musica({ url, titulo, autoplay }: { url: string; titulo: string; autoplay: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);

  // Al ABRIR la invitación (la carta, el destello) la canción arranca:
  // ese toque es la interacción que el navegador pide para el audio.
  useEffect(() => {
    const alAbrir = () => audio.current?.play().catch(() => {});
    window.addEventListener(EVENTO_ABRIR, alAbrir);
    return () => window.removeEventListener(EVENTO_ABRIR, alAbrir);
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const arrancar = () => {
      audio.current?.play().catch(() => {});
      quitar();
    };
    const quitar = () => {
      window.removeEventListener("pointerdown", arrancar);
      window.removeEventListener("keydown", arrancar);
      window.removeEventListener("scroll", arrancar);
    };
    window.addEventListener("pointerdown", arrancar, { once: true });
    window.addEventListener("keydown", arrancar, { once: true });
    window.addEventListener("scroll", arrancar, { once: true, passive: true });
    return quitar;
  }, [autoplay]);

  function alternar() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }

  return (
    <>
      <audio
        ref={audio}
        src={url}
        preload="none"
        loop
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
      />
      <button type="button" className={`inv-musica ${sonando ? "inv-musica-suena" : ""}`} onClick={alternar} aria-pressed={sonando} aria-label={sonando ? "Pausar la canción" : "Reproducir la canción"}>
        <span className="inv-musica-icono" aria-hidden="true">
          {sonando ? (
            <span className="inv-ondas-sonido">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          )}
        </span>
        <span className="inv-musica-texto">
          {sonando ? "Pausar" : "Reproducir"} {titulo ? `«${titulo}»` : "nuestra canción"}
        </span>
      </button>
    </>
  );
}
