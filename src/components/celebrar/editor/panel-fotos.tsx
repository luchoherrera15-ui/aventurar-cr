"use client";

import { prepararSubidaCelebrar } from "@/app/celebrar/editor/acciones";
import SubirImagen from "@/components/subir-imagen";
import type { Documento, Seccion } from "@/lib/celebrar/invitacion/esquema";

const MAX_GALERIA = 12;

/**
 * La pestaña «Fotos»: la de portada, la de la historia y la galería.
 * Sube por el uploader del sitio (`SubirImagen`: comprime en el
 * navegador, recorta, y manda directo a Cloudflare Images con el
 * permiso de `prepararSubidaCelebrar`). En el documento queda solo la URL.
 */
export default function PanelFotos({
  doc,
  celebracionId,
  cambiar,
}: {
  doc: Documento;
  celebracionId: string;
  cambiar: (fn: (d: Documento) => Documento) => void;
}) {
  const carpeta = `celebrar/${celebracionId}`;
  const hero = doc.secciones.find((s) => s.tipo === "hero");
  const historia = doc.secciones.find((s) => s.tipo === "historia");
  const galeria = doc.secciones.find((s) => s.tipo === "galeria");

  function actualizar(id: string, fn: (s: Seccion) => Seccion) {
    cambiar((d) => ({ ...d, secciones: d.secciones.map((s) => (s.id === id ? fn(s) : s)) }));
  }

  return (
    <div className="grid gap-6">
      {hero && hero.tipo === "hero" && (
        <section className="c-tarjeta p-4">
          <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Foto de portada</h3>
          <p className="mb-3 mt-1 text-[12px] text-(--c-tinta-suave)">
            Con las portadas «Foto a pantalla completa» y «Color arriba, foto abajo» es la protagonista; en las demás
            acompaña al nombre.
          </p>
          <SubirImagen
            valor={hero.datos.fotoUrl}
            alCambiar={(u) => actualizar(hero.id, (s) => ({ ...s, datos: { ...s.datos, fotoUrl: u } }) as Seccion)}
            destino="foto"
            etiqueta="Portada"
            carpeta={carpeta}
            subidaDirecta={prepararSubidaCelebrar}
            recortar
          />
          {hero.datos.fotoUrl && (
            <button type="button" onClick={() => actualizar(hero.id, (s) => ({ ...s, datos: { ...s.datos, fotoUrl: "" } }) as Seccion)} className="mt-2 text-[12px] text-(--c-coral-tinta) underline underline-offset-4">
              Quitar la foto
            </button>
          )}
        </section>
      )}

      {historia && historia.tipo === "historia" && (
        <section className="c-tarjeta p-4">
          <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Foto de «{historia.datos.titulo || "Nuestra historia"}»</h3>
          <div className="mt-3">
            <SubirImagen
              valor={historia.datos.fotoUrl}
              alCambiar={(u) => actualizar(historia.id, (s) => ({ ...s, datos: { ...s.datos, fotoUrl: u } }) as Seccion)}
              destino="foto"
              etiqueta="Historia"
              carpeta={carpeta}
              subidaDirecta={prepararSubidaCelebrar}
              recortar
            />
          </div>
        </section>
      )}

      {galeria && galeria.tipo === "galeria" ? (
        <section className="c-tarjeta p-4">
          <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">
            Galería <span className="font-normal text-(--c-tinta-suave)">({galeria.datos.fotos.length} de {MAX_GALERIA})</span>
          </h3>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {galeria.datos.fotos.map((f, i) => (
              <li key={`${f}-${i}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => actualizar(galeria.id, (s) => ({ ...s, datos: { ...s.datos, fotos: galeria.datos.fotos.filter((_, j) => j !== i) } }) as Seccion)}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-(--c-marino) text-(--c-blanco)"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              </li>
            ))}
          </ul>
          {galeria.datos.fotos.length < MAX_GALERIA && (
            <div className="mt-3">
              <SubirImagen
                key={galeria.datos.fotos.length}
                valor=""
                alCambiar={(u) => actualizar(galeria.id, (s) => ({ ...s, datos: { ...s.datos, fotos: [...galeria.datos.fotos, u] } }) as Seccion)}
                destino="foto"
                etiqueta="Agregar foto a la galería"
                carpeta={carpeta}
                subidaDirecta={prepararSubidaCelebrar}
              />
            </div>
          )}
        </section>
      ) : (
        <p className="text-[13px] text-(--c-tinta-suave)">Agregá la sección «Galería» en la pestaña Secciones para subir más fotos.</p>
      )}
    </div>
  );
}
