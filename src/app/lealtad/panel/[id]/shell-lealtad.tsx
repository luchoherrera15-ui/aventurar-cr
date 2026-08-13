"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { iniciales } from "@/lib/iniciales";
import { Icono, type NombreIcono } from "./iconos";

/**
 * EL SHELL DEL PANEL DE LEALTAD: menú lateral fijo a la izquierda,
 * barra superior, y el contenido a la derecha.
 *
 * Reemplaza a las pestañas horizontales viejas. La estructura es la de
 * un panel de administración de verdad —grupos de secciones, no una
 * fila de píldoras— porque el módulo ya no cabía en cinco pestañas:
 * hay operación diaria (clientes, actividad, equipo) y configuración
 * (recompensas, tarjeta, póster, plan), y mezclarlas obligaba a
 * adivinar dónde estaba cada cosa.
 *
 * DOS DECISIONES QUE VALE LA PENA CONOCER:
 *
 * 1. Todo el contenido queda MONTADO y se esconde con `hidden` (el
 *    patrón que ya traía TabsLealtad): cambiar de sección no
 *    re-consulta nada, el escáner no pierde su estado y el formulario
 *    del programa no pierde lo escrito a medias.
 *
 * 2. La sección activa se sincroniza con el HASH de la URL. Así los
 *    botones del tablero de Inicio ("Configurá tus recompensas →") son
 *    anclas normales renderizadas EN EL SERVIDOR: no necesitan un
 *    callback que cruce la frontera, y de yapa cada sección queda
 *    enlazable (/lealtad/panel/xxx#tarjeta).
 */

const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

export type ItemLealtad = {
  id: string;
  etiqueta: string;
  icono: NombreIcono;
};

export type GrupoLealtad = {
  titulo: string;
  items: ItemLealtad[];
};

