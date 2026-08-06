"use client";

import Link from "next/link";
import { useSesionPublica } from "@/lib/sesion-publica";

/**
 * El link de escritorio del header: "Publicá tu espacio" para todo el
 * mundo, y a quien ya publicó le cambia a la puerta de su panel. La
 * decisión se toma en el navegador (caché compartido de
 * sesion-publica.ts) para que el header no necesite sesión en el
 * servidor y las páginas públicas puedan pre-generarse.
 */
export default function LinkPublicar() {
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
