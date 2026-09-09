"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════
 *  RECORTAR UNA IMAGEN — antes de subirla, como en Linktree
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026), con el «Upload media» de Linktree en
 * pantalla: «a la hora de editar un header y demás, tener estas
 * opciones de recortar».
 *
 * ── CÓMO FUNCIONA ──────────────────────────────────────────────────
 * El marco de recorte es FIJO y la imagen se mueve debajo: se arrastra
 * con el dedo o el mouse y se acerca con el deslizador o la rueda.
 * Es el recorte «de Instagram», no el del rectángulo con manijas de
 * Linktree, y a propósito: da el mismo resultado, funciona igual con
 * el dedo que con el mouse, y no tiene los ocho bordes que hay que
 * acertar con un dedo gordo en un teléfono.
 *
 * La proporción la manda el destino (1:1 un logo, 3:1 una portada) y
 * no se puede romper: lo que sale de acá siempre cabe donde va.
 *
 * ── QUÉ DEVUELVE ───────────────────────────────────────────────────
 * Un `File` nuevo con el recorte, ya en la proporción pedida. Lo que
 * pase después —comprimir, subir— es de quien lo llamó (`SubirImagen`):
 * este componente no sabe de buckets ni de Cloudflare.
 *
 * Un logo con transparencia sale PNG (se conserva el alfa: ver el
 * porqué en `comprimir-imagen.ts`); una foto, JPEG.
 *
 * ── EL ESTADO ES MÍNIMO A PROPÓSITO ────────────────────────────────
 * `off` en null significa «centrada»: el centro se CALCULA en el render
 * a partir del tamaño real de la imagen y del marco, así la imagen
 * aparece centrada sin un efecto que escriba estado (y sin el parpadeo
 * de un primer render descentrado).
 */

const ZOOM_MAX = 4;
const ALTO_VISOR = 360;

type Punto = { x: number; y: number };

