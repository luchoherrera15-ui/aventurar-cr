"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import RanchoCard, { type Calificacion } from "./rancho-card";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import type { Rancho } from "@/app/mi-negocio/types";

// En móvil se ven ~2 tarjetas completas más un asomo de la tercera,
// que es justo lo que invita a deslizar (45vw ronda eso en 360-430px).
// Más anchas a pedido: la foto manda y el bloque blanco es compacto.
// Sube de 330 a 360 acompañando el ensanche de la portada: con la foto
// ya en 16/10 (ver `rancho-card.tsx`), dejarla en 330 haría que estas
// tarjetas se vieran más chatas que las de la portada en la misma
// visita.
const ANCHO_TARJETA = "clamp(260px, 74vw, 360px)";

/**
 * El `sizes` que se corresponde con ese ancho, traducido a algo que el
 * navegador pueda resolver ANTES de tener el CSS: en teléfono la
 * tarjeta ocupa el 70% del ancho de pantalla y en escritorio se planta
 * en 330 px. El default de `RanchoCard` describe la grilla del
 * directorio (45vw / 30vw / 260px) y acá se quedaba corto: en un
 * teléfono de 390 px pedía una foto para 175 px cuando la ranura mide
 * 273, y en escritorio una para 260 cuando mide 330.
 */
const SIZES_TARJETA = "(max-width: 471px) 74vw, 360px";

/**
 * Fila horizontal con scroll-snap — la unidad básica del home (Fase 5).
 * Arriba a la derecha van las flechas ‹ › para pasar de tarjetas sin
 * arrastrar: aparecen SOLO si la fila desborda, y se apagan cuando ya no
 * hay más hacia ese lado. En el teléfono además se puede deslizar con el
 * dedo.
 *
 * Con pocas tarjetas la fila no se estira: cada `RanchoCard` lleva un
 * ancho fijo (`ANCHO_TARJETA`), así que un riel de un solo negocio queda
 * corto y alineado a la izquierda en vez de una tarjeta deforme de 1200
 * px de ancho.
 */
