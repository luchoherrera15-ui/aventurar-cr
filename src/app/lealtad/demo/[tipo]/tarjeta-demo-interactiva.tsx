"use client";

import { useState } from "react";
import Link from "next/link";
import { PaseWallet } from "@/app/lealtad/pase-wallet";
import { ETIQUETA_MODO, type Demo } from "../datos-demos";

const NAVY_PROFUNDO = "#0a1226";
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const ACENTO = "var(--orange)";

/**
 * EL PITCH + LA TARJETA, INTERACTIVOS — separado de `page.tsx` (que
 * sigue siendo un Server Component) porque cambiar de pestaña necesita
 * estado en el cliente. Cada rubro trae 2 `variantes` (Sellos,
 * Cashback o Puntos, según cuál tenga más sentido para ESE negocio) y
 * el visitante las compara tocando la pestaña — la regla, la regalía,
 * el h1 y la tarjeta entera cambian juntos, no solo el número.
 *
 * El `key={i}` en el envoltorio de la narración+tarjeta remonta ese
 * bloque al cambiar de pestaña: así la secuencia "¿Cómo funciona? → la
 * regla → ¡Fidelizás!→ la tarjeta" arranca de cero cada vez, en vez de
 * quedarse a mitad de una animación que ya había terminado.
 */
export default function TarjetaDemoInteractiva({ demo }: { demo: Demo }) {
  const [i, setI] = useState(0);
  const v = demo.variantes[i];
  const total = v.total ?? 0;
  const columnas = total > 10 ? 6 : 5;

  return (
    <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
      {/* ── El pitch ── */}
      <div>
        {/* Las pestañas: filtros que cambian qué modo se ve, no una
            navegación con flechas — mismo criterio que ya usa
            `SelectorFranja` para sus chips de rubro. */}
        <div role="group" aria-label="Tipo de tarjeta" className="mb-4 inline-flex gap-1 rounded-full border border-white/12 p-1">
          {demo.variantes.map((variante, idx) => {
            const activa = idx === i;
            return (
              <button
                key={variante.modo}
                type="button"
                onClick={() => setI(idx)}
                aria-pressed={activa}
                className="presionable rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors"
                style={activa ? { background: ACCION, color: ACCION_TINTA } : { color: "rgba(255,255,255,.55)" }}
              >
                {ETIQUETA_MODO[variante.modo]}
              </button>
            );
          })}
        </div>

        <span
          className="block w-fit rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ background: "rgba(157,180,255,.14)", color: ACCION }}
        >
          Demo · {demo.categoria}
        </span>
        <h1 className="titulo mt-4 text-[clamp(28px,4.5vw,44px)] leading-[1.08] text-white">
          {v.modo === "cashback"
            ? "Devolveles un % de lo que gastan"
            : `Así podría funcionar en tu ${demo.categoria.toLowerCase().replace(/s$/, "")}`}
        </h1>
        <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-white/60">
          <strong className="text-white">{demo.negocio}</strong> no existe — es el
          ejemplo. Tu tarjeta llevaría tu nombre, tus colores y tu regalía.
        </p>

        <div className="mt-6 grid gap-2.5">
          <div className="rounded-xl border border-white/12 px-4 py-3" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">La regla</p>
            <p className="mt-0.5 text-[13.5px] font-bold text-white">{v.regla}</p>
          </div>
          <div className="rounded-xl border border-white/12 px-4 py-3" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">
              {v.modo === "cashback" ? "Qué gana tu cliente" : "La regalía"}
            </p>
            <p className="mt-0.5 text-[13.5px] font-bold text-white">{v.regalia}</p>
          </div>
        </div>

        <ol className="mt-6 grid gap-3">
          {demo.pasos.map((p, idx) => (
            <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-white/70">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                style={{ background: ACENTO, color: "#0a1226" }}
              >
                {idx + 1}
              </span>
              {p}
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/lealtad/crear"
            className="rounded-full px-6 py-3 text-[14px] font-bold transition-transform hover:scale-[1.02]"
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            Quiero esto en mi negocio
          </Link>
          <Link
            href="/lealtad/planes"
            className="rounded-full border border-white/25 px-6 py-3 text-[14px] font-bold text-white/85 hover:border-white/50"
          >
            Ver los paquetes
          </Link>
        </div>

        {/* La prueba de que esto no es una maqueta: un local de la
            misma categoría, publicado y con su carta puesta. Va
            DEBAJO y en texto, no en botón — el llamado comercial
            sigue siendo «Quiero esto en mi negocio». */}
        {demo.ejemplo && (
          <p className="mt-4 text-[13px] text-white/45">
            <Link
              href={demo.ejemplo.href}
              className="font-bold text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              {demo.ejemplo.texto} →
            </Link>{" "}
            — ese sí existe, con su carta y sus precios.
          </p>
        )}
      </div>

      {/* ── La tarjeta de ejemplo, con una narración animada que la
          antecede: "¿Cómo funciona?" → la regla → el pago emocional →
          recién ahí el pase. El `key={i}` reinicia toda la secuencia
          cada vez que se cambia de pestaña. */}
      <div key={i} className="mx-auto w-full max-w-[340px]">
        <p
          className="entra-suave text-center text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: ACCION }}
        >
          ¿Cómo funciona?
        </p>
        <p
          className="entra-suave mt-2 text-center text-[15.5px] font-bold leading-snug text-white"
          style={{ animationDelay: "650ms" }}
        >
          {v.regla}
        </p>
        <p
          className="entra-suave mt-1.5 text-center text-[13px] font-extrabold"
          style={{ animationDelay: "1450ms", color: ACENTO }}
        >
          ¡Fidelizás a tu cliente!
        </p>

        <div className="entra-suave mt-5" style={{ animationDelay: "2250ms" }}>
          <PaseWallet
            marca="apple"
            negocio={demo.negocio}
            foto={demo.foto}
            etiquetaCampo={v.etiquetaCampo}
            valorCampo={v.valor}
            colorFondo={NAVY_PROFUNDO}
            serial="BK · DEMO 0000"
          >
            {v.modo === "sellos" ? (
              <div
                className="grid gap-2 pb-1"
                style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: total }, (_, idx) => {
                  const ganado = idx < (v.logrados ?? 0);
                  return (
                    /* El sello GANADO lleva el ícono del rubro — no una
                       palomita genérica: es lo mismo que vería un
                       cliente de verdad en su Wallet (mismo banco de
                       íconos que el creador, `iconos-sello.ts`). El
                       naranja hace trabajo funcional acá — distingue
                       lleno de vacío —, y el ícono en navy sobre
                       naranja da 2,35:1 de contraste, como ya medía la
                       palomita que reemplaza. */
                    <span
                      key={idx}
                      className="flex aspect-square items-center justify-center rounded-full"
                      style={
                        ganado
                          ? { background: ACENTO, color: "#0a1226" }
                          : { border: "2px dashed rgba(255,255,255,.3)" }
                      }
                    >
                      {ganado && (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {demo.iconoSello.map((d) => (
                            <path key={d} d={d} />
                          ))}
                        </svg>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              /* Cashback y puntos no tienen sellos que dibujar: lo que
                 importa es el saldo y qué se hace con él. */
              <div className="pb-1">
                <p className="text-[26px] font-extrabold leading-none text-white">{v.valor}</p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-white/70">{v.detalle}</p>
              </div>
            )}
          </PaseWallet>
          <p className="mt-3 text-center text-[11.5px] text-white/40">
            Apple Wallet y Google Wallet — se actualiza sola en cada visita.
          </p>
        </div>
      </div>
    </div>
  );
}
