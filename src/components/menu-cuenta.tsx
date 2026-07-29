"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu, IconUserCircle } from "./icons";

/**
 * Píldora de hamburguesa + avatar del header — abre un menú, no navega
 * directo a ningún lado. "Publicá tu espacio" vive tanto acá (para que
 * en el celular, donde el link de texto de al lado está oculto, siga
 * habiendo por dónde llegar) como afuera en desktop.
 */
export default function MenuCuenta({
  sesionActiva,
  cerrarSesion,
}: {
  sesionActiva: boolean;
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
        className="flex items-center gap-2 rounded-full border border-aventurea-line bg-aventurea-surface py-1 pl-3 pr-1 shadow-sm transition-shadow hover:shadow-md"
      >
        <IconMenu className="h-[15px] w-[15px] text-aventurea-ink" />
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-300 text-white">
          <IconUserCircle className="h-[15px] w-[15px]" />
        </span>
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
                  href="/publicar"
                  className={`${itemCls} sm:hidden`}
                  onClick={() => setAbierto(false)}
                >
                  Publicá tu espacio
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
