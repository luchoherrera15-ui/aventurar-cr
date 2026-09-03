"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPOS_ADMIN, seccionDeLaRuta } from "./secciones-admin";
import { ICONOS_ADMIN } from "./iconos-admin";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LA BARRA LATERAL DEL PANEL ADMIN
 * ═══════════════════════════════════════════════════════════════════
 *
 * Antes las dieciséis secciones eran una grilla de tarjetas en la
 * portada: para ir de Finanzas a Publicaciones había que volver al
 * inicio y buscar la tarjeta con la vista. Ahora están siempre a la
 * vista, en el mismo lugar, en todas las pantallas — que es lo que
 * convierte una colección de páginas en una aplicación.
 *
 * ── POR QUÉ ES CLIENTE ─────────────────────────────────────────────
 * Solo por `usePathname`: saber cuál está activa. Nada más de acá
 * necesita el navegador. Por eso la LISTA de secciones vive en un
 * módulo neutro aparte (`secciones-admin.ts`) que el layout —que es
 * servidor— también puede importar sin arrastrar este archivo.
 *
 * ── LOS CONTADORES ─────────────────────────────────────────────────
 * Llegan por props desde el layout, que ya los calcula para el
 * tablero. Pedirlos de nuevo acá sería una segunda consulta por cada
 * pantalla del panel, para el mismo número.
 */
export default function RailAdmin({
  cabecera,
  pie,
  marcaMovil,
  pendientes,
}: {
  /** El conmutador de sección: lo arma el servidor y entra por acá. */
  cabecera: React.ReactNode;
  /** El correo y el botón de cerrar sesión, también del servidor. */
  pie: React.ReactNode;
  /** El logo de la franja de teléfono. */
  marcaMovil: React.ReactNode;
  pendientes: { publicaciones: number; invitaciones: number };
}) {
  const pathname = usePathname() ?? "/admin";
  const activa = seccionDeLaRuta(pathname);
  const [abierto, setAbierto] = useState(false);

  const navegacion = (
    <nav className="flex flex-col gap-5" aria-label="Secciones del panel">
      {GRUPOS_ADMIN.map((grupo) => (
        <div key={grupo.titulo ?? "inicio"}>
          {grupo.titulo && (
            <p className="mb-1.5 px-3 text-[10.5px] font-bold tracking-[0.14em] text-white/35 uppercase">
              {grupo.titulo}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {grupo.items.map((s) => {
              const Icono = ICONOS_ADMIN[s.icono];
              const esActiva = activa === s.href;
              const cuenta =
                s.badge === "publicaciones"
                  ? pendientes.publicaciones
                  : s.badge === "invitaciones"
                    ? pendientes.invitaciones
                    : 0;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    onClick={() => setAbierto(false)}
                    aria-current={esActiva ? "page" : undefined}
                    // Rediseño sep 2026: el activo pasa de relleno
                    // navy-3 + barrita blanca a una CARD blanca elevada
                    // con disco navy en el ícono — el mismo lenguaje de
                    // los rails de /mi-negocio, /cuenta y Lealtad. La
                    // letra sube de 13,5 a 14. El border-l se queda
                    // transparente en los dos estados: reserva los 3px
                    // para que el texto no salte.
                    className={`flex min-h-[42px] items-center gap-2.5 rounded-xl border-l-[3px] border-transparent py-1.5 pr-2.5 pl-[9px] text-[14px] transition-colors ${
                      esActiva
                        ? "bg-white font-bold text-aventurea-navy shadow-elevado"
                        : "font-medium text-aventurea-rail hover:bg-aventurea-navy-3 hover:text-white"
                    }`}
                  >
                    {Icono &&
                      (esActiva ? (
                        <span
                          aria-hidden="true"
                          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-aventurea-navy text-white [&_svg]:h-[16px] [&_svg]:w-[16px]"
                        >
                          <Icono />
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]"
                        >
                          <Icono />
                        </span>
                      ))}
                    <span className="min-w-0 flex-1 truncate">{s.etiqueta}</span>
                    {s.chip && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold tracking-wide uppercase ${
                          esActiva ? "text-aventurea-ink-soft" : "text-white/40"
                        }`}
                      >
                        {s.chip}
                      </span>
                    )}
                    {cuenta > 0 && (
                      <span
                        // El único naranja de toda la barra. Si se
                        // usara también para "activa" o para adornar,
                        // dejaría de significar "esto espera por vos".
                        className="shrink-0 rounded-md bg-aventurea-orange px-1.5 py-0.5 text-[10.5px] font-extrabold text-aventurea-ink"
                        aria-label={`${cuenta} pendientes`}
                      >
                        {cuenta}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* ── Escritorio: fija, con scroll propio ─────────────────── */}
      <aside className="hidden bg-aventurea-rail-fondo lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="shrink-0 space-y-3 p-3.5">{cabecera}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">{navegacion}</div>
        <div className="shrink-0 p-3.5">{pie}</div>
      </aside>

      {/* ── Teléfono: la franja de arriba, con el botón del cajón ──
          Va acá adentro y no en el layout porque el botón necesita el
          mismo estado que el cajón que abre. Separarlos obligaría a
          subir ese estado a un tercer componente cliente que envuelva
          media aplicación. */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-aventurea-line bg-aventurea-cream-2/95 px-4 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el menú del panel"
          aria-expanded={abierto}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-aventurea-line bg-white text-aventurea-navy"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-[18px] w-[18px]"
          >
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {marcaMovil}
      </header>

      {abierto && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className="absolute inset-y-0 left-0 flex w-[80%] max-w-[292px] flex-col bg-aventurea-rail-fondo">
            <div className="shrink-0 space-y-3 p-3.5">{cabecera}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">{navegacion}</div>
            <div className="shrink-0 p-3.5">{pie}</div>
          </div>
        </div>
      )}
    </>
  );
}
