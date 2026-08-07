"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ahorroPack,
  descuentoPct,
  FAMILIA_LABEL,
  PACKS_INVITACIONES,
  PRODUCTOS_INDIVIDUALES,
  PROMO_INVITACIONES,
  sueltoPack,
  type ProductoIndividual,
} from "@/lib/paquetes-invitaciones";

/**
 * El bloque de precios de /invitaciones.
 *
 * Lo que se ve de entrada son los PRODUCTOS SUELTOS, agrupados por
 * familia (álbumes, invitaciones, save the date) — pedido del dueño:
 * la lista de precios primero, sin empujar un paquete. Los PACKS
 * (invitación Premium + álbum, más baratos que por separado) viven
 * detrás de un botón "Ver packs" y se despliegan en el sitio, sin
 * navegar a otra página ni perder el scroll.
 *
 * Los precios salen de src/lib/paquetes-invitaciones.ts, que es el
 * espejo de la tabla `paquetes_invitacion` — la que manda en lo que se
 * cobra de verdad.
 */

const ORDEN_FAMILIAS: ProductoIndividual["familia"][] = [
  "album",
  "invitacion",
  "save_the_date",
];

export default function PreciosCatalogo({
  /** El equivalente en colones de $1, para el "≈ ₡" bajo cada precio. */
  colonesPorUSD,
}: {
  colonesPorUSD: number;
}) {
  const [verPacks, setVerPacks] = useState(false);

  const enColones = (usd: number) =>
    "₡" + (Math.round((usd * colonesPorUSD) / 100) * 100).toLocaleString("es-CR");

  const hayPromo = PRODUCTOS_INDIVIDUALES.some((p) => p.precioAntesUSD);

  return (
    <div className="mt-12">
      {/* El aviso de la promo: la fecha sale de PROMO_INVITACIONES, no
          escrita a mano, para que no siga anunciándose cuando venza. */}
      {hayPromo && (
        <p className="mb-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-[13.5px] text-white/60">
          <span className="rounded-full bg-[#ee7420] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            {PROMO_INVITACIONES.etiqueta}
          </span>
          Las invitaciones están rebajadas hasta el{" "}
          <span className="font-bold text-white">{PROMO_INVITACIONES.hastaTexto}</span>.
        </p>
      )}

      {/* ---------- Productos individuales ---------- */}
      <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {ORDEN_FAMILIAS.map((familia) => {
          const items = PRODUCTOS_INDIVIDUALES.filter((p) => p.familia === familia);
          if (items.length === 0) return null;
          return (
            <div key={familia}>
              <p className="border-b border-white/15 pb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#ee7420]">
                {FAMILIA_LABEL[familia]}
              </p>
              <ul className="mt-1">
                {items.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/invitaciones/pedido/${p.id}`}
                      className="group flex items-baseline justify-between gap-4 border-b border-white/5 py-3.5 transition-colors hover:border-white/20"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] text-white/75 transition-colors group-hover:text-white">
                          {p.nombre}
                        </span>
                        {p.detalle && (
                          <span className="mt-0.5 block text-[12.5px] leading-snug text-white/35">
                            {p.detalle}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="flex items-baseline justify-end gap-2">
                          {p.precioAntesUSD && (
                            <span className="text-[13px] text-white/30 line-through">
                              ${p.precioAntesUSD}
                            </span>
                          )}
                          <span className="text-[17px] font-bold text-white">
                            ${p.precioUSD}
                          </span>
                        </span>
                        <span className="block text-[11px] text-white/35">
                          ≈ {enColones(p.precioUSD)}
                        </span>
                        {descuentoPct(p) !== null && (
                          <span className="mt-1 inline-block rounded-full bg-[#ee7420] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                            −{descuentoPct(p)}%
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ---------- La puerta a los packs ---------- */}
      <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-10">
        <p className="text-center text-[15px] text-white/55">
          ¿Querés la invitación y el álbum juntos?{" "}
          <span className="font-bold text-white">Los packs salen más baratos.</span>
        </p>
        <button
          type="button"
          onClick={() => setVerPacks((v) => !v)}
          aria-expanded={verPacks}
          className="rounded-full bg-[#ee7420] px-8 py-3.5 text-[14px] font-bold uppercase tracking-[0.12em] text-white transition-transform hover:scale-[1.03]"
        >
          {verPacks ? "Ocultar packs" : "Ver packs"}
        </button>
      </div>

      {verPacks && (
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PACKS_INVITACIONES.map((p) => (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl p-7 ${
                p.destacado
                  ? "bg-white text-[#0a1226] ring-2 ring-[#ee7420]"
                  : "bg-white/[0.06] text-white ring-1 ring-white/10"
              }`}
            >
              <span
                className={`absolute -top-3 left-7 rounded-full px-3.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] ${
                  p.destacado ? "bg-[#ee7420] text-white" : "bg-white/15 text-white"
                }`}
              >
                {p.badge}
              </span>

              <p
                className={`mt-2 text-[13px] font-bold uppercase tracking-[0.16em] ${
                  p.destacado ? "text-[#ee7420]" : "text-white/45"
                }`}
              >
                Pack {p.nombre}
              </p>

              {/* El tachado y el "ahorrás" solo salen si el pack DE VERDAD
                  sale más barato que comprar suelto hoy: durante una promo
                  de las piezas la cuenta puede darse vuelta, y anunciar un
                  ahorro inexistente sería mentirle al cliente. */}
              <p className="mt-3 flex items-baseline gap-2">
                <span className="titulo text-[44px] leading-none">${p.precioUSD}</span>
                {ahorroPack(p) > 0 && (
                  <span
                    className={`text-[14px] line-through ${
                      p.destacado ? "text-[#0a1226]/35" : "text-white/30"
                    }`}
                  >
                    ${sueltoPack(p)}
                  </span>
                )}
              </p>
              <p
                className={`mt-1.5 text-[12.5px] ${
                  p.destacado ? "text-[#0a1226]/50" : "text-white/40"
                }`}
              >
                ≈ {enColones(p.precioUSD)}
                {ahorroPack(p) > 0 && ` · ahorrás $${ahorroPack(p)}`}
              </p>

              <p
                className={`mt-4 text-[14px] leading-relaxed ${
                  p.destacado ? "text-[#0a1226]/70" : "text-white/55"
                }`}
              >
                {p.lema}
              </p>

              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {p.incluye.map((linea) => (
                  <li key={linea} className="flex gap-2.5 text-[13.5px] leading-snug">
                    <span
                      aria-hidden
                      className={`mt-[3px] shrink-0 text-[13px] font-bold ${
                        p.destacado ? "text-[#ee7420]" : "text-[#ee7420]"
                      }`}
                    >
                      ✓
                    </span>
                    <span className={p.destacado ? "text-[#0a1226]/80" : "text-white/70"}>
                      {linea}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/invitaciones/pedido/${p.id}`}
                className={`mt-7 rounded-full py-3.5 text-center text-[14px] font-bold transition-transform hover:scale-[1.02] ${
                  p.destacado
                    ? "bg-[#ee7420] text-white"
                    : "bg-white text-[#0a1226]"
                }`}
              >
                Lo quiero
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
