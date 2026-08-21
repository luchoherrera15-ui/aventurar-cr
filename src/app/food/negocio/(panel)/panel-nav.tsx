"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconAyuda,
  IconBell,
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconGear,
  IconMenu,
  IconSalir,
  IconStore,
  IconTagLine,
  IconUsers,
  IconUtensils,
  IconX,
} from "@/components/icons";
import { RAIL_GRUPO, RAIL_ITEM, RAIL_TARJETA } from "@/components/panel/sistema";
import { RANGOS, ROTULO_RANGO, rangoDesdeParam } from "@/lib/food/rango";
import { salirDelPanelFood } from "./panel-actions";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL SHELL DEL PANEL DE FOOD — sidebar + topbar + cajón móvil
 * ═══════════════════════════════════════════════════════════════════
 *
 * Reemplaza a la fila de pestañas horizontales: el panel creció (de 5
 * pantallas a 10) y una fila de tabs ya no da la sensación de "centro
 * de control" que pide el producto. La anatomía es la misma que ya
 * usan /cuenta y mi-negocio — columna navy sólida con los tokens
 * RAIL_* del sistema de paneles — para que todo Bookea hable el mismo
 * idioma visual; lo propio de FOOD es el acento naranja del ítem
 * activo y la marca "Bookea FOOD".
 *
 * Es UN componente cliente que recibe `children` del layout (los
 * children siguen siendo Server Components: pasar por acá no los
 * hidrata). Cliente porque casi todo lo suyo es interactivo: ítem
 * activo por pathname, selector de rango por querystring, campana,
 * cajón <dialog> en el teléfono.
 *
 * En móvil (<lg) la sidebar se vuelve un cajón con <dialog> nativo:
 * showModal() da foco atrapado, Esc y backdrop gratis — sin librería
 * de drawer ni listeners globales caseros.
 */

/** Una notificación ya lista para pintar (el layout la arma en servidor). */
export type NotificacionPanel = {
  id: string;
  titulo: string;
  detalle: string;
};

type NegocioShell = {
  nombre: string;
  activo: boolean;
};

type ItemNav = { href: string; label: string; icono: ReactNode };
type GrupoNav = { titulo: string; items: ItemNav[] };

/**
 * El mapa del panel. Los grupos cuentan la historia del producto:
 * PRINCIPAL es "¿cómo me va?", OPERACIÓN es "lo de hoy", RESTAURANTE
 * es "mi identidad" e INFORMACIÓN es soporte. Las rutas de la fase 2
 * (reservas, clientes, rendimiento, promociones, perfil, ayuda) ya
 * están linkeadas: este shell es el contrato de navegación.
 */
