"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu, IconUserCircle } from "./icons";

/**
 * Primer nombre + primer apellido: "Luis Herrera Ovares" → "LH" (no
 * "LO" — el segundo apellido no cuenta). Un solo nombre → su inicial.
 */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Píldora de hamburguesa + avatar del header — abre un menú, no navega
 * directo a ningún lado. Con sesión, el círculo muestra la foto del
 * perfil (si entró con Google) o las iniciales del nombre; el ícono
 * genérico queda solo para visitas sin sesión. "Publicá tu espacio"
 * vive tanto acá (para que en el celular, donde el link de texto de al
 * lado está oculto, siga habiendo por dónde llegar) como afuera en
 * desktop.
 */
export default function MenuCuenta({
  sesionActiva,
  nombre,
  fotoUrl,
  yaPublica = false,
  cerrarSesion,
}: {
  sesionActiva: boolean;
  nombre?: string | null;
  fotoUrl?: string | null;
  /** Ya tiene un negocio publicado: el link lleva a su panel. */
  yaPublica?: boolean;
  cerrarSesion: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);

  const itemCls =
    "block whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink hover:bg-aventurea-cream-2";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Menú de cuenta"
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface py-1 pl-3 pr-1 shadow-sm transition-shadow hover:shadow-md"
      >
        <IconMenu className="h-[15px] w-[15px] text-aventurea-ink" />
        {sesionActiva && fotoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- avatar
             de Google, dominio externo variable: next/image pediría
             registrar cada host. */
          <img
            src={fotoUrl}
            alt={nombre ?? "Tu perfil"}
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : sesionActiva && nombre ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-aventurea-navy text-[10.5px] font-bold leading-none text-white">
            {iniciales(nombre)}
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-white">
            <IconUserCircle className="h-[15px] w-[15px]" />
          </span>
        )}
      </button>

      {abierto && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-xl">
            {sesionActiva ? (
              <>
                <Link href="/cuenta" className={itemCls} onClick={() => setAbierto(false)}>
                  Mi cuenta
                </Link>
                <Link href="/mensajes" className={itemCls} onClick={() => setAbierto(false)}>
                  Mensajes
                </Link>
                <Link href="/eventos" className={itemCls} onClick={() => setAbierto(false)}>
                  Ver el directorio
                </Link>
                <Link
                  href={yaPublica ? "/mi-rancho" : "/publicar"}
                  className={`${itemCls} sm:hidden`}
                  onClick={() => setAbierto(false)}
                >
                  {yaPublica ? "Manejá tu espacio" : "Publicá tu espacio"}
                </Link>
                <div className="my-1 border-t border-aventurea-line" />
                <form action={cerrarSesion}>
                  <button type="submit" className={itemCls}>
                    Cerrar sesión
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/cuenta" className={itemCls} onClick={() => setAbierto(false)}>
                  Iniciar sesión
                </Link>
                <Link
                  href="/publicar"
                  className={`${itemCls} sm:hidden`}
                  onClick={() => setAbierto(false)}
                >
                  Publicá tu espacio
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
