"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hrefDeDestino, type Puerta } from "./taxonomia-navegacion";
import { IconChevronDown } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS CATEGORÍAS EN EL TELÉFONO — un cajón, no el mega menú encogido
 * ════════════════════════════════════════════════════════════════════
 *
 * El pedido del dueño fue explícito: «NO hacer simplemente un responsive
 * automático. Diseñar la experiencia mobile específicamente.»
 *
 * Y tiene razón por una cuestión física: el panel del mega menú son
 * cuatro columnas ancladas a un contenedor de 1120px. Encogerlo a 360px
 * lo convierte en una lista de ochenta líneas con títulos intercalados,
 * que es exactamente el menú que nadie recorre.
 *
 * Acá el recorrido es de DOS NIVELES, que es como funciona un teléfono:
 *
 *   1. Se abre el cajón y se ven las CINCO puertas. Nada más.
 *   2. Se toca una y se despliegan sus columnas, en acordeón, con la
 *      puerta tocada quedando arriba.
 *
 * Una sola abierta a la vez: con dos abiertas, la segunda queda debajo
 * del pliegue y el pulgar tiene que hacer scroll a ciegas.
 *
 * ── POR QUÉ UN <dialog> Y NO UN <div> ───────────────────────────────
 *
 * `showModal()` da gratis cuatro cosas que a mano salen mal: el foco
 * atrapado adentro, Escape que cierra, el resto de la página inerte para
 * el lector de pantalla, y el fondo oscuro sin una capa propia. Lo único
 * que hay que agregar es cerrar al tocar afuera.
 */
export default function CajonNavMovil({ puertas }: { puertas: Puerta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  // `showModal()` es imperativo: no hay forma declarativa de abrir un
  // <dialog> modal en React, así que el estado manda sobre el elemento.
  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setExpandida(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-expanded={abierto}
        aria-label="Abrir las categorías"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-aventurea-line bg-white text-aventurea-ink transition-colors hover:border-[color:var(--navy)] lg:hidden"
      >
        <span aria-hidden className="flex flex-col gap-[3.5px]">
          <span className="block h-[2px] w-[18px] rounded-full bg-current" />
          <span className="block h-[2px] w-[18px] rounded-full bg-current" />
          <span className="block h-[2px] w-[18px] rounded-full bg-current" />
        </span>
      </button>

      <dialog
        ref={dialogo}
        onClose={cerrar}
        // Cerrar al tocar el fondo: el clic sobre `::backdrop` llega al
        // propio <dialog>, así que alcanza con comprobar que el objetivo
        // sea el diálogo y no algo de adentro.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
        className="anim-cajon-nav m-0 ml-auto h-dvh max-h-none w-[min(400px,88vw)] max-w-none bg-white p-0 backdrop:bg-black/45"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-aventurea-line px-5">
            <span className="text-[13px] font-bold uppercase tracking-[0.10em] text-aventurea-ink-soft">
              Categorías
            </span>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
            >
              <span aria-hidden className="text-[20px] leading-none">
                ×
              </span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {puertas.map((puerta) => {
              const estaExpandida = expandida === puerta.id;
              return (
                <div key={puerta.id} className="border-b border-aventurea-line last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={estaExpandida}
                    onClick={() => setExpandida(estaExpandida ? null : puerta.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-4 text-left text-[16px] font-extrabold text-aventurea-ink"
                  >
                    {puerta.label}
                    <IconChevronDown
                      aria-hidden
                      className={`h-4 w-4 shrink-0 text-aventurea-ink-soft transition-transform duration-200 ${
                        estaExpandida ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {estaExpandida && (
                    <div className="pb-3">
                      {puerta.columnas.map((columna) => (
                        <div key={columna.id} className="mb-3 last:mb-0">
                          <p className="px-3 text-[11.5px] font-bold uppercase tracking-[0.10em] text-aventurea-ink-soft">
                            {columna.titulo}
                          </p>
                          <ul className="mt-1">
                            {columna.entradas.map((entrada) => {
                              const href = hrefDeDestino(entrada.destino);
                              if (!href) return null;
                              return (
                                <li key={entrada.id}>
                                  <Link
                                    href={href}
                                    onClick={cerrar}
                                    // 44px de alto: el mínimo táctil.
                                    // Una lista de rubros con filas de
                                    // 32px se toca mal justo cuando se
                                    // usa de pie y con una mano.
                                    className="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] font-semibold text-aventurea-ink active:bg-aventurea-cream-2"
                                  >
                                    {entrada.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}

                      <Link
                        href={puerta.ruta}
                        onClick={cerrar}
                        className="flex min-h-[44px] items-center px-3 text-[14px] font-extrabold text-[color:var(--navy)]"
                      >
                        Explorar todo {puerta.label} <span aria-hidden>&nbsp;→</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-aventurea-line p-4">
            <Link
              href="/publicar"
              onClick={cerrar}
              className="presionable flex min-h-[48px] items-center justify-center rounded-2xl text-[15px] font-extrabold text-white"
              style={{ background: "var(--orange)" }}
            >
              Publicá tu negocio gratis
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
