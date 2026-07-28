"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconHeart, IconPin, IconStar } from "@/components/icons";
import {
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  UNIDAD_PRECIO_LABEL,
  type Rancho,
} from "@/app/mi-rancho/types";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/ranchos-eventos/constants";
import { alternarFavorito } from "@/app/ranchos-eventos/favoritos-actions";
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
      : `/ranchos-eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);
  // Cantón y provincia alcanzan: la dirección exacta se desbordaba y
  // quedaba cortada a media palabra.
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");
  // eslint-disable-next-line react-hooks/purity -- "nuevo" es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(rancho.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;

  return (
    <article
      data-reveal
      // Tope en 6 para no hacer esperar de más a las cards de más
      // abajo en páginas grandes — el efecto ya se nota igual.
      style={
        {
          "--reveal-delay": `${Math.min(index, 6) * 60}ms`,
          ...(ancho ? { width: ancho, flex: `0 0 ${ancho}` } : {}),
        } as React.CSSProperties
      }
    >
      <Link href={href} className="group block">
        <div
          className="relative aspect-square overflow-hidden rounded-[13px]"
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
          {esNuevo && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-aventurea-ink shadow-[0_2px_7px_rgba(0,0,0,.16)]">
              Nuevo
            </span>
          )}
          <BotonFavorito ranchoId={rancho.id} inicial={favoritoInicial} sesionActiva={sesionActiva} />
        </div>

        <h3 className="mt-2.5 truncate text-[15px] font-semibold tracking-tight text-aventurea-ink">
          {rancho.nombre}
        </h3>
        {ubicacion && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-aventurea-ink-soft">
            <IconPin className="h-3 w-3 shrink-0" />
            {ubicacion}
          </p>
        )}
        <p className="mt-0.5 text-[13.5px] text-aventurea-ink-soft">
          <span className="font-bold text-aventurea-ink">{precio ?? "Consultar"}</span>
          {precio && ` ${UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}`}
          {calificacion && (
            <>
              {" "}
              · <IconStar className="mb-0.5 inline-block h-2.5 w-2.5 text-aventurea-ink" />{" "}
              {calificacion.promedio.toFixed(2).replace(".", ",")}
            </>
          )}
        </p>

        {rancho.categoria === "lugares" && proximaLibre !== undefined && (
          <span
            className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
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
      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center transition-transform hover:scale-110 disabled:opacity-70"
    >
      <IconHeart className={`h-[22px] w-[22px] ${activo ? "text-aventurea-orange" : "text-black/30"}`} />
    </button>
  );
}
