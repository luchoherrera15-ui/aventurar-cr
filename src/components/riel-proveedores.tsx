"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import RanchoCard, { type Calificacion } from "./rancho-card";
import { IconChevronLeft, IconChevronRight } from "./icons";
import type { Rancho } from "@/app/mi-negocio/types";

// En móvil se ven ~2 tarjetas completas más un asomo de la tercera,
// que es justo lo que invita a deslizar (45vw ronda eso en 360-430px).
// Más anchas a pedido: la foto manda y el bloque blanco es compacto.
const ANCHO_TARJETA = "clamp(240px, 70vw, 330px)";

/**
 * Fila horizontal con scroll-snap — la unidad básica del home (Fase 5).
 * Arriba a la derecha van las flechas ‹ › (estilo Airbnb) para pasar
 * de tarjetas sin arrastrar; se apagan cuando ya no hay más hacia ese
 * lado. En el teléfono además se puede deslizar con el dedo.
 */
export default function RielProveedores({
  titulo,
  subtitulo,
  items,
  verTodoHref,
  onVerTodo,
  calificaciones,
  proximasLibres,
  favoritosIds,
  sesionActiva,
  cardExtra,
  anchoTarjeta = ANCHO_TARJETA,
}: {
  titulo: string;
  subtitulo?: string;
  items: Rancho[];
  verTodoHref?: string;
  /** Alternativa a verTodoHref para contextos client-side: en vez de
   *  navegar, dispara una acción (ej. cambiar la pestaña de categoría). */
  onVerTodo?: () => void;
  calificaciones: Map<string, Calificacion>;
  proximasLibres: Map<string, string | null>;
  favoritosIds: Set<string>;
  sesionActiva: boolean;
  /** Tarjeta sembrada a mano al inicio del riel (ej. Invitaciones
   *  Digitales en "Otros servicios"). Recibe el mismo ancho que las
   *  demás vía render-prop. */
  cardExtra?: (ancho: string) => React.ReactNode;
  /** Ancho de cada tarjeta — el home lo achica para que sus 5 quepan
   *  sin scroll horizontal en desktop. */
  anchoTarjeta?: string;
}) {
  const rielRef = useRef<HTMLDivElement>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  const medir = useCallback(() => {
    const el = rielRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir, items.length]);

  function desplazar(direccion: -1 | 1) {
    const el = rielRef.current;
    if (!el) return;
    // Casi una pantalla por click: se conserva un asomo de la última
    // tarjeta visible para no perder el hilo.
    el.scrollBy({ left: direccion * el.clientWidth * 0.85, behavior: "smooth" });
  }

  // Un riel sin negocios igual se muestra si trae una tarjeta sembrada
  // (Invitaciones Digitales en "Otros servicios").
  if (items.length === 0 && !cardExtra) return null;

  const flechaCls =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aventurea-line bg-aventurea-surface text-aventurea-ink shadow-[0_1px_3px_rgba(16,26,44,0.08)] transition-all hover:shadow-[0_2px_8px_rgba(16,26,44,0.14)] disabled:opacity-35 disabled:shadow-none [&_svg]:h-4 [&_svg]:w-4";

  return (
    <section className="py-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[21px] font-bold leading-tight tracking-tight text-aventurea-ink">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="mt-1 max-w-[62ch] text-[14px] text-aventurea-ink-soft">{subtitulo}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          {onVerTodo ? (
            <button
              type="button"
              onClick={onVerTodo}
              className="whitespace-nowrap text-[13px] font-bold text-aventurea-ink underline underline-offset-2 hover:text-aventurea-navy"
            >
              Ver todo
            </button>
          ) : verTodoHref ? (
            <Link
              href={verTodoHref}
              className="whitespace-nowrap text-[13px] font-bold text-aventurea-ink underline underline-offset-2 hover:text-aventurea-navy"
            >
              Ver todo
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => desplazar(-1)}
            disabled={!puedeIzq}
            aria-label={`Tarjetas anteriores de ${titulo}`}
            className={flechaCls}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => desplazar(1)}
            disabled={!puedeDer}
            aria-label={`Más tarjetas de ${titulo}`}
            className={flechaCls}
          >
            <IconChevronRight />
          </button>
        </div>
      </div>

      <div
        ref={rielRef}
        onScroll={medir}
        className="mt-3.5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1 pt-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {cardExtra && <div className="snap-start">{cardExtra(anchoTarjeta)}</div>}
        {items.map((r, i) => (
          <div key={r.id} className="snap-start">
            <RanchoCard
              rancho={r}
              index={i}
              ancho={anchoTarjeta}
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