const GRUPOS_NAV: GrupoNav[] = [
  {
    titulo: "Principal",
    items: [
      { href: "/food/negocio", label: "Dashboard", icono: <IconChartBars className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/reservas", label: "Reservas", icono: <IconCalendarLine className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/clientes", label: "Clientes", icono: <IconUsers className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/rendimiento", label: "Rendimiento", icono: <IconChartBars className="h-[15px] w-[15px]" /> },
    ],
  },
  {
    titulo: "Operación",
    items: [
      { href: "/food/negocio/franjas", label: "Disponibilidad", icono: <IconClock className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/check-in", label: "Check-ins", icono: <IconCheck className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/promociones", label: "Promociones", icono: <IconTagLine className="h-[15px] w-[15px]" /> },
    ],
  },
  {
    titulo: "Restaurante",
    items: [
      { href: "/food/negocio/menu", label: "Menú", icono: <IconUtensils className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/perfil", label: "Perfil", icono: <IconStore className="h-[15px] w-[15px]" /> },
      { href: "/food/negocio/configuracion", label: "Configuración", icono: <IconGear className="h-[15px] w-[15px]" /> },
    ],
  },
  {
    titulo: "Información",
    items: [
      { href: "/food/negocio/ayuda", label: "Ayuda", icono: <IconAyuda className="h-[15px] w-[15px]" /> },
    ],
  },
];

/** ¿Este href es la pantalla activa? El Dashboard solo con match exacto. */
function esActivo(href: string, pathname: string): boolean {
  return href === "/food/negocio" ? pathname === href : pathname.startsWith(href);
}

/** El nombre de la sección activa, para el breadcrumb de la topbar. */
function seccionActiva(pathname: string): string {
  for (const g of GRUPOS_NAV) {
    for (const item of g.items) {
      if (esActivo(item.href, pathname)) return item.label;
    }
  }
  return "Panel";
}

// ───────────────────────────────────────────────────────────────────
//  Selector de restaurante (preparado para multi-restaurante)
// ───────────────────────────────────────────────────────────────────

function SelectorRestaurante({ negocio }: { negocio: NegocioShell }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al clickear afuera — el patrón estándar de los dropdowns
  // del sitio (mismo mecanismo que la campana, abajo).
  useEffect(() => {
    if (!abierto) return;
    const alTocar = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className={`${RAIL_TARJETA} flex w-full items-center gap-2.5 text-left transition-colors hover:bg-white/[0.12]`}
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aventurea-orange text-[13px] font-extrabold text-white"
          aria-hidden
        >
          {negocio.nombre.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold text-white">{negocio.nombre}</span>
          <span
            className={`block text-[10.5px] font-bold ${negocio.activo ? "text-emerald-300" : "text-red-300"}`}
          >
            ● {negocio.activo ? "Activo" : "Apagado"}
          </span>
        </span>
        <IconChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-aventurea-rail transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 rounded-xl border border-white/10 bg-[#122e57] p-1.5 shadow-[var(--shadow-flotante)]">
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.08] px-2.5 py-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">
              {negocio.nombre}
            </span>
            <IconCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
          </div>
          {/* No es botón a propósito: que no exista el elemento
              interactivo es lo que garantiza que no lleve a ningún
              lado (mismo criterio que los ítems "Pronto" del rail de
              mi-negocio). */}
          <p className="px-2.5 py-2 text-[11px] leading-snug text-aventurea-rail">
            Próximamente: agregá otro restaurante
          </p>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  El contenido de la sidebar (columna fija y cajón comparten esto)
// ───────────────────────────────────────────────────────────────────

function ContenidoSidebar({
  negocio,
  correo,
  alCerrar,
}: {
  negocio: NegocioShell;
  correo: string;
  /** Presente solo en el cajón móvil: pinta la X y cierra el dialog. */
  alCerrar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col gap-4 p-3.5">
      <div className="flex items-center justify-between px-1.5 pt-1">
        <Link href="/food" className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-extrabold tracking-tight text-white">Bookea</span>
          <span className="text-[12.5px] font-extrabold tracking-[0.14em] text-aventurea-orange">
            FOOD
          </span>
        </Link>
        {alCerrar && (
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar menú"
            className="grid h-8 w-8 place-items-center rounded-lg text-aventurea-rail transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      <SelectorRestaurante negocio={negocio} />

      <nav className="flex flex-1 flex-col gap-4" aria-label="Secciones del panel">
        {GRUPOS_NAV.map((grupo) => (
          <div key={grupo.titulo}>
            <p className={RAIL_GRUPO}>{grupo.titulo}</p>
            <ul className="flex flex-col gap-0.5">
              {grupo.items.map((item) => {
                const activo = esActivo(item.href, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={activo ? "page" : undefined}
                      className={`${RAIL_ITEM} ${
                        activo
                          ? "border-aventurea-orange bg-white/[0.09] text-white"
                          : "text-aventurea-rail hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <span aria-hidden>{item.icono}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* La persona: quién está adentro y cómo salir. */}
      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-2.5 px-1.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[12.5px] font-extrabold text-white"
            aria-hidden
          >
            {(correo.charAt(0) || "?").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-bold text-white">{correo}</span>
            <span className="block text-[10.5px] font-bold text-aventurea-rail">Propietario</span>
          </span>
        </div>
        <form action={salirDelPanelFood} className="mt-2.5">
          <button
            type="submit"
            className={`${RAIL_ITEM} w-full text-aventurea-rail hover:bg-white/[0.05] hover:text-white`}
          >
            <IconSalir className="h-[15px] w-[15px]" aria-hidden />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Piezas de la topbar
// ───────────────────────────────────────────────────────────────────

/**
 * "Últimos 30 días" — el rango vive en `?rango=` para que sobreviva a
 * la navegación, se pueda compartir el link y el Server Component lo
 * lea sin estado compartido. Un <select> nativo a propósito: teclado y
 * lector de pantalla gratis, y a este tamaño se ve igual de bien que
 * un dropdown casero.
 */
function SelectorRango() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rango = rangoDesdeParam(searchParams.get("rango"));

  return (
    <div className="relative">
      <select
        value={rango}
        aria-label="Rango de fechas de las métricas"
        onChange={(ev) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("rango", ev.target.value);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        className="appearance-none rounded-lg border border-aventurea-line bg-white py-1.5 pl-3 pr-7 text-[12px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
      >
        {RANGOS.map((r) => (
          <option key={r} value={r}>
            {ROTULO_RANGO[r]}
          </option>
        ))}
      </select>
      <IconChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-aventurea-ink-soft"
        aria-hidden
      />
    </div>
  );
}

/**
 * La campana. Sin datos inventados: lista las reservas confirmadas
 * REALES que vienen (se las pasa el layout desde food_reservations) y
 * si no hay nada lo dice tal cual.
 */
function CampanaNotificaciones({ notificaciones }: { notificaciones: NotificacionPanel[] }) {
  const [abierta, setAbierta] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const alTocar = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setAbierta(false);
    };
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setAbierta(false);
    };
    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierta]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-label={
          notificaciones.length === 0
            ? "Notificaciones"
            : `Notificaciones: ${notificaciones.length} reservas próximas`
        }
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-aventurea-line bg-white text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
      >
        <IconBell className="h-[17px] w-[17px]" />
        {notificaciones.length > 0 && (
          <span
            className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-aventurea-orange px-1 text-[9.5px] font-extrabold text-white"
            aria-hidden
          >
            {notificaciones.length}
          </span>
        )}
      </button>

      {abierta && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-aventurea-line bg-white p-2 shadow-[var(--shadow-flotante)]">
          <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
            Notificaciones
          </p>
          {notificaciones.length === 0 ? (
            <p className="px-2.5 pb-2.5 pt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              No hay notificaciones nuevas. Cuando entre una reserva la vas a ver acá.
            </p>
          ) : (
            <>
              <ul className="flex flex-col">
                {notificaciones.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl px-2.5 py-2 transition-colors hover:bg-aventurea-cream-2"
                  >
                    <p className="text-[12.5px] font-bold text-aventurea-ink">{n.titulo}</p>
                    <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">{n.detalle}</p>
                  </li>
                ))}
              </ul>
              <Link
                href="/food/negocio"
                onClick={() => setAbierta(false)}
                className="mt-1 block rounded-xl px-2.5 py-2 text-[12px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-cream-2"
              >
                Ver las reservas de hoy →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  El shell completo
// ───────────────────────────────────────────────────────────────────

export default function PanelShellFood({
  negocio,
  correo,
  notificaciones,
  children,
}: {
  negocio: NegocioShell;
  correo: string;
  notificaciones: NotificacionPanel[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const cajonRef = useRef<HTMLDialogElement>(null);
  const seccion = seccionActiva(pathname);

  // Navegar cierra el cajón: el <dialog> modal taparía la pantalla
  // nueva si quedara abierto.
  useEffect(() => {
    cajonRef.current?.close();
  }, [pathname]);

  return (
    <div className="flex min-h-svh bg-aventurea-cream-2">
      {/* Columna fija de escritorio. */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 overflow-y-auto bg-aventurea-rail-fondo lg:block">
        <ContenidoSidebar negocio={negocio} correo={correo} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-aventurea-line bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => cajonRef.current?.showModal()}
              aria-label="Abrir menú del panel"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-aventurea-line text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy lg:hidden"
            >
              <IconMenu className="h-[17px] w-[17px]" />
            </button>

            {/* Breadcrumb: dónde estoy. Las dos primeras migas son
                contexto, la sección es la que manda. */}
            <nav aria-label="Ubicación" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-[12.5px]">
                <li className="hidden items-center gap-1.5 text-aventurea-ink-soft sm:flex">
                  Bookea
                  <span className="text-aventurea-line-fuerte" aria-hidden>
                    /
                  </span>
                </li>
                <li className="hidden items-center gap-1.5 text-aventurea-ink-soft sm:flex">
                  Food
                  <span className="text-aventurea-line-fuerte" aria-hidden>
                    /
                  </span>
                </li>
                <li className="truncate font-bold text-aventurea-navy" aria-current="page">
                  {seccion}
                </li>
              </ol>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <SelectorRango />
              <CampanaNotificaciones notificaciones={notificaciones} />
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-aventurea-navy text-[13px] font-extrabold text-white"
                title={correo}
                aria-hidden
              >
                {(correo.charAt(0) || "?").toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* El cajón móvil: la MISMA sidebar dentro de un <dialog>. */}
      <dialog
        ref={cajonRef}
        aria-label="Menú del panel"
        onClick={(ev) => {
          // Un click en el backdrop (el dialog mismo, no su contenido)
          // cierra — comportamiento esperado de todo drawer.
          if (ev.target === ev.currentTarget) ev.currentTarget.close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-[100dvh] max-h-none w-[280px] max-w-[85vw] overflow-y-auto bg-aventurea-rail-fondo p-0 backdrop:bg-black/45 lg:hidden"
      >
        <ContenidoSidebar
          negocio={negocio}
          correo={correo}
          alCerrar={() => cajonRef.current?.close()}
        />
      </dialog>
    </div>
  );
}
