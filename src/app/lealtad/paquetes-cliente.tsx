"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * LOS PAQUETES, CORTOS.
 *
 * Antes cada tarjeta listaba TODAS sus capacidades — Empresa tenía
 * trece— y la grilla se volvía una columna de scroll infinito donde
 * ninguna tarjeta se podía comparar con la de al lado, porque nunca
 * se veían dos completas a la vez.
 *
 * Ahora cada una muestra CUATRO y esconde el resto detrás de «ver
 * todo». Cuatro alcanza para decidir; el resto es para quien ya
 * decidió y quiere confirmar.
 *
 * ------------------------------------------------------------------
 * POR QUÉ CADA UNA SE EXPANDE SOLA Y NO TODAS JUNTAS
 * ------------------------------------------------------------------
 * Expandir las cinco a la vez devuelve exactamente el problema que
 * esto viene a resolver. Y expandir una sola es lo que la gente hace:
 * dudás entre dos paquetes, abrís ESE, comparás, cerrás.
 */

const NARANJA = "#ee7420";
const VISIBLES = 4;

export type PaqueteCard = {
  id: string;
  nombre: string;
  /** Ya formateado con su moneda. null = a convenir. */
  precio: string | null;
  precioAnual: string | null;
  esGratis: boolean;
  limite: number | null;
  incluye: string[];
  destacado: boolean;
};

export default function PaquetesCliente({ paquetes }: { paquetes: PaqueteCard[] }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {paquetes.map((p) => (
        <Tarjeta key={p.id} p={p} />
      ))}
    </div>
  );
}

function Tarjeta({ p }: { p: PaqueteCard }) {
  const [abierto, setAbierto] = useState(false);

  // Con UNA sola de más no se corta: un botón «ver todo (+1)» que
  // ahorra una línea es más ruido que la línea que esconde.
  const corta = p.incluye.length > VISIBLES + 1;
  const ocultas = corta ? p.incluye.length - VISIBLES : 0;
  const lista = corta && !abierto ? p.incluye.slice(0, VISIBLES) : p.incluye;

  return (
    <div
      data-reveal
      className="flex flex-col rounded-3xl border p-5"
      style={{
        background: p.destacado ? "rgba(238,116,32,.08)" : "rgba(255,255,255,.04)",
        borderColor: p.destacado ? NARANJA : "rgba(255,255,255,.12)",
      }}
    >
      {/* La cinta del destacado ocupa lugar SIEMPRE, aunque esté vacía:
          si solo la tuviera uno, esa tarjeta arrancaría más abajo que
          las otras cuatro y la fila quedaría desalineada. */}
      <p
        className="h-[16px] text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
        style={{ color: NARANJA }}
      >
        {p.destacado ? "El más popular" : ""}
      </p>

      <p className="mt-2 text-[19px] font-extrabold leading-none text-white">{p.nombre}</p>

      <p className="mt-3 text-[26px] font-extrabold leading-none text-white">
        {p.precio === null ? (
          <span className="text-[19px]">A convenir</span>
        ) : (
          <>
            {p.precio}
            {!p.esGratis && <span className="text-[12px] font-bold text-white/45">/mes</span>}
          </>
        )}
      </p>

      <p className="mt-1.5 min-h-[30px] text-[11.5px] leading-snug text-white/45">
        {p.esGratis
          ? "14 días, sin tarjeta"
          : p.precioAnual
            ? `${p.precioAnual} al año — 2 meses gratis`
            : "Cotizado a tu medida"}
      </p>

      <p className="mt-3 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-white/80"
        style={{ background: "rgba(255,255,255,.06)" }}
      >
        {p.limite === null
          ? "Clientes ilimitados"
          : `Hasta ${p.limite.toLocaleString("es-CR")} clientes`}
      </p>

      <ul className="mt-4 flex-1 space-y-2">
        {lista.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[12.5px] leading-snug">
            <span aria-hidden className="mt-[3px] shrink-0" style={{ color: NARANJA }}>
              ✓
            </span>
            <span className="text-white/75">{item}</span>
          </li>
        ))}
      </ul>

      {ocultas > 0 && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="presionable mt-3 self-start text-[12px] font-bold text-white/50 underline underline-offset-2 hover:text-white/85"
        >
          {abierto ? "Ver menos" : `Ver todo (+${ocultas})`}
        </button>
      )}

      <Link
        href="/lealtad/planes"
        className={`presionable mt-5 flex h-11 items-center justify-center rounded-full text-[13.5px] font-extrabold ${
          p.destacado ? "" : "border border-white/22 text-white"
        }`}
        style={p.destacado ? { background: NARANJA, color: "#0a1226" } : undefined}
      >
        {p.esGratis ? "Empezar gratis" : p.precio === null ? "Hablemos" : "Solicitarlo"}
      </Link>
    </div>
  );
}
