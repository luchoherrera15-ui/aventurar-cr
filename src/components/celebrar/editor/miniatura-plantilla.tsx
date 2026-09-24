"use client";

import { useEffect, useRef, useState } from "react";
import RenderInvitacion from "@/components/celebrar/invitacion/render-invitacion";
import { normalizarDocumento, type Documento, type Estilo, type Seccion } from "@/lib/celebrar/invitacion/esquema";

/** El ancho del teléfono en que se «toma la foto» de la portada. */
const ANCHO_BASE = 390;
/** Alto de esa pantalla (390 × 2.05, como el marco del editor). */
const ALTO_BASE = 800;

/**
 * La miniatura de una plantilla en el selector: la PORTADA DE VERDAD,
 * renderizada a 390 px con el mismo componente de la invitación y
 * encogida a lo que mida la tarjeta (un ResizeObserver mide el ancho y
 * aplica la escala). Así lo que se ve en el catálogo es exactamente lo
 * que se va a ver en el teléfono — con sus letras, su textura, su
 * ornamento y su marco — y no un dibujito aproximado.
 *
 * Sin partículas ni animaciones de entrada (`soloPortada`): 40 de estas
 * en pantalla tienen que ser livianas.
 */
export default function MiniaturaPlantilla({
  estilos,
  esquema,
  muestra,
  saludo,
  subtitulo = "",
}: {
  estilos: unknown;
  /** El documento de la plantilla; si falta, se arma uno mínimo con el estilo. */
  esquema?: unknown;
  muestra: string;
  saludo: string;
  subtitulo?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ANCHO_BASE);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = normalizarDocumento(esquema ?? { secciones: [{ id: "hero", tipo: "hero" }] });
  const estilo: Estilo = { ...normalizarDocumento({ estilo: estilos }).estilo, animaciones: false };
  // normalizarDocumento garantiza que la primera sección es la portada.
  const hero = base.secciones[0];
  const portada: Seccion =
    hero.tipo === "hero"
      ? { ...hero, datos: { ...hero.datos, saludo: saludo || hero.datos.saludo, subtitulo: subtitulo || hero.datos.subtitulo, titulo: muestra } }
      : hero;
  const doc: Documento = { ...base, estilo, secciones: [portada] };

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: `${ANCHO_BASE} / ${ALTO_BASE}`, borderRadius: 12 }} aria-hidden="true">
      <div
        style={{
          width: ANCHO_BASE,
          height: ALTO_BASE,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <RenderInvitacion
          documento={doc}
          celebracion={{ nombre: muestra, fecha: "2026-12-12", hora: "16:00", lugarNombre: null, direccion: null, mapsUrl: null }}
          conFuentes={false}
          modo="publico"
          altoPantalla={`${ALTO_BASE}px`}
          soloPortada
        />
      </div>
    </div>
  );
}
