"use client";

import { useActionState, useState } from "react";
import { TIPOS_CELEBRACION } from "@/lib/celebrar/marca";
import { limpiarSlugEscrito } from "@/lib/celebrar/slug";
import type { Celebracion } from "@/lib/celebrar/tipos";
import { actualizarCelebracion, type EstadoEdicion } from "./acciones";

/**
 * El formulario de datos básicos de la ficha. Mismos campos que el
 * asistente; la validación es la misma función pura y la base vuelve a
 * vigilar el slug. Guardar no cambia el estado (borrador sigue borrador).
 */
export default function EditarBasicos({ c, base }: { c: Celebracion; base: string }) {
  const accion = actualizarCelebracion.bind(null, c.id);
  const [estado, enviar, pendiente] = useActionState<EstadoEdicion, FormData>(accion, null);
  const [slug, setSlug] = useState(c.slug);
  const errores = estado?.errores ?? {};

  return (
    <form action={enviar} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ed-tipo" className="c-rotulo">
            Tipo
          </label>
          <select id="ed-tipo" name="tipo" defaultValue={c.tipo} className="c-campo">
            {TIPOS_CELEBRACION.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ed-nombre" className="c-rotulo">
            Nombre
          </label>
          <input id="ed-nombre" name="nombre" type="text" required maxLength={120} defaultValue={c.nombre} className="c-campo" />
          {errores.nombre && <Error>{errores.nombre}</Error>}
        </div>
      </div>

      <div>
        <label htmlFor="ed-slug" className="c-rotulo">
          Dirección
        </label>
        <div className="c-campo flex items-center gap-1 px-0">
          <span className="shrink-0 pl-4 text-[14px] text-(--c-tinta-suave)">{base}/</span>
          <input
            id="ed-slug"
            name="slug"
            type="text"
            required
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            value={slug}
            onChange={(e) => setSlug(limpiarSlugEscrito(e.target.value))}
            className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-[15px] text-(--c-tinta) outline-none"
          />
        </div>
        {errores.slug ? (
          <Error>{errores.slug}</Error>
        ) : (
          slug !== c.slug && (
            <p className="mt-2 text-[13px] text-(--c-tinta-suave)">
              Si la cambiás, la dirección anterior sigue llevando a esta celebración.
            </p>
          )
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ed-fecha" className="c-rotulo">
            Fecha
          </label>
          <input id="ed-fecha" name="fecha" type="date" defaultValue={c.fecha ?? ""} className="c-campo" />
          {errores.fecha && <Error>{errores.fecha}</Error>}
        </div>
        <div>
          <label htmlFor="ed-hora" className="c-rotulo">
            Hora
          </label>
          <input id="ed-hora" name="hora" type="time" defaultValue={c.hora?.slice(0, 5) ?? ""} className="c-campo" />
          {errores.hora && <Error>{errores.hora}</Error>}
        </div>
      </div>

      <div>
        <label htmlFor="ed-lugar" className="c-rotulo">
          Lugar
        </label>
        <input id="ed-lugar" name="lugarNombre" type="text" maxLength={160} defaultValue={c.lugar_nombre ?? ""} className="c-campo" />
        {errores.lugarNombre && <Error>{errores.lugarNombre}</Error>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ed-direccion" className="c-rotulo">
            Dirección
          </label>
          <input id="ed-direccion" name="direccion" type="text" maxLength={300} defaultValue={c.direccion ?? ""} className="c-campo" />
          {errores.direccion && <Error>{errores.direccion}</Error>}
        </div>
        <div>
          <label htmlFor="ed-maps" className="c-rotulo">
            Link de Google Maps o Waze
          </label>
          <input id="ed-maps" name="mapsUrl" type="url" inputMode="url" defaultValue={c.maps_url ?? ""} className="c-campo" />
          {errores.mapsUrl && <Error>{errores.mapsUrl}</Error>}
        </div>
      </div>

      {estado?.mensaje && (
        <p role="alert" className="rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] text-(--c-coral-tinta)">
          {estado.mensaje}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--c-linea) pt-5">
        <p role="status" className="text-[14px] text-(--c-ok)">
          {estado?.guardado ? "Guardado." : ""}
        </p>
        <button type="submit" disabled={pendiente} className="c-boton c-boton-primario">
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-[13px] text-(--c-coral-tinta)">
      {children}
    </p>
  );
}
