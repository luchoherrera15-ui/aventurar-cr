"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIAS_INVITACIONES,
  type CategoriaInvitacion,
  type DemoInvitacion,
} from "@/lib/catalogo-invitaciones";
import TelefonoVivo from "./telefono-vivo";

const PAPEL_DEFECTO = { fondo: "#efe7d8", tinta: "#2a2318", acento: "#c9a227" };

/**
 * LA VITRINA: cada ejemplo corriendo en el teléfono, no un rectángulo
 * de color con el nombre encima.
 *
 * El riel anterior (`riel-ejemplos.tsx`) pintaba un slide grande con la
 * paleta de cada diseño y un botón para abrirla en otra pestaña — o sea
 * que para ver una invitación había que irse de la landing. Acá se ve
 * acá: la pestaña filtra por ocasión, la lista de la derecha elige el
 * diseño, y el teléfono lo muestra andando. «Pantalla completa» sigue
 * abriendo la invitación sola, para quien quiera verla como la vería
 * un invitado.
 */
export default function VitrinaEjemplos({
  demos,
  claseSerif,
}: {
  demos: DemoInvitacion[];
  claseSerif: string;
}) {
  // Arranca en la primera pestaña que tenga ejemplos.
  const [categoria, setCategoria] = useState<CategoriaInvitacion>(
    () =>
      CATEGORIAS_INVITACIONES.find((c) => demos.some((d) => d.categoria === c.id))?.id ??
      CATEGORIAS_INVITACIONES[0].id,
  );
  const visibles = useMemo(() => demos.filter((d) => d.categoria === categoria), [demos, categoria]);
  const [slug, setSlug] = useState<string | null>(null);
  const demo = visibles.find((d) => d.slug === slug) ?? visibles[0];

  function cambiarCategoria(id: CategoriaInvitacion) {
    setCategoria(id);
    setSlug(null);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Ocasiones"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible"
      >
        {CATEGORIAS_INVITACIONES.map((c) => {
          const activa = c.id === categoria;
          const cuantas = demos.filter((d) => d.categoria === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => cambiarCategoria(c.id)}
              className={`presionable flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors duration-[var(--duracion-micro)] ${
                activa
                  ? "bg-[var(--inv-papel)] text-[var(--inv-fondo)]"
                  : "border border-[var(--inv-linea)] text-[var(--inv-tinta-suave)] hover:border-[var(--inv-tinta-suave)] hover:text-[var(--inv-tinta)]"
              }`}
            >
              {c.label}
              {cuantas > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${activa ? "bg-[var(--inv-fondo)]/10" : "bg-[var(--inv-vidrio)]"}`}>
                  {cuantas}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!demo ? (
        <p className="mt-8 rounded-[18px] border border-dashed border-[var(--inv-linea)] px-6 py-16 text-center text-[14px] text-[var(--inv-tinta-suave)]">
          Estamos preparando los ejemplos de esta ocasión. Contanos de tu evento y te diseñamos la tuya desde cero.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[auto_1fr] lg:gap-14">
          <div className="flex justify-center lg:sticky lg:top-24">
            <TelefonoVivo
              src={`/i/${demo.slug}`}
              titulo={demo.nombre}
              ocasion={demo.ocasion}
              papel={demo.muestra ?? PAPEL_DEFECTO}
              ancho={280}
              claseSerif={claseSerif}
            />
          </div>

          {/* min-w-0: sin esto la columna crece hasta el ancho del texto
              truncado y la página entera se desborda en el teléfono. */}
          <div className="min-w-0 lg:pt-6">
            <p className="text-[12px] font-bold text-[var(--inv-tinta-suave)]">{demo.ocasion}</p>
            <h3 className={`${claseSerif} mt-1 text-[clamp(34px,4.5vw,52px)] leading-[1.02]`}>{demo.nombre}</h3>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--inv-tinta-suave)]">{demo.descripcion}</p>
            <a
              href={`/i/${demo.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="presionable mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--inv-linea)] px-5 text-[13.5px] font-bold transition-colors duration-[var(--duracion-micro)] hover:border-[var(--inv-tinta-suave)]"
            >
              Abrir en pantalla completa
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path d="M4 10h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            {visibles.length > 1 && (
              <ul className="mt-8 flex flex-col gap-2" aria-label="Más diseños de esta ocasión">
                {visibles.map((d) => {
                  const es = d.slug === demo.slug;
                  const m = d.muestra ?? PAPEL_DEFECTO;
                  return (
                    <li key={d.slug}>
                      <button
                        type="button"
                        aria-pressed={es}
                        onClick={() => setSlug(d.slug)}
                        className={`presionable flex w-full items-center gap-3.5 rounded-[14px] border p-3 text-left transition-colors duration-[var(--duracion-micro)] ${
                          es
                            ? "border-[var(--inv-papel)] bg-[var(--inv-vidrio)]"
                            : "border-[var(--inv-linea)] hover:border-[var(--inv-tinta-suave)]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`${claseSerif} flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] text-[17px] leading-none`}
                          style={{ background: m.fondo, color: m.tinta, boxShadow: `inset 0 0 0 1px ${m.acento}` }}
                        >
                          {d.nombre.charAt(0)}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14.5px] font-bold">{d.nombre}</span>
                          <span className="block truncate text-[12.5px] text-[var(--inv-tinta-suave)]">{d.descripcion}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
