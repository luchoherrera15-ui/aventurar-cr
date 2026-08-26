"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconHeart, IconPin, IconStar } from "@/components/icons";
import {
  SUBCATEGORIA_LABEL,
  enConfiguracion,
  type Rancho,
} from "@/app/mi-negocio/types";
import InsigniaVerificado, { selloDe } from "@/components/insignia-verificado";
import {
  categoriaGradiente,
  categoriaIcono,
  categoriaLabel,
  esCategoriaValida,
} from "@/lib/categorias-vertical";
import { alternarFavorito } from "@/app/eventos/favoritos-actions";
import { esFechaHoy, fmtFechaCorta } from "@/lib/fechas";
import type { Calificacion } from "@/components/rancho-card";

/**
 * La tarjeta grande de la vista por categoría / búsqueda: collage de
 * fotos arriba (portada + dos miniaturas y el contador de las que
 * faltan), la info con más aire abajo — calificación, ubicación,
 * rubro, precio y una reseña real citada — y un botón de reservar con
 * color. Los rieles del home siguen usando la RanchoCard compacta.
 *
 * El corazón de favorito vive acá junto al nombre, no encima de la
 * foto: la foto queda limpia y el corazón no compite con los badges.
 */
export default function RanchoCardGrande({
  rancho,
  index = 0,
  calificacion,
  resena,
  proximaLibre,
  favoritoInicial,
  sesionActiva,
}: {
  rancho: Rancho;
  index?: number;
  calificacion: Calificacion | null;
  /** El comentario más reciente con texto, para citarlo. */
  resena: string | null;
  /** undefined = no aplica (no es "lugares"); null = agotado; string = fecha ISO libre. */
  proximaLibre?: string | null;
  favoritoInicial: boolean;
  sesionActiva: boolean;
}) {
  const href = rancho.slug ? `/${rancho.slug}` : `/eventos/${rancho.id}`;
  // En configuración: visible en el directorio pero sin poder abrirse.
  const enPausa = enConfiguracion(rancho.detalles);
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");
  // eslint-disable-next-line react-hooks/purity -- "nuevo" es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(rancho.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;

  // Collage de tres: la portada manda (dos tercios del ancho) y al lado
  // van dos miniaturas del álbum. Un salón se elige por cómo se ve, y
  // una sola foto no alcanza para mostrar el lugar. Si el dueño subió
  // menos fotos, el bloque se acomoda solo: con dos queda partido en
  // dos, con una la portada ocupa todo.
  const portada = rancho.foto_url ?? rancho.fotos[0] ?? null;
  const galeria = rancho.fotos.filter((f) => f !== portada);
  const miniaturas = galeria.slice(0, 2);
  const fotosExtra = Math.max(0, galeria.length - miniaturas.length);
  const esDemo = !!rancho.slug?.startsWith("demo-");

  // Esta card se usa en Eventos, Hospedajes y favoritos de cualquier
  // vertical: rubro, ícono y gradiente salen del helper por vertical
  // (categorias-vertical.ts), que ya sabe caer a "otros" si la
  // categoría no matchea.
  const rubro = rancho.subcategoria
    ? SUBCATEGORIA_LABEL[rancho.subcategoria]
    : esCategoriaValida(rancho.vertical ?? "eventos", rancho.categoria)
      ? categoriaLabel(rancho.vertical ?? "eventos", rancho.categoria)
      : rancho.categoria;

  return (
    <article
      data-reveal
      style={{ "--reveal-delay": `${Math.min(index, 6) * 60}ms` } as React.CSSProperties}
      className="h-full"
    >
      <Link
        href={enPausa ? "#" : href}
        aria-disabled={enPausa || undefined}
        tabIndex={enPausa ? -1 : undefined}
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-[0_10px_36px_-20px_rgba(16,26,44,0.3)] transition-all ${
          enPausa
            ? "pointer-events-none"
            : "hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(16,26,44,0.4)]"
        }`}
      >
        {/* ---------- El collage con sus insignias ---------- */}
        <div
          className="relative aspect-[16/9] overflow-hidden"
          style={
            !portada
              ? { backgroundImage: categoriaGradiente(rancho.vertical ?? "eventos", rancho.categoria) }
              : undefined
          }
        >
          {/* El velo de "en configuración": la publicación se ve pero
              todavía no se puede abrir. */}
          {enPausa && (
            <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-aventurea-navy/70 px-4 text-center backdrop-blur-[2px]">
              <span className="rounded-lg bg-white/95 px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-wide text-aventurea-navy">
                En configuración
              </span>
              <span className="text-[12.5px] font-bold leading-snug text-white/85">
                Muy pronto disponible para reservar
              </span>
            </span>
          )}

          {portada ? (
            <div className="absolute inset-0 flex gap-[3px]">
              <div className="relative flex-1 overflow-hidden">
                <Image
                  src={portada}
                  alt={rancho.nombre}
                  fill
                  // Misma razón que en la card compacta: la portada de
                  // la primera tarjeta de la grilla es el LCP y estaba
                  // en `lazy`.
                  loading={index === 0 ? "eager" : undefined}
                  fetchPriority={index === 0 ? "high" : undefined}
                  // ── POR QUÉ ESTOS NÚMEROS Y NO OTROS ──
                  //
                  // La grilla es 1 / 2 / 3 columnas (gap-5) dentro de un
                  // contenedor de max-w-[1600px] con px-6. La portada
                  // ocupa el 68% de la tarjeta (el 32% restante son las
                  // miniaturas, más 3px de separación).
                  //
                  //   1 col            → ~64vw
                  //   2 col (≤1279px)  → tarjeta ~48vw → portada ~33vw
                  //   3 col (≥1280px)  → tarjeta 504px → portada ~345px
                  //
                  // Estaba declarado "340px" para TODOS los anchos, y en
                  // dos columnas la portada llega a ~408px: el navegador
                  // pedía un candidato para 340 y lo estiraba. En una
                  // pantalla DPR2 eso se ve.
                  sizes="(max-width: 640px) 64vw, (max-width: 1279px) 33vw, 345px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {miniaturas.length > 0 && (
                <div className="flex w-[32%] shrink-0 flex-col gap-[3px]">
                  {miniaturas.map((foto, i) => (
                    <div key={foto} className="relative flex-1 overflow-hidden">
                      <Image
                        src={foto}
                        alt={`${rancho.nombre} — foto ${i + 2}`}
                        fill
                        // 32% de la tarjeta: hasta ~194px en dos
                        // columnas y ~161px en tres. Estaba en "120px"
                        // fijo — un 40% menos de lo que se dibuja, que
                        // en DPR2 obliga a estirar el candidato de 256
                        // hasta casi 400. Eran las más borrosas de la
                        // tarjeta.
                        sizes="(max-width: 640px) 30vw, (max-width: 1279px) 16vw, 165px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-12 [&_svg]:w-12">
              {categoriaIcono(rancho.vertical ?? "eventos", rancho.categoria)}
            </span>
          )}

          {/* El rubro, como la categoría en Citas. */}
          {/* ⚠️ `max-w` + `truncate`: este chip y las insignias de la
              derecha son los DOS absolutos, así que no se empujan — se
              tapan. Con «Ranchos para fiestas» y la insignia de
              verificado se pisaban 30 px, medidos, y el rubro quedaba
              cortado a media palabra debajo del verde.

              El tope va en % y no en px porque esta tarjeta se usa a
              anchos distintos (riel, grilla, favoritos): en px, el que
              funciona en la grilla aprieta de más en el riel. */}
          <span className="absolute left-3 top-3 max-w-[45%] truncate rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
            {rubro}
          </span>

          <span className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {esDemo && (
              <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
                Demo
              </span>
            )}
            {rancho.destacado_orden != null && (
              <span className="rounded-lg bg-aventurea-sky px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-sm">
                ★ Destacado
              </span>
            )}
            {/* Ver `rancho-card.tsx` para por qué reemplaza a «Nuevo» en vez de sumarse. */}
            {selloDe(rancho) ? (
              <InsigniaVerificado estado={selloDe(rancho)!} sobreFoto />
            ) : (
              esNuevo && (
                <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink backdrop-blur">
                  Nuevo
                </span>
              )
            )}
          </span>

          {fotosExtra > 0 && (
            <span className="absolute bottom-2.5 right-2.5 rounded-md bg-aventurea-navy/85 px-2 py-1 text-[11px] font-bold text-white">
              +{fotosExtra} foto{fotosExtra === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* ---------- Cuerpo, igual que la card de Citas ---------- */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex-1 text-[15px] font-extrabold leading-snug text-aventurea-ink">
              {rancho.nombre}
            </h3>
            {calificacion && (
              <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[12.5px] font-bold text-aventurea-ink">
                <IconStar className="h-3.5 w-3.5 text-bookea-naranja-fuerte" />
                {calificacion.promedio.toFixed(1).replace(".", ",")}
                <span className="font-semibold text-aventurea-ink-soft">
                  ({calificacion.total})
                </span>
              </span>
            )}
            <CorazonFavorito
              ranchoId={rancho.id}
              inicial={favoritoInicial}
              sesionActiva={sesionActiva}
            />
          </div>

          {ubicacion && (
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-aventurea-ink-soft">
              <IconPin className="h-3.5 w-3.5 shrink-0 text-bookea-naranja-fuerte" /> {ubicacion}
            </p>
          )}

          {resena && (
            <p className="mt-2.5 line-clamp-2 border-l-2 border-aventurea-sky/40 pl-2.5 text-[12.5px] italic leading-relaxed text-aventurea-ink-soft">
              “{resena}” — Cliente verificado
            </p>
          )}

          {rancho.categoria === "lugares" && proximaLibre !== undefined && (
            <span
              className={`mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                proximaLibre
                  ? "border-aventurea-navy text-aventurea-navy"
                  : "border-aventurea-line text-zinc-500"
              }`}
            >
              <i
                aria-hidden
                className={`h-1 w-1 rounded-full ${proximaLibre ? "bg-aventurea-navy" : "bg-zinc-300"}`}
              />
              {proximaLibre
                ? esFechaHoy(proximaLibre)
                  ? "Libre ahora"
                  : `Libre desde ${fmtFechaCorta(proximaLibre)}`
                : "Agotado"}
            </span>
          )}

          {/* ⚠️ ACÁ IBA «Desde ₡X» Y SE SACÓ A PEDIDO DEL DUEÑO (26 ago
              2026): «en los CARDS quitá lo de desde y que sale el precio
              más bajo».

              El dato tenía un problema de fondo: `precio_desde` es UN
              número para un negocio que vende MUCHAS cosas a precios
              distintos. En un salón de eventos casi es el precio; en una
              barbería con veinte servicios, «desde ₡5.000» es el corte
              más barato y no dice nada de lo que la persona va a pagar
              — pero le ancla la expectativa igual, y se la ancla mal.

              El precio de verdad vive en la ficha, servicio por
              servicio, que es donde se puede leer sin que engañe.

              NO se tocó la ficha del negocio (`rancho-portal.tsx`) ni la
              descripción que sale en Google (`lib/seo-negocio.ts`): ahí
              el precio va con el contexto que lo hace cierto. */}
          {/* Pie: solo la acción, alineada a la derecha como estaba. */}
          <div className="mt-auto flex items-center justify-end border-t border-aventurea-line/70 pt-3">
            <span
              className={`text-[13px] font-extrabold ${
                enPausa ? "text-aventurea-ink-soft" : "text-bookea-naranja-fuerte"
              }`}
            >
              {enPausa
                ? "No disponible aún"
                : rancho.categoria === "lugares"
                  ? "Reservar fecha →"
                  : "Reservar →"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

/** El corazón junto al nombre — chip con borde, no flotando en la foto. */
function CorazonFavorito({
  ranchoId,
  inicial,
  sesionActiva,
}: {
  ranchoId: string;
  inicial: boolean;
  sesionActiva: boolean;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(inicial);
  const [pending, startTransition] = useTransition();

  function alternar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!sesionActiva) {
      router.push("/cuenta");
      return;
    }
    const nuevo = !activo;
    setActivo(nuevo);
    startTransition(async () => {
      const res = await alternarFavorito(ranchoId, nuevo);
      if (res?.error) setActivo(!nuevo);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pending}
      aria-label={activo ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={activo}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all hover:scale-105 disabled:opacity-70 ${
        activo
          ? "border-aventurea-sky bg-aventurea-sky/10"
          : "border-aventurea-line bg-aventurea-cream-2"
      }`}
    >
      <IconHeart
        className={`h-4 w-4 ${activo ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`}
      />
    </button>
  );
}