export default function RielProveedores({
  titulo,
  subtitulo,
  conteo,
  items,
  verTodoHref,
  verTodoTexto = "Ver todo",
  onVerTodo,
  calificaciones,
  proximasLibres,
  favoritosIds,
  sesionActiva,
  cardExtra,
  prioridad = true,
  anchoTarjeta = ANCHO_TARJETA,
  sizesTarjeta = SIZES_TARJETA,
}: {
  titulo: string;
  subtitulo?: string;
  /**
   * Cuántos negocios tiene la fila DE VERDAD, antes del tope de
   * tarjetas. Se pinta al lado del título («Eventos · 14 negocios»).
   *
   * Opcional porque no toda fila tiene un número honesto que mostrar:
   * los carriles del directorio de Eventos son una vista filtrada de
   * una lista que el visitante ya está viendo entera. Cuando se pasa,
   * tiene que salir de la MISMA lista que alimenta el `verTodoHref`, o
   * el número no va a cuadrar con lo que se ve del otro lado del clic.
   */
  conteo?: number;
  items: Rancho[];
  verTodoHref?: string;
  /** El texto del enlace. Por defecto «Ver todo». */
  verTodoTexto?: string;
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
  /**
   * Si las tarjetas muestran la unidad del precio. Se pasa tal cual a
   * `RanchoCard` — ver allá el porqué. En la portada va en `false`
   * porque el riel mezcla verticales y `unidad_precio` arrastra el
   * 'evento' por defecto de la 0033.
   */
  /**
   * Si la PRIMERA tarjeta de este riel pelea por el ancho de banda
   * (`eager` + `fetchPriority=high` en su foto).
   *
   * Por defecto sí, que es como funcionó siempre. Se apaga cuando hay
   * varios rieles en la misma pantalla: la portada pasó de un riel a
   * seis carriles, y con el default cada uno marcaba una foto como
   * prioritaria — seis imágenes compitiendo con el héroe justo en lo
   * que Google mide. Solo el primer carril de la página lo deja en
   * `true`.
   */
  prioridad?: boolean;
  /**
   * Ancho CSS por tarjeta y su `sizes` correspondiente. Por defecto los
   * de siempre (`ANCHO_TARJETA`/`SIZES_TARJETA`, pensados para el
   * directorio de Eventos). La portada pasa un par más chico —"un poco
   * más pequeños" fue el pedido puntual del dueño para esta página—
   * sin tocar el directorio real, que sigue con el tamaño de siempre.
   */
  anchoTarjeta?: string;
  sizesTarjeta?: string;
}) {
  const rielRef = useRef<HTMLDivElement>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);
  // ¿Sobra fila para el costado? Si TODAS las tarjetas caben en
  // pantalla, las flechas no se dibujan: dos botones permanentemente
  // apagados al lado de un título son ruido, y en la portada —donde una
  // vertical puede tener un solo negocio publicado— se leen como un
  // control roto. Arranca en false: es mejor que aparezcan después de
  // medir a que parpadeen y se vayan.
  const [hayDesborde, setHayDesborde] = useState(false);
  // El scroller se nombra con el título de la fila: sin esto, un lector
  // de pantalla anuncia media docena de regiones desplazables idénticas.
  const idTitulo = useId();
  // Las flechas mueven la fila SIN animar cuando el visitante pidió
  // movimiento reducido. Es la misma regla que ya aplica el carrusel de
  // súper destacados; faltaba acá, que es la pieza más repetida del
  // sitio.
  const movimientoReducido = useMovimientoReducido();

  const medir = useCallback(() => {
    const el = rielRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    setHayDesborde(el.scrollWidth > el.clientWidth + 4);
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
    el.scrollBy({
      left: direccion * el.clientWidth * 0.85,
      behavior: movimientoReducido ? "auto" : "smooth",
    });
  }

  // Un riel sin negocios igual se muestra si trae una tarjeta sembrada
  // (Invitaciones Digitales en "Otros servicios").
  if (items.length === 0 && !cardExtra) return null;

  // `hidden sm:flex`: son botones de 32 px, muy por debajo del objetivo
  // táctil de 44 que el resto del sitio respeta, y en un teléfono no
  // hacen falta — ahí el gesto natural es deslizar la fila con el dedo,
  // que ya funciona. En escritorio, donde no hay gesto, siguen siendo la
  // única forma de pasar de tarjetas sin arrastrar.
  const flechaCls =
    "hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aventurea-line bg-aventurea-surface text-aventurea-ink shadow-[0_1px_3px_rgba(16,26,44,0.08)] transition-all hover:shadow-[0_2px_8px_rgba(16,26,44,0.14)] disabled:opacity-35 disabled:shadow-none sm:flex [&_svg]:h-4 [&_svg]:w-4";

  return (
    <section className="py-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2
            id={idTitulo}
            className="flex flex-wrap items-baseline gap-x-2.5 text-[21px] font-bold leading-tight tracking-tight text-aventurea-ink"
          >
            {titulo}
            {/* El conteo real, en gris y en tamaño de nota: es
                información, no un titular. Sale de la misma lista que
                el «Ver todo», así que cuadra con lo que se ve del otro
                lado del clic. Nunca se redondea ni se adorna con un
                «+»: acá no se inventan cifras. */}
            {typeof conteo === "number" && (
              <span className="text-[13px] font-semibold text-aventurea-ink-soft">
                {conteo} {conteo === 1 ? "negocio" : "negocios"}
              </span>
            )}
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
              {verTodoTexto}
            </Link>
          ) : null}
          {/* Solo si de verdad hay algo para el costado. Ver `hayDesborde`. */}
          {hayDesborde && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Una región desplazable con nombre: quien navega con lector de
          pantalla la encuentra como «Salones de belleza, grupo» en vez
          de tropezarse con seis cajas sin identificar. El nombre sale
          del `<h2>` de arriba, no de una cadena repetida. */}
      <div
        ref={rielRef}
        onScroll={medir}
        role="group"
        aria-labelledby={idTitulo}
        // Una región que scrollea tiene que poder recorrerse con el
        // teclado: con el foco acá, las flechas ← → mueven la fila sin
        // tocar el mouse. Solo cuando de verdad desborda — si todas las
        // tarjetas caben, este tab stop no llevaría a ninguna parte.
        tabIndex={hayDesborde ? 0 : undefined}
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
              sizes={sizesTarjeta}
              calificacion={calificaciones.get(r.id) ?? null}
              proximaLibre={r.categoria === "lugares" ? proximasLibres.get(r.id) : undefined}
              favoritoInicial={favoritosIds.has(r.id)}
              sesionActiva={sesionActiva}
              prioridad={prioridad && i === 0}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
