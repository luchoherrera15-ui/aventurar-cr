"use client";

import Link from "next/link";
import { useSesionPublica } from "./use-sesion-publica";

/**
 * El enlace «Publicá tu espacio» / «Manejá tu espacio» del
 * `site-header`, como isla de cliente.
 *
 * Era la línea que quedaba: el header ya no lee sesión en el servidor
 * (ver use-sesion-publica.ts), pero este Link decidía su etiqueta con
 * `await tieneNegocioPropio()` — un `cookies()` que por sí solo habría
 * seguido volviendo dinámicas todas las páginas con header. El primer
 * pintado dice «Publicá tu espacio» (lo que ve todo visitante) y, si el
 * navegador encuentra sesión con negocio, cambia a la puerta del panel.
 */
export default function BotonPublicarHeader() {
  const { yaPublica } = useSesionPublica();

  return (
    <Link
      href={yaPublica ? "/mi-negocio" : "/publicar"}
      className="hidden whitespace-nowrap text-[13.5px] font-bold text-aventurea-ink hover:text-aventurea-navy sm:block"
    >
      {yaPublica ? "Manejá tu espacio" : "Publicá tu espacio"}
    </Link>
  );
}
