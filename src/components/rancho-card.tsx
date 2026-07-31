"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconHeart, IconPin, IconStar } from "@/components/icons";
import {
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  SUBCATEGORIA_LABEL,
  UNIDAD_PRECIO_LABEL,
  type Rancho,
} from "@/app/mi-rancho/types";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/eventos/constants";
import { alternarFavorito } from "@/app/eventos/favoritos-actions";
import { esFechaHoy, fmtFechaCorta } from "@/lib/fechas";

export type Calificacion = { rancho_id: string; promedio: number; total: number };

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

/**
 * Tarjeta única para todo el marketplace: grilla de resultados y
 * rieles del home usan exactamente esta misma pieza. Fondo blanco,
 * foto cuadrada aparte del texto — nada de degradado ni botón
 * "Reservar" adentro; la tarjeta completa es el link.
 */
export default function RanchoCard({
  rancho,
  index = 0,
  calificacion,
  proximaLibre,
  favoritoInicial,
  sesionActiva,
  ancho,
}: {
  rancho: Rancho;
  index?: number;
  calificacion: Calificacion | null;
  /** undefined = no aplica (no es "lugares"); null = agotado; string = fecha ISO libre. */
  proximaLibre?: string | null;
  favoritoInicial: boolean;
  sesionActiva: boolean;
  /** Ancho CSS (ej. "220px" o un clamp()) para uso en riel horizontal; sin esto, ocupa el 100% de su celda de grilla. */
  ancho?: string;
}) {
  const esBookear = rancho.nombre === NOMBRE_RANCHO_BOOKEAR;
  const href = esBookear
    ? "/eventos-salon"
    : rancho.slug
      ? `/${rancho.slug}`
      : `/eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);
  // Cantón y provincia alcanzan: la dirección exacta se desbordaba y
  // quedaba cortada a media palabra.
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");
  // eslint-disable-next-line react-hooks/purity -- "nuevo" es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(rancho.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;

  const esDemo = !!rancho.slug?.startsWith("demo-");
  const rubro = rancho.subcategoria
    ? SUBCATEGORIA_LABEL[rancho.subcategoria]
    : CATEGORIA_LABEL[rancho.categoria];

  return (
    <article
      data-reveal
      className="h-full"
      // Tope en 6 para no hacer esperar de más a las cards de más
      // abajo en páginas grandes — el efecto ya se nota igual.
      style={
        {
          "--reveal-delay": `${Math.min(index, 6) * 60}ms`,
          ...(ancho ? { width: ancho, flex: `0 0 ${ancho}` } : {}),
        } as React.CSSProperties
      }
    >
      {/* El mismo lenguaje de la card de Citas: foto 16:10 con el
          rubro encima, cuerpo blanco con nombre + nota, ubicación y el
          pie "Desde ₡ · Reservar →". Una sola card en todo el sitio. */}
      <Link
        href={href}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(22,41,94,0.4)]"
      >
        {/* 4:3 en vez de 16:10 — la foto es la protagonista y el
            bloque blanco de abajo queda lo más chico posible. */}
        <div
          className="relative aspect-[4/3] overflow-hidden bg-aventurea-blue-light"
          style={
            !rancho.foto_url ? { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] } : undefined
          }
        >
          {rancho.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- fotos externas subidas por cada proveedor, sin dominio fijo para next/image
            <img
              src={rancho.foto_url}
              alt={rancho.nombre}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-12 [&_svg]:w-12">
              {CATEGORIA_ICONO[rancho.categoria]}
            </span>
          )}

          <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
            {rubro}
          </span>

          <span className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {esDemo && (
              <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
                Demo
              </span>
            )}
            {/* Destacado le gana el puesto a "Nuevo". */}
            {rancho.destacado_orden != null ? (
              <span className="rounded-lg bg-aventurea-orange px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-sm">
                ★ Destacado
              </span>
            ) : (
              esNuevo && (
                <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink backdrop-blur">
                  Nuevo
                </span>
              )
            )}
          </span>

          <BotonFavorito ranchoId={rancho.id} inicial={favoritoInicial} sesionActiva={sesionActiva} />
        </div>

        <div className="flex flex-1 flex-col px-4 pb-3 pt-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold leading-snug text-aventurea-ink">
              {rancho.nombre}
            </h3>
            {calificacion && (
              <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[12.5px] font-bold text-aventurea-ink">
                <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
                {calificacion.promedio.toFixed(1).replace(".", ",")}
                <span className="font-semibold text-aventurea-ink-soft">
                  ({calificacion.total})
                </span>
              </span>
            )}
          </div>
          {ubicacion && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-aventurea-ink-soft">
              <IconPin className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />
              {ubicacion}
            </p>
          )}

          {rancho.categoria === "lugares" && proximaLibre !== undefined && (
            <span
              className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
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

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-aventurea-line/70 pt-2.5">
            <span className="min-w-0 truncate text-[12.5px] text-aventurea-ink-soft">
              {precio ? (
                <>
                  Desde <strong className="font-extrabold text-aventurea-ink">{precio}</strong>
                  <span className="hidden sm:inline"> {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}</span>
                </>
              ) : (
                "Consultar"
              )}
            </span>
            <span className="shrink-0 text-[13px] font-extrabold text-aventurea-orange">
              Reservar →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function BotonFavorito({
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
      className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110 disabled:opacity-70"
    >
      <IconHeart className={`h-4 w-4 ${activo ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`} />
    </button>
  );
}
