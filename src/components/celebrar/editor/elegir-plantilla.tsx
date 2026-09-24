"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { elegirPlantilla } from "@/app/celebrar/editor/acciones";
import type { DatosIA } from "@/lib/celebrar/ia-prompt";
import { FUENTES, urlGoogleFonts } from "@/lib/celebrar/invitacion/fuentes";
import { CATEGORIAS_PLANTILLA } from "@/lib/celebrar/marca";
import { rutaPreviaPlantilla } from "@/lib/celebrar/rutas";
import type { PlantillaCatalogo } from "@/lib/celebrar/datos";
import { IconoDestellos } from "./asistente-texto";
import { EnlaceCelebrar } from "../rutas-cliente";
import CrearConIA from "./crear-con-ia";
import MiniaturaPlantilla from "./miniatura-plantilla";

/**
 * Paso 3: elegir el diseño. Dos caminos, uno arriba del otro:
 *  - CREAR CON IA: la persona describe lo que quiere y el documento se
 *    genera desde cero (editable después como cualquier plantilla).
 *  - PLANTILLAS: las 40 del tipo, filtrables por categoría, con
 *    miniatura fiel a su paleta, letra y portada.
 *
 * Elegir reemplaza el documento actual (si lo hubiera): se avisa.
 */
export default function ElegirPlantilla({
  celebracionId,
  nombre,
  saludo,
  plantillas,
  conteo,
  categoriaActiva,
  tieneDocumento,
  datosIA,
  saldo,
}: {
  celebracionId: string;
  nombre: string;
  saludo: string;
  /** La tanda del estilo abierto (el catálogo tiene 20 por estilo y tipo). */
  plantillas: PlantillaCatalogo[];
  /** Cuántos diseños hay por estilo para este tipo. */
  conteo: Record<string, number>;
  categoriaActiva: string;
  tieneDocumento: boolean;
  /** Lo que ya se sabe de la celebración, para arrancar el formulario de la IA. */
  datosIA: Partial<DatosIA>;
  saldo: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // «Crear con IA» vive detrás de un botón: la ventana se abre encima del catálogo.
  const [iaAbierta, setIaAbierta] = useState(false);

  const categorias = useMemo(() => CATEGORIAS_PLANTILLA.filter((c) => (conteo[c.id] ?? 0) > 0), [conteo]);
  const total = useMemo(() => Object.values(conteo).reduce((a, b) => a + b, 0), [conteo]);
  const visibles = plantillas;
  const enlaceEstilo = (cat: string) => `${window.location.pathname}?plantillas=1${cat === "todas" ? "" : `&estilo=${cat}`}`;

  function usar(slug: string) {
    if (tieneDocumento && !window.confirm("Vas a reemplazar el diseño actual por esta plantilla. Los textos que hayas escrito se conservan si la plantilla tiene la misma sección. ¿Seguimos?")) return;
    setError(null);
    setOcupado(slug);
    iniciar(async () => {
      const r = await elegirPlantilla(celebracionId, slug);
      if (!r.ok) {
        setError(r.mensaje);
        setOcupado(null);
        return;
      }
      router.push(window.location.pathname);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Una sola hoja de estilos con todas las letras del catálogo: las
          miniaturas muestran la tipografía real de cada plantilla. */}
      <link rel="stylesheet" href={urlGoogleFonts(FUENTES.map((f) => f.id))} precedence="default" />

      <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl leading-tight text-(--c-tinta)">Elegí una plantilla</h2>
              <p className="mt-1 text-[14px] text-(--c-tinta-suave)">
                {total} diseños para este tipo de celebración, veinte por estilo. Todo se puede cambiar después — también lo que haga la IA.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIaAbierta(true)}
              className="c-ia-pastilla c-montserrat inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 text-[14px] font-bold text-(--c-blanco) shadow-elevado transition-transform duration-(--duracion-micro) ease-(--ease-bookea) hover:-translate-y-0.5 hover:brightness-110"
            >
              <IconoDestellos className="h-4 w-4" />
              Crear con IA
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip activo={categoriaActiva === "todas"} onClick={() => router.push(enlaceEstilo("todas"))}>
              Todas <span className="opacity-60">{total}</span>
            </Chip>
            {categorias.map((c) => (
              <Chip key={c.id} activo={categoriaActiva === c.id} onClick={() => router.push(enlaceEstilo(c.id))}>
                {c.nombre} <span className="opacity-60">{conteo[c.id] ?? 0}</span>
              </Chip>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] text-(--c-coral-tinta)">
              {error}
            </p>
          )}

          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibles.map((p) => (
              <li key={p.id} className="c-tarjeta elevar flex flex-col overflow-hidden">
                <div className="p-2">
                  <MiniaturaPlantilla estilos={p.estilos} esquema={p.portada ? { secciones: [p.portada] } : undefined} muestra={nombre} saludo={saludo} />
                </div>
                <div className="flex flex-1 flex-col px-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="c-montserrat text-[14px] font-semibold leading-tight text-(--c-tinta)">{p.nombre}</p>
                    <span className={p.nivel === "gratis" ? "c-pastilla c-pastilla-ok" : "c-pastilla"}>{p.nivel === "gratis" ? "Gratis" : "Premium"}</span>
                  </div>
                  {p.descripcion && <p className="mt-1 text-[12px] leading-snug text-(--c-tinta-suave)">{p.descripcion}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <EnlaceCelebrar a={rutaPreviaPlantilla(p.slug)} target="_blank" className="c-boton c-boton-secundario min-h-10 text-[13px]">
                      Ver
                    </EnlaceCelebrar>
                    <button type="button" onClick={() => usar(p.slug)} disabled={pendiente} className="c-boton c-boton-primario min-h-10 text-[13px]">
                      {ocupado === p.slug ? "Aplicando…" : "Usar esta"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

      {iaAbierta && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-(--c-marino)/60 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Crear con IA"
          onClick={() => setIaAbierta(false)}
        >
          <div className="relative my-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIaAbierta(false)}
              aria-label="Cerrar"
              className="absolute -top-3 -right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-(--c-blanco) text-(--c-marino) shadow-elevado"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
            <CrearConIA celebracionId={celebracionId} inicial={datosIA} tieneDocumento={tieneDocumento} saldo={saldo} />
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`c-montserrat min-h-9 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
        activo ? "bg-(--c-marino) text-(--c-blanco)" : "border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta-suave) hover:text-(--c-tinta)"
      }`}
    >
      {children}
    </button>
  );
}
