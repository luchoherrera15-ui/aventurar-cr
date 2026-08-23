"use client";

import { useState } from "react";
import {
  TIPOS_TARJETA_LISTA,
  TIPOS_TARJETA,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { tiposDelPlan, planQueDesbloquea } from "@/lib/lealtad/planes";
import { FICHAS } from "./contenido-tipos";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";
import TelefonoMockup, { PantallaWallet } from "./telefono-mockup";

/**
 * "ELEGÍ QUÉ GUARDAN EN EL TELÉFONO" — el selector de los ocho tipos.
 *
 * Antes esta sección era una grilla de 4 cards estáticas (de las ocho
 * que el producto en realidad tiene). El pedido fue explícito: que
 * elegir un tipo cambie el mockup del teléfono, la explicación y el
 * ejemplo — "Bookea se adapta a tu negocio" contado, no solo dicho.
 *
 * Los datos NO se inventan acá: `FICHAS` (contenido-tipos.ts) y
 * `TelefonoMockup`/`PantallaWallet` (telefono-mockup.tsx) son las MISMAS
 * piezas que ya arma el creador — cambiar de pestaña acá es literalmente
 * lo que el dueño de negocio ve al elegir un tipo en `/lealtad/crear`.
 *
 * El cross-fade es el mismo patrón de fase con `setTimeout` que ya usan
 * mockup-anuncios.tsx y mockup-rescate.tsx en esta misma página: no hay
 * librería de motion nueva, y la duración (`--duracion-card`, 300ms) y
 * la curva (`--ease-bookea`) son las del sistema.
 *
 * ------------------------------------------------------------------
 * EN PC, LA VISTA PREVIA SE ESCONDE HASTA QUE SE LA PIDE
 * ------------------------------------------------------------------
 * Pedido del dueño (ago 2026): que la lista de tabs sea lo primero que
 * se vea, sin el teléfono compitiendo al lado, y que el teléfono
 * aparezca deslizando desde la derecha al pasar el mouse. Se resuelve
 * con CSS puro (`group-hover`/`group-focus-within` sobre el contenedor
 * entero, ida y vuelta con :hover — nada de JS midiendo si el mouse
 * "sigue adentro"): a partir de `lg` la columna de la derecha nace en
 * opacity-0 y se revela al pasar el mouse por CUALQUIER parte del
 * bloque (la lista Y la vista previa ya revelada, no solo la lista),
 * así que mover el cursor hacia el teléfono no lo hace desaparecer.
 * `group-focus-within` hace lo mismo para quien navega con teclado —
 * mismo criterio que el menú "Industrias" de nav-lealtad.tsx.
 *
 * En el teléfono no hay hover: ahí la vista previa se queda SIEMPRE
 * visible, debajo de la lista, tal como estaba antes — por eso todas
 * las clases que la esconden llevan el prefijo `lg:`.
 */

export default function SelectorTiposLanding() {
  const [tipo, setTipo] = useState<TipoTarjeta>("sellos");
  const [visible, setVisible] = useState(true);
  const tiposGratis = tiposDelPlan("prueba");

  function elegir(siguiente: TipoTarjeta) {
    if (siguiente === tipo) return;
    setVisible(false);
    window.setTimeout(() => {
      setTipo(siguiente);
      setVisible(true);
    }, 180);
  }

  const def = TIPOS_TARJETA[tipo];
  const ficha = FICHAS[tipo];
  const puedeDestacado = ficha.puede.slice(0, 3);

  return (
    <div className="group/tabs grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-12">
      {/* ── La lista: ocho filas en una sola card con divisores finos ──
          Mismo lenguaje que el resto del rediseño: card con borde de 1px,
          radio 16px, sin sombra en reposo. Cada fila es clickeable y
          cambia la vista previa de la derecha — no es una lista pasiva. */}
      <div
        role="radiogroup"
        aria-label="Tipo de tarjeta"
        className="overflow-hidden rounded-2xl border border-aventurea-line bg-white"
      >
        {TIPOS_TARJETA_LISTA.map((t, i) => {
          const elegido = t.id === tipo;
          const gratis = tiposGratis.includes(t.id);
          const abre = !gratis ? planQueDesbloquea(t.id) : null;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={elegido}
              onClick={() => elegir(t.id)}
              onMouseEnter={() => elegir(t.id)}
              onFocus={() => elegir(t.id)}
              className={`flex w-full items-center gap-3 border-b border-aventurea-line px-4 py-3.5 text-left transition-colors last:border-b-0 ${
                elegido
                  ? "bg-[color:var(--accion-suave)]"
                  : "hover:bg-aventurea-cream-2/60"
              }`}
            >
              <span className="w-5 shrink-0 text-[11.5px] font-bold text-aventurea-ink-soft/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors"
                style={{
                  background: elegido ? "var(--accion)" : "var(--accion-suave)",
                  color: elegido
                    ? "var(--accion-tinta)"
                    : "var(--accion-fuerte)",
                }}
              >
                <Icono nombre={t.icono as NombreIcono} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-extrabold text-aventurea-navy">
                  {t.nombre}
                </span>
                <span className="block truncate text-[12px] text-aventurea-ink-soft">
                  {t.descripcion}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  gratis
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[color:var(--accion-suave)] text-[color:var(--accion-fuerte)]"
                }`}
              >
                {gratis ? "Gratis" : `Desde ${abre?.nombre}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── La vista previa: escondida en PC hasta que se la pide ─────
          `lg:opacity-0 lg:translate-x-6 lg:scale-[.97]` es el estado de
          reposo; `group-hover/tabs:` y `group-focus-within/tabs:` (con
          el mismo prefijo `lg:`) son lo único que la revela — pasar el
          mouse por CUALQUIER parte del bloque, lista o vista previa ya
          revelada, no solo la lista. En el teléfono no hay `lg:`, así
          que queda siempre visible, como estaba. */}
      <div
        className="pointer-events-none opacity-100 translate-x-0 scale-100 transition-all lg:pointer-events-auto lg:opacity-0 lg:translate-x-6 lg:scale-[.97] lg:group-hover/tabs:pointer-events-auto lg:group-hover/tabs:opacity-100 lg:group-hover/tabs:translate-x-0 lg:group-hover/tabs:scale-100 lg:group-focus-within/tabs:pointer-events-auto lg:group-focus-within/tabs:opacity-100 lg:group-focus-within/tabs:translate-x-0 lg:group-focus-within/tabs:scale-100"
        style={{
          transitionDuration: "var(--duracion-card)",
          transitionTimingFunction: "var(--ease-bookea)",
        }}
      >
        <div
          className="rounded-2xl border border-aventurea-line bg-white p-6 transition-opacity sm:p-7"
          style={{
            opacity: visible ? 1 : 0,
            transitionDuration: "var(--duracion-card)",
            transitionTimingFunction: "var(--ease-bookea)",
          }}
        >
          <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--accion)]">
                {def.nombre}
              </p>
              <h3 className="titulo mt-2 text-[22px] leading-tight text-aventurea-navy sm:text-[26px]">
                {ficha.gancho}
              </h3>
              <p className="mt-2.5 text-[13.5px] font-bold text-aventurea-ink-soft">
                {ficha.paraQuien}
              </p>

              <ul className="mt-5 flex flex-col gap-3.5">
                {puedeDestacado.map((c) => (
                  <li key={c.titulo} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                      style={{
                        background: "var(--accion-suave)",
                        color: "var(--accion-fuerte)",
                      }}
                    >
                      <Icono
                        nombre={c.icono as NombreIcono}
                        className="h-3.5 w-3.5"
                      />
                    </span>
                    <div>
                      <p className="text-[13px] font-extrabold text-aventurea-navy">
                        {c.titulo}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-aventurea-ink-soft">
                        {c.texto}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center">
              <TelefonoMockup>
                <PantallaWallet
                  negocio={ficha.negocio}
                  colores={ficha.colores}
                  arriba={ficha.arriba}
                  valor={ficha.valor}
                  abajo={ficha.abajo}
                  foto={ficha.foto}
                  sellos={def.id === "sellos" ? [7, 10] : undefined}
                  detalle={ficha.detalle}
                  movimientos={ficha.movimientos}
                />
              </TelefonoMockup>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
