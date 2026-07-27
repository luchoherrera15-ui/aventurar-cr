import Link from "next/link";
import RanchoCard, { type Calificacion } from "./rancho-card";
import type { Rancho } from "@/app/mi-rancho/types";

// En móvil se ven ~2 tarjetas completas más un asomo de la tercera,
// que es justo lo que invita a deslizar (45vw ronda eso en 360-430px).
const ANCHO_TARJETA = "clamp(158px, 45vw, 240px)";

/**
 * Fila horizontal con scroll-snap — la unidad básica del home (Fase 5).
 * En móvil se ven ~2 tarjetas completas más un asomo de la tercera,
 * que es justo lo que invita a deslizar.
 */
export default function RielProveedores({
  titulo,
  subtitulo,
  items,
  verTodoHref,
  calificaciones,
  proximasLibres,
  favoritosIds,
  sesionActiva,
}: {
  titulo: string;
  subtitulo?: string;
  items: Rancho[];
  verTodoHref?: string;
  calificaciones: Map<string, Calificacion>;
  proximasLibres: Map<string, string | null>;
  favoritosIds: Set<string>;
  sesionActiva: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="py-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-[21px] font-bold leading-tight tracking-tight text-aventurea-ink">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="mt-1 max-w-[62ch] text-[14px] text-aventurea-ink-soft">{subtitulo}</p>
          )}
        </div>
        {verTodoHref && (
          <Link
            href={verTodoHref}
            aria-label={`Ver todo: ${titulo}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink transition-colors hover:bg-zinc-200"
          >
            →
          </Link>
        )}
      </div>

      <div
        className="mt-3.5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1 pt-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((r, i) => (
          <div key={r.id} className="snap-start">
            <RanchoCard
              rancho={r}
              index={i}
              ancho={ANCHO_TARJETA}
              calificacion={calificaciones.get(r.id) ?? null}
              proximaLibre={r.categoria === "lugares" ? proximasLibres.get(r.id) : undefined}
              favoritoInicial={favoritosIds.has(r.id)}
              sesionActiva={sesionActiva}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