export default function RecortarImagen({
  archivo,
  relacion,
  titulo = "Recortar la imagen",
  conservarAlfa = false,
  ladoMax = 1600,
  alConfirmar,
  alCancelar,
}: {
  archivo: File;
  /** ancho / alto del marco: 1 para cuadrado, 3 para banner 3:1. */
  relacion: number;
  titulo?: string;
  conservarAlfa?: boolean;
  /** Tope del lado mayor del recorte que sale. */
  ladoMax?: number;
  alConfirmar: (recortado: File) => void;
  alCancelar: () => void;
}) {
  const visor = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [url] = useState(() => URL.createObjectURL(archivo));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [visorAncho, setVisorAncho] = useState(0);
  const [zoom, setZoom] = useState(1);
  /** null = centrada (ver el comentario de arriba). */
  const [off, setOff] = useState<Punto | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const arrastre = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [fallo, setFallo] = useState(false);

  // La URL del archivo se libera al CERRAR, no al desmontar: en
  // desarrollo React monta y desmonta el componente dos veces (Strict
  // Mode) y una limpieza en el desmontaje simulado revocaba la URL con la
  // imagen todavía cargando — el diálogo quedaba en «Cargando…» para
  // siempre (7 sep 2026).
  const cerrar = () => {
    URL.revokeObjectURL(url);
    alCancelar();
  };

  // El ancho real del visor, para dimensionar el marco.
  useEffect(() => {
    const el = visor.current;
    if (!el) return;
    const ro = new ResizeObserver((entradas) => {
      for (const e of entradas) setVisorAncho(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape cancela.
  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", teclado);
    return () => document.removeEventListener("keydown", teclado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alCancelar, url]);

  // ── La geometría (todo derivado, nada guardado) ───────────────────
  // El marco ocupa el 88 % del visor en su lado limitante.
  let marcoW = 0;
  let marcoH = 0;
  if (visorAncho > 0) {
    marcoW = visorAncho * 0.88;
    marcoH = marcoW / relacion;
    if (marcoH > ALTO_VISOR * 0.88) {
      marcoH = ALTO_VISOR * 0.88;
      marcoW = marcoH * relacion;
    }
  }
  const escalaBase = natural && marcoW ? Math.max(marcoW / natural.w, marcoH / natural.h) : 1;
  const escala = escalaBase * zoom;
  const dibujoW = natural ? natural.w * escala : 0;
  const dibujoH = natural ? natural.h * escala : 0;

  /** La imagen siempre cubre el marco entero: el desplazamiento se acota. */
  const acotar = (o: Punto, dw = dibujoW, dh = dibujoH): Punto => ({
    x: Math.min(0, Math.max(marcoW - dw, o.x)),
    y: Math.min(0, Math.max(marcoH - dh, o.y)),
  });
  const offEfectivo: Punto = off ?? acotar({ x: (marcoW - dibujoW) / 2, y: (marcoH - dibujoH) / 2 });

  /** Cambiar el zoom manteniendo el centro del marco sobre el mismo punto. */
  const cambiarZoom = (z: number) => {
    if (!natural) return;
    const nuevo = Math.min(ZOOM_MAX, Math.max(1, z));
    const e1 = escalaBase * zoom;
    const e2 = escalaBase * nuevo;
    const cx = (marcoW / 2 - offEfectivo.x) / e1;
    const cy = (marcoH / 2 - offEfectivo.y) / e1;
    setZoom(nuevo);
    setOff(acotar({ x: marcoW / 2 - cx * e2, y: marcoH / 2 - cy * e2 }, natural.w * e2, natural.h * e2));
  };

  // ── Arrastre (mouse y dedo, por Pointer Events) ───────────────────
  const alBajar = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, ox: offEfectivo.x, oy: offEfectivo.y };
    setArrastrando(true);
  };
  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    setOff(acotar({ x: a.ox + (e.clientX - a.x), y: a.oy + (e.clientY - a.y) }));
  };
  const alSoltar = () => {
    arrastre.current = null;
    setArrastrando(false);
  };

  // ── El recorte ────────────────────────────────────────────────────
  const confirmar = async () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    setProcesando(true);
    try {
      const sx = -offEfectivo.x / escala;
      const sy = -offEfectivo.y / escala;
      const sw = marcoW / escala;
      const sh = marcoH / escala;
      const factor = Math.min(1, ladoMax / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * factor));
      canvas.height = Math.max(1, Math.round(sh * factor));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sin canvas");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const tipo = conservarAlfa ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, 0.92));
      if (!blob) throw new Error("sin blob");
      const base = archivo.name.replace(/\.[^.]+$/, "") || "imagen";
      URL.revokeObjectURL(url);
      alConfirmar(new File([blob], `${base}-recorte.${conservarAlfa ? "png" : "jpg"}`, { type: tipo }));
    } catch {
      // Si el recorte falla, se sube la imagen entera: nunca sin imagen.
      URL.revokeObjectURL(url);
      alConfirmar(archivo);
    } finally {
      setProcesando(false);
    }
  };

  const listo = !!natural && marcoW > 0;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="recorte-titulo" className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-3">
      <div className="w-[min(560px,100%)] overflow-hidden rounded-3xl bg-white shadow-flotante">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <button type="button" onClick={cerrar} className="rounded-lg px-2 py-1 text-[13px] font-bold text-bookea-gris hover:text-bookea-tinta" aria-label="Volver">
            ←
          </button>
          <h2 id="recorte-titulo" className="text-[15px] font-extrabold text-bookea-tinta">
            {titulo}
          </h2>
          <button type="button" onClick={cerrar} className="rounded-lg px-2 py-1 text-[16px] font-bold text-bookea-gris hover:text-bookea-tinta" aria-label="Cerrar">
            ×
          </button>
        </div>

        {/* El visor: fondo a cuadros, la imagen debajo, el marco encima. */}
        <div
          ref={visor}
          className="relative mx-5 mt-3 touch-none select-none overflow-hidden rounded-2xl"
          style={{
            height: ALTO_VISOR,
            backgroundColor: "#e5e7eb",
            backgroundImage:
              "linear-gradient(45deg,#d1d5db 25%,transparent 25%),linear-gradient(-45deg,#d1d5db 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d1d5db 75%),linear-gradient(-45deg,transparent 75%,#d1d5db 75%)",
            backgroundSize: "18px 18px",
            backgroundPosition: "0 0,0 9px,9px -9px,-9px 0",
            cursor: arrastrando ? "grabbing" : "grab",
          }}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          onWheel={(e) => {
            e.preventDefault();
            cambiarZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92));
          }}
        >
          {/* Todo se posiciona relativo al marco, centrado en el visor. */}
          <div className="absolute" style={{ left: (visorAncho - marcoW) / 2, top: (ALTO_VISOR - marcoH) / 2, width: marcoW, height: marcoH }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- archivo local del usuario */}
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFallo(true)}
              className="absolute max-w-none"
              style={{ left: offEfectivo.x, top: offEfectivo.y, width: dibujoW || undefined, height: dibujoH || undefined, opacity: listo ? 1 : 0 }}
            />
            {/* El marco: lo de afuera se oscurece, adentro la regla de tercios. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-sm border-2 border-white" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,.5)" }}>
              <span className="absolute inset-y-0 left-1/3 w-px bg-white/45" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-white/45" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/45" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/45" />
            </div>
          </div>
          {!listo && (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] font-bold text-bookea-gris">
              {fallo ? "El navegador no puede abrir este archivo (¿es HEIC del iPhone?). Probá con JPG o PNG, o subila entera." : "Cargando la imagen…"}
            </p>
          )}
        </div>

        {/* Acercar */}
        <div className="mx-5 mt-3 flex items-center gap-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-bookea-gris">Acercar</span>
          <input
            type="range"
            min={1}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => cambiarZoom(Number(e.target.value))}
            aria-label="Acercar la imagen"
            className="w-full accent-bookea-tinta"
          />
        </div>
        <p className="mx-5 mt-1.5 text-[11.5px] text-bookea-gris">Arrastrá la imagen para encuadrarla. Lo que queda dentro del marco es lo que se sube.</p>

        <div className="flex flex-col gap-2 p-5">
          <button
            type="button"
            onClick={confirmar}
            disabled={!listo || procesando}
            className="presionable inline-flex min-h-[48px] items-center justify-center rounded-full bg-bookea-tinta px-5 text-[14px] font-extrabold text-white disabled:opacity-60"
          >
            {procesando ? "Recortando…" : "Recortar y subir"}
          </button>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(url);
              alConfirmar(archivo);
            }}
            disabled={procesando}
            className="presionable inline-flex min-h-[44px] items-center justify-center rounded-full border border-bookea-linea px-5 text-[13px] font-bold text-bookea-tinta"
          >
            Usar la imagen entera
          </button>
        </div>
      </div>
    </div>
  );
}
