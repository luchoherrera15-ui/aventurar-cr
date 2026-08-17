"use client";

import { useState } from "react";
import Link from "next/link";
import { Icono } from "./panel/[id]/iconos";

/**
 * EL NAV COMPACTO DE /lealtad.
 *
 * Antes esta landing era "inmersiva, sin chrome": dos píldoras fijas
 * (Volver / Entrar) y nada más. El rediseño pide una barra real —quien
 * llega necesita moverse entre "cómo funciona", "soluciones" y
 * "planes" sin scrollear a ciegas, y quien ya tiene cuenta necesita
 * una puerta que no dependa de memorizar dónde quedó "Entrá acá".
 *
 * Blanca y no navy a propósito: el resto de la página alterna franjas
 * claras y oscuras, y una barra fija oscura se pelea con el contenido
 * claro que queda debajo al hacer scroll. Blanca funciona igual sobre
 * las dos.
 */

/* La barra es BLANCA, así que el CTA usa el par de acción para fondo
   claro: relleno azul con letra blanca. Sale de los tokens de
   `.lealtad` y no de un hex copiado — este archivo tenía su propia
   `const NARANJA` y por eso su botón ya no coincidía con el de la
   landing. */
const ACCION = "var(--accion)";
const ACCION_TINTA = "var(--accion-tinta)";

const ENLACES: { href: string; label: string }[] = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#soluciones", label: "Soluciones" },
  { href: "#planes", label: "Planes" },
];

export default function NavLealtad() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-aventurea-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- mismo
              logo estático que site-header.tsx: next/image no aporta
              nada para un PNG de 4.2 KB que no cambia. */}
          <img
            src="/logo-bookea-nav-v4.png"
            alt="Bookea"
            width={440}
            height={138}
            className="h-7 w-auto shrink-0 sm:h-8"
          />
          <span className="hidden text-[13px] font-bold text-aventurea-ink-soft sm:inline">
            Lealtad
          </span>
        </Link>

        <nav aria-label="Secciones de la página" className="hidden items-center gap-7 md:flex">
          {ENLACES.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className="text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              {e.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/cuenta?volver=lealtad"
            className="text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
          >
            Entrar
          </Link>
          <Link
            href="/lealtad/nuevo"
            className="presionable rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold"
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            Crear mi programa gratis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-lealtad"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-aventurea-line text-aventurea-navy md:hidden"
        >
          <Icono nombre={abierto ? "cerrar" : "menu"} className="h-5 w-5" />
        </button>
      </div>

      {abierto && (
        <div id="menu-lealtad" className="border-t border-aventurea-line bg-white px-5 py-5 md:hidden">
          <nav className="flex flex-col gap-4" aria-label="Secciones de la página">
            {ENLACES.map((e) => (
              <a
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className="text-[15px] font-bold text-aventurea-ink"
              >
                {e.label}
              </a>
            ))}
            <Link
              href="/cuenta?volver=lealtad"
              onClick={() => setAbierto(false)}
              className="text-[15px] font-bold text-aventurea-ink"
            >
              Entrar
            </Link>
            <Link
              href="/lealtad/nuevo"
              onClick={() => setAbierto(false)}
              className="presionable mt-1 rounded-xl px-5 py-3.5 text-center text-[15px] font-extrabold"
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Crear mi programa gratis
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
