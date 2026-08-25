"use client";

import { useState } from "react";
import Link from "next/link";
import { Icono } from "./panel/[id]/iconos";
import { INDUSTRIAS } from "./industrias/datos";
import { iniciales } from "@/lib/iniciales";
import { cerrarSesionLealtad } from "./sesion-actions";

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

const ENLACES: { href: string; label: string }[] = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#soluciones", label: "Soluciones" },
  { href: "#planes", label: "Planes" },
];

/** Los ítems del menú de cuenta — desktop y mobile dibujan la misma lista. */
const ITEMS_CUENTA: { href: string; label: string }[] = [
  { href: "/lealtad/panel", label: "Ver mis negocios con planes" },
  { href: "/cuenta", label: "Configuración de perfil" },
];

export default function NavLealtad({
  logueado = false,
  nombre = null,
}: {
  logueado?: boolean;
  /** El nombre de la cuenta con sesión — lo resuelve
   *  `sesionDelNavLealtad()` (src/lib/lealtad/sesion-nav.ts). null con
   *  sesión pero sin nombre cargado: entonces se cae a «Mi cuenta». */
  nombre?: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [abiertoCuenta, setAbiertoCuenta] = useState(false);
  // Pedido del dueño: que arriba se vea DE QUIÉN es la sesión. Con
  // nombre se muestra el nombre; sin él (sesión sin perfil cargado),
  // «Mi cuenta»; sin sesión, «Ingresar».
  const etiquetaCuenta = logueado ? nombre || "Mi cuenta" : "Ingresar";

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

        <nav
          aria-label="Secciones de la página"
          className="hidden items-center gap-7 lg:flex"
        >
          {ENLACES.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className="text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              {e.label}
            </a>
          ))}
          {/* «Industrias» se despliega al pasar el mouse (pedido del
              dueño) — y también con foco de teclado (focus-within),
              porque un menú solo-hover deja afuera a quien navega con
              Tab. El pt-3 es el puente invisible entre el botón y el
              panel: sin él, el hover se corta al cruzar el espacio. */}
          <div className="group relative">
            <button
              type="button"
              aria-haspopup="true"
              className="flex items-center gap-1 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              Industrias
              <span
                aria-hidden
                className="text-[9px] transition-transform group-hover:rotate-180"
              >
                ▼
              </span>
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 w-[230px] -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="rounded-2xl border border-aventurea-line bg-white p-2 shadow-[0_24px_60px_-24px_rgba(16,38,88,0.35)]">
                {INDUSTRIAS.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/lealtad/industrias/${i.slug}`}
                    className="block rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:bg-[#f2f5fb]"
                  >
                    {i.nombre}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {logueado ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAbiertoCuenta((v) => !v)}
                aria-haspopup="true"
                aria-expanded={abiertoCuenta}
                className="flex items-center gap-1.5 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-aventurea-navy text-[9.5px] font-extrabold text-white">
                  {nombre ? iniciales(nombre) : "✓"}
                </span>
                <span className="max-w-[150px] truncate">{etiquetaCuenta}</span>
                <span
                  aria-hidden
                  className={`text-[9px] transition-transform ${abiertoCuenta ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>

              {abiertoCuenta && (
                <>
                  <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setAbiertoCuenta(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-2xl border border-aventurea-line bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(16,38,88,0.35)]">
                    {ITEMS_CUENTA.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAbiertoCuenta(false)}
                        className="block whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink hover:bg-[#f2f5fb]"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-aventurea-line" />
                    <form action={cerrarSesionLealtad}>
                      <button
                        type="submit"
                        className="block w-full whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink hover:bg-[#f2f5fb]"
                      >
                        Cerrar sesión
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/lealtad/ingresar"
              className="flex items-center gap-1.5 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              <Icono nombre="perfil" className="h-4 w-4 shrink-0" />
              {etiquetaCuenta}
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-lealtad"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-aventurea-line text-aventurea-navy lg:hidden"
        >
          <Icono nombre={abierto ? "cerrar" : "menu"} className="h-5 w-5" />
        </button>
      </div>

      {abierto && (
        <div
          id="menu-lealtad"
          className="border-t border-aventurea-line bg-white px-5 py-5 lg:hidden"
        >
          <nav
            className="flex flex-col gap-4"
            aria-label="Secciones de la página"
          >
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
            <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-aventurea-ink-soft">
              Industrias
            </p>
            {INDUSTRIAS.map((i) => (
              <Link
                key={i.slug}
                href={`/lealtad/industrias/${i.slug}`}
                onClick={() => setAbierto(false)}
                className="pl-3 text-[14px] font-bold text-aventurea-ink"
              >
                {i.nombre}
              </Link>
            ))}
            {logueado ? (
              <>
                <div className="mt-1 flex items-center gap-2 text-[15px] font-bold text-aventurea-ink">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-aventurea-navy text-[9.5px] font-extrabold text-white">
                    {nombre ? iniciales(nombre) : "✓"}
                  </span>
                  <span className="truncate">{etiquetaCuenta}</span>
                </div>
                {ITEMS_CUENTA.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAbierto(false)}
                    className="pl-3 text-[14px] font-bold text-aventurea-ink"
                  >
                    {item.label}
                  </Link>
                ))}
                <form action={cerrarSesionLealtad}>
                  <button type="submit" className="pl-3 text-[14px] font-bold text-aventurea-ink">
                    Cerrar sesión
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/lealtad/ingresar"
                onClick={() => setAbierto(false)}
                className="flex items-center gap-2 text-[15px] font-bold text-aventurea-ink"
              >
                <Icono nombre="perfil" className="h-4 w-4 shrink-0" />
                {etiquetaCuenta}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
