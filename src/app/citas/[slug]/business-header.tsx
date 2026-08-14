"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconHeart, IconPin, IconStar } from "@/components/icons";
import { alternarFavorito } from "@/app/eventos/favoritos-actions";
import type { EstadoApertura } from "./perfil-tipos";

/**
 * A partir de qué largo se pliega la descripción tras "Ver más". No
 * hay forma de medir el DOM real desde el server (line-clamp-3 recorta
 * en CSS, no en JS), así que se aproxima por caracteres — a este ancho
 * de columna, ~220 caracteres son más o menos 3 líneas.
 */
const LARGO_DESCRIPCION_CORTA = 220;

/**
 * El encabezado del perfil público: nombre, insignia de verificado (si
 * aplica), nota + reseñas, ubicación, estado abierto/cerrado,
 * Guardar/Compartir y la descripción con "Ver más". Es la primera
 * pieza de identidad del negocio — todo lo demás (galería, servicios,
 * equipo) cuelga debajo.
 */
export default function BusinessHeader({
  nombre,
  categoriaLabel,
  promedio,
  totalResenas,
  ubicacion,
  distanciaKm,
  estadoApertura,
  verificado = false,
  ranchoId,
  favoritoInicial,
  sesionActiva,
  descripcion,
}: {
  nombre: string;
  categoriaLabel: string;
  promedio: number | null;
  totalResenas: number;
  ubicacion: string | null;
  /** Casi siempre null hoy: no hay geolocalización conectada todavía. */
  distanciaKm: number | null;
  estadoApertura: EstadoApertura;
  /** HOY no existe ningún negocio verificado de verdad — default false, nunca true. */
  verificado?: boolean;
  ranchoId: string;
  favoritoInicial: boolean;
  sesionActiva: boolean;
  descripcion: string | null;
}) {
  const router = useRouter();
  const [guardado, setGuardado] = useState(favoritoInicial);
  const [pendiente, startTransition] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [descripcionAbierta, setDescripcionAbierta] = useState(false);

  // Mismo patrón optimista que BotonFavorito en rancho-card.tsx:
  // pinta el corazón de una vez y solo lo revierte si la acción falla.
  function alternarGuardado() {
    if (!sesionActiva) {
      router.push("/cuenta");
      return;
    }
    const nuevo = !guardado;
    setGuardado(nuevo);
    startTransition(async () => {
      const res = await alternarFavorito(ranchoId, nuevo);
      if (res?.error) setGuardado(!nuevo);
    });
  }

  async function compartir() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: nombre, url });
      } catch {
        // La persona cerró el panel nativo de compartir sin elegir
        // nada — no es un error que valga la pena mostrar.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: no hay mucho más que ofrecer acá.
    }
  }

  const descripcionLarga = (descripcion?.length ?? 0) > LARGO_DESCRIPCION_CORTA;

  return (
    <div className="rounded-3xl border border-aventurea-line bg-white p-6 shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)] sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block w-fit rounded-lg bg-aventurea-blue-light px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy">
            {categoriaLabel}
          </span>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="text-[clamp(22px,3vw,30px)] font-black leading-tight tracking-[-0.6px] text-aventurea-ink">
              {nombre}
            </h1>
            {verificado && (
              <span className="flex items-center gap-1 rounded-lg bg-aventurea-green-light px-2 py-0.5 text-[11px] font-extrabold text-aventurea-green">
                <IconCheck className="h-3 w-3" /> Verificado
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={alternarGuardado}
            disabled={pendiente}
            aria-label={guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
            aria-pressed={guardado}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-aventurea-line text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-70"
          >
            <IconHeart className={`h-4 w-4 ${guardado ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`} />
          </button>
          <button
            type="button"
            onClick={compartir}
            className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-aventurea-line px-3.5 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
          >
            {copiado ? "¡Copiado!" : "Compartir"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-aventurea-ink-soft">
        {totalResenas > 0 && promedio != null ? (
          <span className="flex items-center gap-1 font-bold text-aventurea-ink">
            <IconStar className="h-4 w-4 text-aventurea-orange" />
            {promedio.toFixed(1).replace(".", ",")}
            <span className="font-semibold text-aventurea-ink-soft">
              ({totalResenas} {totalResenas === 1 ? "reseña" : "reseñas"})
            </span>
          </span>
        ) : (
          <span className="font-bold text-aventurea-ink-soft">Sin reseñas todavía</span>
        )}
        {ubicacion && (
          <span className="flex items-center gap-1.5">
            <IconPin className="h-3.5 w-3.5 text-aventurea-navy" />
            {ubicacion}
            {distanciaKm != null && ` · a ${distanciaKm.toFixed(1)} km`}
          </span>
        )}
        {estadoApertura && (
          <span>
            <span className={`font-extrabold ${estadoApertura.abierto ? "text-aventurea-green" : "text-red-600"}`}>
              {estadoApertura.abierto ? "Abierto" : "Cerrado"}
            </span>
            <span className="text-aventurea-ink-soft"> — {estadoApertura.texto}</span>
          </span>
        )}
      </div>

      {descripcion && (
        <div className="mt-3.5 border-t border-[#e8eef8] pt-3.5">
          <p
            className={`text-[13.5px] leading-relaxed text-aventurea-ink-soft ${
              descripcionAbierta ? "" : "line-clamp-3"
            }`}
          >
            {descripcion}
          </p>
          {descripcionLarga && (
            <button
              type="button"
              onClick={() => setDescripcionAbierta((v) => !v)}
              className="mt-1 text-[12.5px] font-bold text-aventurea-navy hover:underline"
            >
              {descripcionAbierta ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