export default function ShellLealtad({
  negocio,
  usuario,
  grupos,
  contenidos,
  mostrador,
}: {
  negocio: { nombre: string; plan: string | null };
  usuario: { nombre: string; email: string };
  grupos: GrupoLealtad[];
  contenidos: Record<string, ReactNode>;
  /** El escáner a pantalla completa. null = quien mira no acredita. */
  mostrador?: ReactNode;
}) {
  const items = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  const primera = items[0]?.id ?? "inicio";

  const [activa, setActiva] = useState(primera);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [enMostrador, setEnMostrador] = useState(false);

  // El hash manda. Se lee en un efecto y no en el estado inicial para
  // que el HTML del servidor y el del cliente coincidan en el primer
  // render — leer `location` durante el render es un error de
  // hidratación esperando a pasar.
  //
  // Sin dependencias A PROPÓSITO: cada server action del panel llama a
  // `revalidatePath`, y con `items` en la lista el efecto se volvía a
  // correr en cada refresco. Eso sacaba del modo mostrador a quien
  // estaba escaneando — la acción que MÁS revalida. Un hash que no
  // corresponde a ninguna sección no rompe nada: `efectiva`, abajo,
  // cae a la primera visible.
  useEffect(() => {
    const aplicarHash = () => {
      const destino = window.location.hash.replace("#", "");
      if (!destino) return;
      setActiva(destino);
      setEnMostrador(false);
      setMenuAbierto(false);
    };
    aplicarHash();
    window.addEventListener("hashchange", aplicarHash);
    return () => window.removeEventListener("hashchange", aplicarHash);
  }, []);

  // Si a quien mira le quitaron un permiso, la sección elegida puede ya
  // no venir en la lista del servidor: se cae a la primera visible.
  const efectiva = items.some((i) => i.id === activa) ? activa : primera;
  const actual = items.find((i) => i.id === efectiva);

  return (
    <div className="lealtad-oscuro min-h-svh" style={{ background: NAVY_PROFUNDO }}>
      <div className="lg:grid lg:grid-cols-[254px_minmax(0,1fr)]">
        {/* ── Fondo que cierra el cajón en móvil ─────────────────── */}
        {menuAbierto && (
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          />
        )}

        {/* ── Menú lateral ───────────────────────────────────────── */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col overflow-y-auto border-r transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:w-auto lg:translate-x-0 ${
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "#070d1c", borderColor: "rgba(255,255,255,.08)" }}
        >
          {/* El negocio, arriba de todo: en un panel de varios
              negocios, saber en cuál estás parado es lo primero. */}
          <div
            className="flex items-center gap-2.5 border-b px-4 py-4"
            style={{ borderColor: "rgba(255,255,255,.08)" }}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[12.5px] font-extrabold"
              style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
            >
              {iniciales(negocio.nombre) || "B"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-extrabold text-white">
                {negocio.nombre}
              </span>
              <span className="block truncate text-[11px] text-white/45">
                {negocio.plan ?? "Sin plan"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="shrink-0 text-white/45 hover:text-white lg:hidden"
              aria-label="Cerrar el menú"
            >
              <Icono nombre="cerrar" className="h-[18px] w-[18px]" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4">
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className="mb-5 last:mb-0">
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                  {grupo.titulo}
                </p>
                <ul className="space-y-0.5">
                  {grupo.items.map((item) => {
                    const esta = item.id === efectiva && !enMostrador;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          aria-current={esta ? "page" : undefined}
                          onClick={() => {
                            setActiva(item.id);
                            setEnMostrador(false);
                            setMenuAbierto(false);
                          }}
                          className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-colors ${
                            esta ? "text-white" : "text-white/55 hover:bg-white/[.06] hover:text-white/85"
                          }`}
                          style={esta ? { background: "rgba(238,116,32,.15)" } : undefined}
                        >
                          {esta && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                              style={{ background: NARANJA }}
                            />
                          )}
                          <Icono
                            nombre={item.icono}
                            className={`h-[17px] w-[17px] shrink-0 ${esta ? "" : "opacity-70"}`}
                          />
                          <span className="min-w-0 truncate">{item.etiqueta}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div
            className="border-t px-4 py-3.5"
            style={{ borderColor: "rgba(255,255,255,.08)" }}
          >
            <Link
              href="/lealtad/panel"
              className="block text-[12px] font-bold text-white/45 hover:text-white"
            >
              ← Mis negocios
            </Link>
          </div>
        </aside>

        {/* ── Columna del contenido ──────────────────────────────── */}
        <div className="min-w-0">
          <header
            className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur sm:px-6"
            style={{
              background: "rgba(10,18,38,.88)",
              borderColor: "rgba(255,255,255,.08)",
            }}
          >
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              className="shrink-0 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Abrir el menú"
            >
              <Icono nombre="menu" className="h-5 w-5" />
            </button>

            <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-white">
              {enMostrador ? "Modo mostrador" : (actual?.etiqueta ?? "Panel")}
            </p>

            {/* Modo mostrador: el equivalente nuestro del "Staff Mode".
                Deja la pantalla en el escáner y nada más — es lo que se
                le pasa al empleado en la caja. Solo aparece si quien
                mira puede acreditar. */}
            {mostrador && (
              <label className="flex shrink-0 cursor-pointer items-center gap-2">
                <span className="hidden text-[12px] font-bold text-white/60 sm:block">
                  Modo mostrador
                </span>
                <input
                  type="checkbox"
                  checked={enMostrador}
                  onChange={(e) => setEnMostrador(e.target.checked)}
                  className="peer sr-only"
                />
                {/* El interruptor se pinta con el estado de React y no
                    con `peer-checked:`: la perilla es NIETA del input,
                    no su hermana, y la variante de Tailwind solo
                    alcanza hermanos. */}
                <span
                  aria-hidden
                  className="relative h-[22px] w-[40px] rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white/50"
                  style={{ background: enMostrador ? NARANJA : "rgba(255,255,255,.15)" }}
                >
                  <span
                    className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white transition-transform ${
                      enMostrador ? "translate-x-[18px]" : ""
                    }`}
                  />
                </span>
              </label>
            )}

            <Link
              href="/cuenta"
              title={usuario.email}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11.5px] font-extrabold text-white/80 hover:text-white"
              style={{ borderColor: "rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)" }}
            >
              {iniciales(usuario.nombre) || "?"}
            </Link>

            <Link href="/lealtad" className="hidden shrink-0 sm:block">
              <Image
                src="/logo-bookea-blanco-v3.png"
                alt="Bookea"
                width={92}
                height={23}
                className="h-[19px] w-auto opacity-70"
              />
            </Link>
          </header>

          <main className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-[1080px]">
              {/* El mostrador se monta SOLO al encenderlo: arrastra el
                  escáner (jsQR + cámara), y cargarlo escondido en cada
                  visita al panel es peso que casi nadie usa. */}
              {mostrador && enMostrador && (
                <section>
                  {mostrador}
                  <button
                    type="button"
                    onClick={() => setEnMostrador(false)}
                    className="mt-4 w-full rounded-2xl border px-5 py-3 text-[13px] font-bold text-white/70 hover:text-white"
                    style={{ borderColor: "rgba(255,255,255,.16)" }}
                  >
                    Salir del modo mostrador
                  </button>
                </section>
              )}

              {items.map((item) => (
                <section key={item.id} hidden={enMostrador || item.id !== efectiva}>
                  {contenidos[item.id]}
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
