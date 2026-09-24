"use client";

import type { Documento, Seccion } from "@/lib/celebrar/invitacion/esquema";
import { rutaFicha } from "@/lib/celebrar/rutas";
import type { Celebracion } from "@/lib/celebrar/tipos";
import { fechaLargaCR } from "@/lib/fechas";
import { EnlaceCelebrar } from "../rutas-cliente";
import { Campo } from "./campos";

/**
 * La pestaña «Esencial»: lo primero que alguien quiere tocar (el saludo,
 * el nombre, la frase) y los datos de la celebración que la invitación
 * usa en varias secciones (fecha, hora, lugar), que se editan en la
 * ficha para que haya UNA sola verdad.
 */
export default function PanelEsencial({
  doc,
  celebracion,
  cambiar,
}: {
  doc: Documento;
  celebracion: Celebracion;
  cambiar: (fn: (d: Documento) => Documento) => void;
}) {
  const hero = doc.secciones.find((s) => s.tipo === "hero");
  const rsvp = doc.secciones.find((s) => s.tipo === "rsvp");
  function actualizar(id: string, fn: (s: Seccion) => Seccion) {
    cambiar((d) => ({ ...d, secciones: d.secciones.map((s) => (s.id === id ? fn(s) : s)) }));
  }

  return (
    <div className="grid gap-6">
      {hero && hero.tipo === "hero" && (
        <section className="c-tarjeta grid gap-4 p-4">
          <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Portada</h3>
          <Campo id="es-saludo" etiqueta="Saludo" valor={hero.datos.saludo} alCambiar={(v) => actualizar(hero.id, (s) => ({ ...s, datos: { ...s.datos, saludo: v } }) as Seccion)} placeholder="Nos casamos" ia={{ seccion: "hero", campo: "saludo" }} />
          <Campo id="es-titulo" etiqueta="Nombre de la celebración" valor={hero.datos.titulo} alCambiar={(v) => actualizar(hero.id, (s) => ({ ...s, datos: { ...s.datos, titulo: v } }) as Seccion)} placeholder={celebracion.nombre} />
          <Campo id="es-sub" etiqueta="Frase" valor={hero.datos.subtitulo} alCambiar={(v) => actualizar(hero.id, (s) => ({ ...s, datos: { ...s.datos, subtitulo: v } }) as Seccion)} ia={{ seccion: "hero", campo: "subtitulo" }} />
        </section>
      )}

      <section className="c-tarjeta p-4">
        <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Fecha, hora y lugar</h3>
        <dl className="mt-3 grid gap-2 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-(--c-tinta-suave)">Fecha</dt>
            <dd className="text-right text-(--c-tinta)">{celebracion.fecha ? fechaLargaCR(celebracion.fecha) : "Sin fecha"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--c-tinta-suave)">Hora</dt>
            <dd className="text-(--c-tinta)">{celebracion.hora ? celebracion.hora.slice(0, 5) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--c-tinta-suave)">Lugar</dt>
            <dd className="text-right text-(--c-tinta)">{celebracion.lugar_nombre ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] leading-relaxed text-(--c-tinta-suave)">
          Estos datos viven en la ficha de la celebración y alimentan la cuenta regresiva, la fecha de la portada y la ubicación.
        </p>
        <EnlaceCelebrar a={rutaFicha(celebracion.id)} className="c-boton c-boton-secundario mt-3 min-h-10 text-[13px]">
          Cambiar en la ficha
        </EnlaceCelebrar>
      </section>

      {rsvp && rsvp.tipo === "rsvp" && (
        <section className="c-tarjeta grid gap-3 p-4">
          <h3 className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">Confirmaciones</h3>
          {rsvp.datos.modo === "panel" ? (
            <p className="text-[13px] leading-relaxed text-(--c-tinta-suave)">
              Los invitados confirman con el formulario de la invitación y las respuestas llegan a <strong className="text-(--c-tinta)">Invitados</strong> en tu panel. Las preguntas se configuran en Secciones → Confirmación de asistencia.
            </p>
          ) : (
            <Campo
              id="es-wa"
              etiqueta="WhatsApp donde confirman"
              tipo="tel"
              valor={rsvp.datos.whatsapp}
              maxLength={20}
              placeholder="8888 8888"
              alCambiar={(v) => actualizar(rsvp.id, (s) => ({ ...s, datos: { ...s.datos, whatsapp: v } }) as Seccion)}
              ayuda="El botón «Confirmar asistencia» abre un chat con este número. Para recibir las confirmaciones en tu panel, cambiá el modo en Secciones → Confirmación de asistencia."
            />
          )}
        </section>
      )}
    </div>
  );
}
