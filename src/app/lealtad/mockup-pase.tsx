"use client";

import { useState } from "react";
import "./mockup-pase.css";
import TelefonoMockup from "./telefono-mockup";
import { Icono } from "./panel/[id]/iconos";
import { FICHAS } from "./contenido-tipos";

/**
 * MOCKUP 1 — el pase que se actualiza solo.
 *
 * Client Component chico y aislado (el selector Apple/Google necesita
 * estado), pero el cuento de adentro —el séptimo sello apareciendo y
 * la notificación— es 100% CSS en loop (ver mockup-pase.css): no hay
 * timers de JavaScript que puedan quedar desincronizados ni layout
 * shift mientras se espera a que algo cargue. El HTML nace completo
 * —con el sello puesto y la notificación en su sitio, ver el bloque
 * `prefers-reduced-motion` del CSS— así que no hay nada que "esperar"
 * para leer la tarjeta.
 *
 * Usa la MISMA ficha que el resto del sitio (Café La Esquina, de
 * contenido-tipos.ts) para no inventar un negocio de más.
 */

const NARANJA = "#ee7420";
const ficha = FICHAS.sellos;

const PLATAFORMAS = [
  { id: "apple" as const, label: "Apple Wallet" },
  { id: "google" as const, label: "Google Wallet" },
];

export default function MockupPase() {
  const [plataforma, setPlataforma] = useState<"apple" | "google">("apple");

  return (
    <div className="relative">
      {/* ── El selector ─────────────────────────────────────────────
          Grupo de botones simple (aria-pressed), no un tablist: acá no
          hay paneles distintos que mostrar u ocultar por plataforma
          —el pase de abajo es el mismo—, así que el patrón ARIA de
          pestañas (con su navegación por flechas) no aplica; hubiera
          sido semántica incorrecta por parecerse visualmente. */}
      <div
        role="group"
        aria-label="Vista previa por plataforma"
        className="mx-auto mb-5 flex w-fit gap-1 rounded-full border border-white/15 p-1"
        style={{ background: "rgba(255,255,255,.05)" }}
      >
        {PLATAFORMAS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={plataforma === p.id}
            onClick={() => setPlataforma(p.id)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors"
            style={
              plataforma === p.id
                ? { background: NARANJA, color: "#0a1226" }
                : { color: "rgba(255,255,255,.55)" }
            }
          >
            <Icono nombre="tarjeta" className="h-[13px] w-[13px]" />
            {p.label}
          </button>
        ))}
      </div>

      <TelefonoMockup>
        <div className="flex h-full flex-col" style={{ background: "#0a1226" }}>
          {/* Barra de estado */}
          <div className="flex items-center justify-between px-5 pt-[11px] text-white">
            <span className="text-[9px] font-semibold">9:41</span>
            <span className="flex items-center gap-[3px]" aria-hidden>
              {[3, 5, 7, 9].map((h) => (
                <span key={h} className="w-[2px] rounded-sm bg-white" style={{ height: h }} />
              ))}
              <span className="ml-[3px] h-[8px] w-[14px] rounded-[2px] border border-white/70">
                <span className="block h-full w-[70%] rounded-[1px] bg-white" />
              </span>
            </span>
          </div>

          <p className="mt-4 px-5 text-[15px] font-extrabold text-white">
            {plataforma === "apple" ? "Cartera" : "Google Wallet"}
          </p>

          {/* ── La notificación, flotando arriba del pase ─────────── */}
          <div className="relative px-3">
            <div
              aria-hidden
              className="mp-anim-banner absolute left-3 right-3 top-1 z-10 flex items-center gap-2 rounded-xl px-3 py-2.5 shadow-[0_12px_24px_-8px_rgba(0,0,0,.6)]"
              style={{ background: "#ffffff" }}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                style={{ background: NARANJA }}
              >
                <Icono nombre="listo" className="h-3.5 w-3.5 text-[#0a1226]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[9.5px] font-extrabold text-[#0a1226]">
                  {ficha.negocio}
                </span>
                <span className="block truncate text-[8.5px] text-[#0a1226]/60">
                  Sello agregado — te faltan 3 para tu café
                </span>
              </span>
            </div>
          </div>

          {/* El pase */}
          <div className="mt-3 px-3">
            <div
              className="overflow-hidden rounded-[16px]"
              style={{ background: ficha.colores[0], boxShadow: "0 10px 24px -8px rgba(0,0,0,.6)" }}
            >
              <div className="relative h-[52px] w-full overflow-hidden">
                <span
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${ficha.foto})`, filter: "saturate(.8) brightness(.5)" }}
                />
                <span
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to bottom, ${ficha.colores[0]}44, ${ficha.colores[0]} 100%)` }}
                />

                {/* El indicador de "escaneando", sobre la foto */}
                <span
                  aria-hidden
                  className="mp-anim-scan absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: "rgba(10,18,38,.7)" }}
                >
                  <span
                    aria-hidden
                    className="mp-anim-ping absolute h-6 w-6 rounded-full"
                    style={{ border: `1.5px solid ${NARANJA}` }}
                  />
                  <Icono nombre="escanear" className="h-3 w-3 text-white" />
                </span>
              </div>

              <div className="relative px-3 pb-3 pt-2">
                <p className="truncate text-[9px] font-medium text-white/85">{ficha.negocio}</p>
                <p className="mt-2 text-[6.5px] uppercase tracking-[0.18em] text-white/50">SELLOS</p>
                <p className="text-[19px] font-extrabold leading-none text-white">7/10</p>
                <p className="mt-1 text-[7.5px] leading-snug text-white/60">
                  Te faltan 3 para tu café
                </p>

                <div className="mt-2.5 flex flex-wrap gap-[3px]">
                  {Array.from({ length: 10 }, (_, i) => {
                    const esElNuevo = i === 6; // el séptimo (índice 6)
                    return (
                      <span
                        key={i}
                        aria-hidden
                        className={esElNuevo ? "mp-anim-pop" : ""}
                        style={{
                          display: "block",
                          height: 11,
                          width: 11,
                          borderRadius: 999,
                          background: NARANJA,
                          opacity: i < 6 ? 1 : esElNuevo ? undefined : 0.18,
                        }}
                      />
                    );
                  })}
                </div>

                {/* El "+1" flotante */}
                <span
                  aria-hidden
                  className="mp-anim-badge pointer-events-none absolute right-3 top-[74px] rounded-full px-2 py-0.5 text-[8px] font-extrabold"
                  style={{ background: NARANJA, color: "#0a1226" }}
                >
                  +1
                </span>
              </div>
            </div>
          </div>

          <p className="mt-auto px-5 pb-4 pt-3 text-center text-[7px] leading-snug text-white/35">
            Se actualiza sola en cada visita
          </p>
        </div>
      </TelefonoMockup>
    </div>
  );
}
