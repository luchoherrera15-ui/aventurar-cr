"use client";

import { useMemo, useState } from "react";
import { IconCheck, IconStar } from "@/components/icons";
import { iniciales } from "@/lib/iniciales";
import { TZ_CR } from "@/lib/fechas";
import type { ResenaPerfil } from "./perfil-tipos";

type Orden = "recientes" | "mejor" | "peor";

const ORDEN_OPCIONES: { id: Orden; label: string }[] = [
  { id: "recientes", label: "Más recientes" },
  { id: "mejor", label: "Mejor valoradas" },
  { id: "peor", label: "Menor valoración" },
];

const LIMITE_INICIAL = 6;
const LIMITE_PASO = 6;

/** "2026-08-13T..." → "13 ago 2026", en hora de Costa Rica. */
function fechaBonita(fecha: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ_CR,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(fecha));
}

/**
 * La lista de reseñas: orden elegible, filtro por profesional (solo si
 * hay más de uno entre las reseñas) y "Ver más" en vez de traer todo de
 * una — todo sobre el array ya recibido, sin pedirle nada nuevo al
 * servidor.
 */
export default function ReviewsList({ resenas }: { resenas: ResenaPerfil[] }) {
  const [orden, setOrden] = useState<Orden>("recientes");
  const [profesional, setProfesional] = useState<string | "todos">("todos");
  const [visibles, setVisibles] = useState(LIMITE_INICIAL);

  const profesionales = useMemo(() => {
    const nombres = new Set(
      resenas.map((r) => r.profesionalNombre).filter((n): n is string => n !== null),
    );
    return [...nombres];
  }, [resenas]);

  const filtradas = useMemo(() => {
    const base =
      profesional === "todos"
        ? resenas
        : resenas.filter((r) => r.profesionalNombre === profesional);

    const ordenadas = [...base].sort((a, b) => {
      if (orden === "mejor") return b.calificacion - a.calificacion;
      if (orden === "peor") return a.calificacion - b.calificacion;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
    return ordenadas;
  }, [resenas, profesional, orden]);

  if (resenas.length === 0) return null;

  const mostradas = filtradas.slice(0, visibles);
  const quedanMas = filtradas.length > mostradas.length;

  return (
    <div>
      {/* ---------- Controles ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        {ORDEN_OPCIONES.map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => {
              setOrden(op.id);
              setVisibles(LIMITE_INICIAL);
            }}
            aria-pressed={orden === op.id}
            className={`rounded-xl px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
              orden === op.id
                ? "bg-aventurea-blue-light text-aventurea-navy"
                : "border border-aventurea-line text-aventurea-ink-soft hover:text-aventurea-navy"
            }`}
          >
            {op.label}
          </button>
        ))}

        {profesionales.length > 1 && (
          <select
            value={profesional}
            onChange={(e) => {
              setProfesional(e.target.value);
              setVisibles(LIMITE_INICIAL);
            }}
            aria-label="Filtrar reseñas por profesional"
            className="ml-auto rounded-xl border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink"
          >
            <option value="todos">Todos los profesionales</option>
            {profesionales.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ---------- Reseñas ---------- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mostradas.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-blue-light text-[12.5px] font-extrabold text-aventurea-navy">
                {iniciales(r.clienteNombre) || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-aventurea-ink">
                  {r.clienteNombre}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-aventurea-ink-soft">
                  <span className="flex items-center gap-0.5 text-aventurea-orange">
                    {Array.from({ length: r.calificacion }, (_, i) => (
                      <IconStar key={i} className="h-3 w-3" />
                    ))}
                  </span>
                  <span>{fechaBonita(r.fecha)}</span>
                </div>
              </div>
            </div>

            {(r.servicioNombre || r.profesionalNombre) && (
              <p className="mt-2 text-[11.5px] font-semibold text-aventurea-ink-soft">
                {[
                  r.servicioNombre,
                  r.profesionalNombre ? `con ${r.profesionalNombre}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            {r.comentario && (
              <p className="mt-2 text-[13px] leading-relaxed text-aventurea-ink">
                “{r.comentario}”
              </p>
            )}

            {/* SIEMPRE true en este esquema (ver perfil-tipos.ts):
                resenas.reserva_id es NOT NULL y único. No es un adorno. */}
            <p className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-aventurea-green">
              <IconCheck className="h-3 w-3 shrink-0" />
              Reserva verificada
            </p>
          </article>
        ))}
      </div>

      {quedanMas && (
        <button
          type="button"
          onClick={() => setVisibles((v) => v + LIMITE_PASO)}
          className="mt-4 flex h-10 items-center justify-center rounded-xl border border-aventurea-line px-5 text-[13px] font-bold text-aventurea-navy transition-colors hover:border-aventurea-navy"
        >
          Ver más reseñas
        </button>
      )}
    </div>
  );
}
