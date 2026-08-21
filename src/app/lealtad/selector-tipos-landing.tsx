"use client";

import { useState } from "react";
import { TIPOS_TARJETA_LISTA, TIPOS_TARJETA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
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
 */

const TAG_PLAN_GRATIS = { texto: "Gratis", clase: "bg-emerald-50 text-emerald-700" };

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
    <div>
      {/* ── El selector: ocho pastillas, siempre las ocho visibles ─── */}
      <div
        role="radiogroup"
        aria-label="Tipo de tarjeta"
        className="flex flex-wrap justify-center gap-2"
      >
        {TIPOS_TARJETA_LISTA.map((t) => {
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
              className={`presionable flex items-center gap-2 rounded-full border px-3.5 py-2 text-left transition-colors ${
                elegido
                  ? "border-transparent"
                  : "border-aventurea-line bg-white hover:border-[color:var(--accion)]"
              }`}
              style={elegido ? { background: "var(--accion)" } : undefined}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                style={
                  elegido
                    ? { background: "rgba(255,255,255,.2)", color: "var(--accion-tinta)" }
                    : { background: "var(--accion-suave)", color: "var(--accion-fuerte)" }
                }
              >
                <Icono nombre={t.icono as NombreIcono} className="h-3.5 w-3.5" />
              </span>
              <span
                className={`text-[13px] font-extrabold ${elegido ? "" : "text-aventurea-navy"}`}
                style={elegido ? { color: "var(--accion-tinta)" } : undefined}
              >
                {t.nombre}
              </span>
              {!elegido && (
                <span
                  className={`rounded-full px-1.5 py-[1px] text-[9.5px] font-extrabold uppercase tracking-wide ${
                    gratis ? TAG_PLAN_GRATIS.clase : "bg-[color:var(--accion-suave)] text-[color:var(--accion-fuerte)]"
                  }`}
                >
                  {gratis ? "Gratis" : `Desde ${abre?.nombre}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── El contenido: teléfono + explicación, cambian juntos ───── */}
      <div
        className="mt-10 grid items-center gap-10 transition-opacity lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16"
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: "var(--duracion-card)",
          transitionTimingFunction: "var(--ease-bookea)",
        }}
      >
        <div className="order-2 lg:order-1">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--accion)]">
            {def.nombre}
          </p>
          <h3 className="titulo mt-2 text-[24px] leading-tight text-aventurea-navy sm:text-[28px]">
            {ficha.gancho}
          </h3>
          <p className="mt-3 text-[14px] font-bold text-aventurea-ink-soft">{ficha.paraQuien}</p>

          <ul className="mt-6 flex flex-col gap-4">
            {puedeDestacado.map((c) => (
              <li key={c.titulo} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                  style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
                >
                  <Icono nombre={c.icono as NombreIcono} className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13.5px] font-extrabold text-aventurea-navy">{c.titulo}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                    {c.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 flex justify-center lg:order-2">
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
  );
}
