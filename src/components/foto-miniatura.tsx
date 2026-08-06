"use client";

import { caerAlOriginal, miniatura } from "@/lib/imagenes";

/**
 * <img> que pide la versión redimensionada de una foto del Storage y,
 * si la transformación no está disponible, cae a la original. Existe
 * como componente aparte para poder usarlo desde componentes de
 * servidor (el onError exige un componente cliente).
 */
export default function FotoMiniatura({
  src,
  ancho,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  /** Ancho en píxeles al que se pide la miniatura. */
  ancho: number;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos externas subidas por cada proveedor, sin dominio fijo para next/image
    <img
      src={miniatura(src, ancho)}
      onError={caerAlOriginal(src)}
      alt={alt}
      loading={loading}
      className={className}
    />
  );
}
