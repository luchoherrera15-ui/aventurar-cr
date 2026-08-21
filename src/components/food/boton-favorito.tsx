"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarFavoritoFood } from "@/app/food/favoritos/actions";
import { IconHeart } from "@/components/icons";

/**
 * EL CORAZÓN DE FAVORITOS — real desde la 0201.
 *
 * Optimista: cambia al toque y recién después confirma con el
 * servidor, revirtiendo si falla (p. ej. sesión vencida a mitad de
 * camino). `logueado=false` lo muestra igual pero manda a /cuenta en
 * vez de intentar guardar nada — nunca falla en silencio ni esconde
 * el control solo porque todavía no hay sesión.
 *
 * `e.preventDefault()` + `e.stopPropagation()`: esta pieza vive
 * ENCIMA de <RestauranteCard>, que es un <Link> entero — sin cortar la
 * burbuja, tocar el corazón navegaría a la ficha del restaurante.
 */
export default function BotonFavorito({
  businessId,
  favoritoInicial,
  logueado,
  slugParaVolver,
  tamano = "md",
}: {
  businessId: string;
  favoritoInicial: boolean;
  logueado: boolean;
  /** El restaurante actual, para volver directo tras loguearse. */
  slugParaVolver?: string;
  tamano?: "md" | "lg";
}) {
  const [favorito, setFavorito] = useState(favoritoInicial);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();

  const lado = tamano === "lg" ? "h-11 w-11" : "h-9 w-9";
  const icono = tamano === "lg" ? "h-[19px] w-[19px]" : "h-4 w-4";

  function alternar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!logueado) {
      router.push(`/cuenta?volver=food:${slugParaVolver ?? ""}`);
      return;
    }
    if (pendiente) return;

    const anterior = favorito;
    setFavorito(!anterior);
    iniciar(async () => {
      const r = await alternarFavoritoFood(businessId);
      if (!r.ok) setFavorito(anterior);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={favorito}
      aria-label={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
      title={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
      className={`presionable grid shrink-0 place-items-center rounded-full bg-white/90 text-aventurea-ink shadow-elevado backdrop-blur transition-colors hover:bg-white ${lado}`}
    >
      <IconHeart
        className={`${icono} transition-colors ${favorito ? "text-aventurea-orange" : "text-aventurea-ink-soft/70"}`}
      />
    </button>
  );
}
