"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ComponentProps } from "react";
import { conPrefijo, sinPrefijo } from "@/lib/celebrar/dominios";
import { PREFIJO_CELEBRAR } from "@/lib/celebrar/rutas";

/**
 * El prefijo de rutas de ESTA visita, bajado desde el layout (que lo
 * lee del host de la petición): "" en celebrar.lat, "/celebrar" en
 * Bookea. Con esto los componentes escriben `RUTA.app` y el link sale
 * correcto en los dos mundos sin un solo "/celebrar" a mano.
 */
const ContextoPrefijo = createContext<string>(PREFIJO_CELEBRAR);

export function ProveedorRutas({
  prefijo,
  children,
}: {
  prefijo: string;
  children: React.ReactNode;
}) {
  return <ContextoPrefijo.Provider value={prefijo}>{children}</ContextoPrefijo.Provider>;
}

export function usePrefijo(): string {
  return useContext(ContextoPrefijo);
}

/** `ruta(RUTA.app)` → "/celebrar/app" o "/app" según el host. */
export function useRuta(): (ruta: string) => string {
  const prefijo = usePrefijo();
  return (ruta) => conPrefijo(ruta, prefijo);
}

/** La ruta actual SIN prefijo, comparable con las de `RUTA`. */
export function useRutaActual(): string {
  const pathname = usePathname() ?? "/";
  return sinPrefijo(pathname);
}

type PropsEnlace = Omit<ComponentProps<typeof Link>, "href"> & {
  /** Una ruta de `RUTA` (sin el prefijo). */
  a: string;
};

/** `<Link>` que completa el prefijo solo. Todo link interno de CELEBRAR pasa por acá. */
export function EnlaceCelebrar({ a, ...props }: PropsEnlace) {
  const prefijo = usePrefijo();
  return <Link href={conPrefijo(a, prefijo)} {...props} />;
}

/**
 * `<a>` plano con el prefijo: para descargas (`download`) y rutas que
 * no son páginas de la app (un CSV, un .ics), donde `<Link>` no aplica.
 */
export function EnlacePlanoCelebrar({ a, ...props }: Omit<ComponentProps<"a">, "href"> & { a: string }) {
  const prefijo = usePrefijo();
  return <a href={conPrefijo(a, prefijo)} {...props} />;
}
