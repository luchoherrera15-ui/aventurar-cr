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
import type { Calificacion } from "@/components/rancho-card";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

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
  const esBookear = rancho.nombre === NOMBRE_RANCHO_BOOKEAR;
  const href = esBookear
    ? "/eventos-salon"
    : rancho.slug
      ? `/${rancho.slug}`
      : `/eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");
  // eslint-disable-next-line react-hooks/purity -- "nuevo" es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(rancho.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;

  // El collage: portada + hasta 2 miniaturas, sin repetir la portada.
  const portada = rancho.foto_url ?? rancho.fotos[0] ?? null;
  const secundarias = rancho.fotos.filter((f) => f !== portada).slice(0, 2);
  const fotosExtra = Math.max(
    0,
    rancho.fotos.filter((f) => f !== portada).length - 2,
  );

  const rubro = rancho.subcategoria
    ? SUBCATEGORIA_LABEL[rancho.subcategoria]
    : CATEGORIA_LABEL[rancho.categoria];

  return (
    <article
      data-reveal
      style={{ "--reveal-delay": `${Math.min(index, 6) * 60}ms` } as React.CSSProperties}
      className="h-full"
    >
      <Link
        href={href}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm transition-shadow hover:shadow-[0_12px_32px_rgba(16,26,44,0.14)]"
      >
        {/* ---------- Collage de fotos ---------- */}
        <div className="relative h-[210px]">
          <div
            className={`grid h-full gap-1 ${secundarias.length > 0 ? "grid-cols-3" : "grid-cols-1"}`}
          >
            <div
              className={`relative overflow-hidden ${secundarias.length > 0 ? "col-span-2" : ""}`}
              style={
                !portada
                  ? { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
                  : undefined
              }
            >
              {portada ? (
                // eslint-disable-next-line @next/next/no-img-element -- fotos externas subidas por cada proveedor, sin dominio fijo para next/image
                <img
                  src={portada}
                  alt={rancho.nombre}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-12 [&_svg]:w-12">
                  {CATEGORIA_ICONO[rancho.categoria]}
                </span>
              )}
              {fotosExtra > 0 && (
                <span className="absolute bottom-2 right-2 rounded-md bg-aventurea-navy/85 px-2 py-1 text-[11px] font-bold text-white">
                  +{fotosExtra} fotos
                </span>
              )}
            </div>
            {secundarias.length > 0 && (
              <div className="grid grid-rows-2 gap-1">
                {secundarias.map((f) => (
                  <div key={f} className="relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- fotos externas subidas por cada proveedor */}
                    <img
                      src={f}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                ))}
                {secundarias.length === 1 && (
                  <div style={{ backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }} />
                )}
              </div>
            )}
          </div>

          {rancho.destacado_orden != null ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-aventurea-orange px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_2px_7px_rgba(0,0,0,.2)]">
              ★ Destacado
            </span>
          ) : esNuevo && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-aventurea-ink shadow-[0_2px_7px_rgba(0,0,0,.16)]">
              Nuevo
            </span>
          )}
        </div>

        {/* ---------- La info, con aire ---------- */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16.5px] font-bold leading-snug tracking-tight text-aventurea-navy">
              {rancho.nombre}
            </h3>
            <CorazonFavorito
              ranchoId={rancho.id}
              inicial={favoritoInicial}
              sesionActiva={sesionActiva}
            />
          </div>

          {calificacion ? (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-aventurea-ink">
              <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
              <span className="font-bold">
                {calificacion.promedio.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-aventurea-ink-soft">
                ({calificacion.total} reseña{calificacion.total === 1 ? "" : "s"}{" "}
                verificada{calificacion.total === 1 ? "" : "s"})
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
              Sin reseñas todavía
            </p>
          )}

          <div className="my-3 h-px bg-aventurea-line" />

          <div className="flex flex-col gap-1.5 text-[13px] text-aventurea-ink">
            {ubicacion && (
              <p className="flex items-center gap-2">
                <IconPin className="h-3.5 w-3.5 shrink-0 text-aventurea-orange" />
                {ubicacion}
              </p>
            )}
            <p className="flex items-center gap-2">
              <span className="text-aventurea-orange [&_svg]:h-3.5 [&_svg]:w-3.5">
                {CATEGORIA_ICONO[rancho.categoria]}
              </span>
              {rubro}
            </p>
            <p className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[11px] font-bold text-aventurea-orange">
                ₡
              </span>
              {precio ? (
                <>
                  <span className="font-bold">{precio}</span>
                  <span className="text-aventurea-ink-soft">
                    {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}
                  </span>
                </>
              ) : (
                <span className="text-aventurea-ink-soft">Precio a consultar</span>
              )}
            </p>
          </div>

          {resena && (
            <p className="mt-3 line-clamp-2 border-l-2 border-aventurea-orange/40 pl-2.5 text-[12.5px] italic leading-relaxed text-aventurea-ink-soft">
              “{resena}” — Cliente verificado
            </p>
          )}

          {rancho.categoria === "lugares" && proximaLibre !== undefined && (
            <span
              className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
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

          <span className="mt-auto block pt-4">
            <span className="flex h-11 items-center justify-center rounded-xl bg-aventurea-orange text-[13.5px] font-bold text-white transition-colors group-hover:bg-aventurea-orange-dark">
              {rancho.categoria === "lugares" ? "Reservar fecha" : "Ver y reservar"}
            </span>
          </span>
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
          ? "border-aventurea-orange bg-aventurea-orange/10"
          : "border-aventurea-line bg-aventurea-cream-2"
      }`}
    >
      <IconHeart
        className={`h-4 w-4 ${activo ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`}
      />
    </button>
  );
}
